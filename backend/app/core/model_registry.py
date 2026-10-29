from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.core.config import get_settings


class ModelInfo(BaseModel):
    """Server-side registered model metadata."""
    id: str = Field(..., description="Stable internal model identifier")
    name: str = Field(..., description="Human-readable display name")
    provider: str = Field(..., description="Provider identifier ('gemini' or 'groq')")
    provider_model_id: str = Field(..., description="Actual model string sent to upstream API")
    description: str = Field(..., description="Short summary of model capabilities")
    tag: str = Field(..., description="UI badge tag (e.g. 'Google AI Studio', 'Groq Cloud')")
    is_available: bool = Field(..., description="Whether required server API credentials are present")


# Master Server-Side Registry Definition
REGISTERED_MODELS: Dict[str, Dict[str, str]] = {
    "gemini-1.5-flash": {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "provider": "gemini",
        "provider_model_id": "gemini-1.5-flash",
        "description": "High-speed multimodal intelligence with 15 RPM / 1M TPM free quota",
        "tag": "Google AI Studio",
    },
    "gemini-1.5-pro": {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "gemini",
        "provider_model_id": "gemini-1.5-pro",
        "description": "Complex reasoning and analytical synthesis with 1M token context",
        "tag": "Google AI Studio",
    },
    "llama-3.1-8b-instant": {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B",
        "provider": "groq",
        "provider_model_id": "llama-3.1-8b-instant",
        "description": "Ultra-fast low-latency inference powered by Groq LPU engine",
        "tag": "Groq Cloud",
    },
    "llama-3.3-70b-versatile": {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "provider": "groq",
        "provider_model_id": "llama-3.3-70b-versatile",
        "description": "State-of-the-art open-weights reasoning model running on Groq LPUs",
        "tag": "Groq Cloud",
    },
    "mixtral-8x7b-32768": {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B",
        "provider": "groq",
        "provider_model_id": "mixtral-8x7b-32768",
        "description": "Mixture-of-Experts architecture with 32k context window on Groq",
        "tag": "Groq Cloud",
    },
}


class ModelRegistry:
    """Server-side registry for validating and querying available models."""

    @staticmethod
    def get_model(model_id: str) -> Optional[ModelInfo]:
        """Fetch model metadata by ID, evaluating live credentials availability."""
        raw = REGISTERED_MODELS.get(model_id)
        if not raw:
            return None

        settings = get_settings()
        if raw["provider"] == "gemini":
            is_available = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
        elif raw["provider"] == "groq":
            is_available = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
        else:
            is_available = False

        return ModelInfo(
            id=raw["id"],
            name=raw["name"],
            provider=raw["provider"],
            provider_model_id=raw["provider_model_id"],
            description=raw["description"],
            tag=raw["tag"],
            is_available=is_available,
        )

    @staticmethod
    def list_models() -> List[ModelInfo]:
        """Return all registered models with their current availability status."""
        models: List[ModelInfo] = []
        for model_id in REGISTERED_MODELS:
            info = ModelRegistry.get_model(model_id)
            if info:
                models.append(info)
        return models

    @staticmethod
    def is_valid_model(model_id: str) -> bool:
        """Check if model ID is recognized in the server registry."""
        return model_id in REGISTERED_MODELS
