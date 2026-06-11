import logging
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.timezone import eat_now

from ..models import Advance, Payroll, ProductionLog, Worker

logger = logging.getLogger(__name__)


async def get_payrolls(session: AsyncSession, skip: int = 0, limit: int = 100, worker_id: int | None = None):
    stmt = select(Payroll)
    if worker_id:
        stmt = stmt.where(Payroll.worker_id == worker_id)
    result = await session.execute(stmt.offset(skip).limit(limit))
    return result.scalars().all()


async def run_payroll(session: AsyncSession, week_start: date, payment_method: str = "cash"):
    end_date = week_start + timedelta(days=6)

    result_workers = await session.execute(select(Worker).where(Worker.active == True))
    workers = result_workers.scalars().all()
    worker_ids = [w.id for w in workers]

    if not worker_ids:
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

    # Batch-fetch advances for all active workers in one query
    adv_result = await session.execute(
        select(
            Advance.worker_id,
            func.coalesce(func.sum(Advance.amount), 0.0).label("total"),
        )
        .where(
            Advance.worker_id.in_(worker_ids),
            Advance.approved == True,
            Advance.payment_status != "paid",
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
                payment_status="pending",
            )
            session.add(payroll)
            payrolls.append(payroll)

    await session.commit()
    for p in payrolls:
        await session.refresh(p)
    total_gross = sum(p.gross_pay for p in payrolls)
    total_net = sum(p.net_pay for p in payrolls)
    logger.info(
        "Payroll computed",
        extra={"week_start": str(week_start), "worker_count": len(payrolls), "total_gross": total_gross, "total_net": total_net},
    )
    return payrolls


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
    session: AsyncSession, payroll_id: int, payment_method: str
) -> Payroll | None:
    payroll = await session.get(Payroll, payroll_id)
    if not payroll:
        logger.warning("Payroll not found for method update", extra={"payroll_id": payroll_id})
        return None
    payroll.payment_method = payment_method
    await session.flush()
    return payroll
