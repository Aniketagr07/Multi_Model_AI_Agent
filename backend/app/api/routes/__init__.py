from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.chat import router as chat_router

api_router = APIRouter()

# Mount health routes at /api/health
api_router.include_router(health_router, prefix="", tags=["Health"])

# Mount chat routes at /api/chat
api_router.include_router(chat_router, prefix="", tags=["Chat"])
