import uuid
import pytest
from app.core.encryption import encrypt_api_key, decrypt_api_key, mask_api_key
from app.services.byok_service import BYOKService
from app.services.auth_service import register_user


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


def test_byok_api_lifecycle_and_user_isolation():
    """
    Test complete BYOK lifecycle:
    1. User A registers and checks status (no keys, byok_setup_completed is False).
    2. User A saves Groq key.
    3. User A status reflects connected Groq key and byok_setup_completed is True.
    4. User B registers and checks status -> isolation: User B has NO keys.
    5. User A deletes key -> byok_setup_completed resets to False.
    """
    # 1. Register User A
    uid = uuid.uuid4().hex[:6]
    user_a = register_user(f"byok_user_a_{uid}@example.com", f"UserA_{uid}", "Password123!")
    user_a_id = user_a["user"]["id"]

    # Initial status
    data = BYOKService.get_user_status(user_a_id)
    assert data.has_active_provider is False
    assert data.byok_setup_completed is False
    groq_status = next(p for p in data.providers if p.provider == "groq")
    assert groq_status.is_connected is False

    # 2. Save Groq key
    save_data = BYOKService.save_user_credential_direct(user_a_id, "groq", "gsk_mySecretGroqKey9999")
    assert save_data.provider == "groq"
    assert save_data.success is True
    assert save_data.key_fingerprint.endswith("9999")
    assert "gsk_mySecret" not in save_data.key_fingerprint

    # 3. User A status check
    data_after = BYOKService.get_user_status(user_a_id)
    assert data_after.has_active_provider is True
    assert data_after.byok_setup_completed is True
    groq_item = next(p for p in data_after.providers if p.provider == "groq")
    assert groq_item.is_connected is True
    assert groq_item.key_fingerprint.endswith("9999")

    # Verify decrypted key retrieval inside backend for User A
    decrypted = BYOKService.get_decrypted_user_key(user_a_id, "groq")
    assert decrypted == "gsk_mySecretGroqKey9999"

    # 4. User B registers and checks isolation
    user_b = register_user(f"byok_user_b_{uid}@example.com", f"UserB_{uid}", "Password123!")
    user_b_id = user_b["user"]["id"]

    data_b = BYOKService.get_user_status(user_b_id)
    assert data_b.has_active_provider is False
    assert data_b.byok_setup_completed is False
    for p in data_b.providers:
        assert p.is_connected is False
        assert p.key_fingerprint is None

    # User B cannot decrypt User A's key
    assert BYOKService.get_decrypted_user_key(user_b_id, "groq") is None

    # 5. User A deletes key
    del_resp = BYOKService.delete_user_key(user_a_id, "groq")
    assert del_resp["success"] is True

    # User A status is now disconnected
    resp_final = BYOKService.get_user_status(user_a_id)
    assert resp_final.has_active_provider is False
    assert resp_final.byok_setup_completed is False


def test_three_providers_connection_and_persistence():
    """Verify connecting Gemini, Groq, and OpenAI: all 3 appear, persist, and do not overwrite each other."""
    uid = uuid.uuid4().hex[:6]
    user = register_user(f"multi_prov_user_{uid}@example.com", f"MultiUser_{uid}", "Password123!")
    user_id = user["user"]["id"]

    # 1. Connect Gemini
    BYOKService.save_user_credential_direct(user_id, "gemini", "AIzaSyGeminiTestKey1234")
    status1 = BYOKService.get_user_status(user_id)
    assert status1.total_connected == 1
    assert any(p.provider == "gemini" and p.is_connected for p in status1.providers)

    # 2. Connect Groq (does not overwrite Gemini)
    BYOKService.save_user_credential_direct(user_id, "groq", "gsk_GroqTestKey5678")
    status2 = BYOKService.get_user_status(user_id)
    assert status2.total_connected == 2
    assert any(p.provider == "gemini" and p.is_connected for p in status2.providers)
    assert any(p.provider == "groq" and p.is_connected for p in status2.providers)

    # 3. Connect OpenAI (does not overwrite Gemini or Groq)
    BYOKService.save_user_credential_direct(user_id, "openai", "sk-proj-OpenAITestKey9999")
    status3 = BYOKService.get_user_status(user_id)
    assert status3.total_connected == 3

    # Confirm all 3 appear connected
    connected_ids = [p.provider for p in status3.providers if p.is_connected]
    assert set(connected_ids) == {"gemini", "groq", "openai"}

    # Confirm decrypted keys are isolated and correct
    assert BYOKService.get_decrypted_user_key(user_id, "gemini") == "AIzaSyGeminiTestKey1234"
    assert BYOKService.get_decrypted_user_key(user_id, "groq") == "gsk_GroqTestKey5678"
    assert BYOKService.get_decrypted_user_key(user_id, "openai") == "sk-proj-OpenAITestKey9999"

    # 4. Remove one provider (Groq) and confirm the remaining two persist
    BYOKService.delete_user_key(user_id, "groq")
    status_after_delete = BYOKService.get_user_status(user_id)
    assert status_after_delete.total_connected == 2
    remaining = [p.provider for p in status_after_delete.providers if p.is_connected]
    assert set(remaining) == {"gemini", "openai"}
    assert BYOKService.get_decrypted_user_key(user_id, "gemini") == "AIzaSyGeminiTestKey1234"
    assert BYOKService.get_decrypted_user_key(user_id, "openai") == "sk-proj-OpenAITestKey9999"


def test_list_user_active_providers():
    """Verify list_user_active_providers accurately reports active providers."""
    uid = uuid.uuid4().hex[:6]
    user = register_user(f"list_prov_user_{uid}@example.com", f"ListUser_{uid}", "Password123!")
    user_id = user["user"]["id"]

    assert BYOKService.list_user_active_providers(user_id) == []

    BYOKService.save_user_credential_direct(user_id, "gemini", "AIzaSyKey1")
    BYOKService.save_user_credential_direct(user_id, "groq", "gsk_Key2")
    BYOKService.save_user_credential_direct(user_id, "openai", "sk-Key3")

    active = BYOKService.list_user_active_providers(user_id)
    assert sorted(active) == ["gemini", "groq", "openai"]
