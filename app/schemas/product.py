from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer, field_validator

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class ProductBase(BaseModel):
    name: str
    unit_price: float
    currency: str = "KES"
    tax_rate: float = 0.0

    @field_validator("unit_price")
    @classmethod
    def validate_unit_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Unit price cannot be negative")
        return v

    @field_validator("tax_rate")
    @classmethod
    def validate_tax_rate(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("Tax rate must be between 0 and 100")
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    active: Optional[bool] = None


class ProductRead(ProductBase):
    id: int
    active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]
