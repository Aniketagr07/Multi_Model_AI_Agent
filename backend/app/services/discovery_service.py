import logging
from typing import List, Optional
import httpx
from fastapi import HTTPException

from app.schemas.discovery import (
    ModelDiscoveryRequest,
    ModelDiscoveryResponse,
    DiscoveredModelItem,
)
from app.core.model_registry import ModelRegistry

logger = logging.getLogger(__name__)


class ModelDiscoveryService:
    """
    Service responsible for dynamically contacting upstream AI provider endpoints,
    validating user-supplied API credentials, discovering all live models,
    and registering them into the server's runtime registry.
    """

    async def discover_models(self, request: ModelDiscoveryRequest) -> ModelDiscoveryResponse:
        provider = request.provider.lower().strip()
        api_key = request.api_key.strip()
        base_url = (request.base_url or "").strip() or None

        if provider == "gemini":
            discovered = await self._discover_gemini(api_key, base_url)
        elif provider == "groq":
            discovered = await self._discover_groq(api_key, base_url)
        elif provider == "openai_compatible":
            discovered = await self._discover_openai_compatible(api_key, base_url)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider family '{provider}'.")

        # Register discovered models in the runtime dynamic registry
        for model in discovered:
            ModelRegistry.register_dynamic_model({
                "id": model.id,
                "name": model.name,
                "provider": model.provider,
                "provider_model_id": model.provider_model_id,
                "description": model.description,
                "tag": model.tag,
                "is_available": True,
                "supported_categories": model.supported_categories,
                "strengths": model.strengths,
                "context_window": model.context_window,
                "cost_tier": model.cost_tier,
                "custom_base_url": base_url,
            })

        return ModelDiscoveryResponse(
            success=True,
            provider=provider,
            count=len(discovered),
            models=discovered,
            message=f"Successfully fetched {len(discovered)} live models from {provider.upper()} API.",
        )

    async def _discover_gemini(self, api_key: str, base_url: Optional[str]) -> List[DiscoveredModelItem]:
        url_base = (base_url or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        endpoint = f"{url_base}/models?key={api_key}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(endpoint)

            if res.status_code in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail="Authentication failed with Google Gemini API. Please check your API key.",
                )
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"Gemini API returned HTTP {res.status_code}: {res.text[:200]}",
                )

            data = res.json()
            models_raw = data.get("models", [])
            discovered: List[DiscoveredModelItem] = []

            for m in models_raw:
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    raw_name = m.get("name", "")
                    clean_id = raw_name.replace("models/", "")
                    display_name = m.get("displayName") or clean_id
                    desc = m.get("description", "Google Gemini multimodal model")
                    ctx = m.get("inputTokenLimit", 1048576)

                    # Tag priority
                    tag = "Google AI Studio (BYOK)"
                    if "flash" in clean_id.lower():
                        tag = "Gemini Flash (BYOK)"
                    elif "pro" in clean_id.lower():
                        tag = "Gemini Pro (BYOK)"

                    discovered.append(DiscoveredModelItem(
                        id=f"custom-gemini-{clean_id}",
                        name=f"{display_name} (Custom)",
                        provider="gemini",
                        provider_model_id=clean_id,
                        description=desc,
                        tag=tag,
                        context_window=ctx,
                        supported_categories=["general", "writing", "reasoning", "coding"],
                        strengths=["Multimodal intelligence", "Live user key quota", "High token capacity"],
                        cost_tier="User API Key",
                        is_available=True,
                    ))

            return discovered

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Google Gemini models endpoint timed out.")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Network error querying Gemini models: {str(e)}")

    async def _discover_groq(self, api_key: str, base_url: Optional[str]) -> List[DiscoveredModelItem]:
        url_base = (base_url or "https://api.groq.com/openai/v1").rstrip("/")
        endpoint = f"{url_base}/models"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {api_key}"},
                )

            if res.status_code in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail="Authentication failed with Groq Cloud API. Please verify your GROQ_API_KEY.",
                )
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"Groq API returned HTTP {res.status_code}: {res.text[:200]}",
                )

            data = res.json()
            models_raw = data.get("data", [])
            discovered: List[DiscoveredModelItem] = []

            for m in models_raw:
                raw_id = m.get("id", "")
                if not raw_id:
                    continue
                # If active flag present, verify active
                if m.get("active") is False:
                    continue

                ctx = m.get("context_window", 131072)
                clean_name = raw_id.replace("openai/", "").replace("qwen/", "").replace("meta-llama/", "")

                discovered.append(DiscoveredModelItem(
                    id=f"custom-groq-{raw_id.replace('/', '-')}",
                    name=f"{clean_name} (Groq Custom)",
                    provider="groq",
                    provider_model_id=raw_id,
                    description=f"Groq LPU ultra-fast inference for {raw_id}",
                    tag="Groq Cloud (BYOK)",
                    context_window=ctx,
                    supported_categories=["coding", "general", "reasoning"],
                    strengths=["Sub-second LPU throughput", "Live user key quota", "Open-weights reasoning"],
                    cost_tier="User API Key",
                    is_available=True,
                ))

            return discovered

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Groq Cloud models endpoint timed out.")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Network error querying Groq models: {str(e)}")

    async def _discover_openai_compatible(self, api_key: str, base_url: Optional[str]) -> List[DiscoveredModelItem]:
        url_base = (base_url or "https://api.openai.com/v1").rstrip("/")
        endpoint = f"{url_base}/models"

        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(endpoint, headers=headers)

            if res.status_code in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail=f"Authentication failed with {url_base}. Please verify your API key.",
                )
            if res.status_code != 200:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"API returned HTTP {res.status_code}: {res.text[:200]}",
                )

            data = res.json()
            models_raw = data.get("data", [])
            discovered: List[DiscoveredModelItem] = []

            for m in models_raw:
                raw_id = m.get("id", "")
                if not raw_id:
                    continue

                discovered.append(DiscoveredModelItem(
                    id=f"custom-openai-{raw_id.replace('/', '-')}",
                    name=f"{raw_id} (Custom)",
                    provider="openai_compatible",
                    provider_model_id=raw_id,
                    description=f"OpenAI-compatible inference via {url_base}",
                    tag="OpenAI / BYOK",
                    context_window=128000,
                    supported_categories=["general", "coding", "writing", "reasoning"],
                    strengths=["Compatible REST protocol", "Live user key quota"],
                    cost_tier="User API Key",
                    is_available=True,
                ))

            return discovered

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail=f"Endpoint {endpoint} timed out.")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Network error querying {endpoint}: {str(e)}")


_discovery_service: Optional[ModelDiscoveryService] = None


def get_discovery_service() -> ModelDiscoveryService:
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = ModelDiscoveryService()
    return _discovery_service
