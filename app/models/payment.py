from pydantic import NaiveDatetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class MpesaTransaction(SQLModel, table=True):
    __tablename__ = "mpesa_transactions"
    id: Optional[int] = Field(primary_key=True)
    payroll_id: Optional[int] = Field(default=None, foreign_key="payrolls.id", index=True)
    advance_id: Optional[int] = Field(default=None, foreign_key="advances.id", index=True)
    worker_id: int = Field(foreign_key="workers.id")
    amount: float
    phone: str
    conversation_id: Optional[str] = None
    originator_conversation_id: Optional[str] = None
    response_code: Optional[str] = None
    response_description: Optional[str] = None
    result_code: Optional[int] = None
    result_description: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str = "pending"
    retry_count: int = 0
    created_at: NaiveDatetime = Field(default_factory=_eatnow)
    updated_at: Optional[NaiveDatetime] = None

    __table_args__ = (
        Index("ix_mpesa_txn_worker", "worker_id"),
        Index("ix_mpesa_txn_status", "status"),
    )
