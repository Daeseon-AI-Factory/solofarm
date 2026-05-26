"""
Shipping model — delivery details for paid orders.

Separates shipping concerns from the SalesOrder model. The existing SalesOrder
has denormalized shipping fields (tracking_number, shipped_at) that work for
Phase 3 manual orders. Phase 4 paid orders use this dedicated table for
richer shipping info (recipient, carrier, delivery instructions).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Shipping(Base):
    """
    Shipping record for a paid order.

    One-to-one with SalesOrder. Created during checkout when the customer
    provides their address. Updated when the farmer ships (carrier + tracking)
    and when delivery is confirmed.
    """

    __tablename__ = "shipping"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sales_order.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Recipient info — may differ from the ordering customer
    recipient_name: Mapped[str] = mapped_column(String(100), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    address_detail: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Delivery carrier — 우체국, CJ대한통운, 한진, 로젠, etc.
    carrier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Special instructions from the customer — '부재시 문 앞에 놔주세요'
    delivery_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
