from fastapi import APIRouter, HTTPException, status, Query, Response, Depends
from typing import Optional
from app.api.routes.auth import get_current_user_optional

from app.db.repository import ConversationRepository
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationPinRequest,
    ConversationArchiveRequest,
    ConversationResponse,
    ConversationDetailResponse,
    ConversationListResponse,
    MessageResponse,
)
from app.services.export_service import (
    sanitize_filename,
    export_to_markdown,
    export_to_text,
    export_to_json,
)

router = APIRouter()


@router.get(
    "",
    response_model=ConversationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Conversations",
    description="Retrieve conversations ordered by pinned status and last activity. Supports search across titles and messages.",
)
async def list_conversations(
    limit: int = Query(default=100, ge=1, le=500),
    q: Optional[str] = Query(default=None, description="Search query across conversation titles and message contents"),
    include_archived: bool = Query(default=True, description="Whether to include archived conversations in the list"),
    archived_only: bool = Query(default=False, description="Filter strictly for archived conversations"),
    user: Optional[dict] = Depends(get_current_user_optional),
) -> ConversationListResponse:
    """Return conversations ordered by pinned state (top) and last update descending."""
    user_id = user["id"] if user else None
    convs = await ConversationRepository.a_list_conversations(
        limit=limit,
        include_archived=include_archived,
        archived_only=archived_only,
        search_query=q,
        user_id=user_id,
    )
    items = [
        ConversationResponse(
            id=c["id"],
            title=c["title"],
            is_pinned=c.get("is_pinned", False),
            is_archived=c.get("is_archived", False),
            pinned_at=c.get("pinned_at"),
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
async def create_conversation(
    payload: Optional[ConversationCreate] = None,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> ConversationResponse:
    """Create a new conversation session."""
    title = payload.title if payload and payload.title else "New Conversation"
    user_id = user["id"] if user else None
    created = await ConversationRepository.a_create_conversation(title=title, user_id=user_id)
    return ConversationResponse(
        id=created["id"],
        title=created["title"],
        is_pinned=False,
        is_archived=False,
        pinned_at=None,
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
            effort=m.get("effort", "medium"),
            created_at=m["created_at"],
        )
        for m in messages_raw
    ]

    return ConversationDetailResponse(
        id=conv["id"],
        title=conv["title"],
        is_pinned=conv.get("is_pinned", False),
        is_archived=conv.get("is_archived", False),
        pinned_at=conv.get("pinned_at"),
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
        is_pinned=updated.get("is_pinned", False),
        is_archived=updated.get("is_archived", False),
        pinned_at=updated.get("pinned_at"),
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
        message_count=updated.get("message_count", 0),
    )


@router.patch(
    "/{conversation_id}/pin",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Pin or Unpin Conversation",
    description="Pin conversation to the top of the sidebar or unpin it.",
)
async def pin_conversation(
    conversation_id: str,
    payload: ConversationPinRequest,
) -> ConversationResponse:
    """Toggle pin status of a conversation."""
    updated = await ConversationRepository.a_pin_conversation(
        conv_id=conversation_id,
        is_pinned=payload.is_pinned,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

    return ConversationResponse(
        id=updated["id"],
        title=updated["title"],
        is_pinned=updated.get("is_pinned", False),
        is_archived=updated.get("is_archived", False),
        pinned_at=updated.get("pinned_at"),
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
        message_count=updated.get("message_count", 0),
    )


@router.patch(
    "/{conversation_id}/archive",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Archive or Restore Conversation",
    description="Move conversation to archive or restore it back to active list.",
)
async def archive_conversation(
    conversation_id: str,
    payload: ConversationArchiveRequest,
) -> ConversationResponse:
    """Toggle archive status of a conversation."""
    updated = await ConversationRepository.a_archive_conversation(
        conv_id=conversation_id,
        is_archived=payload.is_archived,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

    return ConversationResponse(
        id=updated["id"],
        title=updated["title"],
        is_pinned=updated.get("is_pinned", False),
        is_archived=updated.get("is_archived", False),
        pinned_at=updated.get("pinned_at"),
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
        message_count=updated.get("message_count", 0),
    )


@router.get(
    "/{conversation_id}/export",
    status_code=status.HTTP_200_OK,
    summary="Export Conversation",
    description="Export full conversation transcript as Markdown (.md), Plain Text (.txt), or JSON (.json).",
)
async def export_conversation(
    conversation_id: str,
    format: str = Query(default="markdown", pattern="^(markdown|text|json)$"),
) -> Response:
    """Download conversation formatted as markdown, plain text, or sanitized JSON."""
    conv = await ConversationRepository.a_get_conversation(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

    messages = await ConversationRepository.a_get_messages(conversation_id)
    safe_title = sanitize_filename(conv.get("title", "conversation"))

    if format == "json":
        content = export_to_json(conv, messages)
        media_type = "application/json; charset=utf-8"
        filename = f"{safe_title}.json"
    elif format == "text":
        content = export_to_text(conv, messages)
        media_type = "text/plain; charset=utf-8"
        filename = f"{safe_title}.txt"
    else:
        # Default: markdown
        content = export_to_markdown(conv, messages)
        media_type = "text/markdown; charset=utf-8"
        filename = f"{safe_title}.md"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": media_type,
    }
    return Response(content=content, media_type=media_type, headers=headers)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Conversation",
    description="Permanently delete a conversation and its message history from SQLite.",
)
async def delete_conversation(
    conversation_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> None:
    """Delete conversation and all its cascaded messages."""
    user_id = user["id"] if user else None
    deleted = await ConversationRepository.a_delete_conversation(conversation_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' was not found in persistent storage.",
        )

