import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import audit as crud_audit
from ..crud import production_log as crud_log
from ..database import get_session
from ..models import Product, ProductionLog, Worker
from ..schemas import ProductionLogCreate, ProductionLogRead
from ..security import get_current_clerk, get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/production", tags=["production"])


@router.get("/", response_model=List[ProductionLogRead])
async def read_production_logs(
    skip: int = 0,
    limit: int = 1000,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    worker_id: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk),
):
    return await crud_log.get_production_logs(
        session, skip=skip, limit=limit, start_date=start_date, end_date=end_date, worker_id=worker_id
    )


@router.post("/", response_model=ProductionLogRead)
async def create_production_log(
    log: ProductionLogCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    if log.quantity <= 0:
        logger.warning("Production creation failed: invalid quantity", extra={"quantity": log.quantity})
        raise HTTPException(400, "Quantity must be greater than zero")
    if log.amount < 0:
        logger.warning("Production creation failed: negative amount", extra={"amount": log.amount})
        raise HTTPException(400, "Amount cannot be negative")

    worker = await session.get(Worker, log.worker_id)
    product = await session.get(Product, log.product_id)
    worker_name = worker.name if worker else f"#{log.worker_id}"
    product_name = product.name if product else f"#{log.product_id}"

    await crud_audit.log_action(
        session, current_user.id, "production_created",
        f"{worker_name} — {log.quantity}× {product_name} ({log.amount} KES)"
    )

    db_log = await crud_log.create_production_log(session, log, current_user.id)
    if db_log is None:
        logger.warning("Production creation failed: invalid product_id", extra={"product_id": log.product_id})
        raise HTTPException(status_code=400, detail="Invalid product_id")
    logger.info("Production log created", extra={"worker_id": log.worker_id, "product_id": log.product_id, "quantity": log.quantity, "amount": log.amount})
    return db_log


@router.put("/{log_id}/approve", response_model=ProductionLogRead)
async def approve_production_log(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    db_log = await session.get(ProductionLog, log_id)
    if db_log is None:
        logger.warning("Production log not found for approval", extra={"log_id": log_id})
        raise HTTPException(status_code=404, detail="Production log not found")

    worker = await session.get(Worker, db_log.worker_id)
    product = await session.get(Product, db_log.product_id)
    worker_name = worker.name if worker else f"#{db_log.worker_id}"
    product_name = product.name if product else f"#{db_log.product_id}"

    was_already_approved = db_log.approved

    await crud_audit.log_action(
        session, current_user.id, "production_approved",
        f"{worker_name} — {db_log.quantity}× {product_name} ({db_log.amount} KES)"
    )

    db_log = await crud_log.approve_production_log(session, log_id, current_user.id)

    # Credit worker wallet on first approval only
    if not was_already_approved:
        from ..crud import wallet as crud_wallet
        await crud_wallet.add_earning(
            session,
            worker_id=db_log.worker_id,
            amount=db_log.amount,
            reference_type="production_log",
            reference_id=db_log.id,
            description=f"{db_log.quantity}× {product_name}",
        )

    return db_log
