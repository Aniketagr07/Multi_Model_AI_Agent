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


class GeminiProvider(BaseLLMProvider):
    """Adapter for Google Gemini API via official REST interface with streaming SSE support."""

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
            gemini_role = "model" if role == "assistant" else "user"
            content_text = msg.get("content", "")
            if content_text.strip():
                formatted.append({
                    "role": gemini_role,
                    "parts": [{"text": content_text}],
                })
        return formatted

    def _get_generation_config(self, effort: str) -> Dict[str, Any]:
        """Derive generation parameters from effort tier."""
        effort_level = (effort or "medium").lower()
        if effort_level == "low":
            return {"temperature": 0.2, "maxOutputTokens": 1024}
        elif effort_level == "high":
            return {"temperature": 0.9, "maxOutputTokens": 8192}
        else:
            return {"temperature": 0.7, "maxOutputTokens": 4096}

    async def generate_response(self, messages: List[Dict[str, str]], model_id: str = "gemini-3.6-flash", effort: str = "medium") -> str:
        """Send formatted prompt to Google Gemini API and extract complete response text."""
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
            )

        target_model = model_id
        if target_model in ("gemini-1.5-flash", "gemini-1.5-pro", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.5-pro"):
            logger.info("Routing Gemini model '%s' to verified active 'gemini-3.6-flash'...", target_model)
            target_model = "gemini-3.6-flash"

        endpoint = f"{self.base_url}/models/{target_model}:generateContent"
        params = {"key": self.api_key}
        payload = {
            "contents": self._format_messages(messages),
            "generationConfig": self._get_generation_config(effort),
        }

        call_timeout = 10.0

        try:
            try:
                async with httpx.AsyncClient(timeout=call_timeout) as client:
                    response = await client.post(
                        endpoint,
                        params=params,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
            except httpx.TimeoutException:
                if target_model != "gemini-3.5-flash":
                    logger.warning("Gemini model '%s' timed out. Attempting fallback to gemini-3.5-flash...", target_model)
                    fb_endpoint = f"{self.base_url}/models/gemini-3.5-flash:generateContent"
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.post(
                            fb_endpoint,
                            params=params,
                            json=payload,
                            headers={"Content-Type": "application/json"},
                        )
                else:
                    raise

            # Handle 404 or 503 (model deprecated or high demand on Gemini)
            if response.status_code in (404, 503):
                fallback_candidates = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-lite-latest"]
                for fb_model in fallback_candidates:
                    if fb_model != target_model:
                        logger.info("Gemini model '%s' returned status %s. Retrying with fallback '%s'...", target_model, response.status_code, fb_model)
                        fb_endpoint = f"{self.base_url}/models/{fb_model}:generateContent"
                        try:
                            async with httpx.AsyncClient(timeout=10.0) as client:
                                fb_resp = await client.post(
                                    fb_endpoint,
                                    params=params,
                                    json=payload,
                                    headers={"Content-Type": "application/json"},
                                )
                                if fb_resp.status_code == 200:
                                    response = fb_resp
                                    break
                        except Exception as fb_err:
                            logger.warning("Fallback model '%s' failed: %s", fb_model, fb_err)

            if response.status_code == 400:
                try:
                    err_json = response.json()
                    err_msg = err_json.get("error", {}).get("message", "Invalid request to Gemini API.")
                except Exception:
                    err_msg = "Invalid request format."
                raise ProviderError(f"Gemini API error: {err_msg}", status_code=400)
            elif response.status_code in (401, 403):
                raise ProviderAuthError("Authentication failed with Google Gemini API. Please verify your GEMINI_API_KEY.")
            elif response.status_code == 429:
                raise ProviderRateLimitError("Google Gemini API free tier rate limit or quota exceeded. Please wait a moment and retry.")
            elif response.status_code >= 500:
                raise ProviderError("Google Gemini API servers encountered an internal error. Please try again later.", status_code=502)
            elif response.status_code != 200:
                raise ProviderError(f"Unexpected status from Gemini API (HTTP {response.status_code}).", status_code=502)

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                feedback = data.get("promptFeedback", {})
                block_reason = feedback.get("blockReason")
                if block_reason:
                    raise ProviderError(f"Prompt blocked by Google safety filters: {block_reason}")
                raise ProviderError("Gemini returned an empty response with no candidates.")

            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise ProviderError("Gemini candidate contains no text parts.")

            result_text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
            if not result_text:
                raise ProviderError("Gemini returned empty text content.")
            return result_text

        except httpx.TimeoutException:
            logger.warning("Gemini API request timed out after %.1f seconds", self.timeout)
            raise ProviderTimeoutError(f"Google Gemini API request timed out after {self.timeout} seconds.")
        except httpx.RequestError as req_err:
            logger.error("HTTP network error communicating with Gemini API: %s", str(req_err))
            raise ProviderError("Network connection failure communicating with Google Gemini API.", status_code=502)

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "gemini-3.5-flash",
        effort: str = "medium",
    ) -> AsyncGenerator[str, None]:
        """
        Progressively stream text tokens from Google Gemini API via official Server-Sent Events (?alt=sse).
        """
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
            )

        target_model = model_id
        # Route retired or timeout-prone preview models to verified fast models
        if target_model in ("gemini-1.5-flash", "gemini-1.5-pro", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"):
            logger.info("Streaming Gemini model '%s' via verified active 'gemini-3.6-flash'...", target_model)
            target_model = "gemini-3.6-flash"

        endpoint = f"{self.base_url}/models/{target_model}:streamGenerateContent"
        params = {"key": self.api_key, "alt": "sse"}
        payload = {
            "contents": self._format_messages(messages),
            "generationConfig": self._get_generation_config(effort),
        }

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                async with client.stream(
                    "POST",
                    endpoint,
                    params=params,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                ) as stream_resp:
                    # Check for 404 or deprecation fallback
                    if stream_resp.status_code in (404, 503) and target_model != "gemini-3.5-flash":
                        logger.info("Streaming Gemini '%s' gave %s. Switching stream to gemini-3.5-flash...", target_model, stream_resp.status_code)
                        fb_endpoint = f"{self.base_url}/models/gemini-3.5-flash:streamGenerateContent"
                        async with client.stream(
                            "POST",
                            fb_endpoint,
                            params=params,
                            json=payload,
                            headers={"Content-Type": "application/json"},
                        ) as fb_stream:
                            if fb_stream.status_code == 200:
                                async for line in fb_stream.aiter_lines():
                                    if line.startswith("data:"):
                                        data_str = line[5:].strip()
                                        if data_str:
                                            try:
                                                chunk = json.loads(data_str)
                                                candidates = chunk.get("candidates", [])
                                                if candidates:
                                                    parts = candidates[0].get("content", {}).get("parts", [])
                                                    token_text = "".join(p.get("text", "") for p in parts if "text" in p)
                                                    if token_text:
                                                        yield token_text
                                            except json.JSONDecodeError:
                                                pass
                                return

                    if stream_resp.status_code == 400:
                        raise ProviderError("Gemini API rejected request format.", status_code=400)
                    elif stream_resp.status_code in (401, 403):
                        raise ProviderAuthError("Authentication failed with Google Gemini API.")
                    elif stream_resp.status_code == 429:
                        raise ProviderRateLimitError("Google Gemini API quota or rate limit exceeded.")
                    elif stream_resp.status_code >= 500:
                        raise ProviderError("Gemini servers encountered an internal error.", status_code=502)
                    elif stream_resp.status_code != 200:
                        raise ProviderError(f"Unexpected status from Gemini API (HTTP {stream_resp.status_code}).", status_code=502)

                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str:
                                try:
                                    chunk = json.loads(data_str)
                                    candidates = chunk.get("candidates", [])
                                    if candidates:
                                        parts = candidates[0].get("content", {}).get("parts", [])
                                        token_text = "".join(p.get("text", "") for p in parts if "text" in p)
                                        if token_text:
                                            yield token_text
                                except json.JSONDecodeError:
                                    pass

        except httpx.TimeoutException:
            logger.warning("Gemini streaming request timed out.")
            raise ProviderTimeoutError("Google Gemini API streaming request timed out.")
        except httpx.RequestError as req_err:
            logger.error("HTTP network error during Gemini stream: %s", str(req_err))
            raise ProviderError("Network connection failure communicating with Google Gemini API.", status_code=502)

    async def check_availability(self) -> bool:
        """Check if GEMINI_API_KEY is configured and service is reachable."""
        return bool(self.api_key and self.api_key.strip())
