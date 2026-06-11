import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.timezone import eat_now

from ..models import WalletTransaction, WorkerWallet

logger = logging.getLogger(__name__)


async def get_wallet(session: AsyncSession, worker_id: int) -> WorkerWallet | None:
    return await session.get(WorkerWallet, worker_id)


async def get_or_create_wallet(session: AsyncSession, worker_id: int) -> WorkerWallet:
    wallet = await session.get(WorkerWallet, worker_id)
    if not wallet:
        wallet = WorkerWallet(worker_id=worker_id)
        session.add(wallet)
        await session.flush()
    return wallet


async def get_all_wallets(session: AsyncSession) -> list[WorkerWallet]:
    result = await session.execute(select(WorkerWallet))
    return result.scalars().all()


async def add_earning(
    session: AsyncSession,
    worker_id: int,
    amount: float,
    reference_type: str,
    reference_id: int,
    description: Optional[str] = None,
) -> WorkerWallet:
    wallet = await get_or_create_wallet(session, worker_id)
    wallet.total_earned += amount
    wallet.balance = wallet.total_earned - wallet.total_advanced - wallet.total_paid
    wallet.updated_at = eat_now()

    txn = WalletTransaction(
        worker_id=worker_id,
        type="earning",
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
    )
    session.add(txn)
    await session.flush()
    return wallet


async def add_advance(
    session: AsyncSession,
    worker_id: int,
    amount: float,
    reference_type: str,
    reference_id: int,
    description: Optional[str] = None,
) -> WorkerWallet:
    wallet = await get_or_create_wallet(session, worker_id)
    wallet.total_advanced += amount
    wallet.balance = wallet.total_earned - wallet.total_advanced - wallet.total_paid
    wallet.updated_at = eat_now()

    txn = WalletTransaction(
        worker_id=worker_id,
        type="advance",
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
    )
    session.add(txn)
    await session.flush()
    return wallet


async def add_payout(
    session: AsyncSession,
    worker_id: int,
    amount: float,
    reference_type: str,
    reference_id: int,
    description: Optional[str] = None,
) -> WorkerWallet:
    wallet = await get_or_create_wallet(session, worker_id)
    wallet.total_paid += amount
    wallet.balance = wallet.total_earned - wallet.total_advanced - wallet.total_paid
    wallet.updated_at = eat_now()

    txn = WalletTransaction(
        worker_id=worker_id,
        type="payout",
        amount=amount,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
    )
    session.add(txn)
    await session.flush()
    return wallet


async def get_transactions(
    session: AsyncSession,
    worker_id: int,
    skip: int = 0,
    limit: int = 50,
) -> list[WalletTransaction]:
    result = await session.execute(
        select(WalletTransaction)
        .where(WalletTransaction.worker_id == worker_id)
        .order_by(WalletTransaction.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def recalculate_wallet(session: AsyncSession, worker_id: int) -> WorkerWallet:
    """Rebuild a worker's wallet from actual production/advance/payment records."""
    from ..models import Advance, Payroll, ProductionLog

    wallet = await get_or_create_wallet(session, worker_id)

    # Sum approved production
    prod_result = await session.execute(
        select(func.coalesce(func.sum(ProductionLog.amount), 0.0)).where(
            ProductionLog.worker_id == worker_id,
            ProductionLog.approved == True,
        )
    )
    total_earned = float(prod_result.scalar() or 0.0)

    # Sum paid advances (only paid advances count against the wallet)
    adv_result = await session.execute(
        select(func.coalesce(func.sum(Advance.amount), 0.0)).where(
            Advance.worker_id == worker_id,
            Advance.payment_status == "paid",
        )
    )
    total_advanced = float(adv_result.scalar() or 0.0)

    # Sum paid payrolls
    pay_result = await session.execute(
        select(func.coalesce(func.sum(Payroll.net_pay), 0.0)).where(
            Payroll.worker_id == worker_id,
            Payroll.payment_status == "paid",
        )
    )
    total_paid = float(pay_result.scalar() or 0.0)

    wallet.total_earned = total_earned
    wallet.total_advanced = total_advanced
    wallet.total_paid = total_paid
    wallet.balance = total_earned - total_advanced - total_paid
    wallet.updated_at = eat_now()
    await session.flush()

    logger.info(
        "Wallet recalculated",
        extra={
            "worker_id": worker_id,
            "total_earned": total_earned,
            "total_advanced": total_advanced,
            "total_paid": total_paid,
            "balance": wallet.balance,
        },
    )
    return wallet
