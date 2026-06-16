from datetime import datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Role(SQLModel, table=True):
    __tablename__ = "roles"
    id: Optional[int] = Field(primary_key=True)
    name: str


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(primary_key=True)
    username: str = Field(unique=True)
    hashed_password: str
    role_id: int = Field(foreign_key="roles.id")
    active: bool = True
    created_at: datetime = Field(default_factory=_eatnow)
    last_login: Optional[datetime] = None

    __table_args__ = (
        Index("ix_users_active", "active"),
        Index("ix_users_role_id", "role_id"),
    )
