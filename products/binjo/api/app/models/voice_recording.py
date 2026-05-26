"""
Voice recording model — tracks uploaded audio files and their processing status.

Lifecycle: uploaded → processing → completed/failed
Audio files are stored in Supabase Storage and auto-deleted after 30 days.
Only the structured text data is kept permanently.
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VoiceRecording(Base):
    __tablename__ = "voice_recording"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    farmer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Processing pipeline status
    status: Mapped[str] = mapped_column(
        String(20), default="uploaded"
    )  # uploaded → processing → completed → failed
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)  # Raw Whisper output
    parsed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Structured AI output
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Auto-delete audio after 30 days — cleanup cron checks this field
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
