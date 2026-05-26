"""
Abstract LLM provider interface.

# CORE_CANDIDATE — any product needing LLM calls should use this interface.

The Dependency Inversion Principle: high-level modules (farm log parser)
depend on abstractions (LLMProvider), not concretions (Claude, OpenAI).
Swapping Claude for OpenAI requires zero changes in business logic.
"""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2000,
        temperature: float = 0.0,
    ) -> str:
        """
        Send a message to the LLM and get a text response.

        Args:
            system_prompt: System-level instructions
            user_message: The user's input
            max_tokens: Max response length
            temperature: 0.0 = deterministic, 1.0 = creative

        Returns:
            The LLM's text response
        """
        ...
