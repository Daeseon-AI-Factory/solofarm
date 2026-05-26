"""
Voice recording endpoints — upload, check status, get parsed results.

Flow:
1. POST /voice/upload — farmer uploads audio file
2. Pipeline runs: Whisper STT → post-process → Claude parse → weather auto-fill
3. GET /voice/{id}/status — check processing status
4. GET /voice/{id}/result — get the structured farm log data

When Redis is configured (REDIS_URL), voice processing is dispatched to a Celery
worker for async processing. Without Redis, falls back to synchronous processing
(acceptable for a single-farmer MVP).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from core.storage.file_manager import upload_audio
from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.voice_recording import VoiceRecording
from app.modules.farm_log.voice_pipeline import process_voice_recording
from app.schemas.voice import VoiceResultResponse, VoiceStatusResponse, VoiceUploadResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# 5 minutes max recording
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB (Whisper API limit)


def _is_celery_available() -> bool:
    """Check if Celery can be used (Redis URL is configured)."""
    return bool(settings.redis_url)


@router.post("/upload", response_model=VoiceUploadResponse)
async def upload_voice(
    file: UploadFile,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceUploadResponse:
    """
    Upload a voice recording and process it.

    With Redis: dispatches to Celery worker (async, returns immediately).
    Without Redis: processes synchronously (farmer waits ~10-15 seconds).
    """
    # Accept any audio/* type — Whisper handles all common formats
    # Browser sends things like "audio/webm;codecs=opus" which is fine
    content_type = file.content_type or "audio/webm"
    base_type = content_type.split(";")[0].strip()
    logger.info("Voice upload: content_type=%s, size=%d, filename=%s", content_type, 0, file.filename)

    if not base_type.startswith("audio/"):
        logger.warning("Rejected non-audio type: %s", content_type)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_TYPE", "message": f"오디오 파일만 업로드 가능합니다 (받은 형식: {content_type})"},
        )

    # Read file bytes
    audio_bytes = await file.read()

    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOO_LARGE", "message": "25MB 이하의 파일만 업로드 가능합니다"},
        )

    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "빈 파일입니다"},
        )

    # Upload to Supabase Storage
    audio_url = await upload_audio(audio_bytes, content_type)

    # Create recording record
    recording = VoiceRecording(
        farmer_id=farmer.id,
        audio_url=audio_url,
        file_size_bytes=len(audio_bytes),
        status="uploaded",
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)

    # Async path: dispatch to Celery worker if Redis is available
    if _is_celery_available():
        from workers.tasks.process_voice import process_voice_recording_task

        process_voice_recording_task.delay(
            recording_id=str(recording.id),
            audio_url=audio_url,
        )
        logger.info("Dispatched voice processing to Celery: %s", recording.id)
        return VoiceUploadResponse(
            id=str(recording.id),
            status="processing",
            message="음성을 처리하고 있습니다. 잠시만 기다려주세요.",
        )

    # Sync fallback: process inline (blocks the request)
    try:
        await process_voice_recording(
            db=db,
            recording=recording,
            audio_bytes=audio_bytes,
            filename=file.filename or "recording.webm",
            content_type=content_type,
        )
        return VoiceUploadResponse(
            id=str(recording.id),
            status="completed",
            message="음성 기록이 처리되었습니다",
        )
    except Exception as e:
        return VoiceUploadResponse(
            id=str(recording.id),
            status="failed",
            message=str(e),
        )


@router.get("/{recording_id}/status", response_model=VoiceStatusResponse)
async def get_voice_status(
    recording_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceStatusResponse:
    """Check the processing status of a voice recording."""
    result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.id == recording_id,
            VoiceRecording.farmer_id == farmer.id,
        )
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "녹음을 찾을 수 없습니다"},
        )

    return VoiceStatusResponse(
        id=str(recording.id),
        status=recording.status,
        transcript=recording.transcript,
        error_message=recording.error_message,
    )


@router.get("/{recording_id}/result", response_model=VoiceResultResponse)
async def get_voice_result(
    recording_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceResultResponse:
    """Get the parsed result of a completed voice recording."""
    result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.id == recording_id,
            VoiceRecording.farmer_id == farmer.id,
        )
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "녹음을 찾을 수 없습니다"},
        )

    if recording.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "NOT_READY",
                "message": f"처리 상태: {recording.status}",
            },
        )

    return VoiceResultResponse(
        id=str(recording.id),
        status=recording.status,
        transcript=recording.transcript,
        parsed_data=recording.parsed_data,
        created_at=recording.created_at,
    )
