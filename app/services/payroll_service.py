"""Payroll service — owns business logic for payroll calculation and processing.

Extracted from crud/payroll.py's run_payroll function which was doing business logic
inside what should be a pure data-access layer.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.enums import PaymentMethod, PaymentStatus
from app.timezone import eat_now

from ..crud import audit as crud_audit
from ..models.advance import Advance
from ..models.payroll import Payroll
from ..models.production_log import ProductionLog
from ..models.worker import Worker

logger = logging.getLogger(__name__)


async def run_payroll(
    session: AsyncSession,
    week_start: date,
    payment_method: str = PaymentMethod.cash.value,
    current_user_id: int | None = None,
) -> list[Payroll]:
    """Calculate and create/update payroll for all active workers for a given week.

    Steps:
    1. Fetch all active workers
    2. Calculate gross pay from approved production logs
    3. Subtract outstanding advances
    4. Create or update Payroll records
    5. Log audit entry

    Returns the list of created/updated Payroll records.
    """
    end_date = week_start + timedelta(days=6)

    result_workers = await session.execute(select(Worker).where(Worker.active == True))
    workers = result_workers.scalars().all()
    worker_ids = [w.id for w in workers]

    if not worker_ids:
        logger.info("No active workers found for payroll run", extra={"week_start": str(week_start)})
        return []

    # Batch-fetch gross pay for all active workers in one query
    gross_result = await session.execute(
        select(
            ProductionLog.worker_id,
            func.coalesce(func.sum(ProductionLog.amount), 0.0).label("gross"),
        )
        .where(
            ProductionLog.worker_id.in_(worker_ids),
            ProductionLog.approved == True,
            ProductionLog.production_date >= week_start,
            ProductionLog.production_date <= end_date,
        )
        .group_by(ProductionLog.worker_id)
    )
    gross_by_worker = {row.worker_id: float(row.gross) for row in gross_result.all()}

    # Batch-fetch outstanding advances for all active workers
    adv_result = await session.execute(
        select(
            Advance.worker_id,
            func.coalesce(func.sum(Advance.amount), 0.0).label("total"),
        )
        .where(
            Advance.worker_id.in_(worker_ids),
            Advance.approved == True,
            Advance.payment_status != PaymentStatus.paid.value,
            Advance.advance_date >= week_start,
            Advance.advance_date <= end_date,
        )
        .group_by(Advance.worker_id)
    )
    advances_by_worker = {row.worker_id: float(row.total) for row in adv_result.all()}

    # Batch-fetch existing payroll records for this week
    existing_result = await session.execute(
        select(Payroll).where(
            Payroll.worker_id.in_(worker_ids),
            Payroll.week_start == week_start,
        )
    )
    existing_by_worker = {p.worker_id: p for p in existing_result.scalars().all()}

    payrolls = []
    for worker in workers:
        gross = gross_by_worker.get(worker.id, 0.0)
        advances = advances_by_worker.get(worker.id, 0.0)
        net = gross - advances

        existing = existing_by_worker.get(worker.id)
        if existing:
            existing.gross_pay = gross
            existing.total_advances = advances
            existing.net_pay = net
            existing.processed_at = eat_now()
            payrolls.append(existing)
        else:
            payroll = Payroll(
                worker_id=worker.id,
                week_start=week_start,
                gross_pay=gross,
                total_advances=advances,
                net_pay=net,
                payment_method=payment_method,
                payment_status=PaymentStatus.pending.value,
            )
            session.add(payroll)
            payrolls.append(payroll)

    await session.flush()
    for p in payrolls:
        await session.refresh(p)

    total_gross = sum(p.gross_pay for p in payrolls)
    total_net = sum(p.net_pay for p in payrolls)

    if current_user_id:
        await crud_audit.log_action(
            session, current_user_id, "payroll_run",
            f"Payroll processed for week starting {week_start} — {len(payrolls)} workers, {total_net:.0f} KES net",
        )

    logger.info(
        "Payroll computed",
        extra={
            "week_start": str(week_start),
            "worker_count": len(payrolls),
            "total_gross": total_gross,
            "total_net": total_net,
        },
    )
    return payrolls
