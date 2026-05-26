"""Pydantic schemas for voice recording endpoints."""

from datetime import datetime

from pydantic import BaseModel


class VoiceUploadResponse(BaseModel):
    id: str
    status: str
    message: str


class VoiceStatusResponse(BaseModel):
    id: str
    status: str  # uploaded | processing | completed | failed
    transcript: str | None = None
    error_message: str | None = None


class VoiceResultResponse(BaseModel):
    id: str
    status: str
    transcript: str | None = None
    parsed_data: dict | None = None
    created_at: datetime


class TaskData(BaseModel):
    stage: str
    detail: str | None = None
    duration_hours: float | None = None


class ChemicalData(BaseModel):
    type: str  # "농약" | "비료"
    name: str
    amount: str | None = None
    action: str = "사용"  # "구입" | "사용"


class ParsedFarmLogData(BaseModel):
    """The structured output from Claude parsing."""
    date: str
    field_names: list[str] = []
    crop: str = "사과"
    tasks: list[TaskData]
    chemicals: list[ChemicalData] = []
    weather_farmer: str | None = None
    notes: str | None = None
