from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, PlainSerializer

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class User(BaseModel):
    username: str
    role: str


# Roles
class RoleBase(BaseModel):
    name: str


class RoleCreate(RoleBase):
    pass


class RoleRead(RoleBase):
    id: int


# Users
class UserBase(BaseModel):
    username: str
    role_id: int


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    active: bool
    created_at: EatDatetime
    last_login: Optional[EatDatetime] = None


class UserActivity(BaseModel):
    user_id: int
    username: str
    role: str
    active: bool
    created_at: EatDatetime
    last_login: Optional[EatDatetime] = None
    total_actions: int
    recent_actions: list[str]
