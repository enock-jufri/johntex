import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.timezone import eat_now

from ..crud import advance as crud_advance
from ..crud import audit as crud_audit
from ..crud import payment as crud_payment
from ..crud import payroll as crud_payroll
from ..crud import settings as crud_settings
from ..crud import wallet as crud_wallet
from ..database import get_session
from ..metrics import mpesa_callbacks_total, payment_attempts_total
from ..models import Advance, Payroll, Worker
from ..schemas import (
    AdvanceBulkPayRequest,
    AdvanceUpdatePaymentMethod,
    MpesaBulkPayRequest,
    MpesaSettingsResponse,
    MpesaSettingsUpdate,
    MpesaTransactionRead,
    PayrollUpdatePaymentMethod,
)
from ..security import get_current_admin
from ..services.mpesa import (
    MPESA_BASE_URL,
    MPESA_CONSUMER_KEY,
    MPESA_CONSUMER_SECRET,
    MPESA_ENVIRONMENT,
    MPESA_SECURITY_CREDENTIAL,
    MpesaClient,
    MpesaError,
    format_phone,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/mpesa/pay/{payroll_id}", response_model=MpesaTransactionRead)
async def pay_single_mpesa(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        raise HTTPException(404, "Payroll record not found")
    if payroll.payment_status in ("processing", "paid"):
        raise HTTPException(400, f"Payroll already {payroll.payment_status}")
    if payroll.net_pay <= 0:
        raise HTTPException(400, "Net pay must be greater than zero")

    worker = await session.get(Worker, payroll.worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")

    try:
        phone = format_phone(worker.phone)
    except ValueError as e:
        raise HTTPException(400, str(e))

    payroll.payment_method = "mpesa"
    payroll.payment_status = "processing"

    client = MpesaClient()
    try:
        txn = await client.send_b2c_payment(
            session=session,
            payroll_id=payroll_id,
            worker_id=worker.id,
            amount=payroll.net_pay,
            phone=phone,
        )
        await session.commit()
        await session.refresh(txn)

        await crud_audit.log_action(
            session,
            current_user.id,
            "mpesa_pay",
            f"{worker.name} — {payroll.net_pay:.0f} KES to {phone}",
        )

        payment_attempts_total.labels(status="initiated", method="mpesa").inc()
        logger.info(
            "M-Pesa B2C payment initiated",
            extra={
                "payroll_id": payroll_id,
                "worker_id": worker.id,
                "amount": payroll.net_pay,
                "phone_last4": phone[-4:],
                "transaction_id": txn.id,
            },
        )

        return txn
    except MpesaError as e:
        payment_attempts_total.labels(status="failed", method="mpesa").inc()
        logger.error(
            "M-Pesa B2C payment failed",
            extra={
                "payroll_id": payroll_id,
                "worker_id": worker.id,
                "amount": payroll.net_pay,
                "error": str(e),
            },
        )
        await session.commit()
        raise HTTPException(502, f"M-Pesa payment failed: {e}")


@router.post("/mpesa/bulk-pay")
async def pay_bulk_mpesa(
    request: MpesaBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.payroll_ids:
        raise HTTPException(400, "No payroll IDs provided")

    results = []
    errors = []
    succeeded_names = []

    client = MpesaClient()  # single client instance reuses auth token

    for pid in request.payroll_ids:
        payroll = await session.get(Payroll, pid)
        if not payroll:
            errors.append({"payroll_id": pid, "error": "Not found"})
            continue
        if payroll.payment_status in ("processing", "paid"):
            errors.append(
                {
                    "payroll_id": pid,
                    "error": f"Already {payroll.payment_status}",
                }
            )
            continue
        if payroll.net_pay <= 0:
            errors.append({"payroll_id": pid, "error": "Net pay must be > 0"})
            continue

        worker = await session.get(Worker, payroll.worker_id)
        if not worker:
            errors.append({"payroll_id": pid, "error": "Worker not found"})
            continue

        try:
            phone = format_phone(worker.phone)
        except ValueError as e:
            errors.append({"payroll_id": pid, "error": str(e)})
            continue

        payroll.payment_method = "mpesa"
        payroll.payment_status = "processing"

        try:
            txn = await client.send_b2c_payment(
                session=session,
                payroll_id=pid,
                worker_id=worker.id,
                amount=payroll.net_pay,
                phone=phone,
            )
            results.append(
                {
                    "payroll_id": pid,
                    "transaction_id": txn.id,
                    "status": txn.status,
                }
            )
            succeeded_names.append(worker.name)
        except MpesaError as e:
            errors.append({"payroll_id": pid, "error": str(e)})

    if results:
        await crud_audit.log_action(
            session,
            current_user.id,
            "mpesa_bulk_pay",
            f"{len(results)} paid ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    await session.commit()

    return {
        "total": len(request.payroll_ids),
        "succeeded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


@router.post("/mpesa/callback")
async def mpesa_callback(
    body: dict,
    session: AsyncSession = Depends(get_session),
):
    result = body.get("Result", {})
    result_code = result.get("ResultCode")
    conversation_id = body.get("ConversationID", "")

    logger.info(
        "M-Pesa callback raw body",
        extra={
            "conversation_id": conversation_id,
            "originator_id": result.get("OriginatorConversationID") or body.get("OriginatorConversationID"),
            "result_code": result_code,
            "result_desc": result.get("ResultDesc", "")[:100],
        },
    )

    client = MpesaClient()
    try:
        outcome_info = await client.process_callback(session, body)
        await session.commit()
        outcome = "success" if result_code == 0 else "failed"
        mpesa_callbacks_total.labels(outcome=outcome).inc()
        logger.info(
            "M-Pesa callback processed",
            extra={
                "result_code": result_code,
                "conversation_id": conversation_id,
                "outcome": outcome_info.get("status", "unknown"),
            },
        )
    except Exception:
        mpesa_callbacks_total.labels(outcome="failed").inc()
        logger.error(
            "M-Pesa callback processing error",
            extra={"conversation_id": conversation_id},
            exc_info=True,
        )
        raise

    return {"ResultCode": 0, "ResultDesc": "Success"}


@router.post("/mpesa/timeout")
async def mpesa_timeout(
    body: dict,
    session: AsyncSession = Depends(get_session),
):
    """Queue timeout callback from Safaricom.

    Safaricom calls this URL when a B2C request sits in the queue beyond
    the expiry time. The request never reached the customer — mark as failed
    so the admin can retry.
    """
    result = body.get("Result", {})
    result_code = result.get("ResultCode")
    originator_id = result.get("OriginatorConversationID") or body.get("OriginatorConversationID", "")

    client = MpesaClient()
    try:
        outcome_info = await client.process_timeout(session, body)
        await session.commit()
        mpesa_callbacks_total.labels(outcome="timeout").inc()
        logger.warning(
            "M-Pesa timeout callback processed",
            extra={
                "result_code": result_code,
                "originator_conversation_id": originator_id,
                "outcome": outcome_info.get("status", "unknown"),
            },
        )
    except Exception:
        mpesa_callbacks_total.labels(outcome="failed").inc()
        logger.error(
            "M-Pesa timeout callback processing error",
            extra={"originator_conversation_id": originator_id},
            exc_info=True,
        )
        raise

    return {"ResultCode": 0, "ResultDesc": "Success"}


@router.get("/transactions", response_model=list[MpesaTransactionRead])
async def list_transactions(
    payroll_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    return await crud_payment.get_transactions(
        session, payroll_id=payroll_id, skip=skip, limit=limit
    )


@router.get("/transactions/{transaction_id}", response_model=MpesaTransactionRead)
async def get_transaction(
    transaction_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    txn = await crud_payment.get_transaction(session, transaction_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


@router.get("/mpesa-settings", response_model=MpesaSettingsResponse)
async def get_mpesa_settings(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    settings = await crud_settings.get_settings_by_prefix(session, "mpesa_")
    return MpesaSettingsResponse(
        environment=MPESA_ENVIRONMENT,
        base_url=MPESA_BASE_URL,
        shortcode=settings.get("mpesa_shortcode", ""),
        initiator_name=settings.get("mpesa_initiator_name", ""),
        consumer_key_set=bool(MPESA_CONSUMER_KEY),
        consumer_secret_set=bool(MPESA_CONSUMER_SECRET),
        security_credential_set=bool(MPESA_SECURITY_CREDENTIAL),
    )


@router.put("/mpesa-settings")
async def update_mpesa_settings(
    body: MpesaSettingsUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    updates = {
        k: v
        for k, v in {
            "mpesa_shortcode": body.shortcode,
            "mpesa_initiator_name": body.initiator_name,
        }.items()
        if v is not None
    }
    for key, value in updates.items():
        await crud_settings.set_setting(session, key, value)

    await crud_audit.log_action(
        session,
        current_user.id,
        "mpesa_settings_updated",
        f"shortcode: {body.shortcode or 'unchanged'}, initiator: {body.initiator_name or 'unchanged'}",
    )

    await session.commit()
    return {"message": "M-Pesa settings updated"}


@router.post("/cash/pay/{payroll_id}")
async def pay_single_cash(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        raise HTTPException(404, "Payroll record not found")
    if payroll.payment_status in ("processing", "paid"):
        raise HTTPException(400, f"Payroll already {payroll.payment_status}")
    if payroll.payment_method != "cash":
        raise HTTPException(400, "Payroll is set to M-Pesa, not cash")

    worker = await session.get(Worker, payroll.worker_id)
    worker_name = worker.name if worker else f"#{payroll.worker_id}"

    payroll.payment_status = "paid"
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
        session,
        current_user.id,
        "cash_paid",
        f"{worker_name} — {payroll.net_pay:.0f} KES cash",
    )
    await session.commit()
    return {"message": f"Marked as paid (cash) for {worker_name}"}


@router.post("/cash/bulk-pay")
async def pay_bulk_cash(
    request: MpesaBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.payroll_ids:
        raise HTTPException(400, "No payroll IDs provided")

    succeeded_names = []
    errors = []

    for pid in request.payroll_ids:
        payroll = await session.get(Payroll, pid)
        if not payroll:
            errors.append({"payroll_id": pid, "error": "Not found"})
            continue
        if payroll.payment_status in ("processing", "paid"):
            errors.append(
                {"payroll_id": pid, "error": f"Already {payroll.payment_status}"}
            )
            continue
        if payroll.payment_method != "cash":
            errors.append({"payroll_id": pid, "error": "Not a cash payment"})
            continue

        worker = await session.get(Worker, payroll.worker_id)
        worker_name = worker.name if worker else f"#{pid}"

        payroll.payment_status = "paid"
        payroll.paid_at = eat_now()
        succeeded_names.append(worker_name)

        await crud_wallet.add_payout(
            session,
            worker_id=payroll.worker_id,
            amount=payroll.net_pay,
            reference_type="payroll",
            reference_id=payroll.id,
            description=f"Cash payment — week {payroll.week_start}",
        )

    if succeeded_names:
        await crud_audit.log_action(
            session,
            current_user.id,
            "cash_bulk_paid",
            f"{len(succeeded_names)} paid cash ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    await session.commit()

    return {
        "total": len(request.payroll_ids),
        "succeeded": len(succeeded_names),
        "failed": len(errors),
        "errors": errors,
    }


@router.put("/payroll/{payroll_id}/payment-method")
async def update_payroll_payment_method(
    payroll_id: int,
    body: PayrollUpdatePaymentMethod,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if body.payment_method not in ("cash", "mpesa"):
        raise HTTPException(400, "payment_method must be 'cash' or 'mpesa'")
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        raise HTTPException(404, "Payroll record not found")

    worker = await session.get(Worker, payroll.worker_id)
    worker_name = worker.name if worker else f"#{payroll.worker_id}"
    await crud_audit.log_action(
        session,
        current_user.id,
        "payment_method_changed",
        f"{worker_name} — week {payroll.week_start} → {body.payment_method}",
    )

    payroll.payment_method = body.payment_method
    await session.commit()
    return {"message": f"Payment method updated to {body.payment_method}"}


# ── Advance payment endpoints ──

@router.post("/mpesa/pay-advance/{advance_id}", response_model=MpesaTransactionRead)
async def pay_advance_mpesa(
    advance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    advance = await session.get(Advance, advance_id)
    if not advance:
        raise HTTPException(404, "Advance not found")
    if not advance.approved:
        raise HTTPException(400, "Advance must be approved before payment")
    if advance.payment_status in ("processing", "paid"):
        raise HTTPException(400, f"Advance already {advance.payment_status}")

    worker = await session.get(Worker, advance.worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")

    try:
        phone = format_phone(worker.phone)
    except ValueError as e:
        raise HTTPException(400, str(e))

    advance.payment_method = "mpesa"
    advance.payment_status = "processing"

    client = MpesaClient()
    try:
        txn = await client.send_b2c_payment(
            session=session,
            payroll_id=0,  # not used for advances
            worker_id=worker.id,
            amount=advance.amount,
            phone=phone,
            advance_id=advance_id,
        )
        await session.commit()
        await session.refresh(txn)

        await crud_audit.log_action(
            session,
            current_user.id,
            "mpesa_advance_pay",
            f"{worker.name} — {advance.amount:.0f} KES to {phone} (advance #{advance_id})",
        )

        payment_attempts_total.labels(status="initiated", method="mpesa").inc()
        logger.info(
            "M-Pesa advance payment initiated",
            extra={
                "advance_id": advance_id,
                "worker_id": worker.id,
                "amount": advance.amount,
                "phone_last4": phone[-4:],
                "transaction_id": txn.id,
            },
        )
        return txn
    except MpesaError as e:
        payment_attempts_total.labels(status="failed", method="mpesa").inc()
        logger.error(
            "M-Pesa advance payment failed",
            extra={
                "advance_id": advance_id,
                "worker_id": worker.id,
                "amount": advance.amount,
                "error": str(e),
            },
        )
        await session.commit()
        raise HTTPException(502, f"M-Pesa payment failed: {e}")


@router.post("/mpesa/bulk-pay-advances")
async def pay_advances_bulk_mpesa(
    request: AdvanceBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.advance_ids:
        raise HTTPException(400, "No advance IDs provided")

    results = []
    errors = []
    succeeded_names = []

    client = MpesaClient()  # single client instance reuses auth token

    for aid in request.advance_ids:
        advance = await session.get(Advance, aid)
        if not advance:
            errors.append({"advance_id": aid, "error": "Not found"})
            continue
        if not advance.approved:
            errors.append({"advance_id": aid, "error": "Not approved"})
            continue
        if advance.payment_status in ("processing", "paid"):
            errors.append({"advance_id": aid, "error": f"Already {advance.payment_status}"})
            continue

        worker = await session.get(Worker, advance.worker_id)
        if not worker:
            errors.append({"advance_id": aid, "error": "Worker not found"})
            continue

        try:
            phone = format_phone(worker.phone)
        except ValueError as e:
            errors.append({"advance_id": aid, "error": str(e)})
            continue

        advance.payment_method = "mpesa"
        advance.payment_status = "processing"

        try:
            txn = await client.send_b2c_payment(
                session=session,
                payroll_id=0,
                worker_id=worker.id,
                amount=advance.amount,
                phone=phone,
                advance_id=aid,
            )
            results.append({
                "advance_id": aid,
                "transaction_id": txn.id,
                "status": txn.status,
            })
            succeeded_names.append(worker.name)
        except MpesaError as e:
            errors.append({"advance_id": aid, "error": str(e)})

    if results:
        await crud_audit.log_action(
            session,
            current_user.id,
            "mpesa_bulk_advance_pay",
            f"{len(results)} advances paid ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    await session.commit()
    return {
        "total": len(request.advance_ids),
        "succeeded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


@router.post("/cash/pay-advance/{advance_id}")
async def pay_advance_cash(
    advance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    advance = await session.get(Advance, advance_id)
    if not advance:
        raise HTTPException(404, "Advance not found")
    if not advance.approved:
        raise HTTPException(400, "Advance must be approved before payment")
    if advance.payment_status in ("processing", "paid"):
        raise HTTPException(400, f"Advance already {advance.payment_status}")
    if advance.payment_method != "cash":
        raise HTTPException(400, "Advance is set to M-Pesa, not cash")

    worker = await session.get(Worker, advance.worker_id)
    worker_name = worker.name if worker else f"#{advance.worker_id}"

    advance.payment_status = "paid"
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
        session,
        current_user.id,
        "cash_advance_paid",
        f"{worker_name} — {advance.amount:.0f} KES cash (advance #{advance_id})",
    )
    await session.commit()
    return {"message": f"Marked advance as paid (cash) for {worker_name}"}


@router.post("/cash/bulk-pay-advances")
async def pay_advances_bulk_cash(
    request: AdvanceBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.advance_ids:
        raise HTTPException(400, "No advance IDs provided")

    succeeded_names = []
    errors = []

    for aid in request.advance_ids:
        advance = await session.get(Advance, aid)
        if not advance:
            errors.append({"advance_id": aid, "error": "Not found"})
            continue
        if not advance.approved:
            errors.append({"advance_id": aid, "error": "Not approved"})
            continue
        if advance.payment_status in ("processing", "paid"):
            errors.append({"advance_id": aid, "error": f"Already {advance.payment_status}"})
            continue
        if advance.payment_method != "cash":
            errors.append({"advance_id": aid, "error": "Not a cash payment"})
            continue

        worker = await session.get(Worker, advance.worker_id)
        worker_name = worker.name if worker else f"#{aid}"

        advance.payment_status = "paid"
        advance.paid_at = eat_now()

        await crud_wallet.add_advance(
            session,
            worker_id=advance.worker_id,
            amount=advance.amount,
            reference_type="advance",
            reference_id=advance.id,
            description=advance.notes or f"Cash advance payment — advance #{aid}",
        )

        succeeded_names.append(worker_name)

    if succeeded_names:
        await crud_audit.log_action(
            session,
            current_user.id,
            "cash_bulk_advance_paid",
            f"{len(succeeded_names)} advances paid cash ({', '.join(succeeded_names)})"
            + (f" — {len(errors)} failed" if errors else ""),
        )

    await session.commit()
    return {
        "total": len(request.advance_ids),
        "succeeded": len(succeeded_names),
        "failed": len(errors),
        "errors": errors,
    }


@router.put("/advance/{advance_id}/payment-method")
async def update_advance_payment_method(
    advance_id: int,
    body: AdvanceUpdatePaymentMethod,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if body.payment_method not in ("cash", "mpesa"):
        raise HTTPException(400, "payment_method must be 'cash' or 'mpesa'")
    advance = await session.get(Advance, advance_id)
    if not advance:
        raise HTTPException(404, "Advance not found")

    worker = await session.get(Worker, advance.worker_id)
    worker_name = worker.name if worker else f"#{advance.worker_id}"
    await crud_audit.log_action(
        session,
        current_user.id,
        "advance_payment_method_changed",
        f"{worker_name} — advance #{advance_id} → {body.payment_method}",
    )

    advance.payment_method = body.payment_method
    await session.commit()
    return {"message": f"Advance payment method updated to {body.payment_method}"}


@router.post("/reset-stuck/{entity}/{entity_id}")
async def reset_stuck_payment(
    entity: str,
    entity_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    """Reset a stuck 'processing' payment back to 'pending' so it can be retried.

    First checks the latest M-Pesa transaction — if it actually succeeded
    (callback eventually arrived), marks the payment as 'paid' instead.
    """
    if entity not in ("payroll", "advance"):
        raise HTTPException(400, "entity must be 'payroll' or 'advance'")

    if entity == "payroll":
        record = await session.get(Payroll, entity_id)
    else:
        record = await session.get(Advance, entity_id)

    if not record:
        raise HTTPException(404, f"{entity} not found")
    if record.payment_status not in ("processing", "failed"):
        raise HTTPException(400, f"Cannot reset — status is '{record.payment_status}'")

    worker = await session.get(Worker, record.worker_id)
    worker_name = worker.name if worker else f"#{record.worker_id}"

    # Check latest transactions for this entity
    if entity == "payroll":
        txn = await crud_payment.get_latest_transaction(session, payroll_id=entity_id)
    else:
        txn = await crud_payment.get_latest_transaction(session, advance_id=entity_id)

    if txn and txn.status == "success":
        # Callback DID arrive — payment actually succeeded
        record.payment_status = "paid"
        record.paid_at = eat_now()
        await crud_audit.log_action(
            session, current_user.id, "payment_resolved",
            f"{worker_name} — {entity} #{entity_id} marked paid (txn #{txn.id} succeeded)",
        )
        await session.commit()
        return {"message": "Payment was actually successful — marked as paid", "new_status": "paid"}

    # Safe to reset — no successful transaction found
    record.payment_status = "pending"
    await crud_audit.log_action(
        session, current_user.id, "payment_reset",
        f"{worker_name} — {entity} #{entity_id} reset from {record.payment_status} to pending for retry",
    )
    await session.commit()
    return {"message": "Payment reset to 'pending' — you can now retry", "new_status": "pending"}
