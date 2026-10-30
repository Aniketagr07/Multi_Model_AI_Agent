import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
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
    Universal adapter for any OpenAI-compatible API endpoint with SSE streaming:
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

    def _build_payload(self, messages: List[Dict[str, str]], model_id: str, effort: str = "medium", stream: bool = False) -> Dict[str, Any]:
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
        if stream:
            payload["stream"] = True

        if any(keyword in model_id.lower() for keyword in ["o1", "o3", "r1", "reasoner"]):
            payload["reasoning_effort"] = effort_level
            payload.pop("temperature", None)

        return payload

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str,
        effort: str = "medium"
    ) -> str:
        if not self.api_key and "localhost" not in self.base_url and "127.0.0.1" not in self.base_url:
            raise ProviderConfigError("API key is required for this provider.")

        endpoint = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = self._build_payload(messages, model_id, effort, stream=False)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(endpoint, json=payload, headers=headers)

            if response.status_code == 400:
                try:
                    err_msg = response.json().get("error", {}).get("message", "Invalid request format.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"API error: {err_msg}", status_code=400)
            elif response.status_code in (401, 403):
                raise ProviderAuthError("Authentication failed with upstream API. Please check your API key.")
            elif response.status_code == 429:
                raise ProviderRateLimitError("Rate limit or quota exceeded with upstream API provider.")
            elif response.status_code >= 500:
                raise ProviderError(f"Upstream server error (HTTP {response.status_code}).", status_code=502)
            elif response.status_code != 200:
                raise ProviderError(f"Unexpected status (HTTP {response.status_code}).", status_code=502)

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise ProviderError("Provider returned no choices.")

            message_data = choices[0].get("message", {})
            content = message_data.get("content", "").strip()
            if not content:
                raise ProviderError("Provider returned empty text content.")

            return content

        except httpx.TimeoutException:
            raise ProviderTimeoutError(f"Request timed out after {self.timeout}s.")
        except httpx.RequestError as e:
            raise ProviderError(f"Network error: {str(e)}", status_code=502)

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str,
        effort: str = "medium"
    ) -> AsyncGenerator[str, None]:
        """Stream response chunks progressively using SSE."""
        if not self.api_key and "localhost" not in self.base_url and "127.0.0.1" not in self.base_url:
            raise ProviderConfigError("API key is required for this provider.")

        endpoint = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = self._build_payload(messages, model_id, effort, stream=True)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as stream_resp:
                    if stream_resp.status_code in (401, 403):
                        raise ProviderAuthError("Authentication failed with upstream API provider.")
                    elif stream_resp.status_code == 429:
                        raise ProviderRateLimitError("Rate limit exceeded with upstream API provider.")
                    elif stream_resp.status_code >= 500:
                        raise ProviderError("Upstream API server error.", status_code=502)
                    elif stream_resp.status_code != 200:
                        raise ProviderError(f"Unexpected status HTTP {stream_resp.status_code}", status_code=502)

                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: ") and line.strip() != "data: [DONE]":
                            try:
                                chunk = json.loads(line[6:].strip())
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                token = delta.get("content", "")
                                if token:
                                    yield token
                            except json.JSONDecodeError:
                                pass

        except httpx.TimeoutException:
            raise ProviderTimeoutError("Streaming request timed out.")
        except httpx.RequestError as e:
            raise ProviderError(f"Network error: {str(e)}", status_code=502)

    async def check_availability(self) -> bool:
        return bool(self.api_key or "localhost" in self.base_url or "127.0.0.1" in self.base_url)
