"""
AI insight model — stores AI-generated actionable suggestions.

Claude analyzes accumulated farm data and produces insights like cost-saving
recommendations, sales predictions, and customer re-engagement alerts.
These are shown in the farmer's intelligence dashboard.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiInsight(Base):
    """
    AI-generated actionable insight.

    Types:
    - 'cost_saving': expense optimization suggestion
    - 'sales_prediction': demand forecast based on historical patterns
    - 'customer_alert': re-engagement reminder for inactive customers
    - 'yearly_report': comprehensive annual analysis
    """

    __tablename__ = "ai_insight"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # 'cost_saving', 'sales_prediction', 'customer_alert', 'yearly_report'
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Supporting data — charts, numbers, evidence backing the insight
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # 'high', 'normal', 'low'
    priority: Mapped[str] = mapped_column(String(10), default="normal")
    # 'new', 'read', 'actioned', 'dismissed'
    status: Mapped[str] = mapped_column(String(20), default="new")

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
