from typing import Optional
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from app.api.routes.auth import get_current_user_optional
from app.core.model_registry import ModelRegistry
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ModelItemResponse,
    ModelRegistryResponse,
)
from app.schemas.discovery import (
    ModelDiscoveryRequest,
    ModelDiscoveryResponse,
)
from app.services.chat_service import ChatService, get_chat_service
from app.services.discovery_service import ModelDiscoveryService, get_discovery_service

router = APIRouter()


@router.get(
    "/models",
    response_model=ModelRegistryResponse,
    status_code=status.HTTP_200_OK,
    summary="List Registered Models",
    description="Returns the server-side model registry with provider details, verified capabilities, and credential availability.",
)
def get_model_registry() -> ModelRegistryResponse:
    """Return all registered models from the server-side model registry."""
    models_list = ModelRegistry.list_models()
    items = [
        ModelItemResponse(
            id=m.id,
            name=m.name,
            provider=m.provider,
            description=m.description,
            tag=m.tag,
            is_available=m.is_available,
            supported_categories=m.supported_categories,
            strengths=m.strengths,
            context_window=m.context_window,
            cost_tier=m.cost_tier,
            streaming_supported=getattr(m, "streaming_supported", True),
        )
        for m in models_list
    ]
    return ModelRegistryResponse(models=items)


@router.post(
    "/models/discover",
    response_model=ModelDiscoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Discover Models via User API Key",
    description="Connects to upstream provider (Gemini, Groq, OpenAI-compatible) using user's API key, queries live models, and registers them dynamically.",
)
async def discover_models(
    request: ModelDiscoveryRequest,
    discovery_service: ModelDiscoveryService = Depends(get_discovery_service),
) -> ModelDiscoveryResponse:
    """Dynamically query and register live models from user-supplied API key."""
    return await discovery_service.discover_models(request)


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Chat Completion",
    description="Submits a message prompt to a specified AI model or routes automatically when model_id='auto'.",
)
async def chat_completion(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
    user: Optional[dict] = Depends(get_current_user_optional),
) -> ChatResponse:
    """Process incoming chat request and generate AI model completion."""
    return await chat_service.process_chat(request, user=user)


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="Generate Progressive Streaming Chat Completion via SSE",
    description="Streams real-time response tokens using Server-Sent Events (SSE). Emits meta, token, done, and error events.",
)
async def chat_stream(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
    user: Optional[dict] = Depends(get_current_user_optional),
) -> StreamingResponse:
    """Stream AI model completion tokens progressively via Server-Sent Events."""
    return StreamingResponse(
        chat_service.stream_chat(request, user=user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
