import pytest
from app.main import app, create_application
from app.api.routes.health import check_health
from app.core.config import get_settings
from app.schemas.health import HealthResponse


def test_settings_configuration():
    """Verify application configuration defaults and parsing."""
    settings = get_settings()
    assert settings.APP_NAME == "OmniAI Backend"
    assert settings.APP_VERSION == "0.1.0"
    assert "http://localhost:5173" in settings.cors_origins_list


def test_health_function_contract():
    """Verify health handler returns a valid HealthResponse schema."""
    health: HealthResponse = check_health()
    assert health.app_name == "OmniAI Backend"
    assert health.status == "healthy"
    assert health.version == "0.1.0"
    assert health.environment in ("development", "production", "test")
    assert health.timestamp is not None
    data = health.model_dump()
    assert "app_name" in data
    assert "status" in data
    assert "version" in data


def test_app_routing_and_endpoints():
    """Verify that expected endpoints and CORS middlewares are mounted."""
    paths = list(app.openapi()["paths"].keys())
    # Verify root and health routes are mounted
    assert "/" in paths
    assert "/api/health" in paths
    assert "get" in app.openapi()["paths"]["/api/health"]
    assert "get" in app.openapi()["paths"]["/"]


def test_root_endpoint_logic():
    """Verify root endpoint payload format and metadata."""
    # Find root route endpoint function
    root_route = next(r for r in app.routes if getattr(r, "path", None) == "/")
    response = root_route.endpoint()
    assert response["status"] == "operational"
    assert response["name"] == "OmniAI Backend"
    assert response["version"] == "0.1.0"
    assert response["health"] == "/api/health"
