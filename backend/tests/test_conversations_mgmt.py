import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db, get_db_connection
from app.db.repository import ConversationRepository

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database schema is fresh and ready before each test."""
    init_db()


def test_search_conversations_by_title():
    """Test searching conversations by conversation title."""
    c1 = ConversationRepository.create_conversation(title="Quantum Computing Basics")
    c2 = ConversationRepository.create_conversation(title="Organic Chemistry Synthesis")
    c3 = ConversationRepository.create_conversation(title="Machine Learning Neural Networks")

    try:
        # Search for 'Quantum'
        resp = client.get("/api/conversations?q=Quantum")
        assert resp.status_code == 200
        data = resp.json()
        ids = [c["id"] for c in data["conversations"]]
        assert c1["id"] in ids
        assert c2["id"] not in ids
        assert c3["id"] not in ids

        # Search for 'Synthesis'
        resp = client.get("/api/conversations?q=Synthesis")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["conversations"]]
        assert c2["id"] in ids
        assert c1["id"] not in ids

    finally:
        ConversationRepository.delete_conversation(c1["id"])
        ConversationRepository.delete_conversation(c2["id"])
        ConversationRepository.delete_conversation(c3["id"])


def test_search_conversations_by_message_content():
    """Test searching conversations by text inside user or assistant message content."""
    c1 = ConversationRepository.create_conversation(title="Session Alpha")
    c2 = ConversationRepository.create_conversation(title="Session Beta")

    ConversationRepository.add_message(
        conv_id=c1["id"],
        role="user",
        content="What is the difference between Dijkstra and A* pathfinding?",
    )
    ConversationRepository.add_message(
        conv_id=c2["id"],
        role="user",
        content="Explain Python list comprehension with examples.",
    )

    try:
        # Search by message keyword 'pathfinding'
        resp = client.get("/api/conversations?q=pathfinding")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["conversations"]]
        assert c1["id"] in ids
        assert c2["id"] not in ids

        # Search by message keyword 'comprehension'
        resp = client.get("/api/conversations?q=comprehension")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()["conversations"]]
        assert c2["id"] in ids
        assert c1["id"] not in ids

    finally:
        ConversationRepository.delete_conversation(c1["id"])
        ConversationRepository.delete_conversation(c2["id"])


def test_pin_and_unpin_conversation():
    """Test pinning conversation to the top and unpinning it."""
    c1 = ConversationRepository.create_conversation(title="Unpinned Chat 1")
    c2 = ConversationRepository.create_conversation(title="Pinned Priority Chat")

    try:
        # Pin c2
        pin_resp = client.patch(f"/api/conversations/{c2['id']}/pin", json={"is_pinned": True})
        assert pin_resp.status_code == 200
        assert pin_resp.json()["is_pinned"] is True
        assert pin_resp.json()["pinned_at"] is not None

        # Verify list ordering puts pinned at the very top
        list_resp = client.get("/api/conversations")
        assert list_resp.status_code == 200
        convs = list_resp.json()["conversations"]
        assert convs[0]["id"] == c2["id"]
        assert convs[0]["is_pinned"] is True

        # Unpin c2
        unpin_resp = client.patch(f"/api/conversations/{c2['id']}/pin", json={"is_pinned": False})
        assert unpin_resp.status_code == 200
        assert unpin_resp.json()["is_pinned"] is False

    finally:
        ConversationRepository.delete_conversation(c1["id"])
        ConversationRepository.delete_conversation(c2["id"])


def test_archive_and_restore_conversation():
    """Test archiving conversation and restoring it."""
    c1 = ConversationRepository.create_conversation(title="Active Session")
    c2 = ConversationRepository.create_conversation(title="Old Project Notes")

    try:
        # Archive c2
        arch_resp = client.patch(f"/api/conversations/{c2['id']}/archive", json={"is_archived": True})
        assert arch_resp.status_code == 200
        assert arch_resp.json()["is_archived"] is True

        # Verify active-only list does not include c2
        active_resp = client.get("/api/conversations?include_archived=false")
        assert active_resp.status_code == 200
        active_ids = [c["id"] for c in active_resp.json()["conversations"]]
        assert c1["id"] in active_ids
        assert c2["id"] not in active_ids

        # Verify archived_only list includes c2
        archived_only_resp = client.get("/api/conversations?archived_only=true")
        assert archived_only_resp.status_code == 200
        archived_ids = [c["id"] for c in archived_only_resp.json()["conversations"]]
        assert c2["id"] in archived_ids
        assert c1["id"] not in archived_ids

        # Restore c2
        restore_resp = client.patch(f"/api/conversations/{c2['id']}/archive", json={"is_archived": False})
        assert restore_resp.status_code == 200
        assert restore_resp.json()["is_archived"] is False

        # Verify c2 is back in active list
        active_resp_after = client.get("/api/conversations?include_archived=false")
        assert c2["id"] in [c["id"] for c in active_resp_after.json()["conversations"]]

    finally:
        ConversationRepository.delete_conversation(c1["id"])
        ConversationRepository.delete_conversation(c2["id"])


def test_rename_conversation():
    """Test renaming conversation title."""
    c = ConversationRepository.create_conversation(title="Original Title")
    try:
        rename_resp = client.patch(f"/api/conversations/{c['id']}", json={"title": "Updated Brand New Title"})
        assert rename_resp.status_code == 200
        assert rename_resp.json()["title"] == "Updated Brand New Title"

        # Verify persistence via GET
        get_resp = client.get(f"/api/conversations/{c['id']}")
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Updated Brand New Title"
    finally:
        ConversationRepository.delete_conversation(c["id"])


def test_delete_conversation_with_cascade():
    """Test deleting conversation removes parent and all child messages."""
    c = ConversationRepository.create_conversation(title="To Be Deleted")
    ConversationRepository.add_message(conv_id=c["id"], role="user", content="Will be deleted")
    ConversationRepository.add_message(conv_id=c["id"], role="assistant", content="Me too")

    del_resp = client.delete(f"/api/conversations/{c['id']}")
    assert del_resp.status_code == 204

    # Verify conversation is gone
    get_resp = client.get(f"/api/conversations/{c['id']}")
    assert get_resp.status_code == 404

    # Verify messages are gone
    remaining_msgs = ConversationRepository.get_messages(c["id"])
    assert len(remaining_msgs) == 0


def test_export_conversation_markdown():
    """Test exporting conversation as Markdown (.md)."""
    c = ConversationRepository.create_conversation(title="Export Test Session")
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="user",
        content="What is reinforcement learning?",
    )
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="assistant",
        content="Reinforcement learning is an area of machine learning...",
        model_id="gemini-3.6-flash",
    )

    try:
        resp = client.get(f"/api/conversations/{c['id']}/export?format=markdown")
        assert resp.status_code == 200
        assert "text/markdown" in resp.headers["content-type"]
        assert "attachment" in resp.headers["content-disposition"]
        assert ".md" in resp.headers["content-disposition"]

        text = resp.text
        assert "# Export Test Session" in text
        assert "### 👤 User" in text
        assert "What is reinforcement learning?" in text
        assert "### 🤖 Assistant • Model: `gemini-3.6-flash`" in text
        assert "Reinforcement learning is an area" in text
        # Ensure no internal DB paths or API keys leaked
        assert "SQLITE" not in text
        assert "GEMINI_API_KEY" not in text

    finally:
        ConversationRepository.delete_conversation(c["id"])


def test_export_conversation_text():
    """Test exporting conversation as plain text (.txt)."""
    c = ConversationRepository.create_conversation(title="Text Export Session")
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="user",
        content="Hello OmniAI",
    )
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="assistant",
        content="Hello! How can I assist you today?",
        model_id="llama-3.1-8b-instant",
    )

    try:
        resp = client.get(f"/api/conversations/{c['id']}/export?format=text")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers["content-type"]
        assert ".txt" in resp.headers["content-disposition"]

        text = resp.text
        assert "OMNIAI CHAT TRANSCRIPT: Text Export Session" in text
        assert "[USER]" in text
        assert "Hello OmniAI" in text
        assert "[ASSISTANT] (llama-3.1-8b-instant)" in text

    finally:
        ConversationRepository.delete_conversation(c["id"])


def test_export_conversation_json():
    """Test exporting conversation as structured, sanitized JSON (.json)."""
    c = ConversationRepository.create_conversation(title="JSON Export Session")
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="user",
        content="Compute 2 + 2",
    )
    ConversationRepository.add_message(
        conv_id=c["id"],
        role="assistant",
        content="4",
        model_id="gemini-3.6-flash",
        provider="gemini",
    )

    try:
        resp = client.get(f"/api/conversations/{c['id']}/export?format=json")
        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]
        assert ".json" in resp.headers["content-disposition"]

        data = resp.json()
        assert data["title"] == "JSON Export Session"
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][0]["content"] == "Compute 2 + 2"
        assert data["messages"][1]["role"] == "assistant"
        assert data["messages"][1]["content"] == "4"
        assert data["messages"][1]["model"] == "gemini-3.6-flash"
        # Verify no database primary key or sensitive internal columns
        assert "id" not in data["messages"][0]

    finally:
        ConversationRepository.delete_conversation(c["id"])
