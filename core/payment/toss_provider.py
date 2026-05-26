"""
TossPayments provider — Korean payment gateway integration.

# CORE_CANDIDATE — TossPayments client reusable across products.

TossPayments API uses Basic auth with the secret key as the username
and an empty password. The key is base64-encoded as "{secret_key}:".

Includes retry logic with exponential backoff matching the Claude provider
pattern — transient 500s and timeouts shouldn't fail the payment flow.

API docs: https://docs.tosspayments.com/reference
"""

import asyncio
import base64
import hashlib
import hmac
import logging

import httpx

from core.config import settings
from core.payment.payment_provider import PaymentProvider

logger = logging.getLogger(__name__)

TOSS_BASE_URL = "https://api.tosspayments.com/v1/payments"
MAX_RETRIES = 3
BASE_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 15.0


class TossProvider(PaymentProvider):
    """
    TossPayments API implementation.

    Returns raw dict responses from Toss — the endpoint layer extracts
    the fields it needs. This keeps the provider thin and avoids coupling
    to Toss-specific response shapes that may change.
    """

    def __init__(self):
        # Toss uses Basic auth: base64("{secret_key}:") — note the trailing colon
        secret = settings.toss_secret_key
        encoded = base64.b64encode(f"{secret}:".encode()).decode()
        self._auth_header = f"Basic {encoded}"
        self._client = httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={
                "Authorization": self._auth_header,
                "Content-Type": "application/json",
            },
        )

    async def confirm_payment(
        self, payment_key: str, order_id: str, amount: int
    ) -> dict:
        """
        Confirm payment — called after customer completes the Toss widget.

        This is the critical step: verifies the amount server-side to prevent
        tampering, then tells Toss to finalize the charge.
        """
        return await self._request_with_retry(
            "POST",
            f"{TOSS_BASE_URL}/confirm",
            json={
                "paymentKey": payment_key,
                "orderId": order_id,
                "amount": amount,
            },
        )

    async def cancel_payment(
        self, payment_key: str, reason: str
    ) -> dict:
        """
        Cancel a payment — triggers refund to customer.

        Full cancellation only (no partial refunds for MVP).
        """
        return await self._request_with_retry(
            "POST",
            f"{TOSS_BASE_URL}/{payment_key}/cancel",
            json={"cancelReason": reason},
        )

    async def get_payment(self, payment_key: str) -> dict:
        """Look up payment status from Toss."""
        return await self._request_with_retry(
            "GET",
            f"{TOSS_BASE_URL}/{payment_key}",
        )

    def verify_webhook(self, body: bytes, signature: str) -> bool:
        """
        Verify TossPayments webhook HMAC signature.

        Toss signs webhook payloads with HMAC-SHA256 using the webhook secret.
        Returns True if the signature matches, False otherwise.
        """
        if not settings.toss_webhook_secret:
            logger.warning("Toss webhook secret not configured — skipping verification")
            return True

        expected = hmac.new(
            settings.toss_webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature)

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        json: dict | None = None,
    ) -> dict:
        """
        HTTP request with exponential backoff retry.

        Retries on server errors (5xx) and timeouts.
        Does NOT retry on client errors (4xx) — those need different handling.
        """
        last_error: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                response = await self._client.request(method, url, json=json)

                if response.status_code >= 500:
                    # Server error — retry
                    last_error = httpx.HTTPStatusError(
                        f"Toss server error: {response.status_code}",
                        request=response.request,
                        response=response,
                    )
                    delay = BASE_DELAY_SECONDS * (2 ** attempt)
                    logger.warning(
                        "Toss server error %d (attempt %d/%d), retrying in %.1fs",
                        response.status_code, attempt + 1, MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    continue

                if response.status_code >= 400:
                    # Client error — don't retry, return the error details
                    error_data = response.json()
                    logger.error("Toss API error %d: %s", response.status_code, error_data)
                    raise TossPaymentError(
                        code=error_data.get("code", "UNKNOWN"),
                        message=error_data.get("message", "결제 처리 중 오류가 발생했습니다"),
                        status_code=response.status_code,
                    )

                return response.json()

            except httpx.TimeoutException as e:
                last_error = e
                delay = BASE_DELAY_SECONDS * (2 ** attempt)
                logger.warning(
                    "Toss timeout (attempt %d/%d), retrying in %.1fs",
                    attempt + 1, MAX_RETRIES, delay,
                )
                await asyncio.sleep(delay)

        logger.error("Toss API failed after %d attempts", MAX_RETRIES)
        raise last_error or RuntimeError("Toss API failed after all retries")


class TossPaymentError(Exception):
    """Toss API returned a client error (4xx) — not retryable."""

    def __init__(self, code: str, message: str, status_code: int):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(f"TossPayment error [{code}]: {message}")
