from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Setting


async def get_setting(session: AsyncSession, key: str) -> Optional[str]:
    s = await session.get(Setting, key)
    return s.value if s else None


async def set_setting(session: AsyncSession, key: str, value: str) -> Setting:
    s = await session.get(Setting, key)
    if s:
        s.value = value
    else:
        s = Setting(key=key, value=value)
        session.add(s)
    await session.flush()
    return s


async def get_settings_by_prefix(
    session: AsyncSession, prefix: str
) -> dict[str, str]:
    result = await session.execute(
        select(Setting).where(Setting.key.startswith(prefix))
    )
    return {s.key: s.value for s in result.scalars().all()}
