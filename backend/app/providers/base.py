from abc import ABC, abstractmethod
from typing import List, Dict, Any


class ProviderError(Exception):
    """Base exception for all AI model provider errors."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ProviderConfigError(ProviderError):
    """Raised when provider configuration or API credentials are missing."""
    def __init__(self, message: str = "AI Provider is not configured on the server."):
        super().__init__(message, status_code=503)


class ProviderAuthError(ProviderError):
    """Raised when authentication with the upstream provider fails (e.g. invalid API key)."""
    def __init__(self, message: str = "Authentication failed with upstream AI provider."):
        super().__init__(message, status_code=502)


class ProviderRateLimitError(ProviderError):
    """Raised when provider quota or rate limit is reached."""
    def __init__(self, message: str = "Upstream AI provider rate limit or quota exceeded."):
        super().__init__(message, status_code=429)


class ProviderTimeoutError(ProviderError):
    """Raised when a request to the provider times out."""
    def __init__(self, message: str = "Upstream AI provider request timed out."):
        super().__init__(message, status_code=504)


class BaseLLMProvider(ABC):
    """Abstract base class establishing the contract for all AI model adapters."""

    @abstractmethod
    async def generate_response(self, messages: List[Dict[str, str]], model_id: str, effort: str = "medium") -> str:
        """
        Generate a text completion from the provider.

        Args:
            messages: List of message dicts with 'role' ('user' or 'assistant') and 'content'.
            model_id: Specific model identifier to target.

        Returns:
            The raw text response from the model.

        Raises:
            ProviderError or its subclasses on failure.
        """
        pass

    @abstractmethod
    async def check_availability(self) -> bool:
        """Verify provider availability and credentials."""
        pass

