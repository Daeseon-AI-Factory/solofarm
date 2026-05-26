"""
Field management endpoints — CRUD for farm plots (필지).

Farmers can register their fields (e.g., '3번 밭', '앞 과수원') so the
voice pipeline can link parsed field names to actual field records.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.field import Field
from app.schemas.field import (
    FieldCreate,
    FieldListResponse,
    FieldResponse,
    FieldUpdate,
)

router = APIRouter()


def _field_to_response(field: Field) -> FieldResponse:
    """Convert a Field ORM object to a Pydantic response."""
    return FieldResponse(
        id=str(field.id),
        name=field.name,
        area_pyeong=float(field.area_pyeong) if field.area_pyeong else None,
        crop=field.crop,
        address=field.address,
        notes=field.notes,
        created_at=field.created_at,
    )


@router.get("", response_model=FieldListResponse)
async def list_fields(
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FieldListResponse:
    """List all fields for the farmer's farm."""
    farm_id = farmer.farm_id or farmer.id

    result = await db.execute(
        select(Field)
        .where(Field.farm_id == farm_id)
        .order_by(Field.name)
    )
    fields = result.scalars().all()

    count_result = await db.execute(
        select(func.count(Field.id)).where(Field.farm_id == farm_id)
    )
    total = count_result.scalar() or 0

    return FieldListResponse(
        fields=[_field_to_response(f) for f in fields],
        total=total,
    )


@router.post("", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
async def create_field(
    body: FieldCreate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FieldResponse:
    """Register a new field (필지)."""
    farm_id = farmer.farm_id or farmer.id

    field = Field(
        farm_id=farm_id,
        name=body.name,
        area_pyeong=body.area_pyeong,
        crop=body.crop,
        address=body.address,
        notes=body.notes,
    )
    db.add(field)
    await db.commit()
    await db.refresh(field)

    return _field_to_response(field)


@router.put("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: str,
    body: FieldUpdate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FieldResponse:
    """Update field info."""
    farm_id = farmer.farm_id or farmer.id

    result = await db.execute(
        select(Field).where(Field.id == field_id, Field.farm_id == farm_id)
    )
    field = result.scalar_one_or_none()

    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "필지를 찾을 수 없습니다"},
        )

    if body.name is not None:
        field.name = body.name
    if body.area_pyeong is not None:
        field.area_pyeong = body.area_pyeong
    if body.crop is not None:
        field.crop = body.crop
    if body.address is not None:
        field.address = body.address
    if body.notes is not None:
        field.notes = body.notes

    await db.commit()
    await db.refresh(field)

    return _field_to_response(field)


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field(
    field_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a field."""
    farm_id = farmer.farm_id or farmer.id

    result = await db.execute(
        select(Field).where(Field.id == field_id, Field.farm_id == farm_id)
    )
    field = result.scalar_one_or_none()

    if field is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "필지를 찾을 수 없습니다"},
        )

    await db.delete(field)
    await db.commit()
