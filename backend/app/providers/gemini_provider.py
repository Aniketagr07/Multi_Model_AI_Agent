import logging
from typing import List, Dict, Any, Optional
import httpx

from app.providers.base import (
    BaseLLMProvider,
    ProviderError,
    ProviderConfigError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    """Adapter for Google Gemini API via official REST interface."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Format standardized messages into Gemini's contents schema.
        Note: Gemini requires 'user' and 'model' roles.
        """
        formatted = []
        for msg in messages:
            role = msg.get("role", "user")
            # Map assistant role to Gemini's expected 'model' role
            gemini_role = "model" if role == "assistant" else "user"
            content_text = msg.get("content", "")
            if content_text.strip():
                formatted.append({
                    "role": gemini_role,
                    "parts": [{"text": content_text}],
                })
        return formatted

    async def generate_response(self, messages: List[Dict[str, str]], model_id: str = "gemini-1.5-flash") -> str:
        """
        Send formatted prompt to Google Gemini API and extract response text.
        """
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
            )

        # Gemini model endpoint
        endpoint = f"{self.base_url}/models/{model_id}:generateContent"
        params = {"key": self.api_key}
        payload = {
            "contents": self._format_messages(messages),
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint,
                    params=params,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )

            # Handle error status codes
            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "Invalid request to Gemini API.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"Gemini API error: {err_msg}", status_code=400)

            elif response.status_code in (401, 403):
                raise ProviderAuthError(
                    "Authentication failed with Google Gemini API. Please verify your GEMINI_API_KEY."
                )

            elif response.status_code == 429:
                raise ProviderRateLimitError(
                    "Google Gemini API free tier rate limit or quota exceeded. Please wait a moment and retry."
                )

            elif response.status_code >= 500:
                raise ProviderError(
                    "Google Gemini API servers encountered an internal error. Please try again later.",
                    status_code=502,
                )

            elif response.status_code != 200:
                raise ProviderError(
                    f"Unexpected status from Gemini API (HTTP {response.status_code}).",
                    status_code=502,
                )

            # Parse successful 200 response
            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                # Check for prompt feedback block
                feedback = data.get("promptFeedback", {})
                block_reason = feedback.get("blockReason")
                if block_reason:
                    raise ProviderError(f"Prompt blocked by Google safety filters: {block_reason}")
                raise ProviderError("Gemini returned an empty response with no candidates.")

            first_candidate = candidates[0]
            finish_reason = first_candidate.get("finishReason")
            if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):
                if finish_reason == "SAFETY":
                    raise ProviderError("Response blocked by Google safety policies.")
                elif finish_reason == "RECITATION":
                    raise ProviderError("Response withheld due to recitation check.")

            content = first_candidate.get("content", {})
            parts = content.get("parts", [])
            if not parts:
                raise ProviderError("Gemini candidate contains no text parts.")

            # Combine parts into string
            text_chunks = [p.get("text", "") for p in parts if "text" in p]
            result_text = "".join(text_chunks).strip()

            if not result_text:
                raise ProviderError("Gemini returned empty text content.")

            return result_text

        except httpx.TimeoutException:
            logger.warning("Gemini API request timed out after %.1f seconds", self.timeout)
            raise ProviderTimeoutError(
                f"Google Gemini API request timed out after {self.timeout} seconds."
            )
        except httpx.RequestError as req_err:
            logger.error("HTTP network error communicating with Gemini API: %s", str(req_err))
            raise ProviderError(
                "Network connection failure communicating with Google Gemini API.",
                status_code=502,
            )

    async def check_availability(self) -> bool:
        """Check if GEMINI_API_KEY is configured and service is reachable."""
        return bool(self.api_key and self.api_key.strip())
