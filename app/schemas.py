from pydantic import BaseModel, PlainSerializer
from datetime import date, datetime
from typing import Annotated, Optional

from app.timezone import EAT


def _serialize_eat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=EAT)
    return dt.isoformat()


EatDatetime = Annotated[datetime, PlainSerializer(_serialize_eat, return_type=str)]

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    role: str

# Roles
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    pass

class RoleRead(RoleBase):
    id: int

# Users
class UserBase(BaseModel):
    username: str
    role_id: int

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    active: bool
    created_at: EatDatetime
    last_login: Optional[EatDatetime] = None


class UserActivity(BaseModel):
    user_id: int
    username: str
    role: str
    active: bool
    created_at: EatDatetime
    last_login: Optional[EatDatetime] = None
    total_actions: int
    recent_actions: list[str]

# Workers
class WorkerBase(BaseModel):
    name: str
    phone: str

class WorkerCreate(WorkerBase):
    pass

class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None

class WorkerRead(WorkerBase):
    id: int
    active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]

# Products
class ProductBase(BaseModel):
    name: str
    unit_price: float
    currency: str = "KES"
    tax_rate: float = 0.0

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit_price: Optional[float] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    active: Optional[bool] = None

class ProductRead(ProductBase):
    id: int
    active: bool
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]

# Production Log
class ProductionLogBase(BaseModel):
    worker_id: int
    product_id: int
    production_date: date
    quantity: int
    amount: float
    notes: Optional[str] = None

class ProductionLogCreate(ProductionLogBase):
    pass

class ProductionLogUpdate(BaseModel):
    quantity: Optional[int] = None
    amount: Optional[float] = None
    notes: Optional[str] = None
    approved: Optional[bool] = None

class ProductionLogRead(ProductionLogBase):
    id: int
    approved: bool
    approved_by: Optional[int]
    created_at: EatDatetime
    updated_at: Optional[EatDatetime]

# Advances
class AdvanceBase(BaseModel):
    worker_id: int
    advance_date: date
    amount: float
    currency: str = "KES"
    notes: Optional[str] = None

class AdvanceCreate(AdvanceBase):
    pass

class AdvanceUpdate(BaseModel):
    amount: Optional[float] = None
    notes: Optional[str] = None
    approved: Optional[bool] = None

class AdvanceRead(AdvanceBase):
    id: int
    approved: bool
    approved_by: Optional[int]
    created_at: EatDatetime
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[EatDatetime] = None

# Payrolls
class PayrollBase(BaseModel):
    worker_id: int
    week_start: date
    gross_pay: float
    total_advances: float = 0.0
    total_deductions: float = 0.0
    net_pay: float

class PayrollCreate(PayrollBase):
    pass

class PayrollRead(PayrollBase):
    id: int
    processed: bool
    processed_at: EatDatetime
    created_at: EatDatetime
    payment_method: str = "cash"
    payment_status: str = "pending"
    paid_at: Optional[EatDatetime] = None

# Settings
class SettingBase(BaseModel):
    key: str
    value: str

class SettingCreate(SettingBase):
    pass

class SettingRead(SettingBase):
    pass

# Audit Log
class AuditLogBase(BaseModel):
    user_id: Optional[int]
    action: str
    details: Optional[str]

class AuditLogRead(AuditLogBase):
    id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    event_time: EatDatetime


# Payments
class MpesaTransactionRead(BaseModel):
    id: int
    payroll_id: Optional[int] = None
    advance_id: Optional[int] = None
    worker_id: int
    amount: float
    phone: str
    conversation_id: Optional[str] = None
    originator_conversation_id: Optional[str] = None
    response_code: Optional[str] = None
    response_description: Optional[str] = None
    result_code: Optional[int] = None
    result_description: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str
    retry_count: int
    created_at: EatDatetime
    updated_at: Optional[EatDatetime] = None


class MpesaBulkPayRequest(BaseModel):
    payroll_ids: list[int]


class PayrollUpdatePaymentMethod(BaseModel):
    payment_method: str


class AdvanceBulkPayRequest(BaseModel):
    advance_ids: list[int]


class AdvanceUpdatePaymentMethod(BaseModel):
    payment_method: str


class MpesaSettingsResponse(BaseModel):
    environment: str
    base_url: str
    shortcode: str
    initiator_name: str
    consumer_key_set: bool
    consumer_secret_set: bool
    security_credential_set: bool


class MpesaSettingsUpdate(BaseModel):
    shortcode: Optional[str] = None
    initiator_name: Optional[str] = None


# Analytics
class DailyPoint(BaseModel):
    date: date
    revenue: float
    pieces: int


class WorkerStat(BaseModel):
    worker_id: int
    worker_name: str
    total_revenue: float
    total_pieces: int


class ProductStat(BaseModel):
    product_id: int
    product_name: str
    total_revenue: float
    total_pieces: int
    percentage: float


class WeeklyPayrollStat(BaseModel):
    week_start: date
    gross_pay: float
    net_pay: float


class AnalyticsResponse(BaseModel):
    total_revenue: float
    total_pieces: int
    total_payroll: float
    total_advances: float
    approved_count: int
    pending_count: int
    worker_count: int
    daily_revenue: list[DailyPoint]
    worker_stats: list[WorkerStat]
    product_stats: list[ProductStat]
    weekly_payroll: list[WeeklyPayrollStat]
    advance_total_approved: float
    advance_total_pending: float


# ── Wallet ──

class WalletTransactionRead(BaseModel):
    id: int
    worker_id: int
    type: str
    amount: float
    reference_type: str
    reference_id: int
    description: Optional[str] = None
    created_at: EatDatetime


class WorkerWalletRead(BaseModel):
    worker_id: int
    total_earned: float
    total_advanced: float
    total_paid: float
    balance: float
    updated_at: EatDatetime
    transactions: list[WalletTransactionRead] = []