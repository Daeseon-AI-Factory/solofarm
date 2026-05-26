"""
Analytics snapshot model — cached nightly aggregations for dashboards.

Stores pre-computed analytics as JSONB blobs, refreshed by Celery Beat.
This avoids expensive real-time aggregation queries on the farmer's phone —
dashboards read from the latest snapshot instead of scanning transaction/order tables.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AnalyticsSnapshot(Base):
    """
    Nightly analytics cache.

    Types:
    - 'daily_summary': income/expense/profit for the day
    - 'customer_stats': customer count, LTV, repeat rate
    - 'channel_stats': revenue breakdown by sales channel
    """

    __tablename__ = "analytics_snapshot"

    __table_args__ = (
        UniqueConstraint("farm_id", "snapshot_date", "type", name="uq_snapshot_farm_date_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    # 'daily_summary', 'customer_stats', 'channel_stats'
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Flexible JSONB blob — structure varies by type
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
