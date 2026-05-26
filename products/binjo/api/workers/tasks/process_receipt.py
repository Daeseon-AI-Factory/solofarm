"""
Async receipt processing task — runs Claude Vision OCR pipeline in background.

When REDIS_URL is configured, the receipt upload endpoint dispatches this task
instead of processing synchronously. The farmer sees immediate "processing"
status and polls /receipts/{id}/status until completion.

Follows the same pattern as process_voice.py — Celery task wrapping async code.
"""

import asyncio
import logging
from uuid import UUID

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
    name="workers.tasks.process_receipt.process_receipt_task",
    bind=True,
    max_retries=2,
    default_retry_delay=10,
)
def process_receipt_task(
    self,
    receipt_scan_id: str,
    image_url: str,
    image_media_type: str,
    farm_id: str,
    farmer_id: str,
):
    """
    Background task: download receipt image and run OCR pipeline.

    Args:
        receipt_scan_id: UUID of the ReceiptScan to process.
        image_url: Supabase Storage URL to download the image from.
        image_media_type: MIME type of the image (image/jpeg or image/png).
        farm_id: UUID of the farm (for transaction creation).
        farmer_id: UUID of the farmer (for transaction creation).
    """

    async def _process():
        import httpx
        from sqlalchemy import select
        from app.database import async_session
        from app.models.receipt_scan import ReceiptScan
        from app.modules.bookkeeping.receipt_pipeline import process_receipt_scan

        # Download image bytes from Supabase Storage
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            image_bytes = response.content

        # Run pipeline with a fresh DB session
        async with async_session() as db:
            result = await db.execute(
                select(ReceiptScan).where(ReceiptScan.id == receipt_scan_id)
            )
            scan = result.scalar_one_or_none()

            if scan is None:
                logger.error("ReceiptScan %s not found in DB", receipt_scan_id)
                return

            if scan.status not in ("uploaded", "failed"):
                logger.info("ReceiptScan %s already %s, skipping", receipt_scan_id, scan.status)
                return

            await process_receipt_scan(
                db=db,
                scan=scan,
                image_bytes=image_bytes,
                image_media_type=image_media_type,
                farm_id=UUID(farm_id),
                farmer_id=UUID(farmer_id),
            )
            logger.info("Successfully processed receipt %s", receipt_scan_id)

    try:
        _run_async(_process())
    except Exception as e:
        logger.error("Receipt processing task failed for %s: %s", receipt_scan_id, e)
        raise self.retry(exc=e)
