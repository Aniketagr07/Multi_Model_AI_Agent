from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


class ChatMessagePayload(BaseModel):
    """Schema for individual message in the multi-turn context history."""
    role: str = Field(..., description="Message role: 'user', 'assistant', or 'system'")
    content: str = Field(..., min_length=1, description="Message text content")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        role = v.strip().lower()
        if role not in ("user", "assistant", "system"):
            raise ValueError("Role must be 'user', 'assistant', or 'system'.")
        return role


# Alias for backwards compatibility
ChatMessage = ChatMessagePayload


class ChatRequest(BaseModel):
    """Schema for incoming POST /api/chat and POST /api/chat/stream requests."""
    message: str = Field(..., min_length=1, description="User prompt text to be processed by the LLM")
    model_id: str = Field(default="auto", description="Target model ID or 'auto' for intelligent routing")
    conversation_id: Optional[str] = Field(default=None, description="Persistent conversation session ID")
    effort: Optional[str] = Field(default="medium", description="Reasoning effort tier: low, medium, high")
    document_id: Optional[str] = Field(default=None, description="Attached document ID for context grounding")
    skill_id: Optional[str] = Field(default=None, description="Optional attached skill/tool ID to execute")
    custom_instructions: Optional[str] = Field(default=None, description="User-defined system instructions")
    custom_api_key: Optional[str] = Field(default=None, description="User-supplied API key")
    custom_provider: Optional[str] = Field(default=None, description="Custom provider identifier")
    custom_base_url: Optional[str] = Field(default=None, description="Custom OpenAI-compatible base URL")
    custom_provider_model_id: Optional[str] = Field(default=None, description="Raw provider model identifier")
    messages: Optional[List[ChatMessagePayload]] = Field(
        default=None,
        description="Optional full chat history sent from the frontend",
    )

    @field_validator("message")
    @classmethod
    def validate_message_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message content cannot be solely whitespace.")
        return trimmed

    @field_validator("model_id")
    @classmethod
    def validate_model_id(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed:
            raise ValueError("Model ID must be specified.")
        return trimmed

    @field_validator("effort")
    @classmethod
    def validate_effort(cls, v: Optional[str]) -> str:
        if v is None:
            return "medium"
        trimmed = v.strip().lower()
        if trimmed not in ("low", "medium", "high"):
            raise ValueError("Effort tier must be one of: 'low', 'medium', 'high'.")
        return trimmed


class ChatResponse(BaseModel):
    """Schema for POST /api/chat successful response with routing and document metadata."""
    conversation_id: Optional[str] = Field(default=None, description="Associated conversation identifier")
    model_id: str = Field(..., description="Model that produced the response")
    model_name: Optional[str] = Field(default=None, description="Human-readable model name that produced the response")
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
    prompt_tokens: Optional[int] = Field(default=None, description="Input prompt tokens consumed")
    completion_tokens: Optional[int] = Field(default=None, description="Completion tokens generated")
    total_tokens: Optional[int] = Field(default=None, description="Total tokens consumed")
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
    streaming_supported: bool = True


class ModelRegistryResponse(BaseModel):
    """Schema for GET /api/models response listing all available models."""
    models: List[ModelItemResponse]
