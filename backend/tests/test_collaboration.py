import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import create_application
from app.services.auth_service import register_user
from app.db.repository import ConversationRepository
from app.services.collaboration_service import CollaborationService


@pytest.fixture
def client():
    app = create_application()
    return TestClient(app)


@pytest.fixture
def test_users():
    """Register distinct users for testing collaboration."""
    uid = uuid.uuid4().hex[:6]
    user1 = register_user(f"owner_{uid}@test.com", f"owner_{uid}", "Password123!")
    user2 = register_user(f"collab_{uid}@test.com", f"collab_{uid}", "Password123!")
    user3 = register_user(f"viewer_{uid}@test.com", f"viewer_{uid}", "Password123!")
    return {
        "owner": user1,
        "editor": user2,
        "viewer": user3,
    }


def test_conversation_sharing_lifecycle(client: TestClient, test_users):
    owner = test_users["owner"]
    editor = test_users["editor"]
    owner_token = owner["token"]
    editor_token = editor["token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    editor_headers = {"Authorization": f"Bearer {editor_token}"}

    # 1. Create a conversation as owner
    create_res = client.post(
        "/api/conversations",
        json={"title": "Shared Collab Test"},
        headers=owner_headers,
    )
    assert create_res.status_code == 201
    conv_id = create_res.json()["id"]

    # 2. Get initial share settings
    share_get = client.get(f"/api/conversations/{conv_id}/share", headers=owner_headers)
    assert share_get.status_code == 200
    share_data = share_get.json()
    assert share_data["sharing_enabled"] is False
    assert share_data["current_user_role"] == "owner"

    # 3. Update share settings (enable public sharing as editor)
    share_patch = client.patch(
        f"/api/conversations/{conv_id}/share",
        json={"sharing_enabled": True, "share_permission": "editor"},
        headers=owner_headers,
    )
    assert share_patch.status_code == 200
    assert share_patch.json()["sharing_enabled"] is True
    assert share_patch.json()["share_permission"] == "editor"
    share_token = share_patch.json()["share_token"]

    # 4. Create an explicit invitation for editor
    invite_res = client.post(
        f"/api/conversations/{conv_id}/invitations",
        json={"email": editor["user"]["email"], "role": "editor", "expiry_days": 3},
        headers=owner_headers,
    )
    assert invite_res.status_code == 201
    inv_token = invite_res.json()["token"]
    inv_id = invite_res.json()["id"]

    # 5. Collab user accepts invitation
    join_res = client.post(f"/api/conversations/join/{inv_token}", headers=editor_headers)
    assert join_res.status_code == 200
    assert join_res.json()["role"] == "editor"

    # 6. Collab user inspects conversation details and confirms access
    conv_detail = client.get(f"/api/conversations/{conv_id}", headers=editor_headers)
    assert conv_detail.status_code == 200
    assert conv_detail.json()["current_user_role"] == "editor"

    # 7. Owner revokes invitation or removes member
    remove_res = client.delete(
        f"/api/conversations/{conv_id}/members/{editor['user']['id']}",
        headers=owner_headers,
    )
    assert remove_res.status_code == 200

    # 8. Non-owner cannot delete conversation
    del_res = client.delete(f"/api/conversations/{conv_id}", headers=editor_headers)
    assert del_res.status_code == 403


def test_viewer_permission_enforcement(client: TestClient, test_users):
    owner = test_users["owner"]
    viewer = test_users["viewer"]
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}
    viewer_headers = {"Authorization": f"Bearer {viewer['token']}"}

    # 1. Create a conversation as owner
    create_res = client.post(
        "/api/conversations",
        json={"title": "Viewer Restricted Conv"},
        headers=owner_headers,
    )
    conv_id = create_res.json()["id"]

    # 2. Invite viewer with role 'viewer'
    invite_res = client.post(
        f"/api/conversations/{conv_id}/invitations",
        json={"email": viewer["user"]["email"], "role": "viewer"},
        headers=owner_headers,
    )
    inv_token = invite_res.json()["token"]

    # 3. Viewer joins
    client.post(f"/api/conversations/join/{inv_token}", headers=viewer_headers)

    # 4. Viewer can read conversation details
    detail_res = client.get(f"/api/conversations/{conv_id}", headers=viewer_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["current_user_role"] == "viewer"

    # 5. Viewer is rejected from posting messages (HTTP 403 Forbidden)
    chat_res = client.post(
        "/api/chat",
        json={"message": "I want to speak", "conversation_id": conv_id, "model_id": "gemini-1.5-flash"},
        headers=viewer_headers,
    )
    assert chat_res.status_code == 403
    assert "Viewers have read-only access" in chat_res.json()["detail"]


def test_message_author_attribution(test_users):
    owner = test_users["owner"]
    conv = ConversationRepository.create_conversation(title="Attribution Test", user_id=owner["user"]["id"])
    conv_id = conv["id"]

    msg = ConversationRepository.add_message(
        conv_id=conv_id,
        role="user",
        content="Testing attribution",
        author_id=owner["user"]["id"],
        author_name=owner["user"]["username"],
    )
    assert msg["author_id"] == owner["user"]["id"]
    assert msg["author_name"] == owner["user"]["username"]

    messages = ConversationRepository.get_messages(conv_id)
    assert len(messages) == 1
    assert messages[0]["author_name"] == owner["user"]["username"]


def test_realtime_websocket_collaboration(client: TestClient, test_users):
    owner = test_users["owner"]
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}

    # 1. Create a conversation
    create_res = client.post(
        "/api/conversations",
        json={"title": "WebSocket Collab Test"},
        headers=owner_headers,
    )
    conv_id = create_res.json()["id"]

    # 2. Connect to WebSocket as owner
    with client.websocket_connect(f"/api/conversations/ws/{conv_id}?token={owner['token']}") as ws:
        # Receive presence update
        init_event = ws.receive_json()
        assert init_event["type"] == "presence_update"
        assert init_event["conversation_id"] == conv_id
        assert len(init_event["presence"]) >= 1

        # Send ping
        ws.send_json({"type": "ping"})
        pong_event = ws.receive_json()
        assert pong_event["type"] == "pong"

        # Send typing
        ws.send_json({"type": "user_typing", "is_typing": True})

