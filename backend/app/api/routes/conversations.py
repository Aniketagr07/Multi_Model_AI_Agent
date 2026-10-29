from fastapi import APIRouter, HTTPException, status
from typing import Optional

from app.db.repository import ConversationRepository
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationDetailResponse,
    ConversationListResponse,
    MessageResponse,
)

router = APIRouter()


@router.get(
    "",
    response_model=ConversationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Conversations",
    description="Retrieve all persistent user conversations ordered by last-updated timestamp.",
)
async def list_conversations(limit: int = 50) -> ConversationListResponse:
    """Return all conversations ordered by last update descending."""
    convs = await ConversationRepository.a_list_conversations(limit=limit)
    items = [
        ConversationResponse(
            id=c["id"],
            title=c["title"],
            created_at=c["created_at"],
            updated_at=c["updated_at"],
            message_count=c.get("message_count", 0),
        )
        for c in convs
    ]
    return ConversationListResponse(conversations=items)


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Conversation",
    description="Initialize a new conversation session in SQLite.",
)
async def create_conversation(payload: Optional[ConversationCreate] = None) -> ConversationResponse:
    """Create a new conversation session."""
    title = payload.title if payload and payload.title else "New Conversation"
    created = await ConversationRepository.a_create_conversation(title=title)
    return ConversationResponse(
        id=created["id"],
        title=created["title"],
        created_at=created["created_at"],
        updated_at=created["updated_at"],
        message_count=0,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversation Details",
    description="Retrieve conversation metadata and all associated message history in chronological order.",
)
async def get_conversation(conversation_id: str) -> ConversationDetailResponse:
    """Fetch conversation by ID and its complete message list."""
    conv = await ConversationRepository.a_get_conversation(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

    messages_raw = await ConversationRepository.a_get_messages(conversation_id)
    messages = [
        MessageResponse(
            id=m["id"],
            conversation_id=m["conversation_id"],
            role=m["role"],
            content=m["content"],
            model_id=m.get("model_id"),
            provider=m.get("provider"),
            latency_ms=m.get("latency_ms"),
            routed=m.get("routed", False),
            routing_category=m.get("routing_category"),
            routing_explanation=m.get("routing_explanation"),
            created_at=m["created_at"],
        )
        for m in messages_raw
    ]

    return ConversationDetailResponse(
        id=conv["id"],
        title=conv["title"],
        created_at=conv["created_at"],
        updated_at=conv["updated_at"],
        messages=messages,
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Rename Conversation",
    description="Update the title of an existing conversation.",
)
async def rename_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
) -> ConversationResponse:
    """Rename an existing conversation."""
    updated = await ConversationRepository.a_update_conversation_title(
        conv_id=conversation_id,
        title=payload.title,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

    return ConversationResponse(
        id=updated["id"],
        title=updated["title"],
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
        message_count=updated.get("message_count", 0),
    )


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Conversation",
    description="Permanently delete a conversation and its message history from SQLite.",
)
async def delete_conversation(conversation_id: str) -> None:
    """Delete conversation and all its cascaded messages."""
    deleted = await ConversationRepository.a_delete_conversation(conversation_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

