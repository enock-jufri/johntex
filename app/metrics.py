from prometheus_client import Counter, Histogram

# Payment metrics
payment_attempts_total = Counter(
    "payroll_payment_attempts_total",
    "Total M-Pesa payment attempts",
    ["status", "method"],
)

payment_duration_seconds = Histogram(
    "payroll_payment_duration_seconds",
    "M-Pesa B2C request duration in seconds",
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

# Auth metrics
auth_attempts_total = Counter(
    "payroll_auth_attempts_total",
    "Total authentication attempts",
    ["result"],
)

# M-Pesa callback metrics
mpesa_callbacks_total = Counter(
    "payroll_mpesa_callbacks_total",
    "Total M-Pesa callbacks received",
    ["outcome"],
)
