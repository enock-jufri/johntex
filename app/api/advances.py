import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import advance as crud_advance
from ..crud import audit as crud_audit
from ..database import get_session
from ..models import Advance, Worker
from ..schemas import AdvanceCreate, AdvanceRead
from ..security import get_current_clerk, get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/advances", tags=["advances"])


@router.get("/", response_model=List[AdvanceRead])
async def read_advances(
    skip: int = 0,
    limit: int = 10000,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    payment_status: Optional[str] = Query(None),
    worker_id: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk),
):
    return await crud_advance.get_advances(
        session,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        payment_status=payment_status,
        worker_id=worker_id,
    )


@router.post("/", response_model=AdvanceRead)
async def create_advance(
    advance: AdvanceCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    if advance.amount <= 0:
        logger.warning("Advance creation failed: invalid amount", extra={"amount": advance.amount})
        raise HTTPException(400, "Amount must be greater than zero")

    worker = await session.get(Worker, advance.worker_id)
    worker_name = worker.name if worker else f"#{advance.worker_id}"
    await crud_audit.log_action(
        session, current_user.id, "advance_created",
        f"{worker_name} — {advance.amount} KES" + (f" ({advance.notes})" if advance.notes else "")
    )
    db_advance = await crud_advance.create_advance(session, advance)
    return db_advance


@router.put("/{advance_id}/approve", response_model=AdvanceRead)
async def approve_advance(
    advance_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    db_advance = await session.get(Advance, advance_id)
    if db_advance is None:
        logger.warning("Advance not found for approval", extra={"advance_id": advance_id})
        raise HTTPException(status_code=404, detail="Advance not found")

    worker = await session.get(Worker, db_advance.worker_id)
    worker_name = worker.name if worker else f"#{db_advance.worker_id}"
    await crud_audit.log_action(
        session, current_user.id, "advance_approved",
        f"{worker_name} — {db_advance.amount} KES" + (f" ({db_advance.notes})" if db_advance.notes else "")
    )

    db_advance = await crud_advance.approve_advance(session, advance_id, current_user.id)
    return db_advance
