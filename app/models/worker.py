from datetime import datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Worker(SQLModel, table=True):
    __tablename__ = "workers"
    id: Optional[int] = Field(primary_key=True)
    name: str = Field(unique=True)
    phone: str = Field(unique=True)
    active: bool = True
    created_by: Optional[int] = Field(foreign_key="users.id")
    updated_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_workers_active", "active"),
    )
