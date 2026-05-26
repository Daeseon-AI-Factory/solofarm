"""
기상청 단기예보 API client — fetches current and historical weather data.

# CORE_CANDIDATE — reusable Korean weather data client for any agricultural product.

Uses the VilageFcstInfoService_2.0 API from data.go.kr.
- 초단기실황 (getUltraSrtNcst): current conditions (temperature, humidity, rain)
- 단기예보 (getVilageFcst): 3-day forecast

The grid coordinates (nx, ny) are pre-set for 사천시 (Sacheon) where Binjo Farm is.
Korean weather API returns XML by default — we request JSON via dataType=JSON.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

# 기상청 API base URL
KMA_BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"

# 사천시 grid coordinates for KMA API
# Converted from lat/lon (35.0031, 128.0644) using 기상청 좌표 변환
SACHEON_NX = 58
SACHEON_NY = 77

# KST timezone (UTC+9)
KST = timezone(timedelta(hours=9))

# Weather category code → human-readable Korean label
CATEGORY_MAP = {
    "T1H": "기온",        # Temperature (°C)
    "RN1": "1시간 강수량",  # 1-hour rainfall (mm)
    "UUU": "동서바람성분",   # East-west wind (m/s)
    "VVV": "남북바람성분",   # North-south wind (m/s)
    "REH": "습도",        # Relative humidity (%)
    "PTY": "강수형태",     # Precipitation type (code)
    "VEC": "풍향",        # Wind direction (degrees)
    "WSD": "풍속",        # Wind speed (m/s)
}

# Precipitation type code → Korean text
PTY_MAP = {
    "0": "없음",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "5": "빗방울",
    "6": "빗방울눈날림",
    "7": "눈날림",
}

# Sky condition code → Korean text (used in 단기예보)
SKY_MAP = {
    "1": "맑음",
    "3": "구름많음",
    "4": "흐림",
}


def _get_base_time_for_ultra(now: datetime) -> tuple[str, str]:
    """
    Calculate base_date and base_time for 초단기실황 API.

    Ultra short-term observation is released every hour at ~40 minutes past.
    If current time is before XX:40, use the previous hour's data.
    """
    if now.minute < 40:
        now = now - timedelta(hours=1)

    base_date = now.strftime("%Y%m%d")
    base_time = now.strftime("%H00")
    return base_date, base_time


def _get_base_time_for_forecast(now: datetime) -> tuple[str, str]:
    """
    Calculate base_date and base_time for 단기예보 API.

    Short-term forecast is released 8 times daily at:
    0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    Each release takes ~10 minutes, so add a buffer.
    """
    base_hours = [23, 20, 17, 14, 11, 8, 5, 2]

    for hour in base_hours:
        # Each forecast is available ~10 min after base_time
        candidate = now.replace(hour=hour, minute=10, second=0, microsecond=0)
        if now >= candidate:
            base_date = now.strftime("%Y%m%d")
            base_time = f"{hour:02d}00"
            return base_date, base_time

    # If before 02:10, use previous day's 2300 forecast
    yesterday = now - timedelta(days=1)
    return yesterday.strftime("%Y%m%d"), "2300"


def _build_url(endpoint: str, params: dict[str, str]) -> str:
    """
    Build KMA API URL with serviceKey injected directly.

    기상청 API is notoriously sensitive to URL encoding of the serviceKey.
    Using httpx params= causes double-encoding. Instead, we build the URL
    manually and pass other params as query string.
    """
    query_parts = [f"serviceKey={settings.kma_api_key}"]
    for key, value in params.items():
        query_parts.append(f"{key}={value}")
    return f"{KMA_BASE_URL}/{endpoint}?{'&'.join(query_parts)}"


async def get_current_weather(
    nx: int = SACHEON_NX,
    ny: int = SACHEON_NY,
) -> dict[str, Any]:
    """
    Fetch current weather for the given grid coordinates.

    Uses 단기예보 (getVilageFcst) with the nearest forecast time,
    because 초단기실황 (getUltraSrtNcst) requires a separate API subscription.
    단기예보 gives hourly forecasts including the current hour.

    Returns a dict with human-readable weather data:
    {
        "temperature": "4.2",
        "humidity": "65",
        "precipitation": "없음",
        "wind_speed": "2.1",
        "sky": "맑음",
        "observation_time": "2026-03-23 14:00",
        "raw": { ... }
    }
    """
    if not settings.kma_api_key:
        logger.warning("KMA_API_KEY not set — returning empty weather data")
        return {}

    now = datetime.now(KST)
    base_date, base_time = _get_base_time_for_forecast(now)

    # Target the current hour's forecast
    current_hour = now.strftime("%H00")

    params = {
        "numOfRows": "100",
        "pageNo": "1",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
    }

    url = _build_url("getVilageFcst", params)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    data = response.json()

    # KMA API wraps data deep: response > header + body > items > item[]
    try:
        items = data["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        logger.error("Unexpected KMA API response structure: %s", data)
        return {}

    # Filter for today's date and nearest hour
    today_str = now.strftime("%Y%m%d")
    today_items = [i for i in items if i.get("fcstDate") == today_str]

    if not today_items:
        return {}

    # Pick forecasts for the current hour, or the nearest available
    raw: dict[str, str] = {}
    for item in today_items:
        cat = item["category"]
        fcst_time = item.get("fcstTime", "")
        # Prefer current hour, but accept any data
        if cat not in raw or fcst_time == current_hour:
            raw[cat] = item["fcstValue"]

    return {
        "temperature": raw.get("TMP", raw.get("T1H", "")),
        "humidity": raw.get("REH", ""),
        "precipitation": PTY_MAP.get(raw.get("PTY", "0"), "알 수 없음"),
        "precipitation_amount": raw.get("PCP", "0"),
        "wind_speed": raw.get("WSD", ""),
        "sky": SKY_MAP.get(raw.get("SKY", ""), ""),
        "observation_time": f"{now.strftime('%Y-%m-%d')} {current_hour[:2]}:00",
        "raw": raw,
    }


async def get_weather_for_date(
    target_date: str,
    nx: int = SACHEON_NX,
    ny: int = SACHEON_NY,
) -> dict[str, Any]:
    """
    Fetch weather data for a specific date.

    For today: uses 초단기실황 (current observation).
    For past dates: uses 단기예보 with the closest available base_time.

    Args:
        target_date: Date string in YYYY-MM-DD format.

    Returns:
        Same format as get_current_weather(), or empty dict on failure.
    """
    if not settings.kma_api_key:
        logger.warning("KMA_API_KEY not set — returning empty weather data")
        return {}

    now = datetime.now(KST)
    target = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=KST)

    # If target is today, use current observation
    if target.date() == now.date():
        return await get_current_weather(nx, ny)

    # For other dates, use 단기예보 (forecast)
    # Note: KMA only keeps ~3 days of forecast data
    base_date, base_time = _get_base_time_for_forecast(
        target.replace(hour=now.hour, minute=now.minute)
    )

    params = {
        "numOfRows": "100",
        "pageNo": "1",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
    }

    url = _build_url("getVilageFcst", params)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    data = response.json()

    try:
        items = data["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        logger.error("Unexpected KMA forecast response: %s", data)
        return {}

    # Filter items for the target date, pick noon (1200) as representative
    target_date_str = target_date.replace("-", "")
    day_items = [
        item for item in items
        if item.get("fcstDate") == target_date_str
    ]

    if not day_items:
        return {}

    # Group by category, prefer 1200 (midday) readings
    raw: dict[str, str] = {}
    for item in day_items:
        cat = item["category"]
        # Prefer midday reading if available
        if cat not in raw or item.get("fcstTime") == "1200":
            raw[cat] = item["fcstValue"]

    return {
        "temperature": raw.get("TMP", raw.get("T1H", "")),
        "humidity": raw.get("REH", ""),
        "precipitation": PTY_MAP.get(raw.get("PTY", "0"), "알 수 없음"),
        "precipitation_amount": raw.get("PCP", "0"),
        "wind_speed": raw.get("WSD", ""),
        "sky": SKY_MAP.get(raw.get("SKY", ""), ""),
        "observation_time": f"{target_date} 12:00",
        "raw": raw,
    }


def format_weather_summary(weather: dict[str, Any]) -> str:
    """
    Format weather data into a short Korean summary for display.

    Example output: "맑음 4.2°C, 습도 65%, 바람 2.1m/s"
    """
    if not weather:
        return ""

    parts = []

    # Sky condition (forecast) or precipitation status
    sky = weather.get("sky", "")
    precip = weather.get("precipitation", "")
    if sky:
        parts.append(sky)
    elif precip and precip != "없음":
        parts.append(precip)
    else:
        parts.append("맑음")

    # Temperature
    temp = weather.get("temperature", "")
    if temp:
        parts.append(f"{temp}°C")

    # Humidity
    humidity = weather.get("humidity", "")
    if humidity:
        parts.append(f"습도 {humidity}%")

    # Wind
    wind = weather.get("wind_speed", "")
    if wind:
        parts.append(f"바람 {wind}m/s")

    return ", ".join(parts)
