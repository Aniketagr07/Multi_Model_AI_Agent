import time
import logging
from typing import Dict, List, Optional
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.model_registry import ModelRegistry, ModelInfo
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
from app.providers.groq_provider import GroqProvider

logger = logging.getLogger(__name__)


class ChatService:
    """Orchestrates model validation, multi-provider dispatch, and latency measurement."""

    def __init__(self):
        settings = get_settings()
        # Initialize providers
        self._gemini_provider = GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            base_url=settings.GEMINI_BASE_URL,
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
        )
        self._groq_provider = GroqProvider(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
            timeout=settings.REQUEST_TIMEOUT_SECONDS,
        )

        # Provider mapping dictionary
        self._providers: Dict[str, BaseLLMProvider] = {
            "gemini": self._gemini_provider,
            "groq": self._groq_provider,
        }

    def resolve_model_and_provider(self, model_id: str) -> tuple[ModelInfo, BaseLLMProvider]:
        """
        Validate model identifier against the server registry and return
        its registered ModelInfo along with its corresponding provider adapter.
        """
        model_info = ModelRegistry.get_model(model_id)
        if not model_info:
            valid_models = [m.id for m in ModelRegistry.list_models()]
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model_id}' is not recognized in the server registry. Registered models: {valid_models}",
            )

        provider = self._providers.get(model_info.provider)
        if not provider:
            raise HTTPException(
                status_code=500,
                detail=f"Internal configuration error: Provider '{model_info.provider}' is not mapped to an adapter.",
            )

        return model_info, provider

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
        """Process incoming chat request, route to the correct provider, and measure latency."""
        model_info, provider = self.resolve_model_and_provider(request.model_id)
        messages_payload = self._prepare_history(request.message, request.messages)

        # Measure real round-trip latency with monotonic clock
        start_time = time.perf_counter()

        try:
            response_text = await provider.generate_response(
                messages=messages_payload,
                model_id=model_info.provider_model_id,
            )
        except ProviderConfigError as e:
            logger.error("[%s] Configuration error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderAuthError as e:
            logger.error("[%s] Authentication error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderRateLimitError as e:
            logger.warning("[%s] Rate limit error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderTimeoutError as e:
            logger.warning("[%s] Timeout error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ProviderError as e:
            logger.error("[%s] Provider error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except Exception as e:
            logger.exception("[%s] Unexpected error processing request: %s", model_info.provider, str(e))
            raise HTTPException(
                status_code=500,
                detail=f"An internal error occurred while processing the request with {model_info.name}.",
            )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ChatResponse(
            conversation_id=request.conversation_id,
            model_id=model_info.id,
            provider=model_info.provider,
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
