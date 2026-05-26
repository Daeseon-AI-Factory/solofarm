"""Pydantic schemas for farm log endpoints."""

from datetime import date, datetime

from pydantic import BaseModel


class TaskCreate(BaseModel):
    field_name: str | None = None
    stage: str
    detail: str | None = None
    duration_hours: float | None = None


class ChemicalCreate(BaseModel):
    type: str  # "농약" | "비료"
    name: str
    amount: str | None = None
    action: str = "사용"


class FarmLogCreate(BaseModel):
    """Create a farm log — either from voice pipeline or manual entry."""
    voice_recording_id: str | None = None
    log_date: date
    crop: str = "사과"
    tasks: list[TaskCreate]
    chemicals: list[ChemicalCreate] = []
    weather_farmer: str | None = None
    notes: str | None = None


class FarmLogUpdate(BaseModel):
    """Update a farm log — farmer edits parsed data before confirming."""
    log_date: date | None = None
    crop: str | None = None
    tasks: list[TaskCreate] | None = None
    chemicals: list[ChemicalCreate] | None = None
    weather_farmer: str | None = None
    notes: str | None = None


class TaskResponse(BaseModel):
    id: str
    field_name: str | None
    stage: str
    detail: str | None
    duration_hours: float | None


class ChemicalResponse(BaseModel):
    id: str
    type: str
    name: str
    amount: str | None
    action: str


class FarmLogResponse(BaseModel):
    id: str
    log_date: date
    status: str
    crop: str
    tasks: list[TaskResponse]
    chemicals: list[ChemicalResponse]
    weather_official: dict | None = None
    weather_farmer: str | None = None
    notes: str | None = None
    photo_urls: list[str] = []
    voice_recording_id: str | None = None
    created_at: datetime
    updated_at: datetime


class FarmLogListResponse(BaseModel):
    logs: list[FarmLogResponse]
    total: int


class PhotoUploadResponse(BaseModel):
    photo_urls: list[str]
    message: str
