"""
Monthly report model — cached P&L summary for each month.

Pre-computed on the 1st of each month via Celery Beat, or generated
on-demand when the farmer requests a report. Stores category breakdowns
as JSONB for fast dashboard rendering without re-aggregating transactions.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MonthlyReport(Base):
    """
    Cached monthly financial summary.

    The JSONB columns store category breakdowns like:
    income_by_category = {"직거래": 500000, "스마트스토어": 300000}
    expense_by_category = {"농약": 120000, "비료": 80000}

    Unique constraint on (farm_id, year, month) prevents duplicate reports.
    """

    __tablename__ = "monthly_report"

    # Unique per farm per month — can't have two January 2026 reports for the same farm
    __table_args__ = (
        UniqueConstraint("farm_id", "year", "month", name="uq_monthly_report_farm_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # References Phase 1 Prisma-managed 'farm' table — no ORM relationship
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)

    # Summary totals (cached for fast access)
    total_income: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    total_expense: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    net_profit: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)

    # Category breakdowns as JSONB — avoids extra tables for what is essentially a cache
    income_by_category: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expense_by_category: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Generated PDF stored in Supabase Storage
    report_pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 'draft' (auto-generated, editable) or 'finalized' (locked, used for tax)
    status: Mapped[str] = mapped_column(String(20), default="draft")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
