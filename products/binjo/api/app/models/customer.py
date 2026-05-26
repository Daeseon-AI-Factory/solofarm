"""
Customer model — lightweight customer identity for direct orders.

# CORE_CANDIDATE — customer tracking reusable across products.

No user accounts — phone number is the primary identifier (same as KakaoTalk
direct sales). Auto-populated on first paid order, updated on repeat orders.

Design decision: preferred_products uses JSONB instead of PostgreSQL TEXT[].
JSONB is more portable across ORMs, easier to query with SQLAlchemy, and
avoids asyncpg array encoding edge cases.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Customer(Base):
    """
    Customer record keyed on (farm_id, phone).

    Analytics fields (total_orders, total_spent) are updated on each new order.
    This avoids expensive COUNT/SUM queries when rendering the customer list.
    """

    __tablename__ = "customer"

    __table_args__ = (
        UniqueConstraint("farm_id", "phone", name="uq_customer_farm_phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # References Phase 1 Prisma-managed 'farm' table
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Primary identifier — phone number (no accounts, guest checkout)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Last used shipping address — auto-populated for returning customers
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pre-computed analytics — updated on each order, avoids expensive aggregation
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    first_order_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_order_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Products this customer has ordered — ["부사", "시나노골드"]
    preferred_products: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Farmer's notes about this customer — "추석 때 매년 10박스"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
