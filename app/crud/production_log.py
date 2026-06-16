import logging
from datetime import date, datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from app.timezone import eat_now

from ..models import Product, ProductionLog
from ..schemas import ProductionLogCreate, ProductionLogUpdate

logger = logging.getLogger(__name__)


async def get_production_log(session: AsyncSession, log_id: int) -> ProductionLog | None:
    return await session.get(ProductionLog, log_id)


async def get_production_logs(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    worker_id: Optional[int] = None,
) -> list[ProductionLog]:
    stmt = select(ProductionLog)
    if start_date:
        stmt = stmt.where(ProductionLog.production_date >= start_date)
    if end_date:
        stmt = stmt.where(ProductionLog.production_date <= end_date)
    if worker_id:
        stmt = stmt.where(ProductionLog.worker_id == worker_id)
    stmt = stmt.order_by(desc(ProductionLog.production_date)).offset(skip).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()


async def create_production_log(session: AsyncSession, log: ProductionLogCreate, created_by: int) -> ProductionLog | None:
    product = await session.get(Product, log.product_id)
    if not product:
        logger.warning("Production creation failed: invalid product_id", extra={"product_id": log.product_id})
        return None
    amount = log.quantity * product.unit_price
    log_data = log.model_dump(exclude={'amount'})
    db_log = ProductionLog(**log_data, amount=amount)
    session.add(db_log)
    await session.commit()
    await session.refresh(db_log)
    return db_log


async def update_production_log(session: AsyncSession, log_id: int, log_update: ProductionLogUpdate) -> ProductionLog | None:
    db_log = await session.get(ProductionLog, log_id)
    if db_log:
        update_data = log_update.model_dump(exclude_unset=True)
        if 'quantity' in update_data:
            product = await session.get(Product, db_log.product_id)
            if product:
                update_data['amount'] = update_data['quantity'] * product.unit_price
        for key, value in update_data.items():
            setattr(db_log, key, value)
        db_log.updated_at = eat_now()
        await session.commit()
        await session.refresh(db_log)
    return db_log


async def approve_production_log(session: AsyncSession, log_id: int, approved_by: int) -> ProductionLog | None:
    db_log = await session.get(ProductionLog, log_id)
    if db_log:
        db_log.approved = True
        db_log.approved_by = approved_by
        db_log.updated_at = eat_now()
        await session.commit()
        await session.refresh(db_log)
    return db_log
