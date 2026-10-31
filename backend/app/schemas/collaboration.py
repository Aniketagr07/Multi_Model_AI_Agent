from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr


class ShareSettingsUpdate(BaseModel):
    """Schema to update conversation public link sharing settings."""
    sharing_enabled: bool = Field(..., description="Enable or disable public link sharing")
    share_permission: str = Field(default="editor", description="Permission granted via link: 'editor' or 'viewer'")


class ConversationInviteRequest(BaseModel):
    """Schema for inviting a user via email or generating a direct invite token."""
    email: Optional[str] = Field(default=None, description="Email address of the invitee")
    role: str = Field(default="editor", description="Permission role: 'editor' or 'viewer'")
    expiry_days: int = Field(default=7, ge=1, le=30, description="Invitation validity duration in days")


class ConversationMemberResponse(BaseModel):
    """Schema representing an active member in a shared conversation."""
    id: str
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    joined_at: str


class ConversationInvitationResponse(BaseModel):
    """Schema representing an invitation to a conversation."""
    id: str
    conversation_id: str
    inviter_user_id: str
    email: Optional[str] = None
    token: str
    role: str
    status: str
    expires_at: str
    created_at: str
    invite_url: Optional[str] = None


class ShareDetailsResponse(BaseModel):
    """Schema returning full sharing configuration, members, and pending invites."""
    conversation_id: str
    title: str
    sharing_enabled: bool
    share_permission: str
    share_token: Optional[str] = None
    share_url: Optional[str] = None
    current_user_role: str
    owner: Optional[dict] = None
    members: List[ConversationMemberResponse] = []
    pending_invitations: List[ConversationInvitationResponse] = []


class AcceptInvitationRequest(BaseModel):
    """Schema to accept an invite token."""
    token: str


class JoinConversationResponse(BaseModel):
    """Schema returned after successfully accepting an invitation or opening link."""
    conversation_id: str
    role: str
    title: str
    message: str = "Joined conversation successfully"

