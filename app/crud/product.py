import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.timezone import eat_now

from ..models import Product
from ..schemas import ProductCreate, ProductUpdate

logger = logging.getLogger(__name__)


async def get_product(session: AsyncSession, product_id: int) -> Product | None:
    result = await session.execute(select(Product).where(Product.id == product_id))
    return result.scalars().first()


async def get_products(session: AsyncSession, skip: int = 0, limit: int = 100, active_only: bool = False) -> list[Product]:
    stmt = select(Product)
    if active_only:
        stmt = stmt.where(Product.active == True)
    result = await session.execute(stmt.offset(skip).limit(limit).order_by(Product.name))
    return result.scalars().all()


async def create_product(session: AsyncSession, product: ProductCreate, created_by: int) -> Product:
    db_product = Product(**product.model_dump(), created_by=created_by)
    session.add(db_product)
    await session.commit()
    await session.refresh(db_product)
    return db_product


async def update_product(session: AsyncSession, product_id: int, product_update: ProductUpdate, updated_by: int) -> Product | None:
    result = await session.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if db_product:
        update_data = product_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_product, key, value)
        db_product.updated_by = updated_by
        db_product.updated_at = eat_now()
        await session.commit()
        await session.refresh(db_product)
    return db_product


async def delete_product(session: AsyncSession, product_id: int) -> Product | None:
    result = await session.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if db_product:
        logger.info("Product hard-deleted", extra={"product_id": product_id, "product_name": db_product.name})
        await session.delete(db_product)
        await session.commit()
    else:
        logger.warning("Product not found for delete", extra={"product_id": product_id})
    return db_product
