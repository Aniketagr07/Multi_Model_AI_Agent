import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.encryption import encrypt_api_key, decrypt_api_key, mask_api_key
from app.services.byok_service import BYOKService
from app.services.auth_service import register_user

client = TestClient(app)


def test_encryption_decryption_and_tampering():
    """Verify Fernet encryption, decryption roundtrip, masking, and tampering detection."""
    test_key = "AIzaSyD-sampleGeminiApiKey1234567890"
    encrypted = encrypt_api_key(test_key)

    assert encrypted != test_key
    assert isinstance(encrypted, str)

    # Decrypt roundtrip
    decrypted = decrypt_api_key(encrypted)
    assert decrypted == test_key

    # Masking
    masked = mask_api_key(test_key)
    assert masked.endswith("7890")
    assert "••••••••••••" in masked
    assert "AIzaSy" not in masked

    # Tampering detection
    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(ValueError, match="corrupted"):
        decrypt_api_key(tampered)


def test_live_provider_validation_responses():
    """Verify live validation status messaging for Gemini and Groq with mocked HTTP responses."""
    # Test valid Gemini key
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"models": [{"name": "models/gemini-2.5-flash"}]}
        mock_get.return_value = mock_resp

        val = asyncio.run(BYOKService.validate_provider_key("gemini", "AIzaSyValidGeminiKey123"))
        assert val[0] is True
        assert val[1] == "Connected Successfully"

    # Test invalid Gemini key (400)
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"error": {"message": "API key not valid"}}
        mock_get.return_value = mock_resp

        val = asyncio.run(BYOKService.validate_provider_key("gemini", "AIzaSyInvalidKey"))
        assert val[0] is False
        assert val[1] == "Invalid API Key"

    # Test Groq rate limit (429)
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.json.return_value = {"error": {"message": "Rate limit reached"}}
        mock_get.return_value = mock_resp

        val = asyncio.run(BYOKService.validate_provider_key("groq", "gsk_testRateLimitKey"))
        assert val[0] is False
        assert val[1] == "Provider Rate Limit Reached"

    # Test Groq 503 service unavailable
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        mock_resp.json.return_value = {}
        mock_get.return_value = mock_resp

        val = asyncio.run(BYOKService.validate_provider_key("groq", "gsk_test503Key"))
        assert val[0] is False
        assert val[1] == "Provider Service Unavailable"


def test_byok_api_lifecycle_and_user_isolation():
    """
    Test complete BYOK lifecycle:
    1. User A registers and checks status (no keys, byok_setup_completed is False).
    2. User A validates and saves Groq key.
    3. User A status reflects connected Groq key and byok_setup_completed is True.
    4. User B registers and checks status -> isolation: User B has NO keys.
    5. User A deletes key -> byok_setup_completed resets to False.
    """
    # 1. Register User A
    user_a = register_user("byok_user_a@example.com", "UserA", "Password123!")
    token_a = user_a["token"]
    user_a_id = user_a["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Initial status
    resp = client.get("/api/byok/status", headers=headers_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_active_provider"] is False
    assert data["byok_setup_completed"] is False
    groq_status = next(p for p in data["providers"] if p["provider"] == "groq")
    assert groq_status["is_connected"] is False

    # 2. Validate Groq key
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"id": "llama-3.3-70b-versatile"}]}
        mock_get.return_value = mock_resp

        val_resp = client.post(
            "/api/byok/validate",
            headers=headers_a,
            json={"provider": "groq", "api_key": "gsk_mySecretGroqKey9999"},
        )
        assert val_resp.status_code == 200
        assert val_resp.json()["success"] is True
        assert val_resp.json()["status"] == "Connected Successfully"

        # Save Groq key
        save_resp = client.post(
            "/api/byok/save",
            headers=headers_a,
            json={"provider": "groq", "api_key": "gsk_mySecretGroqKey9999"},
        )
        assert save_resp.status_code == 201
        save_data = save_resp.json()
        assert save_data["provider"] == "groq"
        assert save_data["success"] is True
        assert save_data["key_fingerprint"].endswith("9999")
        assert "gsk_mySecret" not in save_data["key_fingerprint"]

    # 3. User A status check
    resp_after = client.get("/api/byok/status", headers=headers_a)
    data_after = resp_after.json()
    assert data_after["has_active_provider"] is True
    assert data_after["byok_setup_completed"] is True
    groq_item = next(p for p in data_after["providers"] if p["provider"] == "groq")
    assert groq_item["is_connected"] is True
    assert groq_item["key_fingerprint"].endswith("9999")

    # Verify decrypted key retrieval inside backend for User A
    decrypted = BYOKService.get_decrypted_user_key(user_a_id, "groq")
    assert decrypted == "gsk_mySecretGroqKey9999"

    # 4. User B registers and checks isolation
    user_b = register_user("byok_user_b@example.com", "UserB", "Password123!")
    token_b = user_b["token"]
    user_b_id = user_b["user"]["id"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    resp_b = client.get("/api/byok/status", headers=headers_b)
    data_b = resp_b.json()
    assert data_b["has_active_provider"] is False
    assert data_b["byok_setup_completed"] is False
    for p in data_b["providers"]:
        assert p["is_connected"] is False
        assert p["key_fingerprint"] is None

    # User B cannot decrypt User A's key
    assert BYOKService.get_decrypted_user_key(user_b_id, "groq") is None

    # 5. User A deletes key
    del_resp = client.delete("/api/byok/groq", headers=headers_a)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # User A status is now disconnected
    resp_final = client.get("/api/byok/status", headers=headers_a)
    assert resp_final.json()["has_active_provider"] is False
    assert resp_final.json()["byok_setup_completed"] is False


def test_auto_routing_filters_by_user_active_providers():
    """Verify that auto-routing limits available models strictly to the authenticated user's active providers."""
    # Register user and add only Groq key
    user = register_user("groq_only_user@example.com", "GroqUser", "Password123!")
    user_id = user["user"]["id"]
    token = user["token"]
    headers = {"Authorization": f"Bearer {token}"}

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"id": "llama-3.3-70b-versatile"}]}
        mock_get.return_value = mock_resp

        client.post(
            "/api/byok/save",
            headers=headers,
            json={"provider": "groq", "api_key": "gsk_groqExclusiveKey1234"},
        )

    # Active providers should be ['groq']
    active_provs = BYOKService.list_user_active_providers(user_id)
    assert active_provs == ["groq"]

    # When sending a chat request in auto mode
    with patch("app.providers.groq_provider.GroqProvider.generate_response", return_value="Mocked response from Groq"):
        chat_resp = client.post(
            "/api/chat",
            headers=headers,
            json={"message": "Write a python script to sort a list", "model_id": "auto"},
        )
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        assert chat_data["routed"] is True
        # Provider chosen MUST be groq, not gemini
        assert chat_data["provider"] == "groq"
        assert chat_data["model_id"] in ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

