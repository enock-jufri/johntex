from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Advance(SQLModel, table=True):
    __tablename__ = "advances"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    advance_date: date
    amount: float
    currency: str = "KES"
    notes: Optional[str] = None
    approved: bool = False
    approved_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_advances_date", "advance_date"),
        Index("ix_advances_worker_date", "worker_id", "advance_date"),
        Index("ix_advances_approved", "approved"),
        Index("ix_advances_payment_status", "payment_status"),
    )
