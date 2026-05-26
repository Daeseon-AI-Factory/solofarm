"""
Farm log models — the structured, confirmed farm diary entries.

A farm log can have multiple tasks and chemical usages.
This is the data that eventually gets exported as 영농일지 PDF.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FarmLog(Base):
    __tablename__ = "farm_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    voice_recording_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False)

    # draft → confirmed → exported
    status: Mapped[str] = mapped_column(String(20), default="draft")

    crop: Mapped[str] = mapped_column(String(50), default="사과")

    # Weather from 기상청 API (official) and farmer's own observation
    weather_official: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    weather_farmer: Mapped[str | None] = mapped_column(String(200), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Photo URLs stored in Supabase Storage — JSONB array of public URLs
    # Using JSONB instead of a separate table: simpler for now, promotes if we need per-photo metadata later
    photo_urls: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships — one log has many tasks and chemical usages
    tasks: Mapped[list["FarmLogTask"]] = relationship(
        back_populates="farm_log", cascade="all, delete-orphan"
    )
    chemicals: Mapped[list["ChemicalUsage"]] = relationship(
        back_populates="farm_log", cascade="all, delete-orphan"
    )


class FarmLogTask(Base):
    __tablename__ = "farm_log_task"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farm_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farm_log.id", ondelete="CASCADE"), nullable=False
    )
    field_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Fallback

    # 전정/시비/방제/적화/적과/봉지씌우기/수확/기타
    stage: Mapped[str] = mapped_column(String(50), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_hours: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    farm_log: Mapped["FarmLog"] = relationship(back_populates="tasks")


class ChemicalUsage(Base):
    __tablename__ = "chemical_usage"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farm_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("farm_log.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # '농약' | '비료'
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[str | None] = mapped_column(String(100), nullable=True)  # '200리터'
    action: Mapped[str] = mapped_column(String(10), default="used")  # 'purchased' | 'used'

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    farm_log: Mapped["FarmLog"] = relationship(back_populates="chemicals")
