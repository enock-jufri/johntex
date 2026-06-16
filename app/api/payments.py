"""Payment endpoints — thin route handlers delegating to payment_service.

Business logic (validation, audit logging, wallet updates, M-Pesa integration)
lives in app/services/payment_service.py.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import PaymentMethod

from ..crud import payment as crud_payment
from ..crud import settings as crud_settings
from ..database import get_session
from ..metrics import mpesa_callbacks_total, payment_attempts_total
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
from ..services.mpesa import MPESA_BASE_URL, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_ENVIRONMENT, MPESA_SECURITY_CREDENTIAL
from ..services.payment_service import (
    bulk_pay_advances_cash,
    bulk_pay_advances_mpesa,
    bulk_pay_payrolls_cash,
    bulk_pay_payrolls_mpesa,
    pay_advance_cash,
    pay_advance_mpesa,
    pay_payroll_cash,
    pay_payroll_mpesa,
    process_mpesa_callback,
    process_mpesa_timeout,
    reset_stuck_payment,
    update_advance_payment_method,
    update_payroll_payment_method,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


# ── Single M-Pesa payments ──


@router.post("/mpesa/pay/{payroll_id}", response_model=MpesaTransactionRead)
async def pay_single_mpesa(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        txn = await pay_payroll_mpesa(session, payroll_id, current_user.id)
        await session.commit()
        await session.refresh(txn)
        payment_attempts_total.labels(status="initiated", method="mpesa").inc()
        return txn
    except Exception as e:
        await session.rollback()
        payment_attempts_total.labels(status="failed", method="mpesa").inc()
        logger.error("M-Pesa payment failed", extra={"payroll_id": payroll_id, "error": str(e)})
        raise _to_http(e)


@router.post("/mpesa/pay-advance/{advance_id}", response_model=MpesaTransactionRead)
async def pay_advance_mpesa_endpoint(
    advance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        txn = await pay_advance_mpesa(session, advance_id, current_user.id)
        await session.commit()
        await session.refresh(txn)
        payment_attempts_total.labels(status="initiated", method="mpesa").inc()
        return txn
    except Exception as e:
        await session.rollback()
        payment_attempts_total.labels(status="failed", method="mpesa").inc()
        logger.error("M-Pesa advance payment failed", extra={"advance_id": advance_id, "error": str(e)})
        raise _to_http(e)


# ── Bulk M-Pesa payments ──


@router.post("/mpesa/bulk-pay")
async def pay_bulk_mpesa(
    request: MpesaBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.payroll_ids:
        raise HTTPException(400, "No payroll IDs provided")

    result = await bulk_pay_payrolls_mpesa(session, request.payroll_ids, current_user.id)
    await session.commit()
    return {
        "total": result.total,
        "succeeded": result.succeeded,
        "failed": result.failed,
        "results": result.results,
        "errors": result.errors,
    }


@router.post("/mpesa/bulk-pay-advances")
async def pay_advances_bulk_mpesa(
    request: AdvanceBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.advance_ids:
        raise HTTPException(400, "No advance IDs provided")

    result = await bulk_pay_advances_mpesa(session, request.advance_ids, current_user.id)
    await session.commit()
    return {
        "total": result.total,
        "succeeded": result.succeeded,
        "failed": result.failed,
        "results": result.results,
        "errors": result.errors,
    }


# ── Single cash payments ──


@router.post("/cash/pay/{payroll_id}")
async def pay_single_cash(
    payroll_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        worker_name = await pay_payroll_cash(session, payroll_id, current_user.id)
        await session.commit()
        return {"message": f"Marked as paid (cash) for {worker_name}"}
    except Exception as e:
        await session.rollback()
        raise _to_http(e)


@router.post("/cash/pay-advance/{advance_id}")
async def pay_advance_cash_endpoint(
    advance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        worker_name = await pay_advance_cash(session, advance_id, current_user.id)
        await session.commit()
        return {"message": f"Marked advance as paid (cash) for {worker_name}"}
    except Exception as e:
        await session.rollback()
        raise _to_http(e)


# ── Bulk cash payments ──


@router.post("/cash/bulk-pay")
async def pay_bulk_cash(
    request: MpesaBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.payroll_ids:
        raise HTTPException(400, "No payroll IDs provided")

    result = await bulk_pay_payrolls_cash(session, request.payroll_ids, current_user.id)
    await session.commit()
    return {
        "total": result.total,
        "succeeded": result.succeeded,
        "failed": result.failed,
        "errors": result.errors,
    }


@router.post("/cash/bulk-pay-advances")
async def pay_advances_bulk_cash(
    request: AdvanceBulkPayRequest,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    if not request.advance_ids:
        raise HTTPException(400, "No advance IDs provided")

    result = await bulk_pay_advances_cash(session, request.advance_ids, current_user.id)
    await session.commit()
    return {
        "total": result.total,
        "succeeded": result.succeeded,
        "failed": result.failed,
        "errors": result.errors,
    }


# ── Payment method updates ──


@router.put("/payroll/{payroll_id}/payment-method")
async def update_payroll_payment_method_endpoint(
    payroll_id: int,
    body: PayrollUpdatePaymentMethod,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        await update_payroll_payment_method(session, payroll_id, body.payment_method, current_user.id)
        await session.commit()
        return {"message": f"Payment method updated to {body.payment_method}"}
    except Exception as e:
        await session.rollback()
        raise _to_http(e)


@router.put("/advance/{advance_id}/payment-method")
async def update_advance_payment_method_endpoint(
    advance_id: int,
    body: AdvanceUpdatePaymentMethod,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        await update_advance_payment_method(session, advance_id, body.payment_method, current_user.id)
        await session.commit()
        return {"message": f"Advance payment method updated to {body.payment_method}"}
    except Exception as e:
        await session.rollback()
        raise _to_http(e)


# ── M-Pesa callbacks (no auth — called by Safaricom) ──


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
            "result_code": result_code,
            "result_desc": result.get("ResultDesc", "")[:100],
        },
    )

    try:
        await process_mpesa_callback(session, body)
        await session.commit()
        outcome = "success" if result_code == 0 else "failed"
        mpesa_callbacks_total.labels(outcome=outcome).inc()
    except Exception:
        mpesa_callbacks_total.labels(outcome="failed").inc()
        logger.error("M-Pesa callback processing error", extra={"conversation_id": conversation_id}, exc_info=True)
        raise

    return {"ResultCode": 0, "ResultDesc": "Success"}


@router.post("/mpesa/timeout")
async def mpesa_timeout(
    body: dict,
    session: AsyncSession = Depends(get_session),
):
    result = body.get("Result", {})
    result_code = result.get("ResultCode")
    originator_id = result.get("OriginatorConversationID") or body.get("OriginatorConversationID", "")

    try:
        await process_mpesa_timeout(session, body)
        await session.commit()
        mpesa_callbacks_total.labels(outcome="timeout").inc()
        logger.warning(
            "M-Pesa timeout callback processed",
            extra={"result_code": result_code, "originator_conversation_id": originator_id},
        )
    except Exception:
        mpesa_callbacks_total.labels(outcome="failed").inc()
        logger.error("M-Pesa timeout callback error", extra={"originator_conversation_id": originator_id}, exc_info=True)
        raise

    return {"ResultCode": 0, "ResultDesc": "Success"}


# ── Transactions ──


@router.get("/transactions", response_model=list[MpesaTransactionRead])
async def list_transactions(
    payroll_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    return await crud_payment.get_transactions(session, payroll_id=payroll_id, skip=skip, limit=limit)


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


# ── M-Pesa settings ──


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
    from ..crud import audit as crud_audit

    updates = {
        k: v for k, v in {
            "mpesa_shortcode": body.shortcode,
            "mpesa_initiator_name": body.initiator_name,
        }.items() if v is not None
    }
    for key, value in updates.items():
        await crud_settings.set_setting(session, key, value)

    await crud_audit.log_action(
        session, current_user.id, "mpesa_settings_updated",
        f"shortcode: {body.shortcode or 'unchanged'}, initiator: {body.initiator_name or 'unchanged'}",
    )
    await session.commit()
    return {"message": "M-Pesa settings updated"}


# ── Reset stuck payments ──


@router.post("/reset-stuck/{entity}/{entity_id}")
async def reset_stuck_payment_endpoint(
    entity: str,
    entity_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    try:
        result = await reset_stuck_payment(session, entity, entity_id, current_user.id)
        await session.commit()
        return result
    except Exception as e:
        await session.rollback()
        raise _to_http(e)


# ── Exception conversion ──


def _to_http(exc: Exception) -> HTTPException:
    """Convert a domain exception to an HTTPException for FastAPI."""
    from app.exceptions import AppError, NotFoundError, ValidationError, ConflictError, PaymentError

    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=404, detail=exc.detail)
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=400, detail=exc.detail)
    if isinstance(exc, ConflictError):
        return HTTPException(status_code=409, detail=exc.detail)
    if isinstance(exc, PaymentError):
        return HTTPException(status_code=502, detail=exc.detail)
    if isinstance(exc, AppError):
        return HTTPException(status_code=exc.status_code, detail=exc.detail)
    # Re-raise unexpected exceptions as-is
    raise
