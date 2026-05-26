"""Pydantic schemas for receipt OCR endpoints."""

from datetime import datetime

from pydantic import BaseModel


class ReceiptUploadResponse(BaseModel):
    """Response after uploading a receipt photo."""

    receipt_scan_id: str
    status: str
    message: str


class ReceiptStatusResponse(BaseModel):
    """Polling response for receipt OCR progress."""

    receipt_scan_id: str
    status: str  # uploaded | processing | completed | failed
    error_message: str | None = None


class ParsedReceiptItem(BaseModel):
    """Single item extracted from a receipt."""

    name: str
    quantity: int = 1
    unit_price: int = 0
    total_price: int = 0
    category: str = "기타지출"
    confidence: float = 0.0


class ParsedReceiptData(BaseModel):
    """Structured data extracted from a receipt via Claude Vision OCR."""

    store_name: str | None = None
    store_type: str | None = None  # 농협 | 농자재상 | 마트 | 온라인 | 기타
    date: str | None = None  # YYYY-MM-DD
    items: list[ParsedReceiptItem] = []
    total_amount: int = 0
    payment_method: str | None = None  # 현금 | 카드 | 계좌이체 | 외상
    overall_confidence: float = 0.0


class ReceiptResultResponse(BaseModel):
    """Full result after receipt OCR processing."""

    receipt_scan_id: str
    status: str
    parsed_data: ParsedReceiptData | None = None
    transaction_ids: list[str] = []
    created_at: datetime
    processed_at: datetime | None = None
