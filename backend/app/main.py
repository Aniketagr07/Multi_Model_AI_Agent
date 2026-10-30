import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.core.security import (
    SecurityHeadersMiddleware,
    SingleUserAuthMiddleware,
    RateLimiterMiddleware,
    RequestSizeLimitMiddleware,
)
from app.api.routes import api_router
from app.db.database import init_db

# Configure sanitized logging
setup_logging(get_settings().LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown routines."""
    settings = get_settings()
    logger.info("Starting %s v%s [Env: %s | Debug: %s]...", settings.APP_NAME, settings.APP_VERSION, settings.APP_ENV, settings.DEBUG)
    # Initialize SQLite database schema
    init_db()
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


def create_application() -> FastAPI:
    """Application factory for OmniAI FastAPI service."""
    settings = get_settings()

    docs_url = "/docs" if settings.docs_enabled else None
    redoc_url = "/redoc" if settings.docs_enabled else None
    openapi_url = "/openapi.json" if settings.docs_enabled else None

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="OmniAI Intelligent Multi-Model AI Chatbot API",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    # Core Security Middlewares (evaluated in order)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(SingleUserAuthMiddleware)
    app.add_middleware(RateLimiterMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)

    # Configure CORS middleware
    allowed_origins = settings.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global unhandled exception handler to prevent leaking internal stack traces
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred. Please try again later."},
        )

    # Root endpoint with basic API information
    @app.get(
        "/",
        summary="Root API Info",
        description="Returns basic information regarding the OmniAI service and documentation links.",
    )
    def root_info() -> Dict[str, Any]:
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "operational",
            "message": "Welcome to the OmniAI Backend Service",
            "docs": "/docs",
            "health": "/api/health",
        }

    # Mount modular API routes under /api
    app.include_router(api_router, prefix="/api")

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
