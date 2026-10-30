import json
import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.repository import ConversationRepository
from app.schemas.chat import ChatRequest
from app.services.chat_service import get_chat_service


client = TestClient(app)


def parse_sse_events(response_text: str):
    """Helper to parse SSE lines into structured events."""
    events = []
    lines = response_text.strip().split("\n\n")
    for block in lines:
        for line in block.split("\n"):
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:].strip()))
                except json.JSONDecodeError:
                    pass
    return events


def test_streaming_endpoint_mounted():
    """Verify POST /api/chat/stream is mounted and validates empty body."""
    response = client.post("/api/chat/stream", json={})
    assert response.status_code == 422


@pytest.mark.anyio
async def test_successful_streaming_and_persistence():
    """Verify successful streaming yields meta, tokens, done events and persists to SQLite."""
    async def mock_stream_tokens(*args, **kwargs):
        tokens = ["Hello", " world", "!"]
        for t in tokens:
            yield t

    with patch("app.providers.groq_provider.GroqProvider.stream_response", side_effect=mock_stream_tokens), \
         patch("app.providers.groq_provider.GroqProvider.check_availability", return_value=True):

        response = client.post(
            "/api/chat/stream",
            json={
                "message": "Say hello world",
                "model_id": "llama-3.1-8b-instant",
                "effort": "low",
            },
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = parse_sse_events(response.text)
        types = [e.get("type") for e in events]
        assert "meta" in types
        assert "token" in types
        assert "done" in types

        # Check metadata
        meta = next(e for e in events if e.get("type") == "meta")
        assert meta["model_id"] == "llama-3.1-8b-instant"
        assert meta["effort"] == "low"
        conv_id = meta["conversation_id"]

        # Check tokens
        tokens = [e.get("token") for e in events if e.get("type") == "token"]
        assert "".join(tokens) == "Hello world!"

        # Check done event
        done = next(e for e in events if e.get("type") == "done")
        assert done["response"] == "Hello world!"
        assert done["conversation_id"] == conv_id

        # Verify SQLite persistence
        db_conv = await ConversationRepository.a_get_conversation(conv_id)
        assert db_conv is not None
        assert db_conv["message_count"] >= 2  # user + assistant

        messages = await ConversationRepository.a_get_messages(conv_id)
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) >= 1
        assert assistant_msgs[-1]["content"] == "Hello world!"
        assert assistant_msgs[-1]["model_id"] == "llama-3.1-8b-instant"


@pytest.mark.anyio
async def test_streaming_provider_error_handling():
    """Verify provider errors during stream emit an error SSE event without crashing server."""
    async def mock_failing_stream(*args, **kwargs):
        yield "Initial chunk"
        raise RuntimeError("Simulated mid-stream network drop")

    with patch("app.providers.groq_provider.GroqProvider.stream_response", side_effect=mock_failing_stream):
        response = client.post(
            "/api/chat/stream",
            json={
                "message": "Fail test",
                "model_id": "llama-3.1-8b-instant",
            },
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        types = [e.get("type") for e in events]
        assert "error" in types
        err_event = next(e for e in events if e.get("type") == "error")
        assert "Simulated mid-stream network drop" in err_event["error"]


@pytest.mark.anyio
async def test_streaming_auto_routing():
    """Verify Auto mode preserves intelligent classification and emits routing rationale in meta."""
    async def mock_stream_tokens(*args, **kwargs):
        yield "def add(a, b): return a + b"

    with patch("app.providers.groq_provider.GroqProvider.stream_response", side_effect=mock_stream_tokens), \
         patch("app.providers.groq_provider.GroqProvider.check_availability", return_value=True):

        response = client.post(
            "/api/chat/stream",
            json={
                "message": "Write a python function to add two numbers",
                "model_id": "auto",
                "effort": "medium",
            },
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        meta = next(e for e in events if e.get("type") == "meta")
        assert meta["routed"] is True
        assert meta["routing_category"] == "coding"


@pytest.mark.anyio
async def test_cancellation_does_not_save_incomplete_response():
    """Verify that when a client cancels or aborts mid-stream, incomplete text is NOT saved as completed in SQLite."""
    chat_service = get_chat_service()

    async def mock_endless_stream(*args, **kwargs):
        yield "Part 1"
        yield "Part 2"
        # Simulate abrupt generator close/cancel
        raise GeneratorExit()

    with patch("app.providers.groq_provider.GroqProvider.stream_response", side_effect=mock_endless_stream):
        req = ChatRequest(
            message="Will be cancelled mid-stream",
            model_id="llama-3.1-8b-instant",
            effort="high",
        )

        # Consume only 1 token then abort generator
        gen = chat_service.stream_chat(req)
        meta_line = await gen.__anext__()
        meta = json.loads(meta_line.replace("data: ", "").strip())
        conv_id = meta["conversation_id"]

        try:
            await gen.__anext__()  # pulls first token
            await gen.aclose()     # simulate client disconnect
        except (GeneratorExit, StopAsyncIteration):
            pass

        # Verify assistant message was NOT saved into SQLite
        messages = await ConversationRepository.a_get_messages(conv_id)
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) == 0, "Incomplete response must NOT be saved as completed answer"


@pytest.mark.anyio
async def test_regeneration_stream():
    """Verify regeneration successfully accepts prior conversation_id and re-streams fresh output."""
    conv = await ConversationRepository.a_create_conversation(title="Test Regen")
    conv_id = conv["id"]

    async def mock_first_pass(*args, **kwargs):
        yield "First attempt"

    async def mock_second_pass(*args, **kwargs):
        yield "Second regenerated attempt"

    with patch("app.providers.groq_provider.GroqProvider.stream_response", side_effect=mock_second_pass), \
         patch("app.providers.groq_provider.GroqProvider.check_availability", return_value=True):

        response = client.post(
            "/api/chat/stream",
            json={
                "message": "Explain quantum computing",
                "conversation_id": conv_id,
                "model_id": "llama-3.1-8b-instant",
                "effort": "high",
            },
        )
        assert response.status_code == 200
        events = parse_sse_events(response.text)
        done = next(e for e in events if e.get("type") == "done")
        assert done["response"] == "Second regenerated attempt"
        assert done["conversation_id"] == conv_id
