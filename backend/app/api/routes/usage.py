from fastapi import APIRouter, status
from typing import Dict, Any
from app.db.repository import ConversationRepository

router = APIRouter()


@router.get(
    "/usage",
    status_code=status.HTTP_200_OK,
    summary="Get Local Model Usage Analytics",
    description="Returns sliding 5-hour and 7-day usage metrics, remaining quota percentages, and reset countdowns across providers.",
)
async def get_model_usage() -> Dict[str, Any]:
    """Retrieve sliding window usage tracking across AI model providers."""
    return await ConversationRepository.a_get_usage_analytics()

