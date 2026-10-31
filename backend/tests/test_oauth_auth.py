import base64
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import get_settings
from app.services.auth_service import create_oauth_state

client = TestClient(app)


def fake_google_id_token(sub="google-user-12345", email="googleuser@example.com", client_id="test-google-id"):
    """Generate mock unverified JWT string with matching claims."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256"}).encode()).decode().rstrip("=")
    claims = base64.urlsafe_b64encode(
        json.dumps({
            "iss": "https://accounts.google.com",
            "aud": client_id,
            "sub": sub,
            "email": email,
            "email_verified": True,
            "name": "Google User",
            "exp": 9999999999,
        }).encode()
    ).decode().rstrip("=")
    return f"{header}.{claims}.fake-signature"


def test_oauth_providers_status():
    """Verify endpoint correctly reports Google & GitHub configuration status."""
    resp = client.get("/api/auth/oauth/providers")
    assert resp.status_code == 200
    data = resp.json()
    assert "google" in data
    assert "github" in data
    assert "enabled" in data["google"]
    assert "enabled" in data["github"]


def test_oauth_url_generation_unconfigured():
    """Verify endpoint rejects URL generation when credentials are unconfigured."""
    settings = get_settings()
    with patch.object(settings, "GOOGLE_CLIENT_ID", None), patch.object(settings, "GOOGLE_CLIENT_SECRET", None):
        resp = client.get("/api/auth/oauth/google/url")
        assert resp.status_code == 400
        assert "not configured" in resp.json()["detail"].lower()


def test_oauth_url_generation_configured():
    """Verify official URL and CSRF state token generation for Google and GitHub."""
    settings = get_settings()
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-g-id"), patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-g-secret"):
        resp = client.get("/api/auth/oauth/google/url")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "google"
        assert "accounts.google.com" in data["url"]
        assert "test-g-id" in data["url"]
        assert data["state"]

    with patch.object(settings, "GITHUB_CLIENT_ID", "test-gh-id"), patch.object(settings, "GITHUB_CLIENT_SECRET", "test-gh-secret"):
        resp = client.get("/api/auth/oauth/github/url")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "github"
        assert "github.com/login/oauth/authorize" in data["url"]
        assert "test-gh-id" in data["url"]
        assert data["state"]


def test_invalid_oauth_state_rejected():
    """Verify callback strictly rejects missing or forged CSRF state tokens."""
    settings = get_settings()
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-g-id"), patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-g-secret"):
        resp = client.post(
            "/api/auth/oauth/google/callback",
            json={"code": "fake-code", "state": "forged-or-expired-state-token"},
        )
        assert resp.status_code == 400
        assert "invalid" in resp.json()["detail"].lower()


def test_google_registration_and_login_flow():
    """Verify full Google OAuth registration, user creation, and subsequent login."""
    settings = get_settings()
    google_client_id = "test-google-id"
    google_client_secret = "test-google-secret"
    google_sub = "google-uid-888"
    user_email = "newgoogleuser@example.com"

    mock_id_token = fake_google_id_token(sub=google_sub, email=user_email, client_id=google_client_id)

    with patch.object(settings, "GOOGLE_CLIENT_ID", google_client_id), patch.object(settings, "GOOGLE_CLIENT_SECRET", google_client_secret):
        # 1. Initiate and get valid state
        state_resp = client.get("/api/auth/oauth/google/url")
        assert state_resp.status_code == 200
        state = state_resp.json()["state"]

        # 2. Mock Google endpoints
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.headers = {"content-type": "application/json"}
        mock_token_resp.json.return_value = {
            "access_token": "mock-google-access-token",
            "id_token": mock_id_token,
            "token_type": "Bearer",
        }

        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {
            "sub": google_sub,
            "name": "Jane Google",
            "email": user_email,
            "email_verified": True,
            "picture": "https://lh3.googleusercontent.com/photo.jpg",
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_post.return_value = mock_token_resp
            mock_get.return_value = mock_userinfo_resp

            callback_resp = client.post(
                "/api/auth/oauth/google/callback",
                json={"code": "valid-google-code", "state": state},
            )

        assert callback_resp.status_code == 200
        auth_data = callback_resp.json()
        assert auth_data["user"]["email"] == user_email
        assert auth_data["user"]["primary_provider"] == "google"
        assert auth_data["token"]
        assert "google" in auth_data["user"]["linked_providers"]

        # Verify HTTP-only session cookie is set
        assert "omniai_session" in callback_resp.cookies

        # 3. Subsequent login with same Google account succeeds seamlessly
        state_resp2 = client.get("/api/auth/oauth/google/url")
        state2 = state_resp2.json()["state"]

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_post.return_value = mock_token_resp
            mock_get.return_value = mock_userinfo_resp

            login_resp = client.post(
                "/api/auth/oauth/google/callback",
                json={"code": "second-login-code", "state": state2},
            )

        assert login_resp.status_code == 200
        assert login_resp.json()["user"]["id"] == auth_data["user"]["id"]


def test_github_registration_with_private_email():
    """Verify GitHub registration retrieves and respects verified primary email from /user/emails."""
    settings = get_settings()
    gh_client_id = "test-gh-id"
    gh_client_secret = "test-gh-secret"
    gh_uid = "98765432"
    primary_verified_email = "octocat_private@example.com"

    with patch.object(settings, "GITHUB_CLIENT_ID", gh_client_id), patch.object(settings, "GITHUB_CLIENT_SECRET", gh_client_secret):
        state_resp = client.get("/api/auth/oauth/github/url")
        assert state_resp.status_code == 200
        state = state_resp.json()["state"]

        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.headers = {"content-type": "application/json"}
        mock_token_resp.json.return_value = {
            "access_token": "mock-gh-access-token",
            "token_type": "bearer",
            "scope": "read:user,user:email",
        }

        # Profile with null/private email
        mock_user_resp = MagicMock()
        mock_user_resp.status_code = 200
        mock_user_resp.json.return_value = {
            "id": gh_uid,
            "login": "monalisa",
            "name": "Mona Lisa Octocat",
            "email": None,
            "avatar_url": "https://avatars.githubusercontent.com/u/98765432",
        }

        # /user/emails endpoint returns list of emails
        mock_emails_resp = MagicMock()
        mock_emails_resp.status_code = 200
        mock_emails_resp.json.return_value = [
            {"email": "unverified@example.com", "primary": False, "verified": False},
            {"email": primary_verified_email, "primary": True, "verified": True},
        ]

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_post.return_value = mock_token_resp
            mock_get.side_effect = [mock_user_resp, mock_emails_resp]

            callback_resp = client.post(
                "/api/auth/oauth/github/callback",
                json={"code": "valid-github-code", "state": state},
            )

        assert callback_resp.status_code == 200
        auth_data = callback_resp.json()
        assert auth_data["user"]["email"] == primary_verified_email
        assert auth_data["user"]["username"] == "monalisa"
        assert auth_data["user"]["primary_provider"] == "github"
        assert "github" in auth_data["user"]["linked_providers"]


def test_account_linking_and_unlinking():
    """Verify an existing authenticated user can link and unlink third-party OAuth providers."""
    # 1. Create native email/password account
    client.cookies.clear()
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": "linker@example.com", "username": "LinkerUser", "password": "securePass123!"},
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["token"]
    user_id = reg_resp.json()["user"]["id"]

    settings = get_settings()
    with patch.object(settings, "GITHUB_CLIENT_ID", "test-gh-id"), patch.object(settings, "GITHUB_CLIENT_SECRET", "test-gh-secret"):
        # 2. Request linking authorization URL
        link_url_resp = client.get(
            "/api/auth/oauth/github/url?action=link",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert link_url_resp.status_code == 200
        link_state = link_url_resp.json()["state"]

        # 3. Simulate callback
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.headers = {"content-type": "application/json"}
        mock_token_resp.json.return_value = {"access_token": "mock-token", "token_type": "bearer"}

        mock_user_resp = MagicMock()
        mock_user_resp.status_code = 200
        mock_user_resp.json.return_value = {
            "id": "github-uid-555",
            "login": "octo_linker",
            "email": "linker_gh@example.com",
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post, \
             patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_post.return_value = mock_token_resp
            mock_get.return_value = mock_user_resp

            link_cb_resp = client.post(
                "/api/auth/oauth/github/callback",
                json={"code": "link-code", "state": link_state},
            )

        assert link_cb_resp.status_code == 200
        assert link_cb_resp.json()["status"] == "linked"

        # 4. Check linked providers endpoint
        linked_list_resp = client.get("/api/auth/linked-providers", headers={"Authorization": f"Bearer {token}"})
        assert linked_list_resp.status_code == 200
        providers = [p["provider"] for p in linked_list_resp.json()["providers"]]
        assert "github" in providers

        # 5. Unlink provider
        unlink_resp = client.delete("/api/auth/linked-providers/github", headers={"Authorization": f"Bearer {token}"})
        assert unlink_resp.status_code == 200

        # Verify it is unlinked
        linked_after = client.get("/api/auth/linked-providers", headers={"Authorization": f"Bearer {token}"}).json()
        assert len(linked_after["providers"]) == 0


def test_password_recovery_forgot_password():
    """Verify forgot password endpoint generates secure recovery response."""
    resp = client.post(
        "/api/auth/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert resp.status_code == 200
    assert "instructions have been generated" in resp.json()["message"]


def test_guest_conversation_migration():
    """Verify guest conversations are safely migrated to a new user account without data loss."""
    client.cookies.clear()
    # 1. Guest creates two conversations
    c1 = client.post("/api/conversations", json={"title": "Guest Session 1"}).json()
    c2 = client.post("/api/conversations", json={"title": "Guest Session 2"}).json()

    # 2. User registers
    reg = client.post(
        "/api/auth/register",
        json={"email": "migrator@example.com", "username": "Migrator", "password": "password123!"},
    ).json()
    token = reg["token"]

    # 3. Migrate guest conversations to user
    mig_resp = client.post(
        "/api/auth/migrate-guest-conversations",
        headers={"Authorization": f"Bearer {token}"},
        json={"conversation_ids": [c1["id"], c2["id"]]},
    )
    assert mig_resp.status_code == 200
    assert mig_resp.json()["migrated_count"] == 2

    # 4. Authenticated user now owns these conversations
    user_convs = client.get("/api/conversations", headers={"Authorization": f"Bearer {token}"}).json()
    user_conv_ids = [c["id"] for c in user_convs["conversations"]]
    assert c1["id"] in user_conv_ids
    assert c2["id"] in user_conv_ids


def test_oauth_direct_get_login_redirect():
    """Verify GET /api/auth/oauth/google/login performs direct HTTP 307 redirect to Google."""
    resp = client.get("/api/auth/oauth/google/login", follow_redirects=False)
    assert resp.status_code == 307
    location = resp.headers["location"]
    assert "accounts.google.com/o/oauth2/v2/auth" in location
    assert "code_challenge=" in location
    assert "code_challenge_method=S256" in location
