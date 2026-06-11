from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, Index, SQLModel

from app.timezone import eat_now


def _eatnow():
    return eat_now()


class Role(SQLModel, table=True):
    __tablename__ = "roles"
    id: Optional[int] = Field(primary_key=True)
    name: str


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(primary_key=True)
    username: str = Field(unique=True)
    hashed_password: str
    role_id: int = Field(foreign_key="roles.id")
    active: bool = True
    created_at: datetime = Field(default_factory=_eatnow)
    last_login: Optional[datetime] = None

    __table_args__ = (
        Index("ix_users_active", "active"),
        Index("ix_users_role_id", "role_id"),
    )


class Worker(SQLModel, table=True):
    __tablename__ = "workers"
    id: Optional[int] = Field(primary_key=True)
    name: str = Field(unique=True)
    phone: str = Field(unique=True)
    active: bool = True
    created_by: Optional[int] = Field(foreign_key="users.id")
    updated_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_workers_active", "active"),
    )


class Product(SQLModel, table=True):
    __tablename__ = "products"
    id: Optional[int] = Field(primary_key=True)
    name: str = Field(unique=True)
    unit_price: float
    currency: str = "KES"
    tax_rate: float = 0.0
    active: bool = True
    created_by: Optional[int] = Field(foreign_key="users.id")
    updated_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_products_active", "active"),
    )


class ProductionLog(SQLModel, table=True):
    __tablename__ = "production_log"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    product_id: int = Field(foreign_key="products.id")
    production_date: date
    quantity: int
    amount: float
    notes: Optional[str] = None
    approved: bool = False
    approved_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_production_log_date", "production_date"),
        Index("ix_production_log_worker_date", "worker_id", "production_date"),
        Index("ix_production_log_approved", "approved"),
        Index("ix_production_log_worker_approved_date", "worker_id", "approved", "production_date"),
    )


class Advance(SQLModel, table=True):
    __tablename__ = "advances"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    advance_date: date
    amount: float
    currency: str = "KES"
    notes: Optional[str] = None
    approved: bool = False
    approved_by: Optional[int] = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=_eatnow)
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_advances_date", "advance_date"),
        Index("ix_advances_worker_date", "worker_id", "advance_date"),
        Index("ix_advances_approved", "approved"),
        Index("ix_advances_payment_status", "payment_status"),
    )


class Payroll(SQLModel, table=True):
    __tablename__ = "payrolls"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    week_start: date
    gross_pay: float
    total_advances: float = 0.0
    total_deductions: float = 0.0
    net_pay: float
    processed: bool = True
    processed_at: datetime = Field(default_factory=_eatnow)
    created_at: datetime = Field(default_factory=_eatnow)
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_payrolls_week_start", "week_start"),
        Index("ix_payrolls_worker_week", "worker_id", "week_start"),
        Index("ix_payrolls_payment_status", "payment_status"),
    )


class MpesaTransaction(SQLModel, table=True):
    __tablename__ = "mpesa_transactions"
    id: Optional[int] = Field(primary_key=True)
    payroll_id: Optional[int] = Field(default=None, foreign_key="payrolls.id", index=True)
    advance_id: Optional[int] = Field(default=None, foreign_key="advances.id", index=True)
    worker_id: int = Field(foreign_key="workers.id")
    amount: float
    phone: str
    conversation_id: Optional[str] = None
    originator_conversation_id: Optional[str] = None
    response_code: Optional[str] = None
    response_description: Optional[str] = None
    result_code: Optional[int] = None
    result_description: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str = "pending"
    retry_count: int = 0
    created_at: datetime = Field(default_factory=_eatnow)
    updated_at: Optional[datetime] = None

    __table_args__ = (
        Index("ix_mpesa_txn_worker", "worker_id"),
        Index("ix_mpesa_txn_status", "status"),
    )


class Setting(SQLModel, table=True):
    __tablename__ = "settings"
    key: str = Field(primary_key=True)
    value: str


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: Optional[int] = Field(primary_key=True)
    user_id: Optional[int] = Field(foreign_key="users.id")
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    event_time: datetime = Field(default_factory=_eatnow)

    __table_args__ = (
        Index("ix_audit_log_user", "user_id"),
        Index("ix_audit_log_action", "action"),
        Index("ix_audit_log_event_time", "event_time"),
    )


class WorkerWallet(SQLModel, table=True):
    """Single source of truth for a worker's balance. One row per worker."""

    __tablename__ = "worker_wallet"
    worker_id: int = Field(primary_key=True, foreign_key="workers.id")
    total_earned: float = 0.0
    total_advanced: float = 0.0
    total_paid: float = 0.0
    balance: float = 0.0  # total_earned - total_advanced - total_paid
    updated_at: datetime = Field(default_factory=_eatnow)


class WalletTransaction(SQLModel, table=True):
    """Ledger of every credit/debit/payout affecting a worker's wallet."""

    __tablename__ = "wallet_transactions"
    id: Optional[int] = Field(primary_key=True)
    worker_id: int = Field(foreign_key="workers.id")
    type: str  # 'earning' | 'advance' | 'payout'
    amount: float
    reference_type: str  # 'production_log' | 'advance' | 'payroll'
    reference_id: int
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=_eatnow)

    __table_args__ = (
        Index("ix_wallet_txn_worker", "worker_id"),
        Index("ix_wallet_txn_ref", "reference_type", "reference_id"),
    )
