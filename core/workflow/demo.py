"""
Demo script — run end-to-end workflow inference against a fake cafe closing
walkthrough. Requires ANTHROPIC_API_KEY in your environment.

Usage:
    source .venv/bin/activate
    ANTHROPIC_API_KEY=sk-ant-... python -m core.workflow.demo

This is intentionally a script, not a test. It is the fastest way to see
whether the inference prompt actually produces useful workflows. Tweak
INFERENCE_SYSTEM_PROMPT and re-run.
"""

import asyncio
import json

from core.workflow import infer_workflow
from core.workflow.schemas import WorkflowInferenceInput

# A realistic "owner walking around the cafe describing the closing shift" —
# fragments, jumps in order, no formal structure. Exactly the kind of input
# inference is supposed to handle.
SAMPLE_VOICE_TRANSCRIPT = """
오늘 카페 마감조 일은 보통 8시부터 시작해.
일단 에스프레소 머신 청소부터 해 — 표면 닦고 트레이 빼서 씻고.
청소되면 사진 한 장 찍어, 내가 확인할 수 있게.
그다음에 바닥 청소. 이거도 사진 찍어.
아 잠깐, 그 전에 카운터 위 정리부터 했었나? 아무튼 카운터도 깨끗하게.
마지막으로 매출 정산 — 현금이랑 카드 따로 세서 적어. 음성으로 말해줘.
재고도 봐야 해, 원두 우유 시럽 — 다 얼마나 남았는지 음성으로 말해.
그러고 불 끄고 문 잠그면 끝. 30분쯤 걸려.
"""

SAMPLE_PHOTO_DESCRIPTIONS = [
    "에스프레소 머신과 그라인더가 카운터 위에 놓여 있는 모습. 머신은 사용 중이어서 표면에 커피 자국이 보임.",
    "바닥 — 카페 내부 객장, 의자 4개가 테이블 두 개 주변에 배치됨. 약간의 음료 자국이 보임.",
    "현금 보관함과 영수증 프린터가 카운터 아래에 있는 모습. 영수증 더미가 옆에 쌓여 있음.",
]


async def main() -> None:
    inputs = WorkflowInferenceInput(
        voice_transcripts=[SAMPLE_VOICE_TRANSCRIPT.strip()],
        photo_descriptions=SAMPLE_PHOTO_DESCRIPTIONS,
        industry_hint="cafe",
    )

    print("=" * 60)
    print("Calling Claude with inference inputs...")
    print("=" * 60)

    result = await infer_workflow(inputs)

    print()
    print("=" * 60)
    print("INFERRED WORKFLOW")
    print("=" * 60)
    print(json.dumps(result.workflow.model_dump(), ensure_ascii=False, indent=2))

    if result.clarifying_questions:
        print()
        print("=" * 60)
        print("CLARIFYING QUESTIONS FOR OWNER")
        print("=" * 60)
        for i, q in enumerate(result.clarifying_questions, 1):
            print(f"{i}. {q}")


if __name__ == "__main__":
    asyncio.run(main())
