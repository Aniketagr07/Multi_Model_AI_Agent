import pytest
import logging
from fastapi.testclient import TestClient
from app.main import create_application
from app.core.config import get_settings
from app.core.logging_config import SecretMaskingFilter
from app.core.security import InMemoryRateLimiter


def test_secret_masking_filter():
    """Verify API keys and bearer tokens are properly redacted from log records."""
    log_filter = SecretMaskingFilter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Connecting with Gemini key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q and Groq key gsk_1234567890abcdef1234567890abcdef1234567890abcdef",
        args=(),
        exc_info=None,
    )
    log_filter.filter(record)
    assert "AIzaSy" not in record.msg
    assert "[REDACTED_GEMINI_KEY]" in record.msg
    assert "gsk_" not in record.msg
    assert "[REDACTED_GROQ_KEY]" in record.msg


def test_in_memory_rate_limiter():
    """Verify rate limiter blocks after reaching limit within rolling window."""
    limiter = InMemoryRateLimiter(requests_per_minute=3)
    client_ip = "192.168.1.100"

    # First 3 requests allowed
    assert limiter.is_allowed(client_ip)[0] is True
    assert limiter.is_allowed(client_ip)[0] is True
    assert limiter.is_allowed(client_ip)[0] is True

    # 4th request blocked
    allowed, retry_after = limiter.is_allowed(client_ip)
    assert allowed is False
    assert retry_after >= 1


def test_payload_size_limit_rejection(monkeypatch):
    """Verify requests exceeding MAX_REQUEST_SIZE_BYTES are rejected with HTTP 413."""
    app = create_application()
    client = TestClient(app)

    # Simulate request with excessive Content-Length header
    response = client.post(
        "/api/chat",
        headers={"Content-Length": str(20 * 1024 * 1024)},  # 20 MB > 15 MB limit
        json={"message": "hello"},
    )
    assert response.status_code == 413
    assert "Payload Too Large" in response.json()["detail"]


def test_single_user_auth_token_enforcement(monkeypatch):
    """Verify single-user authentication token when configured."""
    settings = get_settings()
    monkeypatch.setattr(settings, "APP_ACCESS_TOKEN", "prod-secret-access-token-999")

    app = create_application()
    client = TestClient(app)

    # 1. Health endpoint remains accessible without token
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200

    # 2. Root endpoint remains accessible without token
    root_resp = client.get("/")
    assert root_resp.status_code == 200

    # 3. Protected endpoint without token returns 401
    unauth_resp = client.get("/api/models")
    assert unauth_resp.status_code == 401

    # 4. Protected endpoint with invalid token returns 401
    bad_token_resp = client.get("/api/models", headers={"Authorization": "Bearer wrong-token"})
    assert bad_token_resp.status_code == 401

    # 5. Protected endpoint with valid Bearer token succeeds
    valid_bearer_resp = client.get("/api/models", headers={"Authorization": "Bearer prod-secret-access-token-999"})
    assert valid_bearer_resp.status_code == 200

    # 6. Protected endpoint with valid X-OmniAI-Token header succeeds
    valid_header_resp = client.get("/api/models", headers={"X-OmniAI-Token": "prod-secret-access-token-999"})
    assert valid_header_resp.status_code == 200


def test_security_headers_present():
    """Verify defensive HTTP security headers on responses."""
    app = create_application()
    client = TestClient(app)

    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "Permissions-Policy" in resp.headers
