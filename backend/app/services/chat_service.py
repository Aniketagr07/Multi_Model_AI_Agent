import time
import logging
from typing import Dict, List, Optional
from fastapi import HTTPException

from app.core.config import get_settings
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage
from app.providers.base import (
    BaseLLMProvider,
    ProviderError,
    ProviderConfigError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from app.providers.gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)


class ChatService:
    """Orchestrates model validation, provider dispatch, and latency measurement."""

    def __init__(self):
        settings = get_settings()
        # Initialize providers registry
        self._gemini_provider = GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            base_url=settings.GEMINI_BASE_URL,
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
        )

    def get_provider(self, model_id: str) -> BaseLLMProvider:
        """Route model identifier to its responsible provider adapter."""
        settings = get_settings()
        allowed = settings.allowed_models_list

        if model_id not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model_id}' is not in the allowed models list: {allowed}",
            )

        # For Day 3, Gemini handles gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp
        if model_id.startswith("gemini"):
            return self._gemini_provider

        raise HTTPException(
            status_code=400,
            detail=f"No provider adapter registered for model '{model_id}'.",
        )

    def _prepare_history(
        self,
        current_message: str,
        history: Optional[List[ChatMessage]] = None,
    ) -> List[Dict[str, str]]:
        """Consolidate history and latest message up to the maximum context limit."""
        settings = get_settings()
        max_history = settings.MAX_HISTORY_MESSAGES

        formatted_messages: List[Dict[str, str]] = []

        if history:
            # Enforce max history window
            windowed = history[-max_history:]
            for msg in windowed:
                formatted_messages.append({
                    "role": msg.role,
                    "content": msg.content,
                })

        # Append current user prompt if not already the last item
        if not formatted_messages or formatted_messages[-1]["content"] != current_message:
            formatted_messages.append({
                "role": "user",
                "content": current_message,
            })

        return formatted_messages

    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """Process incoming chat request, invoke provider, and measure latency."""
        provider = self.get_provider(request.model_id)
        messages_payload = self._prepare_history(request.message, request.messages)

        # Measure real round-trip latency with monotonic timer
        start_time = time.perf_counter()

        try:
            response_text = await provider.generate_response(
                messages=messages_payload,
                model_id=request.model_id,
            )
        except ProviderConfigError as e:
            logger.error("Configuration error: %s", e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderAuthError as e:
            logger.error("Provider authentication error: %s", e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderRateLimitError as e:
            logger.warning("Provider rate limit reached: %s", e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderTimeoutError as e:
            logger.warning("Provider timeout: %s", e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderError as e:
            logger.error("Provider execution error: %s", e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except Exception as e:
            logger.exception("Unexpected error processing chat request: %s", str(e))
            raise HTTPException(
                status_code=500,
                detail="An internal server error occurred while processing the chat request.",
            )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ChatResponse(
            conversation_id=request.conversation_id,
            model_id=request.model_id,
            response=response_text,
            latency_ms=elapsed_ms,
        )


_chat_service: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    """Return singleton instance of ChatService."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service

