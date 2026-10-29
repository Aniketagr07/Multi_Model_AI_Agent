from fastapi import APIRouter, Depends, status
from app.core.model_registry import ModelRegistry
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ModelItemResponse,
    ModelRegistryResponse,
)
from app.services.chat_service import ChatService, get_chat_service

router = APIRouter()


@router.get(
    "/models",
    response_model=ModelRegistryResponse,
    status_code=status.HTTP_200_OK,
    summary="List Registered Models",
    description="Returns the server-side model registry with provider details and credential availability.",
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
        )
        for m in models_list
    ]
    return ModelRegistryResponse(models=items)


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Chat Completion",
    description="Submits a message prompt and optional conversation history to the specified AI model provider.",
)
async def chat_completion(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Process incoming chat request and generate AI model completion."""
    return await chat_service.process_chat(request)
