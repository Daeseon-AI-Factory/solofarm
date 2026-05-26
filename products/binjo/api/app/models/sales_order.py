"""
Sales order model — tracks the full lifecycle of a customer order.

Lifecycle: inquiry → confirmed → paid → shipped → delivered (or cancelled at any point)
When an order reaches 'delivered', an income transaction is auto-created.

Upgraded from Phase 1's simple order_inquiry table (Prisma-managed) into a
full order management record.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SalesOrder(Base):
    """
    Customer order from inquiry to delivery.

    The 'channel' field tracks where the order came from (KakaoTalk, phone,
    Naver SmartStore, wholesale, offline). This drives category assignment
    when the income transaction is auto-created on delivery.
    """

    __tablename__ = "sales_order"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # References Phase 1 Prisma-managed 'farm' table
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Customer info
    customer_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    customer_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Order details
    # 'kakao', 'phone', 'naver', 'wholesale', 'offline'
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    # product_id references Phase 1 Prisma-managed 'product' table — no ORM relationship
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Denormalized — product names change; we freeze the name at order time
    product_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    weight_option: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 0), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)

    # Order lifecycle
    # inquiry → confirmed → paid → shipped → delivered → (cancelled)
    status: Mapped[str] = mapped_column(String(20), default="inquiry")

    # Shipping
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Link to the income transaction created when order is delivered
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_transaction.id", ondelete="SET NULL"),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
