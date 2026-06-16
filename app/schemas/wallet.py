from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class WalletTransactionRead(BaseModel):
    id: int
    worker_id: int
    type: str
    amount: float
    reference_type: str
    reference_id: int
    description: Optional[str] = None
    created_at: EatDatetime


class WorkerWalletRead(BaseModel):
    worker_id: int
    total_earned: float
    total_advanced: float
    total_paid: float
    balance: float
    updated_at: EatDatetime
    transactions: list[WalletTransactionRead] = []
