import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from ..crud import audit as crud_audit
from ..crud import worker as crud_worker
from ..database import get_session
from ..exceptions import ConflictError, NotFoundError, ValidationError
from ..models import Advance, MpesaTransaction, Payroll, ProductionLog, Worker
from ..schemas import WorkerCreate, WorkerRead, WorkerUpdate
from ..security import get_current_admin, get_current_clerk, get_current_supervisor
from ..services.mpesa import VALID_PHONE_EXAMPLES, format_phone, is_valid_phone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("/", response_model=List[WorkerRead])
async def read_workers(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    return await crud_worker.get_workers(session, skip=skip, limit=limit)


@router.post("/", response_model=WorkerRead)
async def create_worker(
    worker: WorkerCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    if not is_valid_phone(worker.phone):
        logger.warning("Worker creation failed: invalid phone", extra={"phone": worker.phone[:4] + "***"})
        raise ValidationError(f"Invalid phone number. Use {VALID_PHONE_EXAMPLES}")
    existing = await session.execute(
        select(Worker).where(Worker.name == worker.name)
    )
    if existing.scalars().first():
        logger.warning("Worker creation failed: duplicate name", extra={"worker_name": worker.name})
        raise ConflictError("A worker with this name already exists")

    existing_phone = await session.execute(
        select(Worker).where(Worker.phone == format_phone(worker.phone))
    )
    if existing_phone.scalars().first():
        logger.warning("Worker creation failed: duplicate phone", extra={"phone": worker.phone[:4] + "***"})
        raise ConflictError("A worker with this phone number already exists")

    normalized = format_phone(worker.phone)
    await crud_audit.log_action(session, current_user.id, "worker_created", f"{worker.name} — {normalized}")
    return await crud_worker.create_worker(session, worker, current_user.id)


@router.get("/{worker_id}", response_model=WorkerRead)
async def read_worker(
    worker_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    db_worker = await crud_worker.get_worker(session, worker_id)
    if db_worker is None:
        logger.warning("Worker not found", extra={"worker_id": worker_id})
        raise NotFoundError("Worker not found")
    return db_worker


@router.put("/{worker_id}", response_model=WorkerRead)
async def update_worker(
    worker_id: int,
    worker: WorkerUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    existing = await session.get(Worker, worker_id)
    if existing is None:
        logger.warning("Worker not found for update", extra={"worker_id": worker_id})
        raise NotFoundError("Worker not found")

    if worker.phone is not None and not is_valid_phone(worker.phone):
        logger.warning("Worker update failed: invalid phone", extra={"worker_id": worker_id, "phone": worker.phone[:4] + "***"})
        raise ValidationError(f"Invalid phone number. Use {VALID_PHONE_EXAMPLES}")

    changes = []
    if worker.name and worker.name != existing.name:
        changes.append(f"name → {worker.name}")
    if worker.phone and worker.phone != existing.phone:
        changes.append(f"phone → {worker.phone}")
    if worker.active is not None and worker.active != existing.active:
        changes.append("reactivated" if worker.active else "deactivated")
    if changes:
        await crud_audit.log_action(
            session, current_user.id, "worker_updated",
            f"{existing.name} — {', '.join(changes)}"
        )

    return await crud_worker.update_worker(session, worker_id, worker, current_user.id)


@router.delete("/{worker_id}")
async def delete_worker(
    worker_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin)
):
    existing = await session.get(Worker, worker_id)
    if existing is None:
        logger.warning("Worker not found for delete", extra={"worker_id": worker_id})
        raise NotFoundError("Worker not found")

    # Check for dependent records before allowing hard delete
    deps = []
    for model, label in [
        (ProductionLog, "production logs"),
        (Advance, "advances"),
        (Payroll, "payrolls"),
        (MpesaTransaction, "M-Pesa transactions"),
    ]:
        result = await session.execute(
            select(func.count()).select_from(model).where(model.worker_id == worker_id)
        )
        if result.scalar() > 0:
            deps.append(label)

    if deps:
        logger.warning("Worker delete blocked: has dependent records", extra={"worker_id": worker_id, "dependencies": deps})
        raise ConflictError(f"Cannot delete worker with existing {' ,'.join(deps)}. Deactivate instead.")

    await crud_audit.log_action(
        session, current_user.id, "worker_deleted",
        f"{existing.name} — {existing.phone}"
    )
    await crud_worker.delete_worker(session, worker_id)
    return {"message": "Worker deleted"}
