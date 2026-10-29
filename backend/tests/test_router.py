import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.core.config import Settings
from app.core.model_registry import ModelRegistry, ModelInfo
from app.services.model_router import ModelRouter, RoutingDecision
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest
from app.providers.base import (
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

client = TestClient(app)


# -----------------------------------------------------------------------------
# 1. Classification & Heuristic Scoring Tests
# -----------------------------------------------------------------------------

def test_router_classifies_coding_prompts():
    router = ModelRouter()

    # Prompt with code block
    cat1, rules1 = router.classify_request("Here is my code:\n```python\ndef add(a, b): return a + b\n```\nWhy does it fail?")
    assert cat1 == "coding"
    assert "code_block" in rules1

    # Prompt with debugging / traceback keywords
    cat2, rules2 = router.classify_request("I encountered a nullpointer exception and traceback in my java function, how do I fix this bug?")
    assert cat2 == "coding"
    assert "debugging_keywords" in rules2 or "code_keywords" in rules2

    # Prompt with algorithmic complexity
    cat3, rules3 = router.classify_request("What is the time complexity and space complexity of quicksort in python?")
    assert cat3 == "coding"


def test_router_classifies_writing_prompts():
    router = ModelRouter()

    # Summarization
    cat1, rules1 = router.classify_request("Please summarize this research paper into a concise tl;dr with bullet points.")
    assert cat1 == "writing"
    assert "summarization" in rules1

    # Rewriting & tone
    cat2, rules2 = router.classify_request("Rewrite this email in a professional formal tone for my manager.")
    assert cat2 == "writing"

    # Drafting prose
    cat3, rules3 = router.classify_request("Draft an email to request a deadline extension for our capstone project.")
    assert cat3 == "writing"


def test_router_classifies_reasoning_prompts():
    router = ModelRouter()

    # Step-by-step logic
    cat1, rules1 = router.classify_request("Think step by step and explain why the halting problem is undecidable.")
    assert cat1 == "reasoning"
    assert "step_by_step" in rules1

    # Mathematical derivation
    cat2, rules2 = router.classify_request("Calculate and derive the mathematical formula for Bayes theorem with a proof.")
    assert cat2 == "reasoning"

    # Architectural trade-off analysis
    cat3, rules3 = router.classify_request("What are the key trade-offs and pros and cons of using microservices vs monolithic architectures?")
    assert cat3 == "reasoning"


def test_router_classifies_general_fallback():
    router = ModelRouter()

    cat1, rules1 = router.classify_request("Hello, good morning! How are you doing today?")
    assert cat1 == "general"
    assert "default_heuristic" in rules1

    cat2, rules2 = router.classify_request("What is the capital of France?")
    assert cat2 == "general"


# -----------------------------------------------------------------------------
# 2. Model Selection & Explanation Tests
# -----------------------------------------------------------------------------

def test_router_selects_optimal_model_when_all_available():
    router = ModelRouter()
    mock_models = [
        ModelInfo(
            id="llama-3.1-8b-instant",
            name="Llama 3.1 8B",
            provider="groq",
            provider_model_id="llama-3.1-8b-instant",
            description="Groq LPU",
            tag="Groq Cloud",
            is_available=True,
            supported_categories=["coding", "general"],
        ),
        ModelInfo(
            id="gemini-1.5-flash",
            name="Gemini 1.5 Flash",
            provider="gemini",
            provider_model_id="gemini-1.5-flash",
            description="Google Flash",
            tag="Google AI Studio",
            is_available=True,
            supported_categories=["general", "writing"],
        ),
        ModelInfo(
            id="gemini-1.5-pro",
            name="Gemini 1.5 Pro",
            provider="gemini",
            provider_model_id="gemini-1.5-pro",
            description="Google Pro",
            tag="Google AI Studio",
            is_available=True,
            supported_categories=["reasoning", "writing"],
        ),
    ]

    # Coding should route to Llama 3.1 8B
    decision_coding = router.route_request("Can you fix this python bug with my binary search algorithm?", mock_models)
    assert decision_coding.category == "coding"
    assert decision_coding.chosen_model.id == "llama-3.1-8b-instant"
    assert "coding" in decision_coding.explanation.lower()

    # Reasoning should route to Gemini 1.5 Pro
    decision_reasoning = router.route_request("Think step by step and derive the formula for neural network backpropagation.", mock_models)
    assert decision_reasoning.category == "reasoning"
    assert decision_reasoning.chosen_model.id == "gemini-1.5-pro"

    # Writing should route to Gemini 1.5 Flash
    decision_writing = router.route_request("Summarize this article and draft a formal email with bullet points.", mock_models)
    assert decision_writing.category == "writing"
    assert decision_writing.chosen_model.id == "gemini-1.5-flash"


def test_router_fallback_when_preferred_provider_unavailable():
    router = ModelRouter()
    # Only Gemini is available (Groq missing)
    only_gemini = [
        ModelInfo(
            id="gemini-1.5-flash",
            name="Gemini 1.5 Flash",
            provider="gemini",
            provider_model_id="gemini-1.5-flash",
            description="Google Flash",
            tag="Google AI Studio",
            is_available=True,
            supported_categories=["general", "writing"],
        )
    ]

    # Coding prompt should gracefully fall back to Gemini Flash
    decision = router.route_request("Write a python function to compute fibonacci numbers", only_gemini)
    assert decision.category == "coding"
    assert decision.chosen_model.id == "gemini-1.5-flash"
    assert decision.confidence in ("rule_match", "fallback")


def test_router_raises_503_when_no_models_available():
    router = ModelRouter()
    with pytest.raises(HTTPException) as exc_info:
        router.route_request("Any prompt", available_models=[])
    assert exc_info.value.status_code == 503
    assert "No configured AI models are available" in exc_info.value.detail


# -----------------------------------------------------------------------------
# 3. ChatService Auto-Routing & Fallback Execution Tests
# -----------------------------------------------------------------------------

def test_chat_service_auto_mode_success():
    chat_service = ChatService()

    # Mock Gemini and Groq providers
    chat_service._groq_provider.generate_response = AsyncMock(
        return_value="def binary_search(arr, x): pass"
    )

    with patch.object(
        ModelRegistry,
        "get_available_models",
        return_value=[
            ModelRegistry.get_model("llama-3.1-8b-instant"),
            ModelRegistry.get_model("gemini-1.5-flash"),
        ],
    ):
        req = ChatRequest(
            message="Write an optimal binary search in Python with comments",
            model_id="auto",
        )
        response = asyncio.run(chat_service.process_chat(req))

        assert response.routed is True
        assert response.routing_category == "coding"
        assert response.model_id == "llama-3.1-8b-instant"
        assert response.fallback_used is False
        assert "coding" in response.routing_explanation.lower()
        assert response.response == "def binary_search(arr, x): pass"


def test_chat_service_manual_mode_preserves_routed_false():
    chat_service = ChatService()
    chat_service._gemini_provider.generate_response = AsyncMock(
        return_value="Here is your requested answer."
    )

    req = ChatRequest(
        message="Explain machine learning",
        model_id="gemini-1.5-flash",
    )
    response = asyncio.run(chat_service.process_chat(req))

    assert response.routed is False
    assert response.routing_category is None
    assert response.model_id == "gemini-1.5-flash"
    assert response.fallback_used is False


def test_chat_service_auto_mode_transient_failure_triggers_fallback():
    chat_service = ChatService()

    # Primary (Groq) throws rate limit error
    chat_service._groq_provider.generate_response = AsyncMock(
        side_effect=ProviderRateLimitError("Rate limit exceeded (30 RPM free tier).")
    )
    # Fallback (Gemini) succeeds
    chat_service._gemini_provider.generate_response = AsyncMock(
        return_value="Fallback response from Gemini 1.5 Flash."
    )

    with patch.object(
        ModelRegistry,
        "get_available_models",
        return_value=[
            ModelRegistry.get_model("llama-3.1-8b-instant"),
            ModelRegistry.get_model("gemini-1.5-flash"),
        ],
    ):
        req = ChatRequest(
            message="Debug this python code for me",
            model_id="auto",
        )
        response = asyncio.run(chat_service.process_chat(req))

        assert response.routed is True
        assert response.fallback_used is True
        assert response.model_id == "gemini-1.5-flash"
        assert "Fallback Activated" in response.routing_explanation
        assert response.response == "Fallback response from Gemini 1.5 Flash."


def test_chat_service_auth_error_does_not_silently_fallback():
    chat_service = ChatService()

    # Primary throws auth error (bad key)
    chat_service._groq_provider.generate_response = AsyncMock(
        side_effect=ProviderAuthError("Invalid Groq API key.")
    )

    with patch.object(
        ModelRegistry,
        "get_available_models",
        return_value=[
            ModelRegistry.get_model("llama-3.1-8b-instant"),
            ModelRegistry.get_model("gemini-1.5-flash"),
        ],
    ):
        req = ChatRequest(
            message="Write python code",
            model_id="auto",
        )
        # Auth errors must immediately raise without attempting fallback
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(chat_service.process_chat(req))

        assert exc_info.value.status_code == 502
        assert "Invalid Groq API key" in exc_info.value.detail
