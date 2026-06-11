import logging
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..database import get_session
from ..models import AuditLog
from ..schemas import AuditLogRead
from ..security import get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/", response_model=List[AuditLogRead])
async def read_audit_logs(
    skip: int = 0,
    limit: int = 10000,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    action: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    stmt = select(AuditLog)
    if start_date:
        stmt = stmt.where(func.date(AuditLog.event_time) >= start_date)
    if end_date:
        stmt = stmt.where(func.date(AuditLog.event_time) <= end_date)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    stmt = stmt.order_by(AuditLog.event_time.desc()).offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/actions", response_model=List[str])
async def read_audit_actions(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    result = await session.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    return [row[0] for row in result.all()]
