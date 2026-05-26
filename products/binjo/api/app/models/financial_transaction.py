"""
Financial transaction model — the central ledger for all money movements.

Every purchase, sale, and expense flows through here. Transactions are
created from receipt OCR, voice entry, manual input, or order completion.

# CORE_CANDIDATE — any product that tracks money needs a transaction ledger.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FinancialTransaction(Base):
    """
    Central financial ledger entry.

    Named 'financial_transaction' instead of 'transaction' because
    'transaction' is a PostgreSQL reserved word — using it would require
    quoting everywhere and cause subtle migration/query bugs.
    """

    __tablename__ = "financial_transaction"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # farm_id references Phase 1 Prisma-managed 'farm' table — no ORM relationship
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Core fields
    # 'income' (수입) or 'expense' (지출)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    # Korean category: 농약, 비료, 자재, 인건비, 직거래, 스마트스토어, etc.
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # Korean won — no decimals needed (smallest unit is 1원)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)

    # Details
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Store name (expense) or customer name (income)
    counterparty: Mapped[str | None] = mapped_column(String(200), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Source tracking — how this transaction was created
    # 'receipt_photo', 'voice', 'nh_screenshot', 'order', 'manual'
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # Links to the source record (receipt_scan.id, voice_recording.id, sales_order.id, etc.)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Optional linkage to farm operations
    # Connects an expense to the work day it was used (e.g., pesticide purchase → spray day)
    farm_log_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farm_log.id", ondelete="SET NULL"), nullable=True
    )

    # Status tracking
    # 'pending' (needs farmer review), 'confirmed' (verified), 'exported' (included in report)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # AI parsing confidence 0.00-1.00 — determines auto-confirm vs pending-review
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)

    # Metadata
    receipt_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
