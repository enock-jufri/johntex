# Domain schema modules — imported individually by domain.
# All schemas re-exported here for convenient `from app.schemas import X` access.

from app.schemas.advance import (
    AdvanceBase,
    AdvanceBulkPayRequest,
    AdvanceCreate,
    AdvanceRead,
    AdvanceUpdate,
    AdvanceUpdatePaymentMethod,
)
from app.schemas.analytics import (
    AnalyticsResponse,
    DailyPoint,
    ProductStat,
    WeeklyPayrollStat,
    WorkerStat,
)
from app.schemas.audit_log import AuditLogBase, AuditLogRead
from app.schemas.auth import (
    RoleBase,
    RoleCreate,
    RoleRead,
    Token,
    TokenData,
    User,
    UserActivity,
    UserBase,
    UserCreate,
    UserRead,
)
from app.schemas.payment import (
    MpesaSettingsResponse,
    MpesaSettingsUpdate,
    MpesaTransactionRead,
)
from app.schemas.payroll import (
    MpesaBulkPayRequest,
    PayrollBase,
    PayrollCreate,
    PayrollRead,
    PayrollUpdatePaymentMethod,
)
from app.schemas.production_log import (
    ProductionLogBase,
    ProductionLogCreate,
    ProductionLogRead,
    ProductionLogUpdate,
)
from app.schemas.product import ProductBase, ProductCreate, ProductRead, ProductUpdate
from app.schemas.settings import SettingBase, SettingCreate, SettingRead
from app.schemas.wallet import WalletTransactionRead, WorkerWalletRead
from app.schemas.worker import WorkerBase, WorkerCreate, WorkerRead, WorkerUpdate

__all__ = [
    "AdvanceBase",
    "AdvanceBulkPayRequest",
    "AdvanceCreate",
    "AdvanceRead",
    "AdvanceUpdate",
    "AdvanceUpdatePaymentMethod",
    "AnalyticsResponse",
    "AuditLogBase",
    "AuditLogRead",
    "DailyPoint",
    "MpesaBulkPayRequest",
    "MpesaSettingsResponse",
    "MpesaSettingsUpdate",
    "MpesaTransactionRead",
    "PayrollBase",
    "PayrollCreate",
    "PayrollRead",
    "PayrollUpdatePaymentMethod",
    "ProductBase",
    "ProductCreate",
    "ProductRead",
    "ProductStat",
    "ProductUpdate",
    "ProductionLogBase",
    "ProductionLogCreate",
    "ProductionLogRead",
    "ProductionLogUpdate",
    "RoleBase",
    "RoleCreate",
    "RoleRead",
    "SettingBase",
    "SettingCreate",
    "SettingRead",
    "Token",
    "TokenData",
    "UserActivity",
    "UserBase",
    "UserCreate",
    "UserRead",
    "User",
    "WalletTransactionRead",
    "WeeklyPayrollStat",
    "WorkerBase",
    "WorkerCreate",
    "WorkerRead",
    "WorkerStat",
    "WorkerUpdate",
    "WorkerWalletRead",
]
