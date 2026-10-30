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


class GroqProvider(BaseLLMProvider):
    """Adapter for Groq Cloud API via OpenAI-compatible REST interface with streaming support."""

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
        """Format standardized messages into OpenAI-compatible chat format."""
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

    def _get_generation_params(self, effort: str) -> Dict[str, Any]:
        """Map effort tier to temperature and max_tokens."""
        effort_level = (effort or "medium").lower()
        if effort_level == "low":
            return {"temperature": 0.2, "max_tokens": 1024}
        elif effort_level == "high":
            return {"temperature": 0.9, "max_tokens": 8192}
        else:
            return {"temperature": 0.7, "max_tokens": 4096}

    async def generate_response(self, messages: List[Dict[str, str]], model_id: str = "llama-3.1-8b-instant", effort: str = "medium") -> str:
        """Send formatted prompt to Groq API and extract response text."""
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Groq API key is not configured. Please set GROQ_API_KEY in backend/.env"
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        params = self._get_generation_params(effort)
        payload = {
            "model": model_id,
            "messages": self._format_messages(messages),
            **params,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(endpoint, json=payload, headers=headers)

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

            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "Invalid request to Groq API.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"Groq API error: {err_msg}", status_code=400)
            elif response.status_code == 401:
                raise ProviderAuthError("Authentication failed with Groq Cloud. Please check your GROQ_API_KEY.")
            elif response.status_code == 429:
                raise ProviderRateLimitError("Groq Cloud free-tier rate limit exceeded. Please wait a moment and retry.")
            elif response.status_code >= 500:
                raise ProviderError("Groq Cloud encountered an internal server error. Please try again later.", status_code=502)
            elif response.status_code != 200:
                raise ProviderError(f"Unexpected status from Groq API (HTTP {response.status_code}).", status_code=502)

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                raise ProviderError("Groq returned an empty completion response with no choices.")

            message_data = choices[0].get("message", {})
            content = message_data.get("content", "").strip()
            if not content:
                raise ProviderError("Groq returned empty text content.")

            return content

        except httpx.TimeoutException:
            logger.warning("Groq API request timed out after %.1f seconds", self.timeout)
            raise ProviderTimeoutError(f"Groq API request timed out after {self.timeout} seconds.")
        except httpx.RequestError as req_err:
            logger.error("HTTP network error communicating with Groq API: %s", str(req_err))
            raise ProviderError("Network connection failure communicating with Groq API.", status_code=502)

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "llama-3.1-8b-instant",
        effort: str = "medium",
    ) -> AsyncGenerator[str, None]:
        """Stream text tokens from Groq API progressively using Server-Sent Events."""
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Groq API key is not configured. Please set GROQ_API_KEY in backend/.env"
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        params = self._get_generation_params(effort)
        payload = {
            "model": model_id,
            "messages": self._format_messages(messages),
            "stream": True,
            **params,
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as stream_resp:
                    if stream_resp.status_code == 404:
                        fallback_candidates = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
                        for fb_model in fallback_candidates:
                            if fb_model != model_id:
                                payload["model"] = fb_model
                                async with client.stream("POST", endpoint, json=payload, headers=headers) as fb_stream:
                                    if fb_stream.status_code == 200:
                                        async for line in fb_stream.aiter_lines():
                                            if line.startswith("data: ") and line.strip() != "data: [DONE]":
                                                try:
                                                    chunk = json.loads(line[6:].strip())
                                                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                                                    token = delta.get("content", "")
                                                    if token:
                                                        yield token
                                                except json.JSONDecodeError:
                                                    pass
                                        return

                    if stream_resp.status_code == 400:
                        raise ProviderError("Groq API rejected request format.", status_code=400)
                    elif stream_resp.status_code == 401:
                        raise ProviderAuthError("Authentication failed with Groq Cloud.")
                    elif stream_resp.status_code == 429:
                        raise ProviderRateLimitError("Groq Cloud rate limit or quota exceeded.")
                    elif stream_resp.status_code >= 500:
                        raise ProviderError("Groq Cloud server error.", status_code=502)
                    elif stream_resp.status_code != 200:
                        raise ProviderError(f"Unexpected status from Groq API (HTTP {stream_resp.status_code}).", status_code=502)

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
            logger.warning("Groq streaming request timed out.")
            raise ProviderTimeoutError("Groq Cloud streaming request timed out.")
        except httpx.RequestError as req_err:
            logger.error("HTTP network error during Groq stream: %s", str(req_err))
            raise ProviderError("Network connection failure communicating with Groq API.", status_code=502)

    async def check_availability(self) -> bool:
        """Check if GROQ_API_KEY is configured and service is reachable."""
        return bool(self.api_key and self.api_key.strip())
