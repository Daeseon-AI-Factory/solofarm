"""
Monthly report generator — aggregates transactions into P&L summaries.

# CORE_CANDIDATE — financial aggregation logic reusable across products.

Queries the financial_transaction table, groups by type and category,
and produces (or updates) a MonthlyReport record with cached totals.
"""

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial_transaction import FinancialTransaction
from app.models.monthly_report import MonthlyReport
from app.schemas.report import MonthlySummary, MonthlyTrend

logger = logging.getLogger(__name__)


async def generate_monthly_summary(
    db: AsyncSession,
    farm_id,
    year: int,
    month: int,
) -> MonthlySummary:
    """
    Aggregate confirmed transactions for a given month into a summary.

    Returns a MonthlySummary with totals and category breakdowns.
    Also upserts the MonthlyReport table for caching.
    """
    # Date range for the month
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    # Aggregate by type and category
    query = (
        select(
            FinancialTransaction.type,
            FinancialTransaction.category,
            func.sum(FinancialTransaction.amount).label("total"),
        )
        .where(
            FinancialTransaction.farm_id == farm_id,
            FinancialTransaction.status == "confirmed",
            FinancialTransaction.transaction_date >= month_start,
            FinancialTransaction.transaction_date < month_end,
        )
        .group_by(FinancialTransaction.type, FinancialTransaction.category)
    )

    result = await db.execute(query)
    rows = result.all()

    # Build category breakdowns — use int, Korean won has no decimals
    income_by_category: dict[str, int] = {}
    expense_by_category: dict[str, int] = {}
    total_income = 0
    total_expense = 0

    for txn_type, category, total in rows:
        amount = int(total or 0)
        if txn_type == "income":
            income_by_category[category] = amount
            total_income += amount
        elif txn_type == "expense":
            expense_by_category[category] = amount
            total_expense += amount

    net_profit = total_income - total_expense

    # Upsert MonthlyReport cache
    existing = await db.execute(
        select(MonthlyReport).where(
            MonthlyReport.farm_id == farm_id,
            MonthlyReport.year == year,
            MonthlyReport.month == month,
        )
    )
    report = existing.scalar_one_or_none()

    # Convert Decimal values to int for JSONB storage
    income_json = {k: int(v) for k, v in income_by_category.items()}
    expense_json = {k: int(v) for k, v in expense_by_category.items()}

    if report:
        report.total_income = total_income
        report.total_expense = total_expense
        report.net_profit = net_profit
        report.income_by_category = income_json
        report.expense_by_category = expense_json
    else:
        report = MonthlyReport(
            farm_id=farm_id,
            year=year,
            month=month,
            total_income=total_income,
            total_expense=total_expense,
            net_profit=net_profit,
            income_by_category=income_json,
            expense_by_category=expense_json,
            status="draft",
        )
        db.add(report)

    await db.commit()

    return MonthlySummary(
        year=year,
        month=month,
        total_income=total_income,
        total_expense=total_expense,
        net_profit=net_profit,
        income_by_category=income_by_category,
        expense_by_category=expense_by_category,
        status=report.status,
        report_pdf_url=report.report_pdf_url,
    )


async def get_monthly_trend(
    db: AsyncSession,
    farm_id,
    months: int = 6,
) -> list[MonthlyTrend]:
    """
    Get the last N months of financial data for trend charts.

    Pulls from the MonthlyReport cache first, fills gaps with live queries.
    """
    today = date.today()
    trends = []

    for i in range(months):
        # Walk backwards from current month
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        # Check cache first
        result = await db.execute(
            select(MonthlyReport).where(
                MonthlyReport.farm_id == farm_id,
                MonthlyReport.year == y,
                MonthlyReport.month == m,
            )
        )
        cached = result.scalar_one_or_none()

        if cached:
            trends.append(MonthlyTrend(
                year=y,
                month=m,
                total_income=int(cached.total_income or 0),
                total_expense=int(cached.total_expense or 0),
                net_profit=int(cached.net_profit or 0),
            ))
        else:
            # Live aggregation for months without cached report
            summary = await generate_monthly_summary(db, farm_id, y, m)
            trends.append(MonthlyTrend(
                year=summary.year,
                month=summary.month,
                total_income=summary.total_income,
                total_expense=summary.total_expense,
                net_profit=summary.net_profit,
            ))

    # Return in chronological order (oldest first)
    trends.reverse()
    return trends
