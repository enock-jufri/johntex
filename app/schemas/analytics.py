from datetime import date

from pydantic import BaseModel


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
