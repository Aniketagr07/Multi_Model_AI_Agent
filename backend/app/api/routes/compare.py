from fastapi import APIRouter, Depends, status
from app.schemas.compare import CompareRequest, CompareResponse
from app.services.comparison_service import ComparisonService, get_comparison_service

router = APIRouter()


@router.post(
    "/compare",
    response_model=CompareResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare Two AI Models Concurrently",
    description="Broadcasts a single user prompt concurrently to two distinct AI models and returns their responses and latencies side by side.",
)
async def compare_models(
    request: CompareRequest,
    comparison_service: ComparisonService = Depends(get_comparison_service),
) -> CompareResponse:
    """Execute concurrent multi-model response comparison."""
    return await comparison_service.compare_models(request)
