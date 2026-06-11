import base64
import logging
import os
import re
import time
import uuid
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.timezone import eat_now

from ..metrics import mpesa_callbacks_total
from ..models import Advance, MpesaTransaction, Payroll, Setting, Worker

logger = logging.getLogger(__name__)

SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
PRODUCTION_BASE = "https://api.safaricom.co.ke"

# ── Secrets from environment (never stored in DB) ──
MPESA_ENVIRONMENT = os.environ.get("MPESA_ENVIRONMENT", "sandbox")
MPESA_CONSUMER_KEY = os.environ.get("MPESA_CONSUMER_KEY", "")
MPESA_CONSUMER_SECRET = os.environ.get("MPESA_CONSUMER_SECRET", "")
MPESA_SECURITY_CREDENTIAL = os.environ.get("MPESA_SECURITY_CREDENTIAL", "")
MPESA_BASE_URL = os.environ.get("MPESA_BASE_URL", "").rstrip("/")

# ── Known Safaricom B2C result codes ──

RESULT_CODES = {
    0: "Success",
    1: "Insufficient funds",
    2: "Failed — less than minimum transaction value",
    3: "Failed — more than maximum transaction value",
    4: "Failed — would exceed mobile money daily transfer limit",
    5: "Failed — would exceed minimum balance",
    6: "Failed — user not found on AMF",
    7: "Failed — subject to locking",
    8: "Failed — subject to limits",
    17: "Failed — invalid customer details",
    26: "Failed — subscriber limit exceeded",
    1001: "Failed — invalid pin or subscriber not active",
    1019: "Failed — transaction already processed",
    1032: "Request cancelled by user",
    1037: "Request timed out",
    2001: "Failed — initiator authentication error",
}


def format_phone(phone: str) -> str:
    """Normalize a Kenyan phone number to 254XXXXXXXXX format."""
    cleaned = re.sub(r"[^0-9+]", "", phone.strip())
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    if cleaned.startswith("0"):
        cleaned = "254" + cleaned[1:]
    if len(cleaned) == 9 and cleaned.startswith("7"):
        cleaned = "254" + cleaned
    if not re.match(r"^254\d{9}$", cleaned):
        raise ValueError(f"Invalid phone number: {phone}")
    return cleaned


def is_valid_phone(phone: str) -> bool:
    """Check if a phone number is a valid Kenyan format."""
    try:
        format_phone(phone)
        return True
    except ValueError:
        return False


VALID_PHONE_EXAMPLES = "0712345678, +254712345678, or 254712345678"


class MpesaError(Exception):
    def __init__(self, message: str, response_data: Optional[dict] = None):
        super().__init__(message)
        self.response_data = response_data


class MpesaClient:
    """Daraja B2C client.

    Secrets (consumer key, consumer secret, security credential) come from
    environment variables. Non-sensitive config (shortcode, initiator name,
    URLs) come from the settings table and can be edited via the frontend.

    Token is cached per-instance for reuse within a request (e.g., bulk pay).
    Session is passed per-method rather than stored — SQLAlchemy sessions
    should not be held on long-lived objects.
    """

    def __init__(self):
        self._token: Optional[str] = None
        self._token_expires_at: float = 0

    # ── Non-sensitive settings from DB ──

    @staticmethod
    async def _load_db_settings(session: AsyncSession) -> dict:
        result = await session.execute(
            select(Setting).where(Setting.key.startswith("mpesa_"))
        )
        return {s.key: s.value for s in result.scalars().all()}

    @staticmethod
    def _base_url() -> str:
        return PRODUCTION_BASE if MPESA_ENVIRONMENT == "production" else SANDBOX_BASE

    # ── Auth ──

    async def _get_access_token(self) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token

        if not MPESA_CONSUMER_KEY or not MPESA_CONSUMER_SECRET:
            raise MpesaError(
                "M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY "
                "and MPESA_CONSUMER_SECRET in .env."
            )

        auth = base64.b64encode(
            f"{MPESA_CONSUMER_KEY}:{MPESA_CONSUMER_SECRET}".encode()
        ).decode()
        url = f"{self._base_url()}/oauth/v1/generate?grant_type=client_credentials"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers={"Authorization": f"Basic {auth}"})
            if resp.status_code != 200:
                body = resp.text[:500] if resp.text else "(empty body)"
                logger.error(
                    "M-Pesa OAuth token request failed",
                    extra={"status_code": resp.status_code, "response_body": body},
                )
                raise MpesaError(f"Failed to get M-Pesa access token (HTTP {resp.status_code}): {body}")
            data = resp.json()
            self._token = data["access_token"]
            self._token_expires_at = time.time() + 3300  # 55 minutes
            return self._token

    # ── B2C payment ──

    async def send_b2c_payment(
        self,
        session: AsyncSession,
        payroll_id: int,
        worker_id: int,
        amount: float,
        phone: str,
        advance_id: Optional[int] = None,
        remarks: Optional[str] = None,
        occasion: Optional[str] = None,
    ) -> MpesaTransaction:
        if not MPESA_SECURITY_CREDENTIAL:
            raise MpesaError(
                "M-Pesa security credential not available. "
                "Set MPESA_INITIATOR_PASSWORD and MPESA_CERTIFICATE in .env."
            )

        db_settings = await self._load_db_settings(session)
        shortcode = db_settings.get("mpesa_shortcode", "")
        initiator = db_settings.get("mpesa_initiator_name", "")

        if not shortcode or not initiator:
            raise MpesaError(
                "M-Pesa shortcode or initiator name not configured. "
                "Set them in the Settings page."
            )

        token = await self._get_access_token()
        formatted_phone = format_phone(phone)
        originator_id = str(uuid.uuid4())

        body = {
            "InitiatorName": initiator,
            "SecurityCredential": MPESA_SECURITY_CREDENTIAL,
            "CommandID": "SalaryPayment",
            "Amount": str(int(round(amount))),
            "PartyA": shortcode,
            "PartyB": formatted_phone,
            "Remarks": remarks or "Payroll payment",
            "Occasion": occasion or "Payroll",
            "OriginatorConversationID": originator_id,
            "QueueTimeOutURL": f"{MPESA_BASE_URL}/payments/mpesa/timeout",
            "ResultURL": f"{MPESA_BASE_URL}/payments/mpesa/callback",
        }

        logger.info(
            "M-Pesa B2C request",
            extra={
                "originator_id": originator_id,
                "worker_id": worker_id,
                "amount": amount,
                "phone_last4": formatted_phone[-4:],
            },
        )

        url = f"{self._base_url()}/mpesa/b2c/v3/paymentrequest"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                json=body,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp_data = {}
            if resp.text:
                try:
                    resp_data = resp.json()
                except Exception:
                    logger.warning(
                        "M-Pesa B2C response is not valid JSON",
                        extra={"status_code": resp.status_code, "body": resp.text[:300]},
                    )

        conversation_id = resp_data.get("ConversationID")
        response_code = str(resp_data.get("ResponseCode", ""))
        response_desc = resp_data.get("ResponseDescription", "")

        logger.info(
            "M-Pesa B2C response",
            extra={
                "originator_id": originator_id,
                "response_code": response_code,
                "response_description": response_desc,
                "conversation_id": conversation_id,
            },
        )

        is_success = response_code == "0"

        transaction = MpesaTransaction(
            payroll_id=payroll_id if payroll_id else None,
            worker_id=worker_id,
            amount=amount,
            phone=formatted_phone,
            advance_id=advance_id,
            conversation_id=conversation_id,
            originator_conversation_id=originator_id,
            response_code=response_code,
            response_description=response_desc,
            status="processing" if is_success else "failed",
        )
        session.add(transaction)
        await session.commit()
        await session.refresh(transaction)

        if not is_success:
            err_msg = f"M-Pesa B2C request failed [{response_code}]: {response_desc}"
            raise MpesaError(err_msg, resp_data)

        return transaction

    # ── Callbacks ──

    async def process_callback(self, session: AsyncSession, body: dict) -> dict:
        """Process a B2C result callback."""
        result = body.get("Result", {})
        result_code = result.get("ResultCode")
        result_desc = result.get("ResultDesc", "")

        # ConversationID can be at top level OR inside Result
        conversation_id = body.get("ConversationID") or result.get("ConversationID")

        params = (result.get("ResultParameters") or {}).get("ResultParameter") or []
        param_map = {p["Key"]: p.get("Value") for p in params if "Key" in p}

        transaction_id = param_map.get("TransactionReceipt")

        # Match by ConversationID first (Safaricom may modify OriginatorConversationID)
        txn = None
        if conversation_id:
            query = (
                select(MpesaTransaction)
                .where(MpesaTransaction.conversation_id == conversation_id)
                .order_by(MpesaTransaction.created_at.desc())
                .limit(1)
            )
            txn_result = await session.execute(query)
            txn = txn_result.scalars().first()

        if not txn:
            originator_id = (
                result.get("OriginatorConversationID")
                or body.get("OriginatorConversationID")
            )
            if originator_id:
                query = (
                    select(MpesaTransaction)
                    .where(MpesaTransaction.originator_conversation_id == originator_id)
                    .order_by(MpesaTransaction.created_at.desc())
                    .limit(1)
                )
                txn_result = await session.execute(query)
                txn = txn_result.scalars().first()

        if not txn:
            mpesa_callbacks_total.labels(outcome="orphan").inc()
            logger.warning(
                "M-Pesa orphan callback — conv_id=%s",
                conversation_id,
            )
            return {"status": "orphan"}

        if txn.status in ("success", "failed"):
            mpesa_callbacks_total.labels(outcome="idempotent").inc()
            return {"status": "idempotent"}

        now = eat_now()
        new_status = "success" if result_code == 0 else "failed"
        txn.result_code = result_code
        txn.result_description = result_desc
        txn.transaction_id = transaction_id
        txn.status = new_status
        txn.updated_at = now

        friendly = RESULT_CODES.get(result_code, f"Unknown ({result_code})")
        logger.info(
            "M-Pesa callback processed",
            extra={
                "transaction_id": txn.id,
                "status": new_status,
                "result_code": result_code,
                "result_code_label": friendly,
            },
        )

        if txn.advance_id:
            advance = await session.get(Advance, txn.advance_id)
            if advance:
                advance.payment_status = "paid" if result_code == 0 else "failed"
                if result_code == 0:
                    advance.paid_at = now
                    # Record advance in worker wallet (only when paid)
                    from ..crud import wallet as crud_wallet
                    await crud_wallet.add_advance(
                        session,
                        worker_id=txn.worker_id,
                        amount=txn.amount,
                        reference_type="advance",
                        reference_id=txn.advance_id,
                        description=advance.notes or f"M-Pesa advance payment — {txn.transaction_id or ''}",
                    )
        elif txn.payroll_id:
            payroll = await session.get(Payroll, txn.payroll_id)
            if payroll:
                payroll.payment_status = "paid" if result_code == 0 else "failed"
                if result_code == 0:
                    payroll.paid_at = now
                    # Record payout in worker wallet
                    from ..crud import wallet as crud_wallet
                    await crud_wallet.add_payout(
                        session,
                        worker_id=txn.worker_id,
                        amount=txn.amount,
                        reference_type="payroll",
                        reference_id=txn.payroll_id,
                        description=f"M-Pesa payment — {txn.transaction_id or ''}",
                    )

        await session.flush()
        return {"status": new_status}

    async def process_timeout(self, session: AsyncSession, body: dict) -> dict:
        """Process a B2C queue timeout callback."""
        result = body.get("Result", {})
        result_code = result.get("ResultCode")
        result_desc = result.get("ResultDesc", "")
        originator_id = result.get("OriginatorConversationID") or body.get("OriginatorConversationID")

        txn = None
        if originator_id:
            query = (
                select(MpesaTransaction)
                .where(MpesaTransaction.originator_conversation_id == originator_id)
                .order_by(MpesaTransaction.created_at.desc())
                .limit(1)
            )
            txn_result = await session.execute(query)
            txn = txn_result.scalars().first()

        if not txn:
            logger.warning(
                "M-Pesa timeout callback — no matching transaction",
                extra={"originator_conversation_id": originator_id},
            )
            return {"status": "orphan"}

        if txn.status in ("success", "failed"):
            return {"status": "idempotent"}

        now = eat_now()
        txn.result_code = result_code
        txn.result_description = result_desc or "Queue timeout — request expired at Safaricom"
        txn.status = "failed"
        txn.updated_at = now

        if txn.advance_id:
            advance = await session.get(Advance, txn.advance_id)
            if advance:
                advance.payment_status = "failed"
        elif txn.payroll_id:
            payroll = await session.get(Payroll, txn.payroll_id)
            if payroll:
                payroll.payment_status = "failed"

        await session.flush()
        return {"status": "timeout"}
