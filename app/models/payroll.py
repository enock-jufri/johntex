from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Payroll(SQLModel, table=True):
    __tablename__ = "payrolls"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    week_start: date
    gross_pay: float
    total_advances: float = 0.0
    total_deductions: float = 0.0
    net_pay: float
    processed: bool = True
    processed_at: datetime = Field(default_factory=_eatnow)
    created_at: datetime = Field(default_factory=_eatnow)
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_payrolls_week_start", "week_start"),
        Index("ix_payrolls_worker_week", "worker_id", "week_start"),
        Index("ix_payrolls_payment_status", "payment_status"),
    )
