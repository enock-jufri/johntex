from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class ProductionLog(SQLModel, table=True):
    __tablename__ = "production_log"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    product_id: int = Field(foreign_key="products.id")
    production_date: date
    quantity: int
    amount: float
    notes: Optional[str] = None
    approved: bool = False
    approved_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_production_log_date", "production_date"),
        Index("ix_production_log_worker_date", "worker_id", "production_date"),
        Index("ix_production_log_approved", "approved"),
        Index("ix_production_log_worker_approved_date", "worker_id", "approved", "production_date"),
    )
