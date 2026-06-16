from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class ProductionLogBase(BaseModel):
    worker_id: int
    product_id: int
    production_date: date
    quantity: int
    amount: float
    notes: Optional[str] = None


class ProductionLogCreate(ProductionLogBase):
    pass


class ProductionLogUpdate(BaseModel):
    quantity: Optional[int] = None
    amount: Optional[float] = None
    notes: Optional[str] = None
    approved: Optional[bool] = None


class ProductionLogRead(ProductionLogBase):
    id: int
    approved: bool
    approved_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]
