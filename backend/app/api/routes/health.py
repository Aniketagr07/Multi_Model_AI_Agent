from fastapi import APIRouter
from app.core.config import get_settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the current operational status, application name, and version.",
)
def check_health() -> HealthResponse:
    """Check backend service health."""
    settings = get_settings()
    return HealthResponse(
        app_name=settings.APP_NAME,
        status="healthy",
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
    )
