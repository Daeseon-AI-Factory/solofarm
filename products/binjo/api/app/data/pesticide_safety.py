"""
Pesticide safety period database for Korean apple farming.

Source: 농촌진흥청 농약안전정보시스템 (National Institute of Agricultural Sciences)
Data is for apples (사과) specifically.

# CORE_CANDIDATE — reusable for any Korean fruit farming product.
"""

# Safety period in days before harvest
# dilution_ratio is the standard recommended dilution
PESTICIDE_DB: dict[str, dict] = {
    "석회유황합제": {
        "name_kr": "석회유황합제",
        "name_en": "Lime sulfur",
        "type": "살균제",  # fungicide
        "safety_days": 14,
        "dilution_ratio": "500배",
        "target": ["갈반병", "흑성병", "응애"],
        "season": ["전정기", "발아전"],
        "notes": "발아 후 사용 시 약해 주의",
    },
    "만코지": {
        "name_kr": "만코지",
        "name_en": "Mancozeb",
        "type": "살균제",
        "safety_days": 30,
        "dilution_ratio": "600배",
        "target": ["점무늬낙엽병", "겹무늬썩음병"],
        "season": ["생육기"],
        "notes": "수확 30일 전까지만 사용",
    },
    "디페노코나졸": {
        "name_kr": "디페노코나졸",
        "name_en": "Difenoconazole",
        "type": "살균제",
        "safety_days": 14,
        "dilution_ratio": "3000배",
        "target": ["점무늬낙엽병", "갈색무늬병"],
        "season": ["생육기"],
        "notes": "",
    },
    "이미다클로프리드": {
        "name_kr": "이미다클로프리드",
        "name_en": "Imidacloprid",
        "type": "살충제",  # insecticide
        "safety_days": 21,
        "dilution_ratio": "2000배",
        "target": ["진딧물", "잎말이나방"],
        "season": ["생육기"],
        "notes": "꿀벌 독성 주의, 개화기 사용 금지",
    },
    "클로르피리포스": {
        "name_kr": "클로르피리포스",
        "name_en": "Chlorpyrifos",
        "type": "살충제",
        "safety_days": 21,
        "dilution_ratio": "1000배",
        "target": ["복숭아심식나방", "사과굴나방"],
        "season": ["생육기"],
        "notes": "토양 잔류 주의",
    },
    "아바멕틴": {
        "name_kr": "아바멕틴",
        "name_en": "Abamectin",
        "type": "살충살비제",
        "safety_days": 7,
        "dilution_ratio": "2000배",
        "target": ["점박이응애", "사과응애"],
        "season": ["5~8월"],
        "notes": "고온기 약해 주의",
    },
    "에토펜프록스": {
        "name_kr": "에토펜프록스",
        "name_en": "Etofenprox",
        "type": "살충제",
        "safety_days": 14,
        "dilution_ratio": "1000배",
        "target": ["복숭아심식나방", "잎말이나방"],
        "season": ["6~9월"],
        "notes": "",
    },
    "보르도액": {
        "name_kr": "보르도액",
        "name_en": "Bordeaux mixture",
        "type": "살균제",
        "safety_days": 7,
        "dilution_ratio": "4-4식",
        "target": ["탄저병", "갈반병"],
        "season": ["장마기"],
        "notes": "과피 얼룩 주의",
    },
    "캡탄": {
        "name_kr": "캡탄",
        "name_en": "Captan",
        "type": "살균제",
        "safety_days": 14,
        "dilution_ratio": "800배",
        "target": ["겹무늬썩음병", "점무늬낙엽병"],
        "season": ["생육기"],
        "notes": "",
    },
    "델타메트린": {
        "name_kr": "델타메트린",
        "name_en": "Deltamethrin",
        "type": "살충제",
        "safety_days": 7,
        "dilution_ratio": "2000배",
        "target": ["잎말이나방", "심식나방"],
        "season": ["생육기"],
        "notes": "",
    },
    "티오파네이트메틸": {
        "name_kr": "티오파네이트메틸",
        "name_en": "Thiophanate-methyl",
        "type": "살균제",
        "safety_days": 30,
        "dilution_ratio": "1000배",
        "target": ["부란병", "겹무늬썩음병"],
        "season": ["수확전"],
        "notes": "수확 30일 전까지만 사용 가능",
    },
    "트리플록시스트로빈": {
        "name_kr": "트리플록시스트로빈",
        "name_en": "Trifloxystrobin",
        "type": "살균제",
        "safety_days": 14,
        "dilution_ratio": "3000배",
        "target": ["점무늬낙엽병", "갈색무늬병"],
        "season": ["생육기"],
        "notes": "내성 관리 위해 교호 살포",
    },
}


def get_pesticide_info(name: str) -> dict | None:
    """Look up pesticide by Korean name (exact or partial match)."""
    # Exact match first
    if name in PESTICIDE_DB:
        return PESTICIDE_DB[name]
    # Partial match
    for key, info in PESTICIDE_DB.items():
        if name in key or key in name:
            return info
    return None


def get_all_pesticides() -> list[dict]:
    """Return all pesticides as a list for frontend autocomplete."""
    return [{"id": k, **v} for k, v in PESTICIDE_DB.items()]


def calculate_safe_harvest_date(spray_date: str, pesticide_name: str) -> dict | None:
    """
    Calculate earliest safe harvest date given spray date and pesticide.
    Returns dict with safe_date, days_remaining, is_safe.
    """
    from datetime import datetime, timedelta

    info = get_pesticide_info(pesticide_name)
    if not info:
        return None

    spray = datetime.strptime(spray_date, "%Y-%m-%d")
    safe_date = spray + timedelta(days=info["safety_days"])
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_remaining = (safe_date - today).days

    return {
        "pesticide": info["name_kr"],
        "safety_days": info["safety_days"],
        "spray_date": spray_date,
        "safe_harvest_date": safe_date.strftime("%Y-%m-%d"),
        "days_remaining": max(0, days_remaining),
        "is_safe": days_remaining <= 0,
    }
