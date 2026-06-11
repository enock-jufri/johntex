import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud import wallet as crud_wallet
from ..database import get_session
from ..models import Worker
from ..schemas import WalletTransactionRead, WorkerWalletRead
from ..security import get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("/", response_model=List[WorkerWalletRead])
async def read_all_wallets(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    wallets = await crud_wallet.get_all_wallets(session)
    return [
        WorkerWalletRead(
            worker_id=w.worker_id,
            total_earned=w.total_earned,
            total_advanced=w.total_advanced,
            total_paid=w.total_paid,
            balance=w.balance,
            updated_at=w.updated_at,
        )
        for w in wallets
    ]


@router.get("/{worker_id}", response_model=WorkerWalletRead)
async def read_worker_wallet(
    worker_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    worker = await session.get(Worker, worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")

    wallet = await crud_wallet.get_wallet(session, worker_id)
    if not wallet:
        # Return empty wallet for workers with no activity
        return WorkerWalletRead(
            worker_id=worker_id,
            total_earned=0.0,
            total_advanced=0.0,
            total_paid=0.0,
            balance=0.0,
            updated_at=worker.created_at,
        )

    transactions = await crud_wallet.get_transactions(session, worker_id, limit=50)

    return WorkerWalletRead(
        worker_id=wallet.worker_id,
        total_earned=wallet.total_earned,
        total_advanced=wallet.total_advanced,
        total_paid=wallet.total_paid,
        balance=wallet.balance,
        updated_at=wallet.updated_at,
        transactions=[
            WalletTransactionRead(
                id=t.id,
                worker_id=t.worker_id,
                type=t.type,
                amount=t.amount,
                reference_type=t.reference_type,
                reference_id=t.reference_id,
                description=t.description,
                created_at=t.created_at,
            )
            for t in transactions
        ],
    )


@router.post("/{worker_id}/recalculate")
async def recalculate_wallet(
    worker_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor),
):
    worker = await session.get(Worker, worker_id)
    if not worker:
        raise HTTPException(404, "Worker not found")

    wallet = await crud_wallet.recalculate_wallet(session, worker_id)
    await session.commit()
    return {"message": f"Wallet recalculated for {worker.name}", "balance": wallet.balance}
