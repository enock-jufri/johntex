from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class MpesaTransactionRead(BaseModel):
    id: int
    payroll_id: Optional[int] = None
    advance_id: Optional[int] = None
    worker_id: int
    amount: float
    phone: str
    conversation_id: Optional[str] = None
    originator_conversation_id: Optional[str] = None
    response_code: Optional[str] = None
    response_description: Optional[str] = None
    result_code: Optional[int] = None
    result_description: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str
    retry_count: int
    created_at: EatDatetime
    updated_at: Optional[EatDatetime] = None


class MpesaSettingsResponse(BaseModel):
    environment: str
    base_url: str
    shortcode: str
    initiator_name: str
    consumer_key_set: bool
    consumer_secret_set: bool
    security_credential_set: bool


class MpesaSettingsUpdate(BaseModel):
    shortcode: Optional[str] = None
    initiator_name: Optional[str] = None
