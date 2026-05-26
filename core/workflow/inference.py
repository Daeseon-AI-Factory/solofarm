"""
Workflow inference — turn raw owner evidence into a structured WorkflowDefinition.

This is THE load-bearing feature of the platform. If Claude can't reliably
turn a 10-minute owner voice walkthrough + a few photos into a useful
WorkflowDefinition, nothing else in the product is interesting.

Usage:
    inputs = WorkflowInferenceInput(
        voice_transcripts=["오늘 마감조는 머신 청소부터 하고..."],
        photo_descriptions=["에스프레소 머신 카운터, 우유통 옆에 있음"],
        industry_hint="cafe",
    )
    result = await infer_workflow(inputs)
    print(result.workflow.model_dump_json(indent=2))
"""

import json
import logging

from core.ai.claude_provider import ClaudeProvider
from core.workflow.prompts import INFERENCE_SYSTEM_PROMPT, build_user_message
from core.workflow.schemas import WorkflowInferenceInput, WorkflowInferenceResult

logger = logging.getLogger(__name__)

# Inference output is structured JSON; bigger than chat-style responses because
# we may have 10-20 steps with full verification blocks. 4000 tokens is a safe
# ceiling for most workflows; bump if we ever see truncation in production.
_MAX_TOKENS = 4000

# Slight non-zero temperature: too cold and Claude over-relies on its first
# guess at step order. A tiny bit of variance lets it consider alternatives
# when the evidence is genuinely ambiguous. The JSON schema constraint keeps
# the output disciplined regardless.
_TEMPERATURE = 0.2


async def infer_workflow(
    inputs: WorkflowInferenceInput,
    claude: ClaudeProvider | None = None,
) -> WorkflowInferenceResult:
    """
    Given the owner's raw evidence, infer a structured workflow.

    Args:
        inputs: Owner's text/voice-transcript/photo-description evidence.
        claude: Optional pre-constructed provider — useful for tests or for
            reusing a client across many calls. Defaults to a fresh one.

    Returns:
        WorkflowInferenceResult containing the structured workflow plus any
        clarifying questions the AI surfaced.

    Raises:
        ValueError: if inputs is empty (no evidence to infer from), or if
            the model returned non-JSON / non-conforming output we can't recover.
    """
    claude = claude or ClaudeProvider()

    user_message = build_user_message(inputs)
    raw_response = await claude.complete(
        system_prompt=INFERENCE_SYSTEM_PROMPT,
        user_message=user_message,
        max_tokens=_MAX_TOKENS,
        temperature=_TEMPERATURE,
    )

    cleaned = _strip_markdown_fence(raw_response)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Surface the head of the bad response so we can debug prompt drift.
        logger.error("Workflow inference returned non-JSON. Head: %s", cleaned[:500])
        raise ValueError(
            "AI 응답을 JSON으로 파싱할 수 없습니다. 다시 시도해주세요."
        ) from e

    return WorkflowInferenceResult(**parsed)


def _strip_markdown_fence(text: str) -> str:
    """
    Remove ```json ... ``` wrappers that Claude occasionally adds despite
    being asked not to. Idempotent — safe to call on already-clean JSON.

    # CORE_CANDIDATE — same pattern lives in modules/farm_log/voice_pipeline.
    # Promote to core/ai/response_parsing.py the next time another module needs it.
    """
    s = text.strip()
    if not s.startswith("```"):
        return s
    lines = [ln for ln in s.split("\n") if not ln.strip().startswith("```")]
    return "\n".join(lines).strip()
