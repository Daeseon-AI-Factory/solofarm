"""
Post-processor for Whisper transcripts — fixes common Korean agricultural mishearings.

# CORE_CANDIDATE — correction dictionary pattern reusable for any domain-specific STT.

Whisper is good at general Korean but stumbles on specialized terms.
This module applies known corrections before Claude parsing.
"""

# Common Whisper mishearings for agricultural terms
# Format: { wrong_text: correct_text }
CORRECTIONS: dict[str, str] = {
    # Farming stages
    "적화": "적화",  # Sometimes confused with 적과
    "전전": "전정",  # 전정 (pruning) misheard as 전전
    "전쟁": "전정",  # 전정 misheard as 전쟁 (war)
    "시배": "시비",  # 시비 (fertilizing) misheard
    "방재": "방제",  # 방제 (pest control) misheard as 방재 (disaster prevention)

    # Chemicals
    "석회유활합제": "석회유황합제",
    "기계유제": "기계유유제",
    "만코지수화제": "만코지",

    # Dialect corrections (경상도 사투리)
    "했더": "했다",
    "갔더": "갔다",
    "봤더": "봤다",
    "됐더": "됐다",
}


def correct_transcript(text: str) -> str:
    """
    Apply known corrections to a Whisper transcript.
    Simple string replacement — fast and deterministic.
    Claude handles the harder corrections during parsing.
    """
    result = text
    for wrong, correct in CORRECTIONS.items():
        result = result.replace(wrong, correct)
    return result
