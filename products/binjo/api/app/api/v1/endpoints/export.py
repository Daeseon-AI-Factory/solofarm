"""
영농일지 PDF export endpoint.

Generates a government-compliant PDF from confirmed farm log entries.
The farmer selects a date range, and we generate the document.
"""

from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_farmer_or_token
from app.models.farm_log import FarmLog
from app.models.farmer import Farmer
from app.modules.farm_log.pdf_exporter import generate_farm_diary_pdf

router = APIRouter()


@router.get("/farm-diary")
async def export_farm_diary(
    date_from: date = Query(..., description="시작일 (YYYY-MM-DD)"),
    date_to: date = Query(..., description="종료일 (YYYY-MM-DD)"),
    farmer: Farmer = Depends(get_current_farmer_or_token),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export confirmed farm logs as 영농일지 PDF."""
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_RANGE", "message": "시작일이 종료일보다 뒤입니다"},
        )

    # Fetch confirmed logs in date range
    result = await db.execute(
        select(FarmLog)
        .where(
            FarmLog.farmer_id == farmer.id,
            FarmLog.status == "confirmed",
            FarmLog.log_date >= date_from,
            FarmLog.log_date <= date_to,
        )
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
        .order_by(FarmLog.log_date)
    )
    logs = list(result.scalars().all())

    if not logs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NO_LOGS", "message": "해당 기간에 확인된 기록이 없습니다"},
        )

    # Generate PDF
    pdf_bytes = generate_farm_diary_pdf(
        logs=logs,
        farm_name="빈조농장",
        farmer_name=farmer.nickname or "농장주",
        address="경남 사천시 용치골",
        date_from=date_from,
        date_to=date_to,
    )

    # ASCII filename for header compatibility + URL-encoded UTF-8 filename* for Korean
    ascii_filename = f"farm_diary_{date_from}_{date_to}.pdf"
    korean_filename = quote(f"영농일지_{date_from}_{date_to}.pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_filename}"; '
                f"filename*=UTF-8''{korean_filename}"
            ),
        },
    )
