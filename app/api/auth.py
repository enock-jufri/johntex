import asyncio
import logging

from app.timezone import eat_now
from slowapi import Limiter
from slowapi.util import get_remote_address

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..crud import audit as crud_audit
from ..database import get_session
from ..metrics import auth_attempts_total
from ..models import Role
from ..schemas import Token
from ..security import authenticate_user, create_access_token
from ..services.geo import resolve_location

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    client = request.client
    return client.host if client else "unknown"


@router.post("/token", response_model=Token)
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    ip = get_client_ip(request)

    user = await authenticate_user(form_data.username, form_data.password, session)
    if not user:
        auth_attempts_total.labels(result="failure").inc()
        logger.warning(
            "Failed login attempt",
            extra={"username": form_data.username, "client_ip": ip},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_attempts_total.labels(result="success").inc()
    logger.info(
        "Successful login",
        extra={"username": user.username, "user_id": user.id, "client_ip": ip},
    )
    result = await session.execute(select(Role).where(Role.id == user.role_id))
    role = result.scalars().first()
    role_name = role.name if role else "supervisor"
    access_token = create_access_token(data={"sub": user.username, "role": role_name, "user_id": user.id})

    user.last_login = eat_now()

    ua = request.headers.get("User-Agent", "")[:256]

    # Fire-and-forget geo-resolution to avoid blocking login
    location = None
    if ip and ip not in ("127.0.0.1", "::1", "localhost", ""):
        try:
            location = await asyncio.wait_for(resolve_location(ip), timeout=2.0)
        except (asyncio.TimeoutError, Exception):
            logger.debug("Geo-lookup timed out or failed for IP %s", ip)

    await crud_audit.log_action(
        session, user.id, "login", f"User {user.username} logged in",
        ip_address=ip,
        user_agent=ua,
        location=location,
    )
    await session.commit()
    return {"access_token": access_token, "token_type": "bearer"}
