"""
Farmer model — linked to Kakao account.
This is a Phase 2 table that references the Phase 1 Farm table.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Phase 1 owns the full ``farm`` table through Prisma.  Register only its
# identity column here so SQLAlchemy can model the cross-phase foreign key
# without taking ownership of the table's schema.
farm_identity_table = Table(
    "farm",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    info={"managed_by": "prisma"},
)


class Farmer(Base):
    __tablename__ = "farmer"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # References Phase 1's Prisma-managed Farm table in the same database.
    farm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("farm.id", name="fk_farmer_farm_id_farm", ondelete="RESTRICT"),
        nullable=False,
    )
    kakao_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(50), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="farmer")  # 'farmer' | 'admin'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
