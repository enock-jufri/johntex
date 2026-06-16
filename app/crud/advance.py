import logging
from datetime import date, datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from ..models import Advance
from ..schemas import AdvanceCreate, AdvanceUpdate

logger = logging.getLogger(__name__)


async def get_advance(session: AsyncSession, advance_id: int) -> Advance | None:
    return await session.get(Advance, advance_id)


async def get_advances(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_status: Optional[str] = None,
    worker_id: Optional[int] = None,
) -> list[Advance]:
    stmt = select(Advance)
    if start_date:
        stmt = stmt.where(Advance.advance_date >= start_date)
    if end_date:
        stmt = stmt.where(Advance.advance_date <= end_date)
    if payment_status:
        stmt = stmt.where(Advance.payment_status == payment_status)
    if worker_id:
        stmt = stmt.where(Advance.worker_id == worker_id)
    stmt = stmt.order_by(desc(Advance.created_at)).offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()


async def create_advance(session: AsyncSession, advance: AdvanceCreate) -> Advance:
    db_advance = Advance(**advance.model_dump())
    session.add(db_advance)
    await session.commit()
    await session.refresh(db_advance)
    return db_advance


async def update_advance(session: AsyncSession, advance_id: int, advance_update: AdvanceUpdate) -> Advance | None:
    db_advance = await session.get(Advance, advance_id)
    if db_advance:
        update_data = advance_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_advance, key, value)
        await session.commit()
        await session.refresh(db_advance)
    return db_advance


async def approve_advance(session: AsyncSession, advance_id: int, approved_by: int) -> Advance | None:
    db_advance = await session.get(Advance, advance_id)
    if db_advance:
        db_advance.approved = True
        db_advance.approved_by = approved_by
        await session.commit()
        await session.refresh(db_advance)
        logger.info("Advance approved", extra={"advance_id": advance_id, "amount": db_advance.amount})
    else:
        logger.warning("Advance not found for approval", extra={"advance_id": advance_id})
    return db_advance


async def update_advance_payment_status(
    session: AsyncSession,
    advance_id: int,
    status: str,
    paid_at: Optional[datetime] = None,
) -> Advance | None:
    advance = await session.get(Advance, advance_id)
    if not advance:
        logger.warning("Advance not found for status update", extra={"advance_id": advance_id})
        return None
    advance.payment_status = status
    if paid_at:
        advance.paid_at = paid_at
    await session.flush()
    return advance


async def update_advance_payment_method(
    session: AsyncSession, advance_id: int, payment_method: str
) -> Advance | None:
    advance = await session.get(Advance, advance_id)
    if not advance:
        logger.warning("Advance not found for method update", extra={"advance_id": advance_id})
        return None
    advance.payment_method = payment_method
    await session.flush()
    return advance
