"""
Financial report endpoints — dashboard, monthly P&L, yearly summary, PDF download.

The dashboard gives the farmer an at-a-glance view of current month finances.
Monthly/yearly endpoints provide detailed breakdowns for analysis and tax prep.
The PDF endpoint generates a downloadable report matching government standards.
"""

import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_farmer, get_current_farmer_or_token
from app.models.farmer import Farmer
from app.models.financial_transaction import FinancialTransaction
from app.modules.bookkeeping.chart_generator import generate_trend_chart
from app.modules.bookkeeping.report_generator import generate_monthly_summary, get_monthly_trend
from app.modules.bookkeeping.report_pdf import generate_monthly_report_pdf
from app.schemas.report import DashboardResponse, MonthlySummary, YearlySummary
from app.schemas.transaction import TransactionResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _txn_to_response(txn: FinancialTransaction) -> TransactionResponse:
    """Convert transaction ORM object to response schema."""
    return TransactionResponse(
        id=str(txn.id),
        type=txn.type,
        category=txn.category,
        amount=int(txn.amount),
        description=txn.description,
        counterparty=txn.counterparty,
        transaction_date=txn.transaction_date,
        source=txn.source,
        source_id=str(txn.source_id) if txn.source_id else None,
        farm_log_id=str(txn.farm_log_id) if txn.farm_log_id else None,
        status=txn.status,
        confidence=float(txn.confidence) if txn.confidence is not None else None,
        receipt_image_url=txn.receipt_image_url,
        notes=txn.notes,
        created_at=txn.created_at,
        updated_at=txn.updated_at,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    """
    Financial dashboard — current month summary + 6-month trend + recent transactions.

    This is the main screen the farmer sees when opening the financial tab.
    Designed for quick scanning on a phone screen.
    """
    farm_id = farmer.farm_id or farmer.id
    today = date.today()

    # Current month summary (computed live, cached to MonthlyReport)
    current = await generate_monthly_summary(db, farm_id, today.year, today.month)

    # 6-month trend for the bar chart
    trend = await get_monthly_trend(db, farm_id, months=6)

    # Recent 10 transactions
    result = await db.execute(
        select(FinancialTransaction)
        .where(FinancialTransaction.farm_id == farm_id)
        .order_by(
            FinancialTransaction.transaction_date.desc(),
            FinancialTransaction.created_at.desc(),
        )
        .limit(10)
    )
    recent = result.scalars().all()

    return DashboardResponse(
        current_month=current,
        trend=trend,
        recent_transactions=[_txn_to_response(t) for t in recent],
    )


@router.get("/monthly", response_model=MonthlySummary)
async def get_monthly_report(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> MonthlySummary:
    """Get detailed monthly P&L breakdown for a specific month."""
    farm_id = farmer.farm_id or farmer.id
    return await generate_monthly_summary(db, farm_id, year, month)


@router.get("/monthly/pdf")
async def download_monthly_pdf(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    farmer: Farmer = Depends(get_current_farmer_or_token),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download a monthly P&L report as PDF."""
    farm_id = farmer.farm_id or farmer.id

    # Generate current month summary
    summary = await generate_monthly_summary(db, farm_id, year, month)

    # Get previous month for comparison
    prev_month = month - 1
    prev_year = year
    if prev_month == 0:
        prev_month = 12
        prev_year = year - 1
    prev_summary = await generate_monthly_summary(db, farm_id, prev_year, prev_month)

    # Generate trend chart
    trend = await get_monthly_trend(db, farm_id, months=6)
    trend_chart = generate_trend_chart(trend) if trend else None

    # Generate PDF
    pdf_bytes = generate_monthly_report_pdf(
        summary=summary,
        prev_summary=prev_summary,
        trend_chart_png=trend_chart,
        farm_name="빈조농장",
    )

    filename = f"binjo_report_{year}_{month:02d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/yearly", response_model=YearlySummary)
async def get_yearly_report(
    year: int = Query(..., ge=2020, le=2100),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> YearlySummary:
    """Get 12-month financial summary for a given year."""
    farm_id = farmer.farm_id or farmer.id

    months = []
    total_income = 0
    total_expense = 0

    for m in range(1, 13):
        summary = await generate_monthly_summary(db, farm_id, year, m)
        months.append(summary)
        total_income += summary.total_income
        total_expense += summary.total_expense

    return YearlySummary(
        year=year,
        total_income=total_income,
        total_expense=total_expense,
        net_profit=total_income - total_expense,
        months=months,
    )
