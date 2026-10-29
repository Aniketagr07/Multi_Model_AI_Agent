from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    """Schema for individual message in conversation history."""
    role: Literal["user", "assistant"] = Field(..., description="Role of the message sender")
    content: str = Field(..., max_length=4000, description="Text content of the message")

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message content cannot be empty or whitespace.")
        return trimmed


class ChatRequest(BaseModel):
    """Schema for POST /api/chat incoming request."""
    message: str = Field(..., min_length=1, max_length=4000, description="The user's query prompt")
    model_id: str = Field(default="gemini-1.5-flash", description="Target model identifier")
    conversation_id: Optional[str] = Field(default=None, description="Client conversation identifier")
    messages: Optional[List[ChatMessage]] = Field(default=None, description="Prior conversational context")

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty or solely whitespace.")
        return trimmed

    @field_validator("model_id")
    @classmethod
    def validate_model_id(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed:
            raise ValueError("Model ID must be specified.")
        return trimmed


class ChatResponse(BaseModel):
    """Schema for POST /api/chat successful response."""
    conversation_id: Optional[str] = Field(default=None, description="Associated conversation identifier")
    model_id: str = Field(..., description="Model that produced the response")
    response: str = Field(..., description="Actual text response from the AI provider")
    latency_ms: int = Field(..., description="Provider round-trip latency in milliseconds")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of response generation",
    )

