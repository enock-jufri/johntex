import os
import time
import asyncpg
import asyncio


async def wait_for_db():
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@db:5432/payroll")
    url = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print(f"Waiting for database...")
    for attempt in range(30):
        try:
            conn = await asyncpg.connect(url, timeout=5)
            await conn.close()
            print("Database is available")
            return
        except Exception:
            print(f"Database unavailable, retrying... ({attempt + 1}/30)")
            await asyncio.sleep(1)
    raise SystemExit("Database did not become available in time")


if __name__ == "__main__":
    asyncio.run(wait_for_db())
