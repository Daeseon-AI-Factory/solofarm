"""
Scheduled task: delete expired voice recordings from storage + database.

Voice recordings have a 30-day expires_at timestamp set during processing.
This task runs daily via Celery Beat to enforce the privacy retention policy.

Privacy protection: we only store audio temporarily for debugging.
After 30 days, the audio is deleted — only the text transcript remains.
"""

import asyncio
import logging
from datetime import UTC, datetime

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async function from synchronous Celery worker context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="workers.tasks.cleanup_audio.cleanup_expired_recordings")
def cleanup_expired_recordings():
    """
    Delete voice recordings that have passed their expires_at date.

    Steps for each expired recording:
    1. Delete audio file from Supabase Storage
    2. Clear the audio_url in the DB (keep transcript + parsed_data)
    3. Log the cleanup for audit trail
    """

    async def _cleanup():
        from sqlalchemy import select
        from app.database import async_session
        from core.storage.file_manager import delete_audio
        from app.models.voice_recording import VoiceRecording

        now = datetime.now(UTC)
        deleted_count = 0

        async with async_session() as db:
            # Find all recordings past their expiry date that still have audio
            result = await db.execute(
                select(VoiceRecording).where(
                    VoiceRecording.expires_at <= now,
                    VoiceRecording.audio_url.isnot(None),
                    VoiceRecording.audio_url != "",
                )
            )
            expired = result.scalars().all()

            for recording in expired:
                try:
                    # Delete from Supabase Storage
                    await delete_audio(recording.audio_url)
                    # Clear URL but keep transcript and parsed data
                    recording.audio_url = ""
                    deleted_count += 1
                    logger.info("Cleaned up audio for recording %s", recording.id)
                except Exception as e:
                    # Don't fail the whole batch if one delete fails
                    logger.error("Failed to clean up recording %s: %s", recording.id, e)

            if deleted_count > 0:
                await db.commit()

        logger.info("Audio cleanup complete: %d recordings cleaned", deleted_count)

    _run_async(_cleanup())
