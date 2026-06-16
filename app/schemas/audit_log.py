from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class AuditLogBase(BaseModel):
    user_id: Optional[int]
    action: str
    details: Optional[str]


class AuditLogRead(AuditLogBase):
    id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    event_time: EatDatetime
