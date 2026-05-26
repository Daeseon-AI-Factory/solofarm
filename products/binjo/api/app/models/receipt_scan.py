"""
Receipt scan model — tracks uploaded receipt photos and their OCR processing.

Lifecycle: uploaded → processing → completed/failed
Similar to VoiceRecording but for images instead of audio.

# CORE_CANDIDATE — any product that does document OCR needs scan tracking.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReceiptScan(Base):
    """
    Tracks receipt photo uploads and their OCR processing status.

    Transactions created from this scan link back via
    FinancialTransaction.source='receipt_photo' + source_id=this.id
    instead of an array FK — cleaner than UUID[] with foreign keys.
    """

    __tablename__ = "receipt_scan"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)

    # OCR results
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Structured extraction: {store_name, date, items: [{name, qty, price, category}], total}
    parsed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # uploaded → processing → completed → failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
