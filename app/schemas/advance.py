from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class AdvanceBase(BaseModel):
    worker_id: int
    advance_date: date
    amount: float
    currency: str = "KES"
    notes: Optional[str] = None


class AdvanceCreate(AdvanceBase):
    pass


class AdvanceUpdate(BaseModel):
    amount: Optional[float] = None
    notes: Optional[str] = None
    approved: Optional[bool] = None


class AdvanceRead(AdvanceBase):
    id: int
    approved: bool
    approved_by: Optional[int]
    created_at: EatDatetime
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[EatDatetime] = None


class AdvanceBulkPayRequest(BaseModel):
    advance_ids: list[int]


class AdvanceUpdatePaymentMethod(BaseModel):
    payment_method: str
