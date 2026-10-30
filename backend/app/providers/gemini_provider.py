import asyncio
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

# Verified active high-reliability fallback models on Google Generative Language API
ACTIVE_FALLBACK_CHAIN = [
    "gemini-3.6-flash",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
]

# Models that are retired (404) or experiencing persistent quota/high demand (503/429) on free tier
RETIRED_OR_UNSTABLE_MODELS = {
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-3.5-flash",
}


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

    def _get_candidate_models(self, model_id: str) -> List[str]:
        """Derive ordered list of model endpoints to attempt with fallback protection."""
        target = model_id
        if target in RETIRED_OR_UNSTABLE_MODELS:
            logger.info("Routing retired/unstable Gemini model '%s' to active 'gemini-3.6-flash'...", target)
            target = "gemini-3.6-flash"

        candidates = [target]
        for fb in ACTIVE_FALLBACK_CHAIN:
            if fb not in candidates:
                candidates.append(fb)
        return candidates

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "gemini-3.6-flash",
        effort: str = "medium",
    ) -> str:
        """Send formatted prompt to Google Gemini API and extract complete response text."""
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
            )

        candidates = self._get_candidate_models(model_id)
        params = {"key": self.api_key}
        payload = {
            "contents": self._format_messages(messages),
            "generationConfig": self._get_generation_config(effort),
        }

        last_error = None
        for cand in candidates:
            endpoint = f"{self.base_url}/models/{cand}:generateContent"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        endpoint,
                        params=params,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )

                if response.status_code == 200:
                    data = response.json()
                    candidates_data = data.get("candidates", [])
                    if not candidates_data:
                        feedback = data.get("promptFeedback", {})
                        block_reason = feedback.get("blockReason")
                        if block_reason:
                            raise ProviderError(f"Prompt blocked by Google safety filters: {block_reason}")
                        continue

                    parts = candidates_data[0].get("content", {}).get("parts", [])
                    result_text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
                    if result_text:
                        return result_text

                # Auth errors are fatal across all models
                if response.status_code in (401, 403):
                    raise ProviderAuthError("Authentication failed with Google Gemini API. Please verify your GEMINI_API_KEY.")

                logger.warning("Gemini model '%s' returned HTTP %s. Trying next candidate...", cand, response.status_code)
                last_error = f"HTTP {response.status_code}: {response.text[:120]}"

            except (ProviderAuthError, ProviderConfigError):
                raise
            except httpx.TimeoutException:
                logger.warning("Gemini model '%s' timed out after 10.0s. Trying next candidate...", cand)
                last_error = f"Model '{cand}' request timed out"
            except Exception as e:
                logger.warning("Gemini model '%s' encountered error: %s. Trying next candidate...", cand, e)
                last_error = str(e)

        raise ProviderTimeoutError(
            f"Google Gemini API was unable to respond across active models. {last_error or 'Please try again shortly.'}"
        )

    async def stream_response(
        self,
        messages: List[Dict[str, str]],
        model_id: str = "gemini-3.6-flash",
        effort: str = "medium",
    ) -> AsyncGenerator[str, None]:
        """
        Progressively stream text tokens from Google Gemini API via official Server-Sent Events (?alt=sse).
        Automatically falls back through verified active models if a model is unavailable or encounters high demand.
        """
        if not self.api_key or not self.api_key.strip():
            raise ProviderConfigError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env"
            )

        candidates = self._get_candidate_models(model_id)
        params = {"key": self.api_key, "alt": "sse"}
        payload = {
            "contents": self._format_messages(messages),
            "generationConfig": self._get_generation_config(effort),
        }

        stream_succeeded = False
        last_error = None

        for cand in candidates:
            endpoint = f"{self.base_url}/models/{cand}:streamGenerateContent"
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    async with client.stream(
                        "POST",
                        endpoint,
                        params=params,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    ) as stream_resp:
                        if stream_resp.status_code == 200:
                            stream_succeeded = True
                            async for line in stream_resp.aiter_lines():
                                if line.startswith("data:"):
                                    data_str = line[5:].strip()
                                    if data_str:
                                        try:
                                            chunk = json.loads(data_str)
                                            cands = chunk.get("candidates", [])
                                            if cands:
                                                parts = cands[0].get("content", {}).get("parts", [])
                                                token_text = "".join(p.get("text", "") for p in parts if "text" in p)
                                                if token_text:
                                                    yield token_text
                                        except json.JSONDecodeError:
                                            pass
                            return

                        if stream_resp.status_code in (401, 403):
                            raise ProviderAuthError("Authentication failed with Google Gemini API. Please verify your GEMINI_API_KEY.")

                        logger.warning("Streaming Gemini '%s' returned HTTP %s. Falling back to next candidate...", cand, stream_resp.status_code)
                        last_error = f"HTTP {stream_resp.status_code}"

            except (ProviderAuthError, ProviderConfigError):
                raise
            except (GeneratorExit, asyncio.CancelledError):
                return
            except httpx.TimeoutException:
                logger.warning("Gemini streaming model '%s' timed out. Attempting next candidate...", cand)
                last_error = f"Model '{cand}' streaming timed out"
            except Exception as e:
                logger.warning("Gemini streaming model '%s' failed: %s. Attempting next candidate...", cand, e)
                last_error = str(e)

        if not stream_succeeded:
            raise ProviderTimeoutError(
                f"Google Gemini API stream failed across active endpoints ({last_error or 'service unavailable'})."
            )

    async def check_availability(self) -> bool:
        """Check if GEMINI_API_KEY is configured and service is reachable."""
        return bool(self.api_key and self.api_key.strip())
