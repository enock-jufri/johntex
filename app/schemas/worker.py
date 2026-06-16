from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class WorkerBase(BaseModel):
    name: str
    phone: str


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None


class WorkerRead(WorkerBase):
    id: int
    active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]
