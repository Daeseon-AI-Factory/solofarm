"""
Receipt OCR endpoints — upload receipt photo, check status, get parsed results.

Flow:
1. POST /receipts/upload — farmer takes a photo of a receipt
2. Pipeline runs: Claude Vision OCR → parse → auto-generate transactions
3. GET /receipts/{id}/status — check processing status
4. GET /receipts/{id}/result — get parsed receipt data + generated transaction IDs

Follows the same async/sync pattern as voice endpoints:
- With Redis: dispatches to Celery worker
- Without Redis: processes synchronously
"""

import io
import logging

from core.storage.file_manager import upload_image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.financial_transaction import FinancialTransaction
from app.models.receipt_scan import ReceiptScan
from app.modules.bookkeeping.receipt_pipeline import process_receipt_scan
from app.schemas.receipt import (
    ParsedReceiptData,
    ReceiptResultResponse,
    ReceiptStatusResponse,
    ReceiptUploadResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/heic", "image/heif"}


def _normalize_content_type(content_type: str) -> str:
    """Strip parameters from content type (e.g., 'image/jpeg; charset=...' → 'image/jpeg')."""
    return content_type.split(";")[0].strip().lower()


async def _convert_heic_to_jpeg(image_bytes: bytes) -> tuple[bytes, str]:
    """
    Convert HEIC/HEIF images to JPEG for Claude Vision API.
    iPhone photos are often HEIC — Claude Vision needs JPEG or PNG.
    """
    try:
        import pillow_heif
        from PIL import Image

        # Register HEIF opener with Pillow
        pillow_heif.register_heif_opener()

        img = Image.open(io.BytesIO(image_bytes))
        output = io.BytesIO()
        img.convert("RGB").save(output, format="JPEG", quality=90)
        return output.getvalue(), "image/jpeg"
    except ImportError:
        logger.error("pillow-heif not installed — cannot convert HEIC images")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "HEIC_NOT_SUPPORTED",
                "message": "HEIC 형식은 현재 지원하지 않습니다. JPEG 또는 PNG로 변환해주세요.",
            },
        )


@router.post("/upload", response_model=ReceiptUploadResponse)
async def upload_receipt(
    file: UploadFile,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> ReceiptUploadResponse:
    """
    Upload a receipt photo for OCR processing.

    Accepts JPEG, PNG, HEIC. HEIC is auto-converted to JPEG.
    Max file size: 10MB.
    """
    if not settings.enable_receipt_ocr:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "RECEIPT_OCR_UNAVAILABLE",
                "message": "영수증 자동 인식은 현재 준비 중입니다",
            },
        )

    content_type = _normalize_content_type(file.content_type or "")

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_TYPE",
                "message": (
                    "이미지 파일만 업로드 가능합니다 (JPEG, PNG, HEIC). "
                    f"받은 형식: {content_type}"
                ),
            },
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOO_LARGE", "message": "10MB 이하의 파일만 업로드 가능합니다"},
        )

    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "빈 파일입니다"},
        )

    # Convert HEIC to JPEG if needed
    if content_type in ("image/heic", "image/heif"):
        image_bytes, content_type = await _convert_heic_to_jpeg(image_bytes)

    # Upload to Supabase Storage
    image_url = await upload_image(image_bytes, content_type)

    # Create receipt scan record
    scan = ReceiptScan(
        farmer_id=farmer.id,
        image_url=image_url,
        status="uploaded",
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    farm_id = farmer.farm_id or farmer.id

    # Async path: dispatch to Celery if Redis is available
    if settings.redis_url:
        from workers.tasks.process_receipt import process_receipt_task

        process_receipt_task.delay(
            receipt_scan_id=str(scan.id),
            image_url=image_url,
            image_media_type=content_type,
            farm_id=str(farm_id),
            farmer_id=str(farmer.id),
        )
        logger.info("Dispatched receipt processing to Celery: %s", scan.id)
        return ReceiptUploadResponse(
            receipt_scan_id=str(scan.id),
            status="processing",
            message="영수증을 분석하고 있습니다. 잠시만 기다려주세요.",
        )

    # Sync fallback: process inline
    try:
        await process_receipt_scan(
            db=db,
            scan=scan,
            image_bytes=image_bytes,
            image_media_type=content_type,
            farm_id=farm_id,
            farmer_id=farmer.id,
        )
        return ReceiptUploadResponse(
            receipt_scan_id=str(scan.id),
            status="completed",
            message="영수증 분석이 완료되었습니다.",
        )
    except Exception as e:
        return ReceiptUploadResponse(
            receipt_scan_id=str(scan.id),
            status="failed",
            message=str(e),
        )


@router.get("/{scan_id}/status", response_model=ReceiptStatusResponse)
async def get_receipt_status(
    scan_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> ReceiptStatusResponse:
    """Check the processing status of a receipt scan."""
    result = await db.execute(
        select(ReceiptScan).where(
            ReceiptScan.id == scan_id,
            ReceiptScan.farmer_id == farmer.id,
        )
    )
    scan = result.scalar_one_or_none()

    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "영수증 스캔을 찾을 수 없습니다"},
        )

    return ReceiptStatusResponse(
        receipt_scan_id=str(scan.id),
        status=scan.status,
        error_message=scan.error_message,
    )


@router.get("/{scan_id}/result", response_model=ReceiptResultResponse)
async def get_receipt_result(
    scan_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> ReceiptResultResponse:
    """Get the parsed result of a completed receipt scan."""
    result = await db.execute(
        select(ReceiptScan).where(
            ReceiptScan.id == scan_id,
            ReceiptScan.farmer_id == farmer.id,
        )
    )
    scan = result.scalar_one_or_none()

    if scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "영수증 스캔을 찾을 수 없습니다"},
        )

    if scan.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NOT_READY", "message": f"처리 상태: {scan.status}"},
        )

    # Get transaction IDs created from this receipt
    txn_result = await db.execute(
        select(FinancialTransaction.id).where(
            FinancialTransaction.source == "receipt_photo",
            FinancialTransaction.source_id == scan.id,
        )
    )
    transaction_ids = [str(row[0]) for row in txn_result.all()]

    # Build parsed data response
    parsed_data = None
    if scan.parsed_data:
        parsed_data = ParsedReceiptData(**scan.parsed_data)

    return ReceiptResultResponse(
        receipt_scan_id=str(scan.id),
        status=scan.status,
        parsed_data=parsed_data,
        transaction_ids=transaction_ids,
        created_at=scan.created_at,
        processed_at=scan.processed_at,
    )
