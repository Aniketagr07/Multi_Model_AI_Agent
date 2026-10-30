import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
import httpx

from app.schemas.discovery import ModelDiscoveryRequest
from app.services.discovery_service import ModelDiscoveryService
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest
from app.core.model_registry import ModelRegistry
from app.main import app


def test_discovery_route_mounted():
    """Verify that POST /api/models/discover route is mounted in OpenAPI spec."""
    paths = list(app.openapi()["paths"].keys())
    assert "/api/models/discover" in paths
    assert "post" in app.openapi()["paths"]["/api/models/discover"]


def test_discover_gemini_models_mock():
    """Verify Gemini discovery contacts endpoint and transforms models."""
    service = ModelDiscoveryService()
    mock_payload = {
        "models": [
            {
                "name": "models/gemini-2.5-flash",
                "displayName": "Gemini 2.5 Flash",
                "description": "Next generation fast model",
                "inputTokenLimit": 1048576,
                "supportedGenerationMethods": ["generateContent"],
            },
            {
                "name": "models/embedding-001",
                "displayName": "Embedding 001",
                "supportedGenerationMethods": ["embedContent"],
            },
        ]
    }

    mock_resp = httpx.Response(200, json=mock_payload)

    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_resp)):
        res = asyncio.run(service.discover_models(
            ModelDiscoveryRequest(provider="gemini", api_key="fake-test-key")
        ))

        assert res.success is True
        assert res.count == 1  # Only generateContent model
        assert res.models[0].provider_model_id == "gemini-2.5-flash"
        assert res.models[0].provider == "gemini"
        assert "custom-gemini-gemini-2.5-flash" in ModelRegistry.DYNAMIC_MODELS


def test_discover_groq_models_mock():
    """Verify Groq discovery contacts endpoint and transforms models."""
    service = ModelDiscoveryService()
    mock_payload = {
        "data": [
            {
                "id": "llama-3.3-70b-versatile",
                "object": "model",
                "active": True,
                "context_window": 131072,
            },
            {
                "id": "deprecated-model",
                "active": False,
            },
        ]
    }

    mock_resp = httpx.Response(200, json=mock_payload)

    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_resp)):
        res = asyncio.run(service.discover_models(
            ModelDiscoveryRequest(provider="groq", api_key="gsk_fake")
        ))

        assert res.success is True
        assert res.count == 1
        assert res.models[0].provider_model_id == "llama-3.3-70b-versatile"


def test_chat_service_resolves_custom_byok():
    """Verify that chat service accepts custom_api_key and custom model without error."""
    service = ChatService()
    req = ChatRequest(
        message="Hello custom AI",
        model_id="custom-groq-llama-3.3-70b-versatile",
        custom_api_key="gsk_custom_user_key",
        custom_provider="groq",
    )

    with patch("app.providers.groq_provider.GroqProvider.generate_response", new=AsyncMock(return_value="Hello from custom key!")):
        resp = asyncio.run(service.process_chat(req))
        assert resp.response == "Hello from custom key!"
        assert resp.model_id == "custom-groq-llama-3.3-70b-versatile"
