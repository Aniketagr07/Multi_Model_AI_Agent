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


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Universal adapter for any OpenAI-compatible API endpoint:
    OpenAI, OpenRouter, DeepSeek, Together AI, Mistral, Ollama (local), vLLM, etc.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 45.0,
    ):
        self.api_key = api_key or ""
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
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

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str,
        effort: str = "medium"
    ) -> str:
        if not self.api_key and "localhost" not in self.base_url and "127.0.0.1" not in self.base_url:
            raise ProviderConfigError("API key is required for this provider.")

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        effort_level = (effort or "medium").lower()
        if effort_level == "low":
            temperature = 0.2
            max_tokens = 1024
        elif effort_level == "high":
            temperature = 0.9
            max_tokens = 8192
        else:
            temperature = 0.7
            max_tokens = 4096

        payload: Dict[str, Any] = {
            "model": model_id,
            "messages": self._format_messages(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # If model supports reasoning effort (e.g. OpenAI o-series / DeepSeek R1)
        if any(keyword in model_id.lower() for keyword in ["o1", "o3", "r1", "reasoner"]):
            payload["reasoning_effort"] = effort_level
            # Some reasoning models don't support custom temperature
            payload.pop("temperature", None)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                    headers=headers,
                )

            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "Invalid request format.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"API error: {err_msg}", status_code=400)

            elif response.status_code in (401, 403):
                raise ProviderAuthError(
                    f"Authentication failed with {self.base_url}. Please verify your API key."
                )

            elif response.status_code == 429:
                raise ProviderRateLimitError(
                    f"Rate limit or quota exceeded on {self.base_url}. Please wait and retry."
                )

            elif response.status_code >= 500:
                raise ProviderError(
                    f"Remote server {self.base_url} returned an internal error (HTTP {response.status_code}).",
                    status_code=502,
                )

            elif response.status_code != 200:
                raise ProviderError(
                    f"Unexpected status from API (HTTP {response.status_code}).",
                    status_code=502,
                )

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise ProviderError("API returned response with no choices.")

            msg_obj = choices[0].get("message", {})
            content = msg_obj.get("content", "")

            # If response is inside reasoning content (e.g. DeepSeek R1 / openrouter)
            if not content and "reasoning_content" in msg_obj:
                content = msg_obj.get("reasoning_content", "")

            if not content or not str(content).strip():
                raise ProviderError("Model returned empty text output.")

            return str(content).strip()

        except httpx.TimeoutException:
            logger.warning("Request to %s timed out after %.1f seconds", endpoint, self.timeout)
            raise ProviderTimeoutError(f"Request to {self.base_url} timed out after {self.timeout} seconds.")
        except httpx.RequestError as req_err:
            logger.error("HTTP network error communicating with %s: %s", self.base_url, str(req_err))
            raise ProviderError(
                f"Network connection failure communicating with {self.base_url}: {str(req_err)}",
                status_code=502,
            )

    async def check_availability(self) -> bool:
        return bool(self.api_key) or "localhost" in self.base_url
