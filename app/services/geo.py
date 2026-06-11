import httpx
import logging

logger = logging.getLogger(__name__)


async def resolve_location(ip: str) -> str | None:
    """Resolve an IP address to a city/country string using ip-api.com."""
    if ip in ("127.0.0.1", "::1", "localhost", ""):
        return None
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    city = data.get("city", "")
                    country = data.get("country", "")
                    if city and country:
                        return f"{city}, {country}"
                    return country or city or None
    except Exception:
        logger.debug("Failed to resolve location for IP %s", ip)
    return None
