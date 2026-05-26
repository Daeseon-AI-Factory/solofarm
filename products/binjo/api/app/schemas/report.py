"""Pydantic schemas for financial report endpoints."""

from pydantic import BaseModel

from app.schemas.transaction import TransactionResponse


class MonthlySummary(BaseModel):
    """Monthly P&L summary — used in dashboard and report endpoints."""

    year: int
    month: int
    # int, not Decimal — Korean won has no decimals
    total_income: int = 0
    total_expense: int = 0
    net_profit: int = 0
    income_by_category: dict[str, int] = {}
    expense_by_category: dict[str, int] = {}
    status: str = "draft"
    report_pdf_url: str | None = None


class MonthlyTrend(BaseModel):
    """Single month in a trend chart — minimal data for bar chart rendering."""

    year: int
    month: int
    total_income: int = 0
    total_expense: int = 0
    net_profit: int = 0


class DashboardResponse(BaseModel):
    """Financial dashboard — current month + trend + recent transactions."""

    current_month: MonthlySummary
    trend: list[MonthlyTrend]  # Last 6 months
    recent_transactions: list[TransactionResponse]  # Last 10


class YearlySummary(BaseModel):
    """12-month financial summary for a given year."""

    year: int
    total_income: int = 0
    total_expense: int = 0
    net_profit: int = 0
    months: list[MonthlySummary]
