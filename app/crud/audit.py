from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import AuditLog


async def log_action(
    session: AsyncSession,
    user_id: int,
    action: str,
    details: str = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    location: Optional[str] = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        location=location,
    )
    session.add(entry)
