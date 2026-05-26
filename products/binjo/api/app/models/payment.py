"""
Payment model — tracks TossPayments records for direct orders.

# CORE_CANDIDATE — payment tracking reusable across products.

Each Payment links to a SalesOrder. Created when checkout starts (status=pending),
confirmed when TossPayments confirms the charge, or cancelled/refunded later.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Payment(Base):
    """
    TossPayments transaction record.

    Stores the Toss payment key (their identifier) and our generated order ID
    (toss_order_id) separately from the SalesOrder.id to keep Toss coupling
    contained to this table.
    """

    __tablename__ = "payment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales_order.id", ondelete="CASCADE"),
        nullable=False,
    )

    # TossPayments identifiers
    # payment_key: Toss assigns this after payment widget loads
    toss_payment_key: Mapped[str | None] = mapped_column(
        String(200), unique=True, nullable=True
    )
    # toss_order_id: We generate this (format BJ{YYYYMMDD}{random}) before sending to Toss
    toss_order_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )

    # Payment method — CARD, TRANSFER, VIRTUAL_ACCOUNT, KAKAO_PAY, NAVER_PAY, etc.
    method: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Amounts — Korean won, no decimals
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    # Payment gateway fee (populated after confirmation from Toss response)
    fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 0), nullable=True)
    # Net amount farmer receives = amount - fee
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)

    # Lifecycle: pending → confirmed → (cancelled | refunded)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    # Card details (populated for card payments)
    card_company: Mapped[str | None] = mapped_column(String(50), nullable=True)
    card_number_masked: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Toss receipt URL — customer can view their payment receipt here
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
