from datetime import date

from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..models import Advance, Payroll, ProductionLog, Product, Worker


async def get_analytics(session: AsyncSession, start_date: date, end_date: date):
    # Combine daily revenue/pieces with totals in one query using window functions
    # We'll use two main queries instead of 8+ separate round-trips

    # 1. Production stats: daily + totals + worker stats + product stats
    daily_result = await session.execute(
        select(
            ProductionLog.production_date.label("date"),
            func.sum(ProductionLog.amount).label("revenue"),
            func.sum(ProductionLog.quantity).label("pieces"),
        )
        .where(
            ProductionLog.production_date >= start_date,
            ProductionLog.production_date <= end_date,
        )
        .group_by(ProductionLog.production_date)
        .order_by(ProductionLog.production_date)
    )
    daily_rows = daily_result.all()
    daily_revenue = [
        {"date": row.date, "revenue": float(row.revenue or 0), "pieces": int(row.pieces or 0)}
        for row in daily_rows
    ]
    total_revenue = sum(d["revenue"] for d in daily_revenue)
    total_pieces = sum(d["pieces"] for d in daily_revenue)

    # 2. Approved/pending counts in a single query
    approval_result = await session.execute(
        select(
            func.coalesce(func.sum(case((ProductionLog.approved == True, 1), else_=0)), 0).label("approved"),
            func.count(ProductionLog.id).label("total"),
        ).where(
            ProductionLog.production_date >= start_date,
            ProductionLog.production_date <= end_date,
        )
    )
    approval_row = approval_result.one()
    approved_count = int(approval_row.approved)
    pending_count = int(approval_row.total) - approved_count

    # 3. Worker stats with join (single query)
    worker_result = await session.execute(
        select(
            ProductionLog.worker_id,
            Worker.name.label("worker_name"),
            func.sum(ProductionLog.amount).label("total_revenue"),
            func.sum(ProductionLog.quantity).label("total_pieces"),
        )
        .join(Worker, ProductionLog.worker_id == Worker.id)
        .where(
            ProductionLog.production_date >= start_date,
            ProductionLog.production_date <= end_date,
        )
        .group_by(ProductionLog.worker_id, Worker.name)
        .order_by(func.sum(ProductionLog.amount).desc())
    )
    worker_stats = [
        {
            "worker_id": row.worker_id,
            "worker_name": row.worker_name,
            "total_revenue": float(row.total_revenue or 0),
            "total_pieces": int(row.total_pieces or 0),
        }
        for row in worker_result.all()
    ]

    # 4. Product stats with percentage (single query)
    product_result = await session.execute(
        select(
            ProductionLog.product_id,
            Product.name.label("product_name"),
            func.sum(ProductionLog.amount).label("total_revenue"),
            func.sum(ProductionLog.quantity).label("total_pieces"),
        )
        .join(Product, ProductionLog.product_id == Product.id)
        .where(
            ProductionLog.production_date >= start_date,
            ProductionLog.production_date <= end_date,
        )
        .group_by(ProductionLog.product_id, Product.name)
        .order_by(func.sum(ProductionLog.amount).desc())
    )
    product_rows = product_result.all()
    total_product_revenue = sum(float(row.total_revenue or 0) for row in product_rows)
    product_stats = []
    for row in product_rows:
        rev = float(row.total_revenue or 0)
        product_stats.append({
            "product_id": row.product_id,
            "product_name": row.product_name,
            "total_revenue": rev,
            "total_pieces": int(row.total_pieces or 0),
            "percentage": round((rev / total_product_revenue * 100) if total_product_revenue > 0 else 0, 1),
        })

    # 5. Active worker count
    worker_count_result = await session.execute(
        select(func.count(Worker.id)).where(Worker.active == True)
    )
    worker_count = worker_count_result.scalar() or 0

    # 6. Payroll: totals + weekly breakdown in one query
    payroll_rows_result = await session.execute(
        select(
            Payroll.week_start,
            func.sum(Payroll.gross_pay).label("gross_pay"),
            func.sum(Payroll.net_pay).label("net_pay"),
        )
        .where(
            Payroll.week_start >= start_date,
            Payroll.week_start <= end_date,
        )
        .group_by(Payroll.week_start)
        .order_by(Payroll.week_start)
    )
    payroll_rows = payroll_rows_result.all()
    weekly_payroll = [
        {
            "week_start": row.week_start,
            "gross_pay": float(row.gross_pay or 0),
            "net_pay": float(row.net_pay or 0),
        }
        for row in payroll_rows
    ]
    total_payroll = sum(w["net_pay"] for w in weekly_payroll)

    # 7. Advance totals: approved, pending, and total in one query
    advance_result = await session.execute(
        select(
            func.coalesce(func.sum(case((Advance.approved == True, Advance.amount), else_=0.0)), 0.0).label("approved_total"),
            func.coalesce(func.sum(case((Advance.approved == False, Advance.amount), else_=0.0)), 0.0).label("pending_total"),
        ).where(
            Advance.advance_date >= start_date,
            Advance.advance_date <= end_date,
        )
    )
    adv_row = advance_result.one()
    advance_total_approved = float(adv_row.approved_total)
    advance_total_pending = float(adv_row.pending_total)
    total_advances = advance_total_approved + advance_total_pending

    return {
        "total_revenue": total_revenue,
        "total_pieces": total_pieces,
        "total_payroll": total_payroll,
        "total_advances": total_advances,
        "approved_count": approved_count,
        "pending_count": pending_count,
        "worker_count": worker_count,
        "daily_revenue": daily_revenue,
        "worker_stats": worker_stats,
        "product_stats": product_stats,
        "weekly_payroll": weekly_payroll,
        "advance_total_approved": advance_total_approved,
        "advance_total_pending": advance_total_pending,
    }
