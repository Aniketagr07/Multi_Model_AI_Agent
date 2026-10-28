from datetime import datetime, timezone
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for system health check response."""

    app_name: str = Field(..., description="Name of the application")
    status: str = Field(..., description="Operational status of the service (e.g. 'healthy')")
    version: str = Field(..., description="Application semantic version")
    environment: str = Field(default="development", description="Current execution environment")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO 8601 UTC timestamp of the health check",
    )
