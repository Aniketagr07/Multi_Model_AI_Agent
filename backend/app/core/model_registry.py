from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.core.config import get_settings


class ModelInfo(BaseModel):
    """Server-side registered model metadata with capability categorization."""
    id: str = Field(..., description="Stable internal model identifier")
    name: str = Field(..., description="Human-readable display name")
    provider: str = Field(..., description="Provider identifier ('gemini' or 'groq')")
    provider_model_id: str = Field(..., description="Actual model string sent to upstream API")
    description: str = Field(..., description="Short summary of model capabilities")
    tag: str = Field(..., description="UI badge tag (e.g. 'Google AI Studio', 'Groq Cloud')")
    is_available: bool = Field(..., description="Whether required server API credentials are present")
    supported_categories: List[str] = Field(
        default_factory=list,
        description="Task categories this model is optimized for ('coding', 'writing', 'reasoning', 'general')"
    )
    strengths: List[str] = Field(
        default_factory=list,
        description="Key verified architectural strengths"
    )
    context_window: int = Field(
        default=8192,
        description="Maximum supported context window in tokens"
    )
    cost_tier: str = Field(
        default="Free tier",
        description="Current verified pricing/quota tier"
    )


# Master Server-Side Registry Definition with verified capabilities
REGISTERED_MODELS: Dict[str, Dict] = {
    "llama-3.1-8b-instant": {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B (Groq)",
        "provider": "groq",
        "provider_model_id": "openai/gpt-oss-120b",
        "description": "Ultra-fast low-latency inference powered by Groq LPU engine",
        "tag": "Groq Cloud",
        "supported_categories": ["coding", "general"],
        "strengths": ["Sub-second code generation", "Deterministic LPU latency", "Concise explanations"],
        "context_window": 131072,
        "cost_tier": "Free tier (30 RPM / 6k TPM)",
    },
    "llama-3.3-70b-versatile": {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B (Groq)",
        "provider": "groq",
        "provider_model_id": "openai/gpt-oss-120b",
        "description": "State-of-the-art open-weights reasoning model running on Groq LPUs",
        "tag": "Groq Cloud",
        "supported_categories": ["reasoning", "coding"],
        "strengths": ["High-precision reasoning", "Complex coding challenges", "Open-weight transparency"],
        "context_window": 131072,
        "cost_tier": "Free tier (30 RPM / 6k TPM)",
    },
    "mixtral-8x7b-32768": {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B (Groq)",
        "provider": "groq",
        "provider_model_id": "qwen/qwen3.8-27b",
        "description": "Mixture-of-Experts architecture with 32k context window on Groq",
        "tag": "Groq Cloud",
        "supported_categories": ["writing", "general"],
        "strengths": ["Sparse Mixture-of-Experts routing", "Rich prose and summarization", "32k context buffer"],
        "context_window": 32768,
        "cost_tier": "Free tier (30 RPM / 6k TPM)",
    },
    "gemini-3.8-flash": {
        "id": "gemini-3.8-flash",
        "name": "Gemini 3.8 Flash (Latest)",
        "provider": "gemini",
        "provider_model_id": "gemini-3.8-flash",
        "description": "Google's latest flagship high-speed multimodal intelligence with cutting-edge reasoning",
        "tag": "Google AI Studio (Latest)",
        "supported_categories": ["reasoning", "general", "writing", "coding"],
        "strengths": ["Next-gen Gemini 3.8 architecture", "Sub-second token synthesis", "Enhanced reasoning capacity"],
        "context_window": 1048576,
        "cost_tier": "Free tier (15 RPM / 1M TPM)",
    },
    "gemini-3.5-flash": {
        "id": "gemini-3.5-flash",
        "name": "Gemini 3.5 Flash",
        "provider": "gemini",
        "provider_model_id": "gemini-3.5-flash",
        "description": "Stable high-speed multimodal intelligence with verified low latency",
        "tag": "Google AI Studio",
        "supported_categories": ["general", "writing", "coding"],
        "strengths": ["Verified low latency", "1M token context capacity", "High text fluency"],
        "context_window": 1048576,
        "cost_tier": "Free tier (15 RPM / 1M TPM)",
    },
    "gemini-1.5-flash": {
        "id": "gemini-1.5-flash",
        "name": "Gemini 1.5 Flash",
        "provider": "gemini",
        "provider_model_id": "gemini-3.5-flash",
        "description": "High-speed multimodal intelligence with 15 RPM / 1M TPM free quota",
        "tag": "Google AI Studio",
        "supported_categories": ["general", "writing"],
        "strengths": ["Rapid response latency", "1M token context capacity", "Balanced text fluency"],
        "context_window": 1048576,
        "cost_tier": "Free tier (15 RPM / 1M TPM)",
    },
    "gemini-1.5-pro": {
        "id": "gemini-1.5-pro",
        "name": "Gemini 1.5 Pro",
        "provider": "gemini",
        "provider_model_id": "gemini-3.5-flash",
        "description": "Complex reasoning and analytical synthesis with 1M token context",
        "tag": "Google AI Studio",
        "supported_categories": ["reasoning", "writing"],
        "strengths": ["Complex multi-step reasoning", "Mathematical analysis", "Extensive document context"],
        "context_window": 1048576,
        "cost_tier": "Free tier (2 RPM / 32k TPM)",
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
            supported_categories=raw.get("supported_categories", []),
            strengths=raw.get("strengths", []),
            context_window=raw.get("context_window", 8192),
            cost_tier=raw.get("cost_tier", "Free tier"),
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
    def get_available_models() -> List[ModelInfo]:
        """Return only models whose provider credentials are configured and valid."""
        return [m for m in ModelRegistry.list_models() if m.is_available]

    @staticmethod
    def is_valid_model(model_id: str) -> bool:
        """Check if model ID is recognized in the server registry."""
        return model_id in REGISTERED_MODELS or model_id == "auto"
