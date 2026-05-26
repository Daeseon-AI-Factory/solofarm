"""Pydantic schemas for weather endpoints."""

from pydantic import BaseModel


class WeatherResponse(BaseModel):
    """Current or historical weather data response."""
    temperature: str = ""
    humidity: str = ""
    precipitation: str = ""
    precipitation_amount: str = "0"
    wind_speed: str = ""
    sky: str = ""
    observation_time: str = ""
    summary: str = ""  # Human-readable Korean summary


class WeatherComparisonResponse(BaseModel):
    """Compare farmer-reported weather vs. official KMA data."""
    official: WeatherResponse
    farmer_reported: str | None = None
    match: bool = True  # True if farmer's report roughly matches official data
