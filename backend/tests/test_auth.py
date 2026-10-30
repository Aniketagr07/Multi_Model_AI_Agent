import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_guest_mode_info():
    """Verify guest endpoint describes guest mode boundaries."""
    resp = client.get("/api/auth/guest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "guest"
    assert "not synced across devices" in data["message"]


def test_user_registration_and_validation():
    """Test user registration, validation, and session token issuance."""
    # Test short password rejection
    bad_resp = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "username": "Alice", "password": "123"},
    )
    assert bad_resp.status_code == 422

    # Test invalid email format rejection
    bad_email = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "username": "Alice", "password": "secure_password_123"},
    )
    assert bad_email.status_code == 422

    # Successful registration
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "username": "AliceDev", "password": "strongPassword123!"},
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["username"] == "AliceDev"
    token = data["token"]

    # Verify /api/auth/me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "alice@example.com"

    # Duplicate registration rejection
    dup_resp = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "username": "AliceAgain", "password": "strongPassword123!"},
    )
    assert dup_resp.status_code == 409


def test_user_login_and_logout():
    """Test user login and token invalidation on logout."""
    client.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "username": "BobCoder", "password": "bobPassword123!"},
    )

    # Invalid login
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "bob@example.com", "password": "wrongPassword!"},
    )
    assert bad_login.status_code == 401

    # Valid login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "bob@example.com", "password": "bobPassword123!"},
    )
    assert login_resp.status_code == 200
    bob_token = login_resp.json()["token"]

    # Verify session works
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {bob_token}"})
    assert me_resp.status_code == 200

    # Logout
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {bob_token}"})
    assert logout_resp.status_code == 200

    # Verify session is now invalidated
    after_logout = client.get("/api/auth/me", headers={"Authorization": f"Bearer {bob_token}"})
    assert after_logout.status_code == 401


def test_conversation_user_scoping_and_isolation():
    """Verify conversations created by User A are invisible to User B and Guest."""
    # Register User A
    a_resp = client.post(
        "/api/auth/register",
        json={"email": "usera@example.com", "username": "UserA", "password": "passwordA123!"},
    )
    token_a = a_resp.json()["token"]

    # Register User B
    b_resp = client.post(
        "/api/auth/register",
        json={"email": "userb@example.com", "username": "UserB", "password": "passwordB123!"},
    )
    token_b = b_resp.json()["token"]

    # User A creates a conversation
    c_a = client.post(
        "/api/conversations",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"title": "User A Private Architecture"},
    )
    assert c_a.status_code == 201
    conv_a_id = c_a.json()["id"]

    # User B creates a conversation
    c_b = client.post(
        "/api/conversations",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"title": "User B Research Notes"},
    )
    assert c_b.status_code == 201
    conv_b_id = c_b.json()["id"]

    # User A lists conversations -> sees only User A's conversation
    list_a = client.get("/api/conversations", headers={"Authorization": f"Bearer {token_a}"}).json()
    ids_a = [c["id"] for c in list_a["conversations"]]
    assert conv_a_id in ids_a
    assert conv_b_id not in ids_a

    # User B lists conversations -> sees only User B's conversation
    list_b = client.get("/api/conversations", headers={"Authorization": f"Bearer {token_b}"}).json()
    ids_b = [c["id"] for c in list_b["conversations"]]
    assert conv_b_id in ids_b
    assert conv_a_id not in ids_b

    # Guest lists conversations -> sees neither User A nor User B's conversations
    guest_list = client.get("/api/conversations").json()
    guest_ids = [c["id"] for c in guest_list["conversations"]]
    assert conv_a_id not in guest_ids
    assert conv_b_id not in guest_ids


def test_account_deletion():
    """Verify user account deletion permanently wipes user data and sessions."""
    resp = client.post(
        "/api/auth/register",
        json={"email": "delete_me@example.com", "username": "Ephemeral", "password": "passwordDel123!"},
    )
    token = resp.json()["token"]

    # Delete account
    del_resp = client.delete("/api/auth/account", headers={"Authorization": f"Bearer {token}"})
    assert del_resp.status_code == 200

    # Token is now dead
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 401
