"""Custom application exceptions with structured error responses."""


class AppError(Exception):
    """Base exception for application-level errors."""

    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.detail)
        self.detail = detail or self.detail


class NotFoundError(AppError):
    status_code = 404
    detail = "Resource not found"


class ValidationError(AppError):
    status_code = 400
    detail = "Validation error"


class ConflictError(AppError):
    status_code = 409
    detail = "Resource conflict"


class PaymentError(AppError):
    status_code = 502
    detail = "Payment failed"


class AuthError(AppError):
    status_code = 401
    detail = "Authentication failed"
