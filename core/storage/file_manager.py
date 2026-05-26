"""
Supabase Storage file manager — upload/delete audio and image files.

# CORE_CANDIDATE — reusable S3-compatible storage operations.

Uses the same Supabase Storage as Phase 1 but in separate buckets
for audio (Phase 2) and receipt images (Phase 3).
"""

import uuid

from supabase import create_client

from core.config import settings

AUDIO_BUCKET = "audio"
RECEIPTS_BUCKET = "receipts"
FARM_PHOTOS_BUCKET = "farm-photos"

# Map content types to file extensions for clean storage paths
_EXTENSION_MAP = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}


def _get_client():
    """Lazy init — avoids crash if env vars are missing during import."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _upload_to_bucket(bucket: str, file_bytes: bytes, content_type: str) -> str:
    """Upload a file to a Supabase Storage bucket. Returns the public URL."""
    supabase = _get_client()
    ext = _EXTENSION_MAP.get(content_type, "")
    path = f"{uuid.uuid4()}{ext}"

    supabase.storage.from_(bucket).upload(
        path,
        file_bytes,
        file_options={"content-type": content_type, "upsert": "false"},
    )

    return supabase.storage.from_(bucket).get_public_url(path)


def _delete_from_bucket(bucket: str, url: str) -> None:
    """Delete a file from a Supabase Storage bucket by its public URL."""
    supabase = _get_client()
    # Extract path from URL: .../bucket/uuid.ext → uuid.ext
    path = url.split(f"/{bucket}/")[-1]
    supabase.storage.from_(bucket).remove([path])


# --- Audio (Phase 2 — backward compatible) ---

async def upload_audio(audio_bytes: bytes, content_type: str) -> str:
    """Upload audio file to Supabase Storage. Returns the public URL."""
    return _upload_to_bucket(AUDIO_BUCKET, audio_bytes, content_type)


async def delete_audio(url: str) -> None:
    """Delete an audio file from Supabase Storage by its URL."""
    _delete_from_bucket(AUDIO_BUCKET, url)


# --- Receipt images (Phase 3) ---

async def upload_image(image_bytes: bytes, content_type: str) -> str:
    """Upload a receipt image to Supabase Storage. Returns the public URL."""
    return _upload_to_bucket(RECEIPTS_BUCKET, image_bytes, content_type)


async def delete_image(url: str) -> None:
    """Delete a receipt image from Supabase Storage by its URL."""
    _delete_from_bucket(RECEIPTS_BUCKET, url)


# --- Farm log photos ---

async def upload_farm_photo(image_bytes: bytes, content_type: str) -> str:
    """Upload a farm log photo to Supabase Storage. Returns the public URL."""
    return _upload_to_bucket(FARM_PHOTOS_BUCKET, image_bytes, content_type)


async def delete_farm_photo(url: str) -> None:
    """Delete a farm log photo from Supabase Storage by its URL."""
    _delete_from_bucket(FARM_PHOTOS_BUCKET, url)
