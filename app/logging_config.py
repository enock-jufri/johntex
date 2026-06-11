import json
import logging
import logging.handlers
import os
import re
import sys
from datetime import datetime, timezone

from zoneinfo import ZoneInfo

EAT = ZoneInfo("Africa/Nairobi")


class SensitiveDataFilter(logging.Filter):
    """Redact sensitive fields from log records."""

    SENSITIVE_KEYS = frozenset({
        "password", "passwd", "secret", "token", "authorization",
        "access_token", "refresh_token", "jwt", "security_credential",
        "consumer_key", "consumer_secret", "credential",
    })

    SENSITIVE_VALUE_PATTERNS = [
        (re.compile(r'(Bearer\s+)[\w\-._~+/]+=*'), r'\1***REDACTED***'),
        (re.compile(r'(password[=:]["\']?)[^&\s"\']+'), r'\1***REDACTED***'),
        (re.compile(r'(secret[=:]["\']?)[^&\s"\']+'), r'\1***REDACTED***'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        for key in list(record.__dict__.keys()):
            if key.lower() in self.SENSITIVE_KEYS:
                setattr(record, key, "***REDACTED***")
        msg = record.getMessage()
        for pattern, replacement in self.SENSITIVE_VALUE_PATTERNS:
            msg = pattern.sub(replacement, msg)
        record.redacted_msg = msg
        return True


class EatFormatter(logging.Formatter):
    """Human-readable formatter with EAT timestamps for development."""

    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, tz=EAT)
        return dt.strftime(datefmt or "%Y-%m-%d %H:%M:%S") + " EAT"

    def format(self, record):
        record.asctime = self.formatTime(record)
        text = getattr(record, "redacted_msg", None) or record.getMessage()
        msg = f"{record.asctime} [{record.levelname:<7s}] {record.name}:{record.lineno} -- {text}"
        if record.exc_info and record.exc_info[0]:
            msg += "\n" + self.formatException(record.exc_info)
        return msg


class JsonFormatter(logging.Formatter):
    """Structured JSON formatter for production logs."""

    def format(self, record):
        data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": getattr(record, "redacted_msg", None) or record.getMessage(),
        }

        for attr in ("request_id", "method", "path", "status_code", "duration_ms", "client_ip", "user_agent"):
            value = getattr(record, attr, None)
            if value is not None:
                data[attr] = value

        if record.exc_info and record.exc_info[0]:
            exc_type, exc_value, _ = record.exc_info
            data["exception_type"] = exc_type.__name__
            data["exception_message"] = str(exc_value)
            data["traceback"] = self.formatException(record.exc_info)

        return json.dumps(data)


def _add_file_handler(
    root_logger: logging.Logger,
    log_dir: str,
    filename: str,
    level: int,
    formatter: logging.Formatter,
    sensitive_filter: logging.Filter,
    backup_count: int,
) -> bool:
    """Add a TimedRotatingFileHandler. Returns False if permission denied."""
    try:
        handler = logging.handlers.TimedRotatingFileHandler(
            os.path.join(log_dir, filename),
            when="midnight",
            interval=1,
            backupCount=backup_count,
            encoding="utf-8",
        )
    except PermissionError:
        return False
    handler.setLevel(level)
    handler.setFormatter(formatter)
    handler.addFilter(sensitive_filter)
    root_logger.addHandler(handler)
    return True


def setup_logging() -> None:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    environment = os.getenv("ENVIRONMENT", "development")
    log_dir = os.getenv("LOG_DIR", "/app/logs")
    retention_days = int(os.getenv("LOG_RETENTION_DAYS", "30"))

    try:
        os.makedirs(log_dir, exist_ok=True)
    except OSError:
        log_dir = "/tmp"
        os.makedirs(log_dir, exist_ok=True)

    is_prod = environment == "production"
    console_formatter = JsonFormatter() if is_prod else EatFormatter()
    file_formatter = JsonFormatter() if is_prod else EatFormatter()

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))

    sensitive_filter = SensitiveDataFilter()

    # Console handler — always added
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(getattr(logging, log_level, logging.INFO))
    console.setFormatter(console_formatter)
    console.addFilter(sensitive_filter)
    root_logger.addHandler(console)

    # File handlers — may fail if existing files are owned by a different user
    # (e.g., after a Docker rebuild). Fall back to console-only gracefully.
    file_level = getattr(logging, log_level, logging.INFO)

    ok_all = _add_file_handler(
        root_logger, log_dir, "payroll.log", file_level,
        file_formatter, sensitive_filter, retention_days,
    )
    ok_error = _add_file_handler(
        root_logger, log_dir, "payroll_error.log", logging.ERROR,
        file_formatter, sensitive_filter, retention_days,
    )

    if not ok_all and not ok_error:
        # Logged via console handler since file handlers aren't active yet
        pass

    # Suppress noisy third-party loggers
    for name in (
        "uvicorn.access",
        "httpx",
        "httpcore",
        "python_multipart.multipart",
        "passlib",
        "watchfiles",
    ):
        logging.getLogger(name).setLevel(logging.WARNING)

    if log_level == "DEBUG":
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
