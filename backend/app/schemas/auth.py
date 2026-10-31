from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str
    primary_provider: Optional[str] = "email"
    avatar_url: Optional[str] = None
    last_login_at: Optional[str] = None
    linked_providers: Optional[List[str]] = None


class AuthResponse(BaseModel):
    user: UserResponse
    token: str
    mode: str = "authenticated"


class RegisterRequest(BaseModel):
    email: str = Field(..., description="Valid email address")
    username: str = Field(..., min_length=2, max_length=50, description="Display username")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")


class LoginRequest(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")


class GuestInfoResponse(BaseModel):
    mode: str = "guest"
    message: str = "Running in Guest Mode. Conversations are stored locally on this machine and are not synced across devices."


class OAuthUrlResponse(BaseModel):
    provider: str
    url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str = Field(..., description="Authorization code from OAuth provider")
    state: str = Field(..., description="CSRF state token returned by provider")
    redirect_uri: Optional[str] = Field(default=None, description="Callback redirect URI used during authorization")


class OAuthProviderStatus(BaseModel):
    enabled: bool
    client_id_configured: bool


class OAuthProvidersStatusResponse(BaseModel):
    google: OAuthProviderStatus
    github: OAuthProviderStatus


class LinkedProviderItem(BaseModel):
    provider: str
    provider_user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    created_at: str


class LinkedProvidersResponse(BaseModel):
    providers: List[LinkedProviderItem]


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="Account email to initiate recovery")


class ForgotPasswordResponse(BaseModel):
    status: str = "success"
    message: str
    reset_token: Optional[str] = None


class MigrateGuestConversationsRequest(BaseModel):
    conversation_ids: Optional[List[str]] = Field(default=None, description="Optional specific guest conversation IDs to migrate")


class MigrateGuestConversationsResponse(BaseModel):
    status: str = "success"
    migrated_count: int
    message: str
