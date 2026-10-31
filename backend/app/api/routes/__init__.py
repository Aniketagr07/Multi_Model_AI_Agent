from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.chat import router as chat_router
from app.api.routes.compare import router as compare_router
from app.api.routes.collaboration import router as collaboration_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.documents import router as documents_router
from app.api.routes.settings import router as settings_router
from app.api.routes.usage import router as usage_router
from app.api.routes.auth import router as auth_router
from app.api.routes.skills import router as skills_router
from app.api.routes.projects import router as projects_router

api_router = APIRouter()

# Mount health routes at /api/health
api_router.include_router(health_router, prefix="", tags=["Health"])

# Mount chat routes at /api/chat & /api/models
api_router.include_router(chat_router, prefix="", tags=["Chat"])

# Mount comparison routes at /api/compare
api_router.include_router(compare_router, prefix="", tags=["Compare"])

# Mount collaboration routes at /api/conversations
api_router.include_router(collaboration_router, prefix="/conversations", tags=["Collaboration"])

# Mount conversation routes at /api/conversations
api_router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])

# Mount document upload and processing routes at /api/documents
api_router.include_router(documents_router, prefix="/documents", tags=["Documents"])

# Mount user settings routes at /api/settings
api_router.include_router(settings_router, prefix="/settings", tags=["Settings"])

# Mount model usage analytics at /api/usage
api_router.include_router(usage_router, prefix="", tags=["Usage"])

# Mount user authentication routes at /api/auth
api_router.include_router(auth_router, prefix="", tags=["Authentication"])

# Mount skills marketplace routes at /api/skills
api_router.include_router(skills_router, prefix="", tags=["Skills Marketplace"])

# Mount collaborative projects routes at /api/projects
api_router.include_router(projects_router, prefix="/projects", tags=["Collaborative Projects"])
