"""Payroll CRUD — pure data access functions only.

Business logic for payroll calculation lives in app/services/payroll_service.py.
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from ..models.payroll import Payroll

logger = logging.getLogger(__name__)


async def get_payrolls(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    worker_id: int | None = None,
) -> list[Payroll]:
    stmt = select(Payroll)
    if worker_id:
        stmt = stmt.where(Payroll.worker_id == worker_id)
    stmt = stmt.order_by(desc(Payroll.week_start)).offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()


async def get_payroll(
    session: AsyncSession,
    payroll_id: int,
) -> Payroll | None:
    return await session.get(Payroll, payroll_id)


async def update_payment_status(
    session: AsyncSession,
    payroll_id: int,
    status: str,
    paid_at: datetime | None = None,
) -> Payroll | None:
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        logger.warning("Payroll not found for status update", extra={"payroll_id": payroll_id})
        return None
    logger.info("Payment status updated", extra={"payroll_id": payroll_id, "status": status})
    payroll.payment_status = status
    if paid_at:
        payroll.paid_at = paid_at
    await session.flush()
    return payroll


async def update_payment_method(
    session: AsyncSession,
    payroll_id: int,
    payment_method: str,
) -> Payroll | None:
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        logger.warning("Payroll not found for method update", extra={"payroll_id": payroll_id})
        return None
    payroll.payment_method = payment_method
    await session.flush()
    return payroll
