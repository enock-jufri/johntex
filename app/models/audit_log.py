from pydantic import NaiveDatetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: Optional[int] = Field(primary_key=True)
    user_id: Optional[int] = Field(foreign_key="users.id")
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    event_time: NaiveDatetime = Field(default_factory=_eatnow)

    __table_args__ = (
        Index("ix_audit_log_user", "user_id"),
        Index("ix_audit_log_action", "action"),
        Index("ix_audit_log_event_time", "event_time"),
    )
