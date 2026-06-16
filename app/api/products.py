import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from ..crud import audit as crud_audit
from ..crud import product as crud_product
from ..database import get_session
from ..models import Product
from ..schemas import ProductCreate, ProductRead, ProductUpdate
from ..security import get_current_admin, get_current_clerk, get_current_supervisor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=List[ProductRead])
async def read_products(
    skip: int = 0,
    limit: int = 100,
    active: bool = Query(False, description="Filter to only active products"),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    return await crud_product.get_products(session, skip=skip, limit=limit, active_only=active)


@router.post("/", response_model=ProductRead)
async def create_product(
    product: ProductCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    if product.unit_price < 0:
        logger.warning("Product creation failed: negative unit price", extra={"unit_price": product.unit_price})
        raise HTTPException(400, "Unit price cannot be negative")
    existing = await session.execute(
        select(Product).where(Product.name == product.name)
    )
    if existing.scalars().first():
        logger.warning("Product creation failed: duplicate name", extra={"product_name": product.name})
        raise HTTPException(status_code=400, detail="A product with this name already exists")
    await crud_audit.log_action(
        session, current_user.id, "product_created",
        f"{product.name} — {product.unit_price} KES/piece"
    )
    return await crud_product.create_product(session, product, current_user.id)


@router.get("/{product_id}", response_model=ProductRead)
async def read_product(
    product_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_clerk)
):
    db_product = await crud_product.get_product(session, product_id)
    if db_product is None:
        logger.warning("Product not found", extra={"product_id": product_id})
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int,
    product: ProductUpdate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_supervisor)
):
    existing = await session.get(Product, product_id)
    if existing is None:
        logger.warning("Product not found for update", extra={"product_id": product_id})
        raise HTTPException(status_code=404, detail="Product not found")
    if product.unit_price is not None and product.unit_price < 0:
        logger.warning("Product update failed: negative unit price", extra={"product_id": product_id, "unit_price": product.unit_price})
        raise HTTPException(400, "Unit price cannot be negative")

    changes = []
    if product.name and product.name != existing.name:
        changes.append(f"name → {product.name}")
    if product.unit_price is not None and product.unit_price != existing.unit_price:
        changes.append(f"price → {product.unit_price} KES")
    if product.active is not None and product.active != existing.active:
        changes.append("deactivated" if not product.active else "reactivated")
    if changes:
        await crud_audit.log_action(
            session, current_user.id, "product_updated",
            f"{existing.name} — {', '.join(changes)}"
        )
    logger.info("Product updated", extra={"product_id": product_id, "changes": changes})

    return await crud_product.update_product(session, product_id, product, current_user.id)


@router.delete("/{product_id}")
async def deactivate_product(
    product_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin)
):
    existing = await session.get(Product, product_id)
    if existing is None:
        logger.warning("Product not found for deactivation", extra={"product_id": product_id})
        raise HTTPException(status_code=404, detail="Product not found")
    await crud_audit.log_action(
        session, current_user.id, "product_deactivated",
        f"{existing.name} — {existing.unit_price} KES/piece"
    )
    await crud_product.update_product(session, product_id, ProductUpdate(active=False), current_user.id)
    return {"message": "Product deactivated"}
