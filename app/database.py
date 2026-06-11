import logging
import os

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/payroll"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"server_settings": {"timezone": "Africa/Nairobi"}},
)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

logger = logging.getLogger("app.database")


@event.listens_for(engine.sync_engine, "connect")
def receive_connect(dbapi_connection, connection_record):
    logger.debug("DB connection established from pool")


@event.listens_for(engine.sync_engine, "close")
def receive_close(dbapi_connection, connection_record):
    logger.debug("DB connection closed and returned to pool")


async def get_session():
    async with async_session() as session:
        yield session


async def check_db_health() -> bool:
    """Verify DB connectivity with a lightweight query."""
    try:
        async with async_session() as session:
            await session.execute(select(1))
        return True
    except Exception:
        logger.error("Database health check failed", exc_info=True)
        return False
