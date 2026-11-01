import uuid
import pytest
from fastapi import HTTPException
from app.services.auth_service import register_user
from app.db.repository import ConversationRepository
from app.services.collaboration_service import CollaborationService
from app.api.routes.auth import extract_token_from_request, get_current_user_required


class MockRequest:
    def __init__(self, headers=None, cookies=None):
        self.headers = headers or {}
        self.cookies = cookies or {}


@pytest.fixture(scope="module")
def test_users():
    """Register distinct users for testing collaboration."""
    uid = uuid.uuid4().hex[:6]
    owner = register_user(f"owner_{uid}@test.com", f"owner_{uid}", "Password123!")
    editor = register_user(f"collab_{uid}@test.com", f"collab_{uid}", "Password123!")
    viewer = register_user(f"viewer_{uid}@test.com", f"viewer_{uid}", "Password123!")
    other = register_user(f"other_{uid}@test.com", f"other_{uid}", "Password123!")
    return {
        "owner": owner,
        "editor": editor,
        "viewer": viewer,
        "other": other,
    }


def test_auth_extraction_and_unauthenticated_rejection():
    """Verify bearer, cookie, header token extraction and 401 rejection for unauthenticated requests."""
    # 1. Bearer token in Authorization
    req1 = MockRequest(headers={"Authorization": "Bearer sample-token-123"})
    assert extract_token_from_request(req1) == "sample-token-123"

    # 2. Case-insensitive bearer
    req2 = MockRequest(headers={"authorization": "bearer sample-token-lower"})
    assert extract_token_from_request(req2) == "sample-token-lower"

    # 3. X-OmniAI-Token header
    req3 = MockRequest(headers={"X-OmniAI-Token": "sample-token-x"})
    assert extract_token_from_request(req3) == "sample-token-x"

    # 4. Cookie omniai_session
    req4 = MockRequest(cookies={"omniai_session": "sample-cookie-token"})
    assert extract_token_from_request(req4) == "sample-cookie-token"

    # 5. Missing token must raise 401 Unauthorized with exact expected message
    req_empty = MockRequest()
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_required(req_empty)
    assert exc_info.value.status_code == 401
    assert "Authentication credentials were not provided" in exc_info.value.detail


def test_conversation_sharing_lifecycle(test_users):
    """Test full lifecycle: owner creates conv, toggles link sharing, invites editor, joins, updates role."""
    owner = test_users["owner"]["user"]
    editor = test_users["editor"]["user"]
    other = test_users["other"]["user"]

    # 1. Create a conversation as owner
    conv = ConversationRepository.create_conversation(title="Shared Collab Test", user_id=owner["id"])
    conv_id = conv["id"]

    # 2. Get initial share settings
    share_details = CollaborationService.get_share_details(conv_id, user=owner)
    assert share_details.conversation_id == conv_id
    assert share_details.sharing_enabled is False
    assert share_details.current_user_role == "owner"
    assert len(share_details.members) >= 1
    assert share_details.members[0].user_id == owner["id"]

    # 3. Non-participant cannot view share details (HTTP 403)
    with pytest.raises(HTTPException) as exc_info:
        CollaborationService.get_share_details(conv_id, user=other)
    assert exc_info.value.status_code == 403

    # 4. Update share settings (enable public sharing as collaborative editor)
    updated = CollaborationService.update_share_settings(
        conv_id=conv_id,
        user=owner,
        sharing_enabled=True,
        share_permission="editor",
    )
    assert updated.sharing_enabled is True
    assert updated.share_permission == "editor"
    assert updated.share_token is not None

    # 5. Non-owner cannot update share settings (HTTP 403)
    with pytest.raises(HTTPException) as exc_info:
        CollaborationService.update_share_settings(
            conv_id=conv_id,
            user=editor,
            sharing_enabled=False,
            share_permission="viewer",
        )
    assert exc_info.value.status_code == 403

    # 6. Owner creates an invitation for editor
    inv_response = CollaborationService.create_invitation(
        conv_id=conv_id,
        user=owner,
        email=editor["email"],
        role="editor",
        expiry_days=7,
    )
    assert inv_response.conversation_id == conv_id
    assert inv_response.role == "editor"
    assert inv_response.token is not None
    inv_token = inv_response.token
    inv_id = inv_response.id

    # 7. Editor accepts invitation
    join_res = CollaborationService.accept_invitation(token=inv_token, user=editor)
    assert join_res.conversation_id == conv_id
    assert join_res.role == "editor"

    # 8. Verify members list now includes both owner and editor
    share_details_after_join = CollaborationService.get_share_details(conv_id, user=owner)
    member_ids = [m.user_id for m in share_details_after_join.members]
    assert owner["id"] in member_ids
    assert editor["id"] in member_ids

    # 9. Owner updates editor's role to 'viewer'
    role_update_res = CollaborationService.update_member_role(
        conv_id=conv_id,
        current_user=owner,
        target_user_id=editor["id"],
        new_role="viewer",
    )
    assert role_update_res["success"] is True
    assert role_update_res["role"] == "viewer"

    # 10. Editor (now viewer) cannot update member roles (HTTP 403)
    with pytest.raises(HTTPException) as exc_info:
        CollaborationService.update_member_role(
            conv_id=conv_id,
            current_user=editor,
            target_user_id=owner["id"],
            new_role="editor",
        )
    assert exc_info.value.status_code == 403

    # 11. Owner removes editor from conversation
    remove_res = CollaborationService.remove_member(
        conv_id=conv_id,
        current_user=owner,
        target_user_id=editor["id"],
    )
    assert remove_res["success"] is True

    # 12. Editor is no longer a participant
    access = CollaborationService.get_conversation_access(conv_id, editor)
    assert access["can_manage"] is False


def test_invitation_revocation(test_users):
    """Verify owner can revoke pending invitations and revoked invitations cannot be accepted."""
    owner = test_users["owner"]["user"]
    viewer = test_users["viewer"]["user"]

    conv = ConversationRepository.create_conversation(title="Revoke Test", user_id=owner["id"])
    conv_id = conv["id"]

    # Create invitation
    inv = CollaborationService.create_invitation(
        conv_id=conv_id,
        user=owner,
        email=viewer["email"],
        role="viewer",
    )

    # Revoke invitation
    rev = CollaborationService.revoke_invitation(
        conv_id=conv_id,
        current_user=owner,
        invitation_id=inv.id,
    )
    assert rev["success"] is True

    # Attempting to join with revoked token must fail
    with pytest.raises(HTTPException) as exc_info:
        CollaborationService.accept_invitation(token=inv.token, user=viewer)
    assert exc_info.value.status_code == 400
    assert "This invitation has already been revoked" in exc_info.value.detail


def test_message_author_attribution(test_users):
    """Verify collaborative message storage records author_id and author_name."""
    owner = test_users["owner"]["user"]
    conv = ConversationRepository.create_conversation(title="Attribution Test", user_id=owner["id"])
    conv_id = conv["id"]

    msg = ConversationRepository.add_message(
        conv_id=conv_id,
        role="user",
        content="Testing attribution",
        author_id=owner["id"],
        author_name=owner["username"],
    )
    assert msg["author_id"] == owner["id"]
    assert msg["author_name"] == owner["username"]

    messages = ConversationRepository.get_messages(conv_id)
    assert len(messages) == 1
    assert messages[0]["author_name"] == owner["username"]
