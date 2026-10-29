import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException

from app.schemas.compare import (
    CompareRequest,
    CompareResponse,
    ModelComparisonResult,
)
from app.services.comparison_service import ComparisonService
from app.services.chat_service import ChatService
from app.providers.base import (
    ProviderError,
    ProviderConfigError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from app.main import app


def test_compare_route_mounted():
    """Verify that /api/compare route is mounted in OpenAPI specification."""
    paths = list(app.openapi()["paths"].keys())
    assert "/api/compare" in paths
    assert "post" in app.openapi()["paths"]["/api/compare"]


def test_empty_prompt_validation():
    """Verify that empty or whitespace prompts are rejected."""
    with pytest.raises(ValueError):
        CompareRequest(
            prompt="   ",
            model_a_id="gemini-1.5-flash",
            model_b_id="llama-3.1-8b-instant",
        )


def test_duplicate_model_rejection():
    """Verify that selecting the same model for Model A and Model B is rejected."""
    with pytest.raises(ValueError) as exc_info:
        CompareRequest(
            prompt="Explain binary search",
            model_a_id="gemini-1.5-flash",
            model_b_id="gemini-1.5-flash",
        )
    assert "distinct models" in str(exc_info.value)


def test_both_models_succeed_concurrently():
    """Verify both models execute in parallel and return structured results with latency."""
    chat_service = ChatService()
    comparison_service = ComparisonService(chat_service=chat_service)

    request = CompareRequest(
        prompt="Explain quicksort time complexity.",
        model_a_id="gemini-1.5-flash",
        model_b_id="llama-3.1-8b-instant",
    )

    mock_gemini_ans = "Quicksort has an average time complexity of O(n log n)."
    mock_groq_ans = "Quicksort average time complexity is O(n log n), worst case O(n^2)."

    with patch.object(
        chat_service._gemini_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_gemini_ans),
    ) as mock_gemini, patch.object(
        chat_service._groq_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_groq_ans),
    ) as mock_groq:
        response: CompareResponse = asyncio.run(comparison_service.compare_models(request))

        mock_gemini.assert_called_once()
        mock_groq.assert_called_once()

        assert response.prompt == request.prompt

        # Verify Model A
        assert response.model_a.model_id == "gemini-1.5-flash"
        assert response.model_a.success is True
        assert response.model_a.response == mock_gemini_ans
        assert response.model_a.error is None
        assert response.model_a.latency_ms >= 0

        # Verify Model B
        assert response.model_b.model_id == "llama-3.1-8b-instant"
        assert response.model_b.success is True
        assert response.model_b.response == mock_groq_ans
        assert response.model_b.error is None
        assert response.model_b.latency_ms >= 0


def test_partial_failure_one_succeeds_one_fails():
    """Verify that if Model A fails, Model B still succeeds and both results are reported."""
    chat_service = ChatService()
    comparison_service = ComparisonService(chat_service=chat_service)

    request = CompareRequest(
        prompt="Explain neural networks.",
        model_a_id="gemini-1.5-flash",
        model_b_id="llama-3.1-8b-instant",
    )

    mock_groq_ans = "Neural networks are computational models inspired by biological neurons."

    with patch.object(
        chat_service._gemini_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderRateLimitError("Google Gemini quota exceeded.")),
    ), patch.object(
        chat_service._groq_provider,
        "generate_response",
        new=AsyncMock(return_value=mock_groq_ans),
    ):
        response: CompareResponse = asyncio.run(comparison_service.compare_models(request))

        # Model A failed
        assert response.model_a.success is False
        assert response.model_a.response is None
        assert "quota exceeded" in response.model_a.error

        # Model B succeeded!
        assert response.model_b.success is True
        assert response.model_b.response == mock_groq_ans
        assert response.model_b.error is None


def test_both_models_fail():
    """Verify that if both providers fail, structured failure details are provided for both."""
    chat_service = ChatService()
    comparison_service = ComparisonService(chat_service=chat_service)

    request = CompareRequest(
        prompt="Explain attention mechanism.",
        model_a_id="gemini-1.5-flash",
        model_b_id="llama-3.1-8b-instant",
    )

    with patch.object(
        chat_service._gemini_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderConfigError("Gemini API key is not configured.")),
    ), patch.object(
        chat_service._groq_provider,
        "generate_response",
        new=AsyncMock(side_effect=ProviderTimeoutError("Groq request timed out.")),
    ):
        response: CompareResponse = asyncio.run(comparison_service.compare_models(request))

        assert response.model_a.success is False
        assert "Gemini API key is not configured" in response.model_a.error

        assert response.model_b.success is False
        assert "timed out" in response.model_b.error

