from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.chat import router as chat_router
from app.api.routes.compare import router as compare_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.documents import router as documents_router
from app.api.routes.settings import router as settings_router

api_router = APIRouter()

# Mount health routes at /api/health
api_router.include_router(health_router, prefix="", tags=["Health"])

# Mount chat routes at /api/chat & /api/models
api_router.include_router(chat_router, prefix="", tags=["Chat"])

# Mount comparison routes at /api/compare
api_router.include_router(compare_router, prefix="", tags=["Compare"])

# Mount conversation routes at /api/conversations
api_router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])

# Mount document upload and processing routes at /api/documents
api_router.include_router(documents_router, prefix="/documents", tags=["Documents"])

# Mount user settings routes at /api/settings
api_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
