import logging
import os

from .logging_config import setup_logging

setup_logging()

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .api import (
    advances,
    alerts,
    analytics,
    audit,
    auth,
    payments,
    payroll,
    production,
    products,
    users,
    wallet,
    workers,
)
from .database import check_db_health
from .exceptions import AppError
from .middleware import RequestLoggingMiddleware

logger = logging.getLogger(__name__)

# Validate critical environment variables at startup
_REQUIRED_ENV_VARS = {
    "SECRET_KEY": "JWT signing key — generate a strong random string",
    "DATABASE_URL": "PostgreSQL connection string",
}
_MISSING = [k for k, _ in _REQUIRED_ENV_VARS.items() if not os.getenv(k)]
if _MISSING:
    for k in _MISSING:
        logger.warning(
            "Missing environment variable: %s (%s) — using default, unsafe for production",
            k,
            _REQUIRED_ENV_VARS[k],
        )
else:
    logger.debug("All required environment variables set")

app = FastAPI(title="Payroll System", version="1.0.0")

app.add_middleware(RequestLoggingMiddleware)

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator(
    should_group_status_codes=True,
    should_group_untemplated=True,
    excluded_handlers=["/metrics", "/health", "/alerts/telegram", "/payments/mpesa/callback", "/payments/mpesa/timeout"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.include_router(auth.router)
app.include_router(workers.router)
app.include_router(products.router)
app.include_router(production.router)
app.include_router(advances.router)
app.include_router(payroll.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(users.router)
app.include_router(payments.router)
app.include_router(wallet.router)
app.include_router(alerts.router)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again later."})


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    extra = {
        "method": request.method,
        "path": request.url.path,
        "status_code": exc.status_code,
        "client_ip": request.client.host if request.client else "unknown",
    }
    if exc.status_code >= 500:
        logger.error(f"AppError {exc.status_code}: {exc.detail}", extra=extra)
    else:
        logger.warning(f"AppError {exc.status_code}: {exc.detail}", extra=extra)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    extra = {
        "method": request.method,
        "path": request.url.path,
        "status_code": exc.status_code,
        "client_ip": request.client.host if request.client else "unknown",
    }
    if exc.status_code >= 500:
        logger.error(
            f"HTTP {exc.status_code}: {exc.detail}",
            extra=extra,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
    else:
        logger.warning(f"HTTP {exc.status_code}: {exc.detail}", extra=extra)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else "unknown",
        },
        exc_info=True,
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/")
async def root():
    return {"message": "Payroll API"}


@app.get("/health")
async def health():
    db_healthy = await check_db_health()
    return JSONResponse(
        status_code=200 if db_healthy else 503,
        content={
            "status": "healthy" if db_healthy else "degraded",
            "database": "connected" if db_healthy else "disconnected",
        },
    )
