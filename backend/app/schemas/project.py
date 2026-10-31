from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.conversation import ConversationResponse


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    icon: Optional[str] = Field(default="folder")
    visibility: Optional[str] = Field(default="private")


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    icon: Optional[str] = None
    visibility: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    id: str
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    joined_at: str


class ProjectInviteRequest(BaseModel):
    email: Optional[str] = None
    role: str = Field(default="member")
    expiry_days: int = Field(default=7, ge=1, le=30)


class ProjectInvitationResponse(BaseModel):
    id: str
    project_id: str
    inviter_user_id: str
    email: Optional[str] = None
    token: str
    role: str
    status: str
    expires_at: str
    created_at: str
    invite_url: Optional[str] = None


class ProjectFileResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    file_type: str
    file_size: int
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    created_at: str
    download_url: Optional[str] = None


class ProjectSkillResponse(BaseModel):
    skill_id: str
    name: str
    description: str
    icon: Optional[str] = None
    category: str
    is_enabled: bool


class ActivityEventResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    event_type: str
    details: Optional[str] = None
    created_at: str


class ProjectDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: str = "folder"
    visibility: str = "private"
    owner_id: str
    created_at: str
    updated_at: str
    current_user_role: str
    member_count: int = 1
    conversation_count: int = 0
    file_count: int = 0
    members: List[ProjectMemberResponse] = []
    conversations: List[ConversationResponse] = []
    files: List[ProjectFileResponse] = []
    skills: List[ProjectSkillResponse] = []
    recent_activity: List[ActivityEventResponse] = []
    pending_invitations: List[ProjectInvitationResponse] = []


class ProjectListItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: str = "folder"
    visibility: str = "private"
    current_user_role: str
    member_count: int = 1
    conversation_count: int = 0
    updated_at: str


class MoveConversationRequest(BaseModel):
    conversation_id: str

