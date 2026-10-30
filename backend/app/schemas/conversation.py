from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ConversationCreate(BaseModel):
    """Schema for creating a new conversation."""
    title: Optional[str] = Field(default="New Conversation", max_length=100, description="Initial conversation title")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> str:
        if v is None:
            return "New Conversation"
        trimmed = v.strip()
        return trimmed if trimmed else "New Conversation"


class ConversationUpdate(BaseModel):
    """Schema for updating an existing conversation's title."""
    title: str = Field(..., min_length=1, max_length=100, description="Updated conversation title")

    @field_validator("title")
    @classmethod
    def validate_title_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Conversation title cannot be empty or solely whitespace.")
        return trimmed


class MessageResponse(BaseModel):
    """Schema for an individual message in a conversation."""
    id: str
    conversation_id: str
    role: str
    content: str
    model_id: Optional[str] = None
    provider: Optional[str] = None
    latency_ms: Optional[int] = None
    routed: bool = False
    routing_category: Optional[str] = None
    routing_explanation: Optional[str] = None
    effort: Optional[str] = "medium"
    created_at: str


class ConversationPinRequest(BaseModel):
    """Schema for pinning/unpinning a conversation."""
    is_pinned: bool = Field(..., description="Whether the conversation is pinned to the top")


class ConversationArchiveRequest(BaseModel):
    """Schema for archiving/restoring a conversation."""
    is_archived: bool = Field(..., description="Whether the conversation is archived")


class ConversationResponse(BaseModel):
    """Summary schema for a conversation item in the sidebar list."""
    id: str
    title: str
    is_pinned: bool = False
    is_archived: bool = False
    pinned_at: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int = 0


class ConversationDetailResponse(BaseModel):
    """Detailed schema for a conversation including all message history."""
    id: str
    title: str
    is_pinned: bool = False
    is_archived: bool = False
    pinned_at: Optional[str] = None
    created_at: str
    updated_at: str
    messages: List[MessageResponse] = Field(default_factory=list)


class ConversationListResponse(BaseModel):
    """Schema for listing user conversations."""
    conversations: List[ConversationResponse]

