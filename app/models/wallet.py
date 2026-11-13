from pydantic import NaiveDatetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class WorkerWallet(SQLModel, table=True):
    """Single source of truth for a worker's balance. One row per worker."""

    __tablename__ = "worker_wallet"
    worker_id: int = Field(primary_key=True, foreign_key="workers.id")
    total_earned: float = 0.0
    total_advanced: float = 0.0
    total_paid: float = 0.0
    balance: float = 0.0  # total_earned - total_advanced - total_paid
    updated_at: NaiveDatetime = Field(default_factory=_eatnow)


class WalletTransaction(SQLModel, table=True):
    """Ledger of every credit/debit/payout affecting a worker's wallet."""

    __tablename__ = "wallet_transactions"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    type: str  # 'earning' | 'advance' | 'payout'
    amount: float
    reference_type: str  # 'production_log' | 'advance' | 'payroll'
    reference_id: int
    description: Optional[str] = None
    created_at: NaiveDatetime = Field(default_factory=_eatnow)

    __table_args__ = (
        Index("ix_wallet_txn_worker", "worker_id"),
        Index("ix_wallet_txn_ref", "reference_type", "reference_id"),
    )
