from fastapi import APIRouter, status
from app.db.repository import ConversationRepository
from app.schemas.settings import UserSettingsSchema
from app.core.config import get_settings

router = APIRouter()


@router.get(
    "",
    response_model=UserSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Get User Settings",
    description="Retrieve all persistent user settings, theme preferences, and AI instructions from SQLite.",
)
async def get_user_settings() -> UserSettingsSchema:
    """Load settings from SQLite database or provide default configuration."""
    raw_settings = await ConversationRepository.a_get_all_settings()
    # Merge with default schema values
    schema_dict = UserSettingsSchema().model_dump()
    for k, v in raw_settings.items():
        if k in schema_dict:
            schema_dict[k] = v
    return UserSettingsSchema(**schema_dict)


@router.put(
    "",
    response_model=UserSettingsSchema,
    status_code=status.HTTP_200_OK,
    summary="Update User Settings",
    description="Persist updated user settings, appearance preferences, and custom instructions to SQLite.",
)
async def update_user_settings(payload: UserSettingsSchema) -> UserSettingsSchema:
    """Validate and persist settings to SQLite."""
    data = payload.model_dump()
    updated = await ConversationRepository.a_set_multiple_settings(data)
    schema_dict = UserSettingsSchema().model_dump()
    for k, v in updated.items():
        if k in schema_dict:
            schema_dict[k] = v
    return UserSettingsSchema(**schema_dict)
