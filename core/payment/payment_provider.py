"""
Abstract payment provider interface.

# CORE_CANDIDATE — swap payment gateways without changing business logic.

Any product that accepts payments implements this interface.
Currently: TossPayments. Could swap to Stripe, PayPal, etc.
"""

from abc import ABC, abstractmethod


class PaymentProvider(ABC):
    """
    Abstract interface for payment gateway operations.

    Concrete implementations handle provider-specific API calls,
    authentication, and response parsing. Business logic depends
    only on this interface.
    """

    @abstractmethod
    async def confirm_payment(
        self, payment_key: str, order_id: str, amount: int
    ) -> dict:
        """
        Confirm a payment after the customer completes the payment widget.

        Args:
            payment_key: Payment gateway's identifier for this payment
            order_id: Our generated order ID
            amount: Expected amount in KRW (verified server-side)

        Returns:
            Payment confirmation response from the gateway
        """
        ...

    @abstractmethod
    async def cancel_payment(
        self, payment_key: str, reason: str
    ) -> dict:
        """
        Cancel/refund a confirmed payment.

        Args:
            payment_key: Payment gateway's identifier
            reason: Cancellation reason (shown to customer)

        Returns:
            Cancellation response from the gateway
        """
        ...

    @abstractmethod
    async def get_payment(self, payment_key: str) -> dict:
        """
        Look up a payment's current status.

        Args:
            payment_key: Payment gateway's identifier

        Returns:
            Payment details from the gateway
        """
        ...
