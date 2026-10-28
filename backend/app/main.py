from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown routines."""
    settings = get_settings()
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.APP_ENV}]...")
    yield
    print(f"Shutting down {settings.APP_NAME}...")


def create_application() -> FastAPI:
    """Application factory for OmniAI FastAPI service."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="OmniAI Intelligent Multi-Model AI Chatbot API",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS middleware
    allowed_origins = settings.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
