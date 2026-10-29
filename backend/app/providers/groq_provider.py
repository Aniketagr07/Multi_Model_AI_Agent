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


class GroqProvider(BaseLLMProvider):
    """Adapter for Groq Cloud API via OpenAI-compatible REST interface."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.groq.com/openai/v1",
        timeout: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Format standardized messages into OpenAI-compatible chat format.
        Roles supported: 'user', 'assistant', 'system'.
        """
        formatted = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "").strip()
            if content:
                formatted.append({
                    "role": role,
                    "content": content,
                })
        return formatted

    async def generate_response(self, messages: List[Dict[str, str]], model_id: str = "llama-3.1-8b-instant") -> str:
        """
        Send formatted prompt to Groq API and extract response text.
        """
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Groq API key is not configured. Please set GROQ_API_KEY in backend/.env"
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_id,
            "messages": self._format_messages(messages),
            "temperature": 0.7,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers=headers,
                )

            # Handle 404 (model deprecated or catalog update on Groq)
            if response.status_code == 404:
                fallback_candidates = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
                for fb_model in fallback_candidates:
                    if fb_model != model_id:
                        logger.info("Groq model '%s' not found. Retrying with active model '%s'...", model_id, fb_model)
                        payload["model"] = fb_model
                        async with httpx.AsyncClient(timeout=self.timeout) as client:
                            fb_resp = await client.post(endpoint, json=payload, headers=headers)
                            if fb_resp.status_code == 200:
                                response = fb_resp
                                break

            # Handle error status codes
            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "Invalid request to Groq API.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"Groq API error: {err_msg}", status_code=400)

            elif response.status_code in (401, 403):
                raise ProviderAuthError(
                    "Authentication failed with Groq Cloud API. Please verify your GROQ_API_KEY."
                )

            elif response.status_code == 429:
                raise ProviderRateLimitError(
                    "Groq API rate limit or token quota exceeded. Please wait a moment and retry."
                )

            elif response.status_code >= 500:
                raise ProviderError(
                    "Groq API servers encountered an internal error. Please try again later.",
                    status_code=502,
                )

            elif response.status_code != 200:
                raise ProviderError(
                    f"Unexpected status from Groq API (HTTP {response.status_code}).",
                    status_code=502,
                )

            # Parse successful 200 response
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise ProviderError("Groq API returned an empty choices array.")

            first_choice = choices[0]
            message_obj = first_choice.get("message", {})
            content = message_obj.get("content", "")

            if not content:
                raise ProviderError("Groq API returned an empty message content string.")

            return content.strip()

        except httpx.TimeoutException:
            logger.warning("Groq API request timed out after %s seconds.", self.timeout)
            raise ProviderTimeoutError(
                f"Groq API request timed out after {self.timeout}s."
            )
        except (ProviderError, ProviderConfigError, ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError):
            raise
        except Exception as e:
            logger.exception("Unexpected error communicating with Groq API: %s", str(e))
            raise ProviderError(f"Unexpected error communicating with Groq: {str(e)}")

    async def check_availability(self) -> bool:
        """Check if Groq API key is present and configured."""
        return bool(self.api_key and self.api_key.strip())
