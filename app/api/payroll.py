import logging
import time
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import audit as crud_audit
from ..crud import payroll as crud_payroll
from ..database import get_session
from ..schemas import PayrollRead
from ..security import get_current_admin, get_current_clerk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payroll", tags=["payroll"])


@router.get("/", response_model=List[PayrollRead])
async def read_payrolls(
    skip: int = 0,
    limit: int = 100,
    worker_id: Optional[int] = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    return await crud_payroll.get_payrolls(session, skip=skip, limit=limit, worker_id=worker_id)


@router.post("/run")
async def run_payroll_for_week(
    week_start: date,
    payment_method: str = Query("cash", pattern="^(cash|mpesa)$"),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin)
):
    t0 = time.monotonic()
    await crud_audit.log_action(session, current_user.id, "payroll_run", f"Payroll processed for week starting {week_start}")
    payrolls = await crud_payroll.run_payroll(session, week_start, payment_method=payment_method)
    duration = round((time.monotonic() - t0) * 1000, 2)
    logger.info(
        "Payroll run completed",
        extra={"week_start": str(week_start), "payment_method": payment_method, "count": len(payrolls), "duration_ms": duration},
    )
    return {"message": f"Payroll processed for week starting {week_start}", "processed_payrolls": len(payrolls)}
