"""
Async voice processing task — runs Whisper + Claude pipeline in background.

When REDIS_URL is configured, the voice upload endpoint dispatches this task
instead of processing synchronously. The farmer sees immediate "processing"
status and polls /voice/{id}/status until completion.

Without Redis, the voice endpoint falls back to synchronous processing
(acceptable for a single-farmer MVP).
"""

import asyncio
import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async function from synchronous Celery worker context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="workers.tasks.process_voice.process_voice_recording_task",
    bind=True,
    max_retries=2,
    default_retry_delay=10,
)
def process_voice_recording_task(self, recording_id: str, audio_url: str):
    """
    Background task: download audio from storage and run the full pipeline.

    Args:
        recording_id: UUID of the VoiceRecording to process.
        audio_url: Supabase Storage URL to download the audio from.
    """

    async def _process():
        import httpx
        from sqlalchemy import select
        from app.database import async_session
        from app.models.voice_recording import VoiceRecording
        from app.modules.farm_log.voice_pipeline import process_voice_recording

        # Download audio bytes from Supabase Storage
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(audio_url)
            response.raise_for_status()
            audio_bytes = response.content

        # Run pipeline with a fresh DB session
        async with async_session() as db:
            result = await db.execute(
                select(VoiceRecording).where(VoiceRecording.id == recording_id)
            )
            recording = result.scalar_one_or_none()

            if recording is None:
                logger.error("Recording %s not found in DB", recording_id)
                return

            if recording.status not in ("uploaded", "failed"):
                logger.info("Recording %s already %s, skipping", recording_id, recording.status)
                return

            # Infer filename from URL
            filename = audio_url.split("/")[-1] if "/" in audio_url else "recording.webm"

            await process_voice_recording(
                db=db,
                recording=recording,
                audio_bytes=audio_bytes,
                filename=filename,
                content_type="audio/webm",
            )
            logger.info("Successfully processed recording %s", recording_id)

    try:
        _run_async(_process())
    except Exception as e:
        logger.error("Voice processing task failed for %s: %s", recording_id, e)
        # Celery will retry based on max_retries config
        raise self.retry(exc=e)
