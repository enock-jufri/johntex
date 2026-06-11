import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.timezone import eat_now

from ..models import Worker
from ..schemas import WorkerCreate, WorkerUpdate

logger = logging.getLogger(__name__)


async def get_worker(session: AsyncSession, worker_id: int):
    result = await session.execute(select(Worker).where(Worker.id == worker_id))
    return result.scalars().first()


async def get_workers(session: AsyncSession, skip: int = 0, limit: int = 100):
    result = await session.execute(select(Worker).offset(skip).limit(limit))
    return result.scalars().all()


async def create_worker(session: AsyncSession, worker: WorkerCreate, created_by: int):
    db_worker = Worker(**worker.model_dump(), created_by=created_by)
    session.add(db_worker)
    await session.commit()
    await session.refresh(db_worker)
    return db_worker


async def update_worker(session: AsyncSession, worker_id: int, worker_update: WorkerUpdate, updated_by: int):
    result = await session.execute(select(Worker).where(Worker.id == worker_id))
    db_worker = result.scalars().first()
    if db_worker:
        update_data = worker_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_worker, key, value)
        db_worker.updated_by = updated_by
        db_worker.updated_at = eat_now()
        await session.commit()
        await session.refresh(db_worker)
    return db_worker


async def deactivate_worker(session: AsyncSession, worker_id: int, updated_by: int):
    result = await session.execute(select(Worker).where(Worker.id == worker_id))
    db_worker = result.scalars().first()
    if db_worker:
        db_worker.active = False
        db_worker.updated_by = updated_by
        db_worker.updated_at = eat_now()
        await session.commit()
        await session.refresh(db_worker)
        logger.info("Worker deactivated", extra={"worker_id": worker_id, "worker_name": db_worker.name})
    else:
        logger.warning("Worker not found for deactivation", extra={"worker_id": worker_id})
    return db_worker


async def delete_worker(session: AsyncSession, worker_id: int):
    result = await session.execute(select(Worker).where(Worker.id == worker_id))
    db_worker = result.scalars().first()
    if db_worker:
        logger.info("Worker hard-deleted", extra={"worker_id": worker_id, "worker_name": db_worker.name})
        await session.delete(db_worker)
        await session.commit()
    else:
        logger.warning("Worker not found for delete", extra={"worker_id": worker_id})
    return db_worker
