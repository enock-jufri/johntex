import logging
import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .tracing import REQUEST_ID_HEADER, generate_request_id, set_request_id

logger = logging.getLogger("app.middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER, generate_request_id())
        set_request_id(request_id)

        start = time.monotonic()

        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        user_agent = request.headers.get("User-Agent", "")[:256]

        status_code = 500
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        except Exception:
            logger.error(
                "Unhandled exception in request",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "client_ip": client_ip,
                    "user_agent": user_agent,
                    "duration_ms": round((time.monotonic() - start) * 1000, 2),
                },
            )
            raise
        finally:
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            extra = {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
                "user_agent": user_agent,
            }
            if status_code >= 500:
                logger.error(f"{request.method} {request.url.path} {status_code} — {duration_ms}ms", extra=extra)
            elif status_code >= 400:
                logger.warning(f"{request.method} {request.url.path} {status_code} — {duration_ms}ms", extra=extra)
            else:
                logger.info(f"{request.method} {request.url.path} {status_code} — {duration_ms}ms", extra=extra)
