from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class CompareRequest(BaseModel):
    """Schema for POST /api/compare incoming request."""
    prompt: str = Field(..., min_length=1, max_length=4000, description="The prompt to broadcast to both models")
    model_a_id: str = Field(..., description="First model identifier to evaluate")
    model_b_id: str = Field(..., description="Second model identifier to evaluate")
    effort: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Inference effort level ('low', 'medium', 'high') applied to both models"
    )
    custom_api_key_a: Optional[str] = Field(default=None, description="Custom API key for Model A")
    custom_provider_a: Optional[str] = Field(default=None, description="Custom provider family for Model A")
    custom_base_url_a: Optional[str] = Field(default=None, description="Custom base URL for Model A")
    custom_provider_model_id_a: Optional[str] = Field(default=None, description="Custom upstream model ID for Model A")
    custom_api_key_b: Optional[str] = Field(default=None, description="Custom API key for Model B")
    custom_provider_b: Optional[str] = Field(default=None, description="Custom provider family for Model B")
    custom_base_url_b: Optional[str] = Field(default=None, description="Custom base URL for Model B")
    custom_provider_model_id_b: Optional[str] = Field(default=None, description="Custom upstream model ID for Model B")

    @field_validator("prompt")
    @classmethod
    def validate_prompt_not_empty(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Prompt cannot be empty or whitespace.")
        return trimmed

    @field_validator("model_a_id", "model_b_id")
    @classmethod
    def validate_model_ids(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not trimmed:
            raise ValueError("Model ID must be specified.")
        return trimmed

    @model_validator(mode="after")
    def validate_distinct_models(self) -> "CompareRequest":
        if self.model_a_id == self.model_b_id:
            raise ValueError("Please select two distinct models to compare.")
        return self


class ModelComparisonResult(BaseModel):
    """Schema for an individual model's result within a comparison."""
    model_id: str = Field(..., description="Internal model identifier")
    name: str = Field(..., description="Display name of the model")
    provider: str = Field(..., description="Provider identifier ('gemini' or 'groq')")
    success: bool = Field(..., description="Whether the model request completed successfully")
    response: Optional[str] = Field(default=None, description="Actual AI output text if successful")
    latency_ms: int = Field(..., description="Model round-trip execution latency in milliseconds")
    effort: Optional[str] = Field(default="medium", description="Effort level applied during execution")
    tokens: Optional[int] = Field(default=None, description="Generated output tokens")
    tokens_per_second: Optional[float] = Field(default=None, description="Inference speed in tokens per second")
    error: Optional[str] = Field(default=None, description="Error message if request failed")


class CompareResponse(BaseModel):
    """Schema for POST /api/compare response containing concurrent outputs."""
    prompt: str = Field(..., description="The original prompt evaluated")
    effort: Optional[str] = Field(default="medium", description="Inference effort level applied across models")
    model_a: ModelComparisonResult = Field(..., description="Results for Model A")
    model_b: ModelComparisonResult = Field(..., description="Results for Model B")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of comparison completion",
    )

