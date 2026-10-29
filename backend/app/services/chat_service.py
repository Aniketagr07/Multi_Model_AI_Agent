import time
import logging
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.model_registry import ModelRegistry, ModelInfo
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage
from app.services.model_router import ModelRouter, get_model_router, RoutingDecision
from app.db.repository import ConversationRepository
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
    """Orchestrates model validation, automatic routing, fallback policy, SQLite persistence, and latency measurement."""

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

        self._router: ModelRouter = get_model_router()

    def resolve_model_and_provider(self, model_id: str) -> Tuple[ModelInfo, BaseLLMProvider]:
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

    async def _resolve_conversation(self, conv_id: Optional[str], initial_prompt: str) -> str:
        """
        Ensure conversation exists in SQLite. If missing or None, creates it.
        """
        title = initial_prompt.strip()[:35] + ("..." if len(initial_prompt.strip()) > 35 else "")
        if not title:
            title = "New Conversation"

        if conv_id:
            existing = await ConversationRepository.a_get_conversation(conv_id)
            if existing:
                return conv_id
            # If specified ID does not exist, initialize it with that ID
            created = await ConversationRepository.a_create_conversation(conv_id=conv_id, title=title)
            return created["id"]

        created = await ConversationRepository.a_create_conversation(title=title)
        return created["id"]

    async def _prepare_history(
        self,
        conv_id: str,
        current_message: str,
        history: Optional[List[ChatMessage]] = None,
    ) -> List[Dict[str, str]]:
        """
        Consolidate conversational history and latest message up to the maximum context limit.
        Loads from SQLite if history is not provided by the client.
        """
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
        else:
            # Load chronological recent history from SQLite database
            db_history = await ConversationRepository.a_get_recent_context(conv_id, limit=max_history)
            formatted_messages.extend(db_history)

        # Append current user prompt if not already the last item
        if not formatted_messages or formatted_messages[-1]["content"] != current_message:
            formatted_messages.append({
                "role": "user",
                "content": current_message,
            })

        return formatted_messages

    async def _execute_provider(
        self,
        provider: BaseLLMProvider,
        messages_payload: List[Dict[str, str]],
        provider_model_id: str,
        effort: str = "medium",
    ) -> str:
        """Call provider adapter with exception normalization."""
        return await provider.generate_response(
            messages=messages_payload,
            model_id=provider_model_id,
            effort=effort,
        )

    def _find_fallback_model(
        self,
        primary_model_id: str,
        available_models: List[ModelInfo],
    ) -> Optional[ModelInfo]:
        """
        Locate an eligible secondary model when auto-routed primary encounters a transient error.
        Prioritizes a different provider to bypass provider-level outages or rate limits.
        """
        primary_info = ModelRegistry.get_model(primary_model_id)
        primary_provider = primary_info.provider if primary_info else None

        # Prefer an alternate provider first
        for model in available_models:
            if model.id != primary_model_id and model.provider != primary_provider:
                return model

        # Otherwise pick any other available model
        for model in available_models:
            if model.id != primary_model_id:
                return model

        return None

    async def process_chat(self, request: ChatRequest) -> ChatResponse:
        """
        Process chat request, performing automatic model routing when model_id == 'auto',
        persisting messages into SQLite, executing with monotonic latency timing,
        and applying a conservative fallback policy.
        """
        is_auto_mode = request.model_id.lower() == "auto"
        routing_decision: Optional[RoutingDecision] = None

        # 1. Resolve or create persistent conversation in SQLite
        conv_id = await self._resolve_conversation(request.conversation_id, request.message)

        # 2. Save user message to persistent storage immediately
        await ConversationRepository.a_add_message(
            conv_id=conv_id,
            role="user",
            content=request.message,
        )

        # 3. Prepare sliding-window context history
        messages_payload = await self._prepare_history(conv_id, request.message, request.messages)

        # 4. Resolve Model & Provider
        if is_auto_mode:
            available_models = ModelRegistry.get_available_models()
            if not available_models:
                raise HTTPException(
                    status_code=503,
                    detail="No configured AI models are available. Please configure GEMINI_API_KEY or GROQ_API_KEY.",
                )
            routing_decision = self._router.route_request(request.message, available_models)
            model_info = routing_decision.chosen_model
            provider = self._providers.get(model_info.provider)
            if not provider:
                raise HTTPException(status_code=500, detail=f"Provider adapter '{model_info.provider}' missing.")
        else:
            model_info, provider = self.resolve_model_and_provider(request.model_id)

        start_time = time.perf_counter()
        fallback_used = False
        final_explanation = routing_decision.explanation if routing_decision else None
        final_model_info = model_info

        # 5. Execute Provider with Fallback Handling
        effort = getattr(request, "effort", "medium") or "medium"
        try:
            response_text = await self._execute_provider(
                provider=provider,
                messages_payload=messages_payload,
                provider_model_id=model_info.provider_model_id,
                effort=effort,
            )
        except (ProviderConfigError, ProviderAuthError) as e:
            # Conservative Policy: Do not retry configuration or authentication failures
            logger.error("[%s] Config/Auth error: %s", model_info.provider, e.message)
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except (ProviderRateLimitError, ProviderTimeoutError, ProviderError, Exception) as primary_err:
            # Conservative Fallback: Only permitted for Auto Mode on transient/quota errors
            err_msg = primary_err.message if isinstance(primary_err, ProviderError) else str(primary_err)
            logger.warning(
                "Primary model '%s' failed (%s). Evaluating fallback policy...",
                model_info.id,
                err_msg,
            )

            if not is_auto_mode:
                # Manual mode: return exact failure without unexpected model substitution
                if isinstance(primary_err, ProviderError):
                    raise HTTPException(status_code=primary_err.status_code, detail=primary_err.message)
                raise HTTPException(
                    status_code=500,
                    detail=f"An internal error occurred with {model_info.name}: {err_msg}",
                )

            # Auto Mode Fallback Attempt
            available_models = ModelRegistry.get_available_models()
            fallback_model = self._find_fallback_model(model_info.id, available_models)

            if not fallback_model:
                logger.error("No alternate model available for fallback.")
                if isinstance(primary_err, ProviderError):
                    raise HTTPException(status_code=primary_err.status_code, detail=primary_err.message)
                raise HTTPException(status_code=500, detail=f"Request failed and no fallback available: {err_msg}")

            fallback_provider = self._providers.get(fallback_model.provider)
            if not fallback_provider:
                raise HTTPException(status_code=500, detail="Fallback provider adapter missing.")

            logger.info("Executing conservative fallback via '%s'...", fallback_model.id)
            try:
                response_text = await self._execute_provider(
                    provider=fallback_provider,
                    messages_payload=messages_payload,
                    provider_model_id=fallback_model.provider_model_id,
                    effort=effort,
                )
                fallback_used = True
                final_model_info = fallback_model
                final_explanation = (
                    f"{routing_decision.explanation} "
                    f"[Fallback Activated: Primary model '{model_info.name}' encountered a temporary error ({err_msg}). "
                    f"Successfully generated answer via fallback model '{fallback_model.name}']."
                )
            except Exception as fallback_err:
                logger.error("Fallback model '%s' also failed: %s", fallback_model.id, str(fallback_err))
                raise HTTPException(
                    status_code=502,
                    detail=f"Primary model '{model_info.name}' failed ({err_msg}) and fallback model '{fallback_model.name}' also failed.",
                )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # 6. Save assistant message into SQLite persistent storage
        await ConversationRepository.a_add_message(
            conv_id=conv_id,
            role="assistant",
            content=response_text,
            model_id=final_model_info.id,
            provider=final_model_info.provider,
            latency_ms=elapsed_ms,
            routed=is_auto_mode,
            routing_category=routing_decision.category if routing_decision else None,
            routing_explanation=final_explanation,
            effort=effort,
        )

        return ChatResponse(
            conversation_id=conv_id,
            model_id=final_model_info.id,
            provider=final_model_info.provider,
            response=response_text,
            latency_ms=elapsed_ms,
            routed=is_auto_mode,
            routing_category=routing_decision.category if routing_decision else None,
            routing_explanation=final_explanation,
            fallback_used=fallback_used,
            effort=effort,
        )


_chat_service: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    """Return singleton instance of ChatService."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
