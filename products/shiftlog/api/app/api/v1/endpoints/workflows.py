"""
Workflow inference endpoints — load-bearing PoC of the platform.

Two flavors:
- POST /infer            — accepts pre-processed evidence (transcripts + photo
                           descriptions). Useful for testing, advanced mode UI,
                           and integrations that have already run STT/Vision.
- POST /infer-from-media — accepts raw audio + photos (multipart). Runs Whisper +
                           Claude Vision internally, then inference. This is the
                           primary owner UX — record once, tap submit.

No DB yet — every request is a fresh inference. Persistence lands when we
promote the workflow library off mock data.
"""

import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from core.ai.claude_provider import ClaudeProvider
from core.stt.whisper_api import transcribe_audio
from core.workflow import infer_workflow
from core.workflow.schemas import WorkflowInferenceInput, WorkflowInferenceResult

logger = logging.getLogger(__name__)

router = APIRouter()

# Whisper API caps at 25 MB. Browser MediaRecorder typically produces ~1 MB/min
# of opus/webm, so 25 MB covers ~25 minutes — more than enough for a shop walkthrough.
_MAX_AUDIO_BYTES = 25 * 1024 * 1024
# Each photo capped at 10 MB after the browser compresses for upload. Anything
# bigger than that is almost certainly accidental (a RAW or 4K screenshot).
_MAX_PHOTO_BYTES = 10 * 1024 * 1024

# System prompt for the Vision call that turns a photo into a short, workflow-relevant description.
_PHOTO_DESCRIBE_SYSTEM = """You are documenting a small business workspace for a workflow-inference engine.

Look at the photo and write ONE compact paragraph (max ~50 words) in Korean covering:
- WHAT equipment/station is visible (e.g., 에스프레소 머신, 카운터, 냉장고, 바닥 등)
- WHERE in the shop it likely is (앞쪽 카운터, 백 룸, 객장 등)
- The CURRENT STATE (깨끗함 / 더러움 / 가득 참 / 비어 있음 / 사용 중 등)

Goal: another model will read your description to figure out what tasks an alba worker
might need to do at that station. Be concrete and specific. No commentary, no headers,
just the paragraph."""


@router.post("/infer", response_model=WorkflowInferenceResult)
async def infer(payload: WorkflowInferenceInput) -> WorkflowInferenceResult:
    """
    Turn raw owner evidence into a structured WorkflowDefinition.

    Accepts any combination of text_description, voice_transcripts (already
    transcribed upstream), photo_descriptions (already described by Vision
    upstream), and an optional industry_hint ("cafe", "dry_cleaner", ...).

    Returns the inferred workflow plus clarifying questions the owner
    should answer before publishing the workflow to alba.
    """
    try:
        result = await infer_workflow(payload)
    except ValueError as e:
        # build_user_message raises ValueError on empty inputs;
        # inference raises ValueError on non-JSON / non-conforming Claude output.
        logger.warning("Inference rejected request: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": str(e)},
        ) from e
    except Exception as e:
        # Claude API errors (auth, rate limit, timeout) bubble up here.
        # ClaudeProvider already retried transient errors before this point.
        logger.exception("Inference failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "AI_UPSTREAM_ERROR",
                "message": "AI 추론 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
                "debug": str(e) if logger.isEnabledFor(logging.DEBUG) else None,
            },
        ) from e

    return result


@router.post("/infer-from-media", response_model=WorkflowInferenceResult)
async def infer_from_media(
    audio: UploadFile = File(..., description="Owner's voice walkthrough (any audio/* type)"),
    photos: list[UploadFile] = File(default=[], description="Optional photos of the shop/stations"),
    industry_hint: str | None = Form(default=None),
) -> WorkflowInferenceResult:
    """
    End-to-end one-tap inference: audio + photos → Whisper + Vision → inference.

    This is the primary owner UX. The owner records themselves describing their
    shop (in any language Whisper supports), optionally snaps photos of stations,
    and submits. The server transcribes the audio, generates a short description
    of each photo, and runs workflow inference.
    """
    # --- Validate + read audio ---
    content_type = (audio.content_type or "audio/webm").split(";")[0].strip()
    if not content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_AUDIO_TYPE",
                "message": f"음성 파일만 업로드 가능합니다 (받은 형식: {content_type})",
            },
        )
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_AUDIO", "message": "녹음 파일이 비어있습니다"},
        )
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "AUDIO_TOO_LARGE", "message": "25MB 이하의 녹음만 업로드 가능합니다"},
        )

    logger.info(
        "Media inference request: audio=%s (%d bytes), photos=%d, industry=%s",
        content_type, len(audio_bytes), len(photos), industry_hint,
    )

    # --- Transcribe audio ---
    try:
        whisper_result = await transcribe_audio(
            audio_bytes, audio.filename or "audio.webm", content_type
        )
    except Exception as e:
        logger.exception("Whisper transcription failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "STT_UPSTREAM_ERROR",
                "message": "음성 인식에 실패했습니다. 잠시 후 다시 시도해주세요.",
            },
        ) from e

    transcript = (whisper_result.get("text") or "").strip()
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMPTY_TRANSCRIPT",
                "message": "음성이 인식되지 않았습니다. 다시 녹음해주세요.",
            },
        )

    # --- Describe each photo via Claude Vision ---
    # Sequential calls (one per photo). Could batch in future, but 3-5 photos
    # per workflow is the realistic case and sequential keeps prompts simple.
    claude = ClaudeProvider()
    descriptions: list[str] = []
    for i, photo in enumerate(photos):
        photo_bytes = await photo.read()
        if len(photo_bytes) == 0:
            continue  # skip empty placeholders
        if len(photo_bytes) > _MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "PHOTO_TOO_LARGE",
                    "message": f"사진 {i + 1}번이 너무 큽니다 (10MB 이하)",
                },
            )
        media_type = photo.content_type or "image/jpeg"
        try:
            desc = await claude.complete_with_image(
                system_prompt=_PHOTO_DESCRIBE_SYSTEM,
                image_data=photo_bytes,
                image_media_type=media_type,
                user_message="이 사진을 워크플로우 추론용으로 설명해주세요.",
                max_tokens=300,
            )
            descriptions.append(desc.strip())
        except Exception as e:
            logger.exception("Vision description failed for photo %d", i + 1)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "code": "VISION_UPSTREAM_ERROR",
                    "message": f"사진 {i + 1}번 분석에 실패했습니다. 다시 시도해주세요.",
                },
            ) from e

    # --- Run workflow inference ---
    inputs = WorkflowInferenceInput(
        voice_transcripts=[transcript],
        photo_descriptions=descriptions,
        industry_hint=industry_hint,
    )
    try:
        # Reuse the same Claude client so we don't double-construct.
        return await infer_workflow(inputs, claude=claude)
    except ValueError as e:
        logger.warning("Inference rejected request after preprocessing: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": str(e)},
        ) from e
    except Exception as e:
        logger.exception("Inference failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "AI_UPSTREAM_ERROR",
                "message": "AI 추론 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
            },
        ) from e
