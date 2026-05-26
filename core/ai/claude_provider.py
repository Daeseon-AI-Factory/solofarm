"""
Claude API provider — primary LLM for structured parsing.

# CORE_CANDIDATE — reusable Claude wrapper with consistent error handling.

Uses claude-sonnet-4-20250514 for the best balance of Korean understanding,
structured output quality, and cost. Temperature 0.0 for deterministic parsing.

Includes retry logic with exponential backoff — prevents transient API errors
from failing the entire voice pipeline (which would frustrate the farmer).
"""

import asyncio
import base64
import logging

import anthropic

from core.config import settings
from core.ai.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

# Retry config: 3 attempts with 1s, 2s, 4s backoff
MAX_RETRIES = 3
BASE_DELAY_SECONDS = 1.0
# Timeout per request — if Claude doesn't respond in 30s, something is wrong
REQUEST_TIMEOUT_SECONDS = 30.0
# Vision calls take longer — image encoding + more complex analysis
VISION_TIMEOUT_SECONDS = 45.0


class ClaudeProvider(LLMProvider):
    """Claude API implementation of the LLM provider interface."""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.model = model

    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2000,
        temperature: float = 0.0,
    ) -> str:
        """
        Send a message to Claude with retry logic.

        Retries on transient errors (rate limit, server error, timeout).
        Does NOT retry on client errors (bad request, auth failure).
        """
        messages = [{"role": "user", "content": user_message}]
        return await self._call_with_retry(
            system_prompt, messages, max_tokens, temperature, REQUEST_TIMEOUT_SECONDS
        )

    async def complete_with_image(
        self,
        system_prompt: str,
        image_data: bytes,
        image_media_type: str,
        user_message: str = "",
        max_tokens: int = 4000,
        temperature: float = 0.0,
    ) -> str:
        """
        Send an image + text to Claude Vision for multimodal analysis.

        Used for receipt OCR — sends the receipt photo as a base64 image
        content block alongside the text prompt. Claude extracts structured
        data (store, items, amounts, categories) from the image.

        This method is on ClaudeProvider only, not on the abstract LLMProvider,
        because vision is a Claude-specific capability. The receipt pipeline
        depends on ClaudeProvider directly — no false abstraction.

        Args:
            system_prompt: System instructions (receipt parsing rules)
            image_data: Raw image bytes (JPEG or PNG)
            image_media_type: MIME type ("image/jpeg" or "image/png")
            user_message: Optional additional text context
            max_tokens: Max response tokens (receipts need ~2000-4000)
            temperature: 0.0 for deterministic extraction
        """
        # Build multimodal content: image first, then optional text
        content: list[dict] = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_media_type,
                    "data": base64.b64encode(image_data).decode("utf-8"),
                },
            },
        ]
        if user_message:
            content.append({"type": "text", "text": user_message})

        messages = [{"role": "user", "content": content}]
        return await self._call_with_retry(
            system_prompt, messages, max_tokens, temperature, VISION_TIMEOUT_SECONDS
        )

    async def _call_with_retry(
        self,
        system_prompt: str,
        messages: list[dict],
        max_tokens: int,
        temperature: float,
        timeout: float,
    ) -> str:
        """
        Shared retry logic for text and vision calls.

        Extracted to avoid duplicating the retry/backoff/error-handling code
        between complete() and complete_with_image().
        """
        last_error: Exception | None = None

        # Create a client with the appropriate timeout for this call type
        client = self.client
        if timeout != REQUEST_TIMEOUT_SECONDS:
            client = anthropic.AsyncAnthropic(
                api_key=settings.anthropic_api_key,
                timeout=timeout,
            )

        for attempt in range(MAX_RETRIES):
            try:
                response = await client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=messages,
                )
                # Claude returns a list of content blocks — we want the text from the first one
                return response.content[0].text

            except anthropic.RateLimitError as e:
                # 429 — back off and retry
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude rate limited (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except anthropic.InternalServerError as e:
                # 500 — transient server error, retry
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude server error (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except (asyncio.TimeoutError, anthropic.APITimeoutError) as e:
                # Timeout — retry with backoff
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning("Claude timeout (attempt %d/%d), retrying in %.1fs", attempt + 1, MAX_RETRIES, delay)
                await asyncio.sleep(delay)

            except anthropic.APIError as e:
                # Other API errors (400, 401, 403) — don't retry, these won't fix themselves
                logger.error("Claude API error (not retryable): %s", e)
                raise

        # All retries exhausted
        logger.error("Claude failed after %d attempts", MAX_RETRIES)
        raise last_error or RuntimeError("Claude API failed after all retries")
