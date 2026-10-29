import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException

from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage
from app.services.chat_service import ChatService
from app.providers.base import (
    ProviderError,
    ProviderConfigError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from app.api.routes.chat import get_model_registry
from app.main import app


def test_chat_and_models_routes_mounted():
    """Verify that /api/chat and /api/models routes are mounted in OpenAPI spec."""
    paths = list(app.openapi()["paths"].keys())
    assert "/api/chat" in paths
    assert "post" in app.openapi()["paths"]["/api/chat"]
    assert "/api/models" in paths
    assert "get" in app.openapi()["paths"]["/api/models"]


def test_models_registry_endpoint():
    """Verify GET /api/models returns registered models from both providers."""
    response = get_model_registry()
    model_ids = [m.id for m in response.models]
    assert "gemini-1.5-flash" in model_ids
    assert "llama-3.1-8b-instant" in model_ids

    providers = {m.provider for m in response.models}
    assert "gemini" in providers
    assert "groq" in providers


def test_empty_message_validation():
    """Verify that empty or whitespace-only messages are rejected by schema."""
    with pytest.raises(ValueError):
        ChatRequest(message="   ", model_id="gemini-1.5-flash")

    with pytest.raises(ValueError):
        ChatRequest(message="", model_id="llama-3.1-8b-instant")


def test_invalid_model_id_rejection():
    """Verify that invalid/unregistered model IDs are rejected with HTTP 400."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="unregistered-model-xyz")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.process_chat(request))

    assert exc_info.value.status_code == 400
    assert "not recognized in the server registry" in exc_info.value.detail


def test_gemini_missing_api_key_configuration():
    """Verify that missing GEMINI_API_KEY raises HTTP 503 without crashing."""
    service = ChatService()
    service._gemini_provider.api_key = None
    request = ChatRequest(message="Hello", model_id="gemini-1.5-flash")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.process_chat(request))

    assert exc_info.value.status_code == 503
    assert "Gemini API key is not configured" in exc_info.value.detail


def test_groq_missing_api_key_configuration():
    """Verify that missing GROQ_API_KEY raises HTTP 503 without crashing."""
    service = ChatService()
    service._groq_provider.api_key = None
    request = ChatRequest(message="Hello", model_id="llama-3.1-8b-instant")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.process_chat(request))

    assert exc_info.value.status_code == 503
    assert "Groq API key is not configured" in exc_info.value.detail


def test_gemini_provider_dispatch_and_mock_response():
    """Verify that selecting a Gemini model routes to Gemini provider and returns response."""
    service = ChatService()
    request = ChatRequest(
        message="Explain recursion in Python.",
        model_id="gemini-1.5-flash",
        conversation_id="conv-gemini-1",
    )
    mock_answer = "Recursion occurs when a function calls itself."

    with patch.object(
        service._gemini_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_answer),
    ) as mock_gemini:
        response: ChatResponse = asyncio.run(service.process_chat(request))

        mock_gemini.assert_called_once()
        assert response.model_id == "gemini-1.5-flash"
        assert response.provider == "gemini"
        assert response.response == mock_answer
        assert response.latency_ms >= 0


def test_groq_provider_dispatch_and_mock_response():
    """Verify that selecting a Groq model routes to Groq provider and returns response."""
    service = ChatService()
    request = ChatRequest(
        message="Explain binary search in C++.",
        model_id="llama-3.1-8b-instant",
        conversation_id="conv-groq-1",
    )
    mock_answer = "Binary search divides the search space in half."

    with patch.object(
        service._groq_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_answer),
    ) as mock_groq:
        response: ChatResponse = asyncio.run(service.process_chat(request))

        mock_groq.assert_called_once()
        assert response.model_id == "llama-3.1-8b-instant"
        assert response.provider == "groq"
        assert response.response == mock_answer
        assert response.latency_ms >= 0


def test_groq_auth_error_handling():
    """Verify that Groq auth failure returns HTTP 502."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="llama-3.1-8b-instant")

    with patch.object(
        service._groq_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderAuthError("Authentication failed with Groq Cloud API.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 502
        assert "Authentication failed with Groq" in exc_info.value.detail


def test_groq_rate_limit_error_handling():
    """Verify that Groq rate limit (429) returns HTTP 429."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="llama-3.1-8b-instant")

    with patch.object(
        service._groq_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderRateLimitError("Groq rate limit reached.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 429
        assert "rate limit" in exc_info.value.detail


def test_groq_timeout_error_handling():
    """Verify that Groq timeout returns HTTP 504."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="llama-3.1-8b-instant")

    with patch.object(
        service._groq_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderTimeoutError("Groq request timed out.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 504
        assert "timed out" in exc_info.value.detail
