from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class PayrollBase(BaseModel):
    worker_id: int
    week_start: date
    gross_pay: float
    total_advances: float = 0.0
    total_deductions: float = 0.0
    net_pay: float


class PayrollCreate(PayrollBase):
    pass


class PayrollRead(PayrollBase):
    id: int
    processed: bool
    processed_at: EatDatetime
    created_at: EatDatetime
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[EatDatetime] = None


class PayrollUpdatePaymentMethod(BaseModel):
    payment_method: str


class MpesaBulkPayRequest(BaseModel):
    payroll_ids: list[int]
