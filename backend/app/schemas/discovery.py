from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class ModelDiscoveryRequest(BaseModel):
    """Schema for POST /api/models/discover."""
    provider: Literal["gemini", "groq", "openai_compatible"] = Field(
        ...,
        description="Target provider family ('gemini', 'groq', 'openai_compatible')"
    )
    api_key: str = Field(..., min_length=1, description="API key to authenticate and query models")
    base_url: Optional[str] = Field(
        default=None,
        description="Optional custom API endpoint (e.g. for OpenAI, Ollama, OpenRouter, DeepSeek)"
    )


class DiscoveredModelItem(BaseModel):
    """Metadata for an individual discovered model."""
    id: str = Field(..., description="Unique client identifier")
    name: str = Field(..., description="Display name of the model")
    provider: str = Field(..., description="Provider identifier ('gemini', 'groq', 'openai_compatible')")
    provider_model_id: str = Field(..., description="Exact model name required by upstream API")
    description: str = Field(..., description="Model description")
    tag: str = Field(..., description="Visual badge tag")
    context_window: int = Field(default=8192, description="Context length in tokens")
    supported_categories: List[str] = Field(default_factory=lambda: ["general", "coding", "writing", "reasoning"])
    strengths: List[str] = Field(default_factory=list)
    cost_tier: str = Field(default="User API Key", description="Pricing tier indicator")
    is_available: bool = True


class ModelDiscoveryResponse(BaseModel):
    """Schema for POST /api/models/discover response."""
    success: bool
    provider: str
    count: int
    models: List[DiscoveredModelItem]
    message: str
