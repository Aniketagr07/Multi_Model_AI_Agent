from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse

from app.api.routes.auth import get_current_user_required, get_current_user_optional
from app.services.project_service import ProjectService
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectDetailResponse,
    ProjectListItemResponse,
    ProjectInviteRequest,
    ProjectInvitationResponse,
    ProjectFileResponse,
    MoveConversationRequest,
)

router = APIRouter()


@router.get(
    "",
    response_model=List[ProjectListItemResponse],
    summary="List User Projects",
    description="Retrieve all projects the authenticated user owns or is a member of.",
)
async def list_projects(
    user: dict = Depends(get_current_user_required),
) -> List[ProjectListItemResponse]:
    return ProjectService.list_user_projects(user)


@router.post(
    "",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Project",
    description="Initialize a new collaborative project workspace.",
)
async def create_project(
    payload: ProjectCreate,
    user: dict = Depends(get_current_user_required),
) -> ProjectDetailResponse:
    return ProjectService.create_project(payload, user)


@router.get(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="Get Project Details",
    description="Fetch full project workspace metadata, conversations, members, files, and activity.",
)
async def get_project(
    project_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> ProjectDetailResponse:
    return ProjectService.get_project_detail(project_id, user)


@router.patch(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="Update Project",
    description="Update project workspace metadata (Owner/Admin only).",
)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: dict = Depends(get_current_user_required),
) -> ProjectDetailResponse:
    return ProjectService.update_project(project_id, payload, user)


@router.delete(
    "/{project_id}",
    summary="Delete Project",
    description="Delete project workspace and cascaded assets (Owner only).",
)
async def delete_project(
    project_id: str,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.delete_project(project_id, user)


@router.post(
    "/{project_id}/invitations",
    response_model=ProjectInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite Project Member",
)
async def invite_member(
    project_id: str,
    payload: ProjectInviteRequest,
    user: dict = Depends(get_current_user_required),
) -> ProjectInvitationResponse:
    return ProjectService.create_invitation(
        project_id=project_id,
        user=user,
        email=payload.email,
        role=payload.role,
        expiry_days=payload.expiry_days,
    )


@router.post(
    "/join/{token}",
    summary="Join Project via Invitation Token",
)
async def join_project(
    token: str,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.accept_invitation(token, user)


@router.patch(
    "/{project_id}/members/{target_user_id}",
    summary="Update Member Role",
)
async def update_member_role(
    project_id: str,
    target_user_id: str,
    role: str,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.update_member_role(project_id, target_user_id, role, user)


@router.delete(
    "/{project_id}/members/{target_user_id}",
    summary="Remove Member or Leave Project",
)
async def remove_member(
    project_id: str,
    target_user_id: str,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.remove_member(project_id, target_user_id, user)


@router.post(
    "/{project_id}/conversations/move",
    summary="Move Conversation into Project",
)
async def move_conversation(
    project_id: str,
    payload: MoveConversationRequest,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.move_conversation_to_project(project_id, payload.conversation_id, user)


@router.patch(
    "/{project_id}/skills/{skill_id}",
    summary="Toggle Project Skill",
)
async def toggle_project_skill(
    project_id: str,
    skill_id: str,
    is_enabled: bool,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.toggle_project_skill(project_id, skill_id, is_enabled, user)


@router.post(
    "/{project_id}/files",
    response_model=ProjectFileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Project Document",
)
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user_required),
) -> ProjectFileResponse:
    return await ProjectService.upload_project_file(project_id, file, user)


@router.get(
    "/{project_id}/files/{file_id}/download",
    summary="Download Project Document",
)
async def download_file(
    project_id: str,
    file_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    role = ProjectService.get_project_role(project_id, user)
    if role == "none":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this project file.")

    from app.db.database import get_db_connection
    with get_db_connection() as conn:
        f_cur = conn.execute("SELECT filename, storage_path FROM project_files WHERE id = ? AND project_id = ?;", (file_id, project_id))
        rec = f_cur.fetchone()
        if not rec or not Path(rec["storage_path"]).exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk.")

        return FileResponse(
            path=rec["storage_path"],
            filename=rec["filename"],
            media_type="application/octet-stream",
        )


@router.delete(
    "/{project_id}/files/{file_id}",
    summary="Delete Project Document",
)
async def delete_file(
    project_id: str,
    file_id: str,
    user: dict = Depends(get_current_user_required),
):
    return ProjectService.delete_project_file(project_id, file_id, user)

