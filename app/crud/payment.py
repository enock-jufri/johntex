import logging
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.timezone import eat_now

from ..models import MpesaTransaction

logger = logging.getLogger(__name__)


async def create_transaction(
    session: AsyncSession,
    payroll_id: int,
    worker_id: int,
    amount: float,
    phone: str,
    status: str = "pending",
) -> MpesaTransaction:
    txn = MpesaTransaction(
        payroll_id=payroll_id,
        worker_id=worker_id,
        amount=amount,
        phone=phone,
        status=status,
    )
    session.add(txn)
    await session.flush()
    return txn


async def update_transaction(
    session: AsyncSession, transaction_id: int, updates: dict
) -> MpesaTransaction | None:
    txn = await session.get(MpesaTransaction, transaction_id)
    if not txn:
        logger.warning("Transaction not found for update", extra={"transaction_id": transaction_id})
        return None
    logger.info("Transaction updated", extra={"transaction_id": transaction_id, "status": updates.get("status")})
    for k, v in updates.items():
        if hasattr(txn, k):
            setattr(txn, k, v)
    txn.updated_at = eat_now()
    await session.flush()
    return txn


async def get_transaction(
    session: AsyncSession, transaction_id: int
) -> MpesaTransaction | None:
    return await session.get(MpesaTransaction, transaction_id)


async def get_transactions(
    session: AsyncSession,
    payroll_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[MpesaTransaction]:
    stmt = select(MpesaTransaction).offset(skip).limit(limit)
    if payroll_id is not None:
        stmt = stmt.where(MpesaTransaction.payroll_id == payroll_id)
    stmt = stmt.order_by(desc(MpesaTransaction.created_at))
    result = await session.execute(stmt)
    return result.scalars().all()


async def get_latest_transaction(
    session: AsyncSession,
    payroll_id: Optional[int] = None,
    advance_id: Optional[int] = None,
) -> MpesaTransaction | None:
    stmt = select(MpesaTransaction).order_by(desc(MpesaTransaction.created_at)).limit(1)
    if payroll_id is not None:
        stmt = stmt.where(MpesaTransaction.payroll_id == payroll_id)
    if advance_id is not None:
        stmt = stmt.where(MpesaTransaction.advance_id == advance_id)
    result = await session.execute(stmt)
    return result.scalars().first()
