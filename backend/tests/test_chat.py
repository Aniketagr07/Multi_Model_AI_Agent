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
from app.api.routes.chat import chat_completion
from app.main import app


def test_chat_route_mounted():
    """Verify that /api/chat route is mounted in OpenAPI specification."""
    paths = list(app.openapi()["paths"].keys())
    assert "/api/chat" in paths
    assert "post" in app.openapi()["paths"]["/api/chat"]


def test_empty_message_validation():
    """Verify that empty or whitespace-only messages are rejected by schema."""
    with pytest.raises(ValueError):
        ChatRequest(message="   ", model_id="gemini-1.5-flash")

    with pytest.raises(ValueError):
        ChatRequest(message="", model_id="gemini-1.5-flash")


def test_invalid_model_id_rejection():
    """Verify that invalid/unregistered model IDs are rejected with HTTP 400."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="unregistered-model-xyz")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.process_chat(request))

    assert exc_info.value.status_code == 400
    assert "not in the allowed models list" in exc_info.value.detail


def test_missing_api_key_configuration_handling():
    """Verify that missing GEMINI_API_KEY raises HTTP 503 without crashing."""
    service = ChatService()
    # Force api_key to None to simulate unconfigured state
    service._gemini_provider.api_key = None

    request = ChatRequest(message="Hello", model_id="gemini-1.5-flash")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.process_chat(request))

    assert exc_info.value.status_code == 503
    assert "Gemini API key is not configured" in exc_info.value.detail


def test_provider_auth_error_handling():
    """Verify that invalid API key / auth failure returns HTTP 502."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="gemini-1.5-flash")

    with patch.object(
        service._gemini_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderAuthError("Authentication failed with Google Gemini API.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 502
        assert "Authentication failed" in exc_info.value.detail


def test_provider_rate_limit_error_handling():
    """Verify that provider 429 rate limit translates to HTTP 429."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="gemini-1.5-flash")

    with patch.object(
        service._gemini_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderRateLimitError("Quota exceeded.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 429
        assert "Quota exceeded" in exc_info.value.detail


def test_provider_timeout_error_handling():
    """Verify that provider timeout translates to HTTP 504."""
    service = ChatService()
    request = ChatRequest(message="Hello", model_id="gemini-1.5-flash")

    with patch.object(
        service._gemini_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderTimeoutError("Request timed out.")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(service.process_chat(request))

        assert exc_info.value.status_code == 504
        assert "timed out" in exc_info.value.detail


def test_successful_mocked_chat_response():
    """Verify that a successful provider response produces structured ChatResponse with latency."""
    service = ChatService()
    request = ChatRequest(
        message="Explain recursion in one sentence.",
        model_id="gemini-1.5-flash",
        conversation_id="test-conv-123",
        messages=[
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="assistant", content="Hi! How can I help?"),
        ],
    )

    mock_answer = "Recursion is a programming technique where a function calls itself to solve smaller instances of the same problem."

    with patch.object(
        service._gemini_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_answer),
    ):
        response: ChatResponse = asyncio.run(service.process_chat(request))

        assert response.model_id == "gemini-1.5-flash"
        assert response.conversation_id == "test-conv-123"
        assert response.response == mock_answer
        assert response.latency_ms >= 0
        assert response.timestamp is not None

