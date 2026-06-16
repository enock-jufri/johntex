import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .database import get_session
from .models import User
from .schemas import TokenData

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise RuntimeError("SECRET_KEY environment variable is required in production")
    SECRET_KEY = "change-me-in-production"
    logger.warning("SECRET_KEY not set — using default, which is UNSAFE for production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def authenticate_user(username: str, password: str, session: AsyncSession):
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user:
        logger.warning("Auth failure: user not found", extra={"username": username})
        return False
    if not verify_password(password, user.hashed_password):
        logger.warning("Auth failure: wrong password", extra={"username": username})
        return False
    return user


async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        role_name: str = payload.get("role", "")
    except JWTError:
        logger.warning("Auth failure: JWT decode error")
        raise credentials_exception
    result = await session.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if user is None:
        logger.warning("Auth failure: user from token not found", extra={"username": username})
        raise credentials_exception
    user._role_name = role_name
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.active:
        logger.warning("Auth failure: inactive user", extra={"username": current_user.username, "user_id": current_user.id})
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_supervisor(current_user: User = Depends(get_current_active_user)):
    role_name = getattr(current_user, "_role_name", "")
    if role_name not in ("admin", "supervisor"):
        logger.warning("Auth failure: insufficient supervisor permissions", extra={"username": current_user.username, "role": role_name})
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_clerk(current_user: User = Depends(get_current_active_user)):
    role_name = getattr(current_user, "_role_name", "")
    if role_name not in ("admin", "supervisor", "clerk"):
        logger.warning("Auth failure: insufficient clerk permissions", extra={"username": current_user.username, "role": role_name})
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user


async def get_current_admin(current_user: User = Depends(get_current_active_user)):
    role_name = getattr(current_user, "_role_name", "")
    if role_name != "admin":
        logger.warning("Auth failure: insufficient admin permissions", extra={"username": current_user.username, "role": role_name})
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user
