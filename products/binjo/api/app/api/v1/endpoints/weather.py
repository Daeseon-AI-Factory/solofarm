"""
Weather endpoints — proxy to 기상청 API for auto-fill and display.

The farmer's dashboard shows current weather. When creating a farm log,
weather_official is auto-filled from KMA data for the log date.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.external_api.weather_kma import (
    format_weather_summary,
    get_current_weather,
    get_weather_for_date,
)
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.schemas.weather import WeatherResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/current", response_model=WeatherResponse)
async def current_weather(
    farmer: Farmer = Depends(get_current_farmer),
) -> WeatherResponse:
    """
    Get current weather for the farm location (사천시).
    Displayed on farmer dashboard: "오늘 날씨: 맑음 4°C"
    """
    try:
        weather = await get_current_weather()
    except Exception as e:
        logger.error("Failed to fetch current weather: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "WEATHER_ERROR", "message": "날씨 정보를 가져올 수 없습니다"},
        )

    if not weather:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "WEATHER_UNAVAILABLE", "message": "기상청 API 키가 설정되지 않았습니다"},
        )

    return WeatherResponse(
        temperature=weather.get("temperature", ""),
        humidity=weather.get("humidity", ""),
        precipitation=weather.get("precipitation", ""),
        precipitation_amount=weather.get("precipitation_amount", "0"),
        wind_speed=weather.get("wind_speed", ""),
        sky=weather.get("sky", ""),
        observation_time=weather.get("observation_time", ""),
        summary=format_weather_summary(weather),
    )


@router.get("/history/{date}", response_model=WeatherResponse)
async def weather_for_date(
    date: str,
    farmer: Farmer = Depends(get_current_farmer),
) -> WeatherResponse:
    """
    Get weather for a specific date (YYYY-MM-DD).
    Used to auto-fill weather_official when creating a farm log.
    KMA keeps ~3 days of forecast data, so older dates may return empty.
    """
    # Basic date format validation
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DATE", "message": "날짜 형식: YYYY-MM-DD"},
        )

    try:
        weather = await get_weather_for_date(date)
    except Exception as e:
        logger.error("Failed to fetch weather for %s: %s", date, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "WEATHER_ERROR", "message": "날씨 정보를 가져올 수 없습니다"},
        )

    return WeatherResponse(
        temperature=weather.get("temperature", ""),
        humidity=weather.get("humidity", ""),
        precipitation=weather.get("precipitation", ""),
        precipitation_amount=weather.get("precipitation_amount", "0"),
        wind_speed=weather.get("wind_speed", ""),
        sky=weather.get("sky", ""),
        observation_time=weather.get("observation_time", ""),
        summary=format_weather_summary(weather),
    )
