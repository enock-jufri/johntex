import logging
import time
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import analytics as crud_analytics
from ..database import get_session
from ..schemas import AnalyticsResponse
from ..security import get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsResponse)
async def read_analytics(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    t0 = time.monotonic()
    data = await crud_analytics.get_analytics(session, start_date, end_date)
    duration = round((time.monotonic() - t0) * 1000, 2)
    logger.info(
        "Analytics query completed",
        extra={"start_date": str(start_date), "end_date": str(end_date), "duration_ms": duration, "total_revenue": data["total_revenue"]},
    )
    return AnalyticsResponse(**data)
