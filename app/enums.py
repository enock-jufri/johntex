import enum


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    mpesa = "mpesa"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    paid = "paid"
    failed = "failed"


class MpesaTransactionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    success = "success"
    failed = "failed"


class MpesaEnvironment(str, enum.Enum):
    sandbox = "sandbox"
    production = "production"


VALID_PAYMENT_METHODS = frozenset(m.value for m in PaymentMethod)
VALID_PAYMENT_STATUSES = frozenset(s.value for s in PaymentStatus)
