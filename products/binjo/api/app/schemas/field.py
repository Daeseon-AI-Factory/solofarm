"""Pydantic schemas for field management endpoints."""

from datetime import datetime

from pydantic import BaseModel


class FieldCreate(BaseModel):
    """Create a new field (필지)."""
    name: str  # '3번 밭', '앞 과수원'
    area_pyeong: float | None = None
    crop: str = "사과"
    address: str | None = None
    notes: str | None = None


class FieldUpdate(BaseModel):
    """Update a field — all fields optional."""
    name: str | None = None
    area_pyeong: float | None = None
    crop: str | None = None
    address: str | None = None
    notes: str | None = None


class FieldResponse(BaseModel):
    """Field response with all details."""
    id: str
    name: str
    area_pyeong: float | None
    crop: str
    address: str | None
    notes: str | None
    created_at: datetime


class FieldListResponse(BaseModel):
    """List of fields."""
    fields: list[FieldResponse]
    total: int
