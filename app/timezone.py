from datetime import datetime
from zoneinfo import ZoneInfo

EAT = ZoneInfo("Africa/Nairobi")


def eat_now() -> datetime:
    """Return current time in East Africa Time (Nairobi, UTC+3) as naive datetime.

    The value is naive so it can be stored in TIMESTAMP WITHOUT TIME ZONE columns.
    The Pydantic schema serializer (schemas._serialize_eat) attaches +03:00 on output.
    """
    return datetime.now(EAT).replace(tzinfo=None)


def as_eat(dt: datetime) -> datetime:
    """Attach EAT timezone to a naive datetime assumed to be in EAT."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=EAT)
    return dt.astimezone(EAT)
