"""
Receipt OCR pipeline — photo to structured financial transactions.

Pipeline stages:
1. Mark ReceiptScan as "processing"
2. Send image to Claude Vision with Korean receipt parsing prompt
3. Parse JSON response into structured receipt data
4. Generate FinancialTransaction records for each line item
5. Auto-confirm high-confidence items, flag low-confidence for review

Follows the same status-tracking pattern as voice_pipeline.py —
the UI polls for status and displays results when complete.
"""

import json
import logging
from datetime import UTC, datetime, date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from core.ai.claude_provider import ClaudeProvider
from app.models.financial_transaction import FinancialTransaction
from app.models.receipt_scan import ReceiptScan
from app.modules.bookkeeping.receipt_prompt import RECEIPT_OCR_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# Transactions with confidence >= this threshold are auto-confirmed.
# Below this, they go to "pending" for the farmer to review.
AUTO_CONFIRM_THRESHOLD = 0.8


async def process_receipt_scan(
    db: AsyncSession,
    scan: ReceiptScan,
    image_bytes: bytes,
    image_media_type: str,
    farm_id,
    farmer_id,
) -> dict:
    """
    Run the full receipt photo → structured transactions pipeline.

    Updates scan.status as it progresses:
    - "processing" → while OCR is running
    - "completed" → on success, with parsed_data and transactions saved
    - "failed" → on error, with error_message saved

    Returns the parsed receipt data dict on success, raises on failure.
    """
    raw_response = ""

    try:
        # Stage 1: Mark as processing
        scan.status = "processing"
        await db.commit()

        # Stage 2: Claude Vision OCR
        claude = ClaudeProvider()
        raw_response = await claude.complete_with_image(
            system_prompt=RECEIPT_OCR_SYSTEM_PROMPT,
            image_data=image_bytes,
            image_media_type=image_media_type,
            user_message="이 영수증/거래명세서를 분석해줘.",
            max_tokens=4000,
            temperature=0.0,
        )

        # Stage 3: Parse JSON response
        # Claude sometimes wraps JSON in markdown code blocks — strip them
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            cleaned = "\n".join(lines).strip()

        parsed_data = json.loads(cleaned)

        # Stage 4: Generate transactions from parsed items
        transaction_ids = []
        items = parsed_data.get("items", [])
        overall_confidence = parsed_data.get("overall_confidence", 0.0)
        receipt_date = _parse_date(parsed_data.get("date"))
        store_name = parsed_data.get("store_name", "")

        for item in items:
            item_confidence = item.get("confidence", overall_confidence)
            # Auto-confirm if confidence is high enough
            txn_status = "confirmed" if item_confidence >= AUTO_CONFIRM_THRESHOLD else "pending"

            txn = FinancialTransaction(
                farm_id=farm_id,
                farmer_id=farmer_id,
                type="expense",
                category=item.get("category", "기타지출"),
                amount=Decimal(str(item.get("total_price", 0))),
                description=item.get("name", ""),
                counterparty=store_name,
                transaction_date=receipt_date,
                source="receipt_photo",
                source_id=scan.id,
                status=txn_status,
                confidence=Decimal(str(round(item_confidence, 2))),
                receipt_image_url=scan.image_url,
            )
            db.add(txn)
            await db.flush()  # Get txn.id
            transaction_ids.append(str(txn.id))

        # Stage 5: Save results
        scan.parsed_data = parsed_data
        scan.raw_ocr_text = raw_response
        scan.status = "completed"
        scan.processed_at = datetime.now(UTC)
        await db.commit()

        # Return parsed data with transaction IDs for the response
        parsed_data["transaction_ids"] = transaction_ids
        return parsed_data

    except json.JSONDecodeError:
        scan.status = "failed"
        scan.error_message = f"AI 응답 파싱 실패: {raw_response[:500]}"
        scan.raw_ocr_text = raw_response
        await db.commit()
        raise ValueError("영수증 인식 결과를 파싱할 수 없습니다. 다시 시도해주세요.")

    except Exception as e:
        scan.status = "failed"
        scan.error_message = str(e)[:500]
        await db.commit()
        raise


def _parse_date(date_str: str | None) -> date:
    """
    Parse a date string from Claude's response.
    Falls back to today if the date is missing or unparseable.
    """
    if date_str:
        try:
            return date.fromisoformat(date_str)
        except ValueError:
            logger.warning("Could not parse receipt date: %s, using today", date_str)
    return date.today()
