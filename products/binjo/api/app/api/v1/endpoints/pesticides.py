"""
Pesticide safety information endpoints.

Provides:
- List all registered pesticides (for autocomplete in farm log entry)
- Look up safety info for a specific pesticide
- Calculate safe harvest date after spraying
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.data.pesticide_safety import (
    get_all_pesticides,
    get_pesticide_info,
    calculate_safe_harvest_date,
)
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer

router = APIRouter()


class PesticideInfo(BaseModel):
    id: str
    name_kr: str
    name_en: str
    type: str
    safety_days: int
    dilution_ratio: str
    target: list[str]
    season: list[str]
    notes: str


class SafeHarvestResponse(BaseModel):
    pesticide: str
    safety_days: int
    spray_date: str
    safe_harvest_date: str
    days_remaining: int
    is_safe: bool


@router.get("/", response_model=list[PesticideInfo])
async def list_pesticides(
    farmer: Farmer = Depends(get_current_farmer),
) -> list[dict]:
    """List all registered pesticides for autocomplete."""
    return get_all_pesticides()


@router.get("/lookup")
async def lookup_pesticide(
    name: str = Query(..., description="Pesticide Korean name"),
    farmer: Farmer = Depends(get_current_farmer),
) -> dict:
    """Look up pesticide safety info by name."""
    info = get_pesticide_info(name)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"'{name}' 농약 정보를 찾을 수 없습니다"},
        )
    return info


@router.get("/safe-harvest", response_model=SafeHarvestResponse)
async def check_safe_harvest(
    spray_date: str = Query(..., description="Spray date (YYYY-MM-DD)"),
    pesticide_name: str = Query(..., description="Pesticide Korean name"),
    farmer: Farmer = Depends(get_current_farmer),
) -> dict:
    """Calculate the earliest safe harvest date after pesticide application."""
    result = calculate_safe_harvest_date(spray_date, pesticide_name)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"'{pesticide_name}' 농약 정보를 찾을 수 없습니다"},
        )
    return result
