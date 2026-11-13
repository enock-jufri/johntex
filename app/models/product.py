from pydantic import NaiveDatetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Product(SQLModel, table=True):
    __tablename__ = "products"
    id: Optional[int] = Field(primary_key=True)
    name: str = Field(unique=True)
    unit_price: float
    currency: str = "KES"
    tax_rate: float = 0.0
    active: bool = True
    created_by: Optional[int] = Field(foreign_key="users.id")
    updated_by: Optional[int] = Field(foreign_key="users.id")
    created_at: NaiveDatetime = Field(default_factory=_eatnow)
    updated_at: Optional[NaiveDatetime] = None

    __table_args__ = (
        Index("ix_products_active", "active"),
    )
