"""
Voice processing pipeline — the full flow from audio to structured farm log.

Pipeline stages:
1. Upload audio to Supabase Storage
2. Transcribe with Whisper (STT)
3. Post-process transcript (fix common mishearings)
4. Parse with Claude (extract structured data)
5. Auto-fill weather from 기상청 API
6. Return structured result for farmer review

Each stage updates the VoiceRecording status so the UI can show progress.
"""

import json
import logging
from datetime import UTC, datetime, timedelta

from core.ai.claude_provider import ClaudeProvider
from core.external_api.weather_kma import (
    format_weather_summary,
    get_weather_for_date,
)
from core.stt.post_processor import correct_transcript
from core.stt.whisper_api import transcribe_audio
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.voice_recording import VoiceRecording
from app.modules.farm_log.parser_prompt import SYSTEM_PROMPT, build_user_message
from app.schemas.voice import ParsedFarmLogData

logger = logging.getLogger(__name__)


async def _fetch_weather_for_log(log_date: str) -> dict:
    """
    Best-effort weather fetch — never fails the pipeline.
    Weather is nice-to-have, not critical. If KMA API is down or
    the key is missing, we return empty and the farmer can fill it manually.
    """
    try:
        weather = await get_weather_for_date(log_date)
        if weather:
            weather["summary"] = format_weather_summary(weather)
        return weather
    except Exception as e:
        logger.warning("Weather fetch failed for %s: %s", log_date, e)
        return {}


async def process_voice_recording(
    db: AsyncSession,
    recording: VoiceRecording,
    audio_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict:
    """
    Run the full voice → structured data pipeline.

    Updates recording.status as it progresses:
    - "processing" → while STT + parsing are running
    - "completed" → on success, with transcript and parsed_data saved
    - "failed" → on error, with error_message saved

    Returns the parsed farm log data dict on success, raises on failure.
    """
    try:
        # Stage 1: Mark as processing
        recording.status = "processing"
        await db.commit()

        # Stage 2: Transcribe with Whisper
        whisper_result = await transcribe_audio(audio_bytes, filename, content_type)
        raw_transcript = whisper_result["text"]

        if not raw_transcript.strip():
            raise ValueError("음성이 인식되지 않았습니다. 다시 녹음해주세요.")

        # Stage 3: Post-process — fix common agricultural term mishearings
        corrected_transcript = correct_transcript(raw_transcript)
        recording.transcript = corrected_transcript

        # Stage 4: Parse with Claude — extract structured farm log data
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        user_message = build_user_message(corrected_transcript, today_str)

        claude = ClaudeProvider()
        raw_response = await claude.complete(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            temperature=0.0,
        )

        # Claude sometimes wraps JSON in markdown code blocks — strip them
        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```"):
            # Remove ```json\n...\n``` wrapper
            lines = cleaned_response.split("\n")
            # Drop first line (```json) and last line (```)
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned_response = "\n".join(lines).strip()

        parsed_data = ParsedFarmLogData.model_validate(
            json.loads(cleaned_response)
        ).model_dump()

        # Stage 5: Auto-fill weather from 기상청 API
        # Uses the date Claude extracted from the transcript (defaults to today)
        log_date = parsed_data.get("date", today_str)
        weather_official = await _fetch_weather_for_log(log_date)
        if weather_official:
            parsed_data["weather_official"] = weather_official

        # Stage 6: Save results
        recording.parsed_data = parsed_data
        recording.status = "completed"
        recording.processed_at = datetime.now(UTC)
        # Auto-delete audio after 30 days — privacy protection
        recording.expires_at = datetime.now(UTC) + timedelta(days=30)
        await db.commit()

        return parsed_data

    except json.JSONDecodeError:
        # Claude returned non-JSON — save the raw response for debugging
        recording.status = "failed"
        recording.error_message = f"AI 응답 파싱 실패: {raw_response[:500]}"
        await db.commit()
        raise ValueError("AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.")

    except ValidationError as e:
        # Treat structurally invalid AI output as a failed pipeline result. The
        # client can then show a recoverable error instead of crashing on fields
        # such as tasks.map or field_names.length.
        recording.status = "failed"
        recording.error_message = f"AI 응답 스키마 오류 ({e.error_count()}건)"
        await db.commit()
        raise ValueError("AI 분석 결과 형식이 올바르지 않습니다. 다시 시도해주세요.")

    except Exception as e:
        recording.status = "failed"
        recording.error_message = str(e)[:500]
        await db.commit()
        raise
