"""
API Route Handlers for Bring Your Own API Key (BYOK) system.
Enforces authentication, validation, encryption, and scoped access.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.api.routes.auth import get_current_user_required
from app.schemas.byok import (
    BYOKStatusResponse,
    BYOKValidateRequest,
    BYOKValidateResponse,
    BYOKSaveRequest,
    BYOKSaveResponse,
)
from app.services.byok_service import BYOKService

router = APIRouter(prefix="/byok", tags=["BYOK API Keys"])


@router.get(
    "/status",
    response_model=BYOKStatusResponse,
    summary="Get User BYOK Connection Status",
    description="Returns list of supported providers with connection status and masked key fingerprints. Never exposes raw keys.",
)
async def get_byok_status(
    user: dict = Depends(get_current_user_required),
) -> BYOKStatusResponse:
    return BYOKService.get_user_status(user["id"])


@router.post(
    "/validate",
    response_model=BYOKValidateResponse,
    summary="Test Provider API Key",
    description="Validates an API key directly against the upstream provider's live endpoint without persisting it.",
)
async def validate_byok_key(
    request: BYOKValidateRequest,
    user: dict = Depends(get_current_user_required),
) -> BYOKValidateResponse:
    is_valid, status_label, message = await BYOKService.validate_provider_key(
        request.provider, request.api_key
    )
    return BYOKValidateResponse(
        success=is_valid,
        provider=request.provider,
        status=status_label,
        message=message,
    )


@router.post(
    "/save",
    response_model=BYOKSaveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save and Encrypt Provider API Key",
    description="Validates the key against the live API, encrypts it with Fernet at rest, and associates it with the authenticated user.",
)
async def save_byok_key(
    request: BYOKSaveRequest,
    user: dict = Depends(get_current_user_required),
) -> BYOKSaveResponse:
    return await BYOKService.save_user_key(user["id"], request.provider, request.api_key)


@router.delete(
    "/{provider}",
    summary="Remove Provider API Key",
    description="Deletes encrypted credentials for a provider from the user's account.",
)
async def delete_byok_key(
    provider: str,
    user: dict = Depends(get_current_user_required),
) -> dict:
    return BYOKService.delete_user_key(user["id"], provider)

