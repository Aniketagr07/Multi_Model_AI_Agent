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
    model_id: str = Field(default="auto", description="Target model identifier or 'auto' for intelligent routing")
    conversation_id: Optional[str] = Field(default=None, description="Client conversation identifier")
    messages: Optional[List[ChatMessage]] = Field(default=None, description="Prior conversational context")
    effort: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Inference effort level ('low', 'medium', 'high') modulating reasoning depth and sampling"
    )
    document_id: Optional[str] = Field(default=None, description="Optional attached document ID for AI document analysis")
    custom_api_key: Optional[str] = Field(default=None, description="Optional user-supplied API key")
    custom_provider: Optional[str] = Field(default=None, description="Optional provider identifier ('gemini', 'groq', 'openai_compatible')")
    custom_base_url: Optional[str] = Field(default=None, description="Optional custom base URL endpoint")
    custom_provider_model_id: Optional[str] = Field(default=None, description="Optional upstream provider model name")

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
    """Schema for POST /api/chat successful response with routing and document metadata."""
    conversation_id: Optional[str] = Field(default=None, description="Associated conversation identifier")
    model_id: str = Field(..., description="Model that produced the response")
    provider: Optional[str] = Field(default=None, description="Name of the backend provider adapter used")
    response: str = Field(..., description="Actual text response from the AI provider")
    latency_ms: int = Field(..., description="Provider round-trip latency in milliseconds")
    routed: bool = Field(default=False, description="Whether automatic intelligent model routing was used")
    routing_category: Optional[str] = Field(default=None, description="Classified task category if auto-routed")
    routing_explanation: Optional[str] = Field(default=None, description="Explainable rationale for model selection")
    fallback_used: bool = Field(default=False, description="Whether a fallback model was used after primary error")
    effort: Optional[str] = Field(default="medium", description="Effort level applied during inference")
    document_id: Optional[str] = Field(default=None, description="ID of document used as context if any")
    document_name: Optional[str] = Field(default=None, description="Filename of document used as context if any")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of response generation",
    )


class ModelItemResponse(BaseModel):
    """Schema for individual model in registry response."""
    id: str
    name: str
    provider: str
    description: str
    tag: str
    is_available: bool
    supported_categories: List[str]
    strengths: List[str]
    context_window: int
    cost_tier: str


class ModelRegistryResponse(BaseModel):
    """Schema for GET /api/models response listing all available models."""
    models: List[ModelItemResponse]
