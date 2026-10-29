from fastapi import APIRouter, Depends, status
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService, get_chat_service

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Chat Completion",
    description="Submits a message prompt and optional conversation history to the configured AI model provider.",
)
async def chat_completion(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Process incoming chat request and generate AI model completion."""
    return await chat_service.process_chat(request)

