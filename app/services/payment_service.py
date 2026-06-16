"""Payment orchestration service — owns business logic for all payment flows.

Keeps route handlers thin by extracting validation, audit logging, wallet updates,
and M-Pesa integration into a single reusable layer.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import PaymentMethod, PaymentStatus
from app.exceptions import NotFoundError, PaymentError, ValidationError
from app.timezone import eat_now

from ..crud import advance as crud_advance
from ..crud import audit as crud_audit
from ..crud import payment as crud_payment
from ..crud import payroll as crud_payroll
from ..crud import wallet as crud_wallet
from ..models.advance import Advance
from ..models.payroll import Payroll
from ..models.payment import MpesaTransaction
from ..models.worker import Worker
from ..services.mpesa import MpesaClient, MpesaError, format_phone

logger = logging.getLogger(__name__)


# ── Shared result types ──


@dataclass
class PaymentResult:
    """Result of a single payment attempt."""

    entity_id: int
    success: bool
    transaction_id: Optional[int] = None
    status: str = ""
    error: Optional[str] = None


@dataclass
class BulkPaymentResult:
    """Result of a bulk payment attempt."""

    total: int
    succeeded: int
    failed: int
    results: list[dict]
    errors: list[dict]


# ── Helpers ──


def _worker_name(worker: Optional[Worker], fallback: str) -> str:
    return worker.name if worker else fallback


async def _resolve_worker(session: AsyncSession, worker_id: int) -> Worker:
    worker = await session.get(Worker, worker_id)
    if not worker:
        raise NotFoundError(f"Worker #{worker_id} not found")
    return worker


async def _validate_payroll_ready(session: AsyncSession, payroll_id: int) -> tuple[Payroll, Worker]:
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        raise NotFoundError("Payroll record not found")
    if payroll.payment_status in (PaymentStatus.processing.value, PaymentStatus.paid.value):
        raise ValidationError(f"Payroll already {payroll.payment_status}")
    if payroll.net_pay <= 0:
        raise ValidationError("Net pay must be greater than zero")
    worker = await _resolve_worker(session, payroll.worker_id)
    return payroll, worker


async def _validate_advance_ready(session: AsyncSession, advance_id: int) -> tuple[Advance, Worker]:
    advance = await session.get(Advance, advance_id)
    if not advance:
        raise NotFoundError("Advance not found")
    if not advance.approved:
        raise ValidationError("Advance must be approved before payment")
    if advance.payment_status in (PaymentStatus.processing.value, PaymentStatus.paid.value):
        raise ValidationError(f"Advance already {advance.payment_status}")
    worker = await _resolve_worker(session, advance.worker_id)
    return advance, worker


# ── Single cash payment ──


async def pay_payroll_cash(
    session: AsyncSession,
    payroll_id: int,
    current_user_id: int,
) -> str:
    """Mark a single payroll as paid in cash. Returns worker name."""
    payroll, worker = await _validate_payroll_ready(session, payroll_id)

    if payroll.payment_method != PaymentMethod.cash.value:
        raise ValidationError("Payroll is set to M-Pesa, not cash")

    worker_name = _worker_name(worker, f"#{payroll.worker_id}")
    payroll.payment_status = PaymentStatus.paid.value
    payroll.paid_at = eat_now()

    await crud_wallet.add_payout(
        session,
        worker_id=payroll.worker_id,
        amount=payroll.net_pay,
        reference_type="payroll",
        reference_id=payroll.id,
        description=f"Cash payment — week {payroll.week_start}",
    )

    await crud_audit.log_action(
        session, current_user_id, "cash_paid",
        f"{worker_name} — {payroll.net_pay:.0f} KES cash",
    )
    return worker_name


async def pay_advance_cash(
    session: AsyncSession,
    advance_id: int,
    current_user_id: int,
) -> str:
    """Mark a single advance as paid in cash. Returns worker name."""
    advance, worker = await _validate_advance_ready(session, advance_id)

    if advance.payment_method != PaymentMethod.cash.value:
        raise ValidationError("Advance is set to M-Pesa, not cash")

    worker_name = _worker_name(worker, f"#{advance.worker_id}")
    advance.payment_status = PaymentStatus.paid.value
    advance.paid_at = eat_now()

    await crud_wallet.add_advance(
        session,
        worker_id=advance.worker_id,
        amount=advance.amount,
        reference_type="advance",
        reference_id=advance.id,
        description=advance.notes or f"Cash advance payment — advance #{advance_id}",
    )

    await crud_audit.log_action(
        session, current_user_id, "cash_advance_paid",
        f"{worker_name} — {advance.amount:.0f} KES cash (advance #{advance_id})",
    )
    return worker_name


# ── Single M-Pesa payment ──


async def pay_payroll_mpesa(
    session: AsyncSession,
    payroll_id: int,
    current_user_id: int,
) -> MpesaTransaction:
    """Send a single B2C payment via M-Pesa for a payroll record."""
    payroll, worker = await _validate_payroll_ready(session, payroll_id)
    phone = _normalise_phone(worker.phone)
    return await _initiate_mpesa_payment(
        session=session,
        entity_name="payroll",
        worker=worker,
        amount=payroll.net_pay,
        phone=phone,
        payroll_id=payroll_id,
        advance_id=None,
        current_user_id=current_user_id,
        audit_action="mpesa_pay",
        audit_detail=f"{worker.name} — {payroll.net_pay:.0f} KES to {phone}",
    )


async def pay_advance_mpesa(
    session: AsyncSession,
    advance_id: int,
    current_user_id: int,
) -> MpesaTransaction:
    """Send a single B2C payment via M-Pesa for an advance."""
    advance, worker = await _validate_advance_ready(session, advance_id)
    phone = _normalise_phone(worker.phone)
    advance.payment_method = PaymentMethod.mpesa.value
    advance.payment_status = PaymentStatus.processing.value
    return await _initiate_mpesa_payment(
        session=session,
        entity_name="advance",
        worker=worker,
        amount=advance.amount,
        phone=phone,
        payroll_id=None,
        advance_id=advance_id,
        current_user_id=current_user_id,
        audit_action="mpesa_advance_pay",
        audit_detail=f"{worker.name} — {advance.amount:.0f} KES to {phone} (advance #{advance_id})",
    )


async def _initiate_mpesa_payment(
    session: AsyncSession,
    entity_name: str,
    worker: Worker,
    amount: float,
    phone: str,
    payroll_id: Optional[int],
    advance_id: Optional[int],
    current_user_id: int,
    audit_action: str,
    audit_detail: str,
) -> MpesaTransaction:
    """Shared M-Pesa initiation — updates status, calls API, logs audit."""
    # Mark as processing
    if entity_name == "payroll":
        await crud_payroll.update_payment_status(
            session, payroll_id, PaymentStatus.processing.value
        )
    elif entity_name == "advance":
        await crud_advance.update_advance_payment_status(
            session, advance_id, PaymentStatus.processing.value
        )

    client = MpesaClient()
    try:
        txn = await client.send_b2c_payment(
            session=session,
            payroll_id=payroll_id or 0,
            worker_id=worker.id,
            amount=amount,
            phone=phone,
            advance_id=advance_id or 0,
        )
        await session.flush()

        await crud_audit.log_action(
            session, current_user_id, audit_action, audit_detail,
        )

        logger.info(
            "M-Pesa B2C payment initiated",
            extra={
                "entity": entity_name,
                "worker_id": worker.id,
                "amount": amount,
                "phone_last4": phone[-4:],
                "transaction_id": txn.id,
            },
        )
        return txn
    except MpesaError as e:
        logger.error(
            "M-Pesa B2C payment failed",
            extra={
                "entity": entity_name,
                "worker_id": worker.id,
                "amount": amount,
                "error": str(e),
            },
        )
        raise PaymentError(f"M-Pesa payment failed: {e}")


# ── Bulk cash payments ──


async def bulk_pay_payrolls_cash(
    session: AsyncSession,
    payroll_ids: list[int],
    current_user_id: int,
) -> BulkPaymentResult:
    """Pay multiple payrolls in cash. Processes all, collecting successes and errors."""
    succeeded_names: list[str] = []
    errors: list[dict] = []

    for pid in payroll_ids:
        try:
            name = await pay_payroll_cash(session, pid, current_user_id)
            succeeded_names.append(name)
        except (NotFoundError, ValidationError) as e:
            errors.append({"payroll_id": pid, "error": str(e.detail)})

    if succeeded_names:
        await crud_audit.log_action(
            session, current_user_id, "cash_bulk_paid",
            f"{len(succeeded_names)} paid cash ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    return BulkPaymentResult(
        total=len(payroll_ids),
        succeeded=len(succeeded_names),
        failed=len(errors),
        results=[{"payroll_id": pid, "status": "paid"} for pid in payroll_ids if pid not in [e.get("payroll_id") for e in errors]],
        errors=errors,
    )


async def bulk_pay_advances_cash(
    session: AsyncSession,
    advance_ids: list[int],
    current_user_id: int,
) -> BulkPaymentResult:
    """Pay multiple advances in cash."""
    succeeded_names: list[str] = []
    errors: list[dict] = []

    for aid in advance_ids:
        try:
            name = await pay_advance_cash(session, aid, current_user_id)
            succeeded_names.append(name)
        except (NotFoundError, ValidationError) as e:
            errors.append({"advance_id": aid, "error": str(e.detail)})

    if succeeded_names:
        await crud_audit.log_action(
            session, current_user_id, "cash_bulk_advance_paid",
            f"{len(succeeded_names)} advances paid cash ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    return BulkPaymentResult(
        total=len(advance_ids),
        succeeded=len(succeeded_names),
        failed=len(errors),
        results=[{"advance_id": aid, "status": "paid"} for aid in advance_ids if aid not in [e.get("advance_id") for e in errors]],
        errors=errors,
    )


# ── Bulk M-Pesa payments ──


async def bulk_pay_payrolls_mpesa(
    session: AsyncSession,
    payroll_ids: list[int],
    current_user_id: int,
) -> BulkPaymentResult:
    """Pay multiple payrolls via M-Pesa."""
    results: list[dict] = []
    errors: list[dict] = []
    succeeded_names: list[str] = []

    client = MpesaClient()  # single client instance reuses auth token

    for pid in payroll_ids:
        try:
            payroll, worker = await _validate_payroll_ready(session, pid)
            phone = _normalise_phone(worker.phone)
            payroll.payment_method = PaymentMethod.mpesa.value
            payroll.payment_status = PaymentStatus.processing.value

            txn = await client.send_b2c_payment(
                session=session,
                payroll_id=pid,
                worker_id=worker.id,
                amount=payroll.net_pay,
                phone=phone,
                advance_id=0,
            )
            results.append({"payroll_id": pid, "transaction_id": txn.id, "status": txn.status})
            succeeded_names.append(worker.name)
        except (NotFoundError, ValidationError, MpesaError, PaymentError) as e:
            detail = e.detail if hasattr(e, "detail") else str(e)
            errors.append({"payroll_id": pid, "error": detail})

    if results:
        await crud_audit.log_action(
            session, current_user_id, "mpesa_bulk_pay",
            f"{len(results)} paid ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    return BulkPaymentResult(
        total=len(payroll_ids),
        succeeded=len(results),
        failed=len(errors),
        results=results,
        errors=errors,
    )


async def bulk_pay_advances_mpesa(
    session: AsyncSession,
    advance_ids: list[int],
    current_user_id: int,
) -> BulkPaymentResult:
    """Pay multiple advances via M-Pesa."""
    results: list[dict] = []
    errors: list[dict] = []
    succeeded_names: list[str] = []

    client = MpesaClient()

    for aid in advance_ids:
        try:
            advance, worker = await _validate_advance_ready(session, aid)
            phone = _normalise_phone(worker.phone)
            advance.payment_method = PaymentMethod.mpesa.value
            advance.payment_status = PaymentStatus.processing.value

            txn = await client.send_b2c_payment(
                session=session,
                payroll_id=0,
                worker_id=worker.id,
                amount=advance.amount,
                phone=phone,
                advance_id=aid,
            )
            results.append({"advance_id": aid, "transaction_id": txn.id, "status": txn.status})
            succeeded_names.append(worker.name)
        except (NotFoundError, ValidationError, MpesaError, PaymentError) as e:
            detail = e.detail if hasattr(e, "detail") else str(e)
            errors.append({"advance_id": aid, "error": detail})

    if results:
        await crud_audit.log_action(
            session, current_user_id, "mpesa_bulk_advance_pay",
            f"{len(results)} advances paid ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    return BulkPaymentResult(
        total=len(advance_ids),
        succeeded=len(results),
        failed=len(errors),
        results=results,
        errors=errors,
    )


# ── Payment method updates ──


async def update_payroll_payment_method(
    session: AsyncSession,
    payroll_id: int,
    payment_method: str,
    current_user_id: int,
):
    """Update a payroll's payment method with audit logging."""
    if payment_method not in (PaymentMethod.cash.value, PaymentMethod.mpesa.value):
        raise ValidationError("payment_method must be 'cash' or 'mpesa'")

    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        raise NotFoundError("Payroll record not found")

    worker = await session.get(Worker, payroll.worker_id)
    worker_name = _worker_name(worker, f"#{payroll.worker_id}")
    await crud_audit.log_action(
        session, current_user_id, "payment_method_changed",
        f"{worker_name} — week {payroll.week_start} → {payment_method}",
    )
    payroll.payment_method = payment_method
    return worker_name


async def update_advance_payment_method(
    session: AsyncSession,
    advance_id: int,
    payment_method: str,
    current_user_id: int,
):
    """Update an advance's payment method with audit logging."""
    if payment_method not in (PaymentMethod.cash.value, PaymentMethod.mpesa.value):
        raise ValidationError("payment_method must be 'cash' or 'mpesa'")

    advance = await session.get(Advance, advance_id)
    if not advance:
        raise NotFoundError("Advance not found")

    worker = await session.get(Worker, advance.worker_id)
    worker_name = _worker_name(worker, f"#{advance.worker_id}")
    await crud_audit.log_action(
        session, current_user_id, "advance_payment_method_changed",
        f"{worker_name} — advance #{advance_id} → {payment_method}",
    )
    advance.payment_method = payment_method
    return worker_name


# ── M-Pesa callback processing ──


async def process_mpesa_callback(
    session: AsyncSession,
    body: dict,
) -> dict:
    """Process an M-Pesa B2C callback and update payment statuses."""
    client = MpesaClient()
    outcome_info = await client.process_callback(session, body)

    result = body.get("Result", {})
    result_code = result.get("ResultCode")
    outcome = "success" if result_code == 0 else "failed"

    logger.info(
        "M-Pesa callback processed",
        extra={
            "result_code": result_code,
            "conversation_id": body.get("ConversationID", ""),
            "outcome": outcome_info.get("status", "unknown"),
        },
    )
    return outcome_info


async def process_mpesa_timeout(
    session: AsyncSession,
    body: dict,
) -> dict:
    """Process an M-Pesa timeout callback and mark payments as failed."""
    client = MpesaClient()
    outcome_info = await client.process_timeout(session, body)

    logger.warning(
        "M-Pesa timeout callback processed",
        extra={
            "originator_conversation_id": body.get("Result", {}).get("OriginatorConversationID") or body.get("OriginatorConversationID", ""),
            "outcome": outcome_info.get("status", "unknown"),
        },
    )
    return outcome_info


# ── Reset stuck payments ──


async def reset_stuck_payment(
    session: AsyncSession,
    entity: str,
    entity_id: int,
    current_user_id: int,
) -> dict:
    """Reset a stuck 'processing' payment back to 'pending' for retry.

    If the latest M-Pesa transaction actually succeeded (callback arrived),
    marks as 'paid' instead.
    """
    if entity not in ("payroll", "advance"):
        raise ValidationError("entity must be 'payroll' or 'advance'")

    if entity == "payroll":
        record = await session.get(Payroll, entity_id)
    else:
        record = await session.get(Advance, entity_id)

    if not record:
        raise NotFoundError(f"{entity} not found")
    if record.payment_status not in (PaymentStatus.processing.value, PaymentStatus.failed.value):
        raise ValidationError(f"Cannot reset — status is '{record.payment_status}'")

    worker = await session.get(Worker, record.worker_id)
    worker_name = _worker_name(worker, f"#{record.worker_id}")

    # Check latest transactions
    if entity == "payroll":
        txn = await crud_payment.get_latest_transaction(session, payroll_id=entity_id)
    else:
        txn = await crud_payment.get_latest_transaction(session, advance_id=entity_id)

    if txn and txn.status == "success":
        record.payment_status = PaymentStatus.paid.value
        record.paid_at = eat_now()
        await crud_audit.log_action(
            session, current_user_id, "payment_resolved",
            f"{worker_name} — {entity} #{entity_id} marked paid (txn #{txn.id} succeeded)",
        )
        return {"message": "Payment was actually successful — marked as paid", "new_status": PaymentStatus.paid.value}

    record.payment_status = PaymentStatus.pending.value
    await crud_audit.log_action(
        session, current_user_id, "payment_reset",
        f"{worker_name} — {entity} #{entity_id} reset to pending for retry",
    )
    return {"message": "Payment reset to 'pending' — you can now retry", "new_status": PaymentStatus.pending.value}


# ── Private helpers ──


def _normalise_phone(phone: str) -> str:
    try:
        return format_phone(phone)
    except ValueError as e:
        raise ValidationError(str(e))
