import uuid
from app.db.database import get_db_connection, init_db
from app.services.auth_service import register_user, import_client_guest_conversations

def test_import_client_guest_conversations():
    """Verify that client-side guest conversations with full message history migrate to user account."""
    init_db()

    email = f"guest_migrator_{uuid.uuid4().hex[:6]}@example.com"
    user_res = register_user(email=email, username="Migrator", password="StrongPassword123!")
    user_id = user_res["user"]["id"]

    guest_conv_id = f"guest-conv-{uuid.uuid4().hex[:8]}"
    guest_msg_1 = f"msg-{uuid.uuid4().hex[:8]}"
    guest_msg_2 = f"msg-{uuid.uuid4().hex[:8]}"

    payload = [
        {
            "id": guest_conv_id,
            "title": "Quantum Physics Intro",
            "created_at": "2026-10-31T10:00:00Z",
            "updated_at": "2026-10-31T10:05:00Z",
            "messages": [
                {
                    "id": guest_msg_1,
                    "role": "user",
                    "content": "What is quantum superposition?",
                    "created_at": "2026-10-31T10:00:00Z",
                },
                {
                    "id": guest_msg_2,
                    "role": "assistant",
                    "content": "Quantum superposition is a fundamental principle...",
                    "model_id": "qwen2.5-0.5b",
                    "provider": "local",
                    "latency_ms": 95,
                    "created_at": "2026-10-31T10:00:02Z",
                },
            ],
        }
    ]

    count = import_client_guest_conversations(user_id, payload)
    assert count == 1

    with get_db_connection() as conn:
        conv = conn.execute("SELECT * FROM conversations WHERE id = ?", [guest_conv_id]).fetchone()
        assert conv is not None
        assert conv["user_id"] == user_id
        assert conv["title"] == "Quantum Physics Intro"

        messages = conn.execute("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC", [guest_conv_id]).fetchall()
        assert len(messages) == 2
        assert messages[0]["content"] == "What is quantum superposition?"
        assert messages[1]["provider"] == "local"
        assert messages[1]["model_id"] == "qwen2.5-0.5b"

    # Second import must avoid duplicate insertion
    count_second = import_client_guest_conversations(user_id, payload)
    assert count_second == 0
