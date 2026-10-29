from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class CompareRequest(BaseModel):
    """Schema for POST /api/compare incoming request."""
    prompt: str = Field(..., min_length=1, max_length=4000, description="The prompt to broadcast to both models")
    model_a_id: str = Field(..., description="First model identifier to evaluate")
    model_b_id: str = Field(..., description="Second model identifier to evaluate")

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
    error: Optional[str] = Field(default=None, description="Error message if request failed")


class CompareResponse(BaseModel):
    """Schema for POST /api/compare response containing concurrent outputs."""
    prompt: str = Field(..., description="The original prompt evaluated")
    model_a: ModelComparisonResult = Field(..., description="Results for Model A")
    model_b: ModelComparisonResult = Field(..., description="Results for Model B")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of comparison completion",
    )

