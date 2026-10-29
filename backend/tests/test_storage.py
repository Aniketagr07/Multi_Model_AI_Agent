import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import init_db
from app.db.repository import ConversationRepository
from app.services.chat_service import ChatService
from app.schemas.chat import ChatRequest
from app.core.model_registry import ModelRegistry

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database schema is initialized before each test."""
    init_db()


def test_create_and_get_conversation():
    """Verify creating a conversation and retrieving it by ID."""
    conv = ConversationRepository.create_conversation(title="Test Architecture")
    assert conv["id"] is not None
    assert conv["title"] == "Test Architecture"
    assert conv["created_at"] is not None
    assert conv["updated_at"] is not None

    fetched = ConversationRepository.get_conversation(conv["id"])
    assert fetched is not None
    assert fetched["id"] == conv["id"]
    assert fetched["title"] == "Test Architecture"
    assert fetched["message_count"] == 0


def test_list_conversations_ordered():
    """Verify conversations are listed in descending order of updated_at."""
    c1 = ConversationRepository.create_conversation(title="First Conv")
    c2 = ConversationRepository.create_conversation(title="Second Conv")

    convs = ConversationRepository.list_conversations(limit=10)
    assert len(convs) >= 2
    # c2 was created after c1, so c2 should appear before c1
    ids = [c["id"] for c in convs]
    assert ids.index(c2["id"]) < ids.index(c1["id"])


def test_rename_and_delete_conversation():
    """Verify renaming a conversation and cascading deletion."""
    conv = ConversationRepository.create_conversation(title="Old Title")
    conv_id = conv["id"]

    # Add a message to verify cascade delete
    ConversationRepository.add_message(
        conv_id=conv_id,
        role="user",
        content="Hello world",
    )
    assert len(ConversationRepository.get_messages(conv_id)) == 1

    # Rename
    updated = ConversationRepository.update_conversation_title(conv_id, "New Renamed Title")
    assert updated["title"] == "New Renamed Title"

    # Delete
    deleted = ConversationRepository.delete_conversation(conv_id)
    assert deleted is True

    # Check conversation is gone
    assert ConversationRepository.get_conversation(conv_id) is None
    # Check cascaded messages are gone
    assert len(ConversationRepository.get_messages(conv_id)) == 0


def test_messages_persistence_and_chronology():
    """Verify messages are stored and retrieved in chronological order."""
    conv = ConversationRepository.create_conversation(title="Chat History Test")
    cid = conv["id"]

    msg1 = ConversationRepository.add_message(
        conv_id=cid,
        role="user",
        content="What is binary search?",
    )
    msg2 = ConversationRepository.add_message(
        conv_id=cid,
        role="assistant",
        content="Binary search is an O(log n) search algorithm.",
        model_id="llama-3.1-8b-instant",
        provider="groq",
        latency_ms=120,
        routed=True,
        routing_category="coding",
    )

    messages = ConversationRepository.get_messages(cid)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What is binary search?"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["model_id"] == "llama-3.1-8b-instant"
    assert messages[1]["routed"] is True
    assert messages[1]["routing_category"] == "coding"


def test_recent_context_window():
    """Verify get_recent_context returns the last N messages in chronological order."""
    conv = ConversationRepository.create_conversation(title="Window Test")
    cid = conv["id"]

    for i in range(5):
        ConversationRepository.add_message(
            conv_id=cid,
            role="user" if i % 2 == 0 else "assistant",
            content=f"Message {i}",
        )

    recent = ConversationRepository.get_recent_context(cid, limit=3)
    assert len(recent) == 3
    assert recent[0]["content"] == "Message 2"
    assert recent[1]["content"] == "Message 3"
    assert recent[2]["content"] == "Message 4"


def test_conversations_api_endpoints():
    """Verify GET, POST, PATCH, DELETE /api/conversations HTTP endpoints."""
    # 1. Create conversation via POST
    post_res = client.post("/api/conversations", json={"title": "API Test Session"})
    assert post_res.status_code == 201
    conv_data = post_res.json()
    conv_id = conv_data["id"]
    assert conv_data["title"] == "API Test Session"

    # 2. Get list via GET
    list_res = client.get("/api/conversations")
    assert list_res.status_code == 200
    conv_ids = [c["id"] for c in list_res.json()["conversations"]]
    assert conv_id in conv_ids

    # 3. Get details via GET /{id}
    detail_res = client.get(f"/api/conversations/{conv_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == conv_id
    assert detail_res.json()["messages"] == []

    # 4. Rename via PATCH /{id}
    patch_res = client.patch(f"/api/conversations/{conv_id}", json={"title": "Updated API Title"})
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated API Title"

    # 5. Delete via DELETE /{id}
    del_res = client.delete(f"/api/conversations/{conv_id}")
    assert del_res.status_code == 204

    # 6. Verify 404 after deletion
    get_del = client.get(f"/api/conversations/{conv_id}")
    assert get_del.status_code == 404


def test_chat_service_persists_messages_in_db():
    """Verify that process_chat automatically persists both user prompt and model response."""
    chat_service = ChatService()
    chat_service._gemini_provider.generate_response = AsyncMock(
        return_value="Persistent response from Gemini 1.5 Flash."
    )

    req = ChatRequest(
        message="Explain SQLite foreign key constraints",
        model_id="gemini-1.5-flash",
    )

    res = asyncio.run(chat_service.process_chat(req))
    assert res.conversation_id is not None
    cid = res.conversation_id

    # Verify messages in SQLite
    messages = ConversationRepository.get_messages(cid)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert "foreign key" in messages[0]["content"].lower()
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "Persistent response from Gemini 1.5 Flash."
    assert messages[1]["model_id"] == "gemini-1.5-flash"
