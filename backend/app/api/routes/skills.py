from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status

from app.api.routes.auth import get_current_user_optional
from app.schemas.skills import (
    SkillItem,
    SkillsListResponse,
    SkillInstallRequest,
    SkillToggleRequest,
    SkillExecuteRequest,
    SkillExecuteResponse,
)
from app.services.skills_service import (
    list_skills,
    get_skill_by_id,
    install_skill,
    uninstall_skill,
    toggle_skill_status,
    execute_skill,
    list_skill_executions,
    SkillError,
)

router = APIRouter(prefix="/skills", tags=["Skills Marketplace"])

CATEGORIES = [
    "All",
    "Coding & Development",
    "Research & Web",
    "Productivity",
    "Data Analysis",
    "Documents & PDF",
    "Mathematics",
    "Automation",
    "Third-Party Integrations",
]


@router.get("", response_model=SkillsListResponse)
def get_skills_catalog(
    category: Optional[str] = Query(None, description="Category filter"),
    q: Optional[str] = Query(None, description="Search query"),
    installed_only: bool = Query(False, description="Filter for installed skills only"),
    featured_only: bool = Query(False, description="Filter for featured skills"),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Retrieve catalog of skills with installation state scoped to current user or guest."""
    user_id = user["id"] if user else None
    skills_data = list_skills(
        user_id=user_id,
        category=category,
        query=q,
        installed_only=installed_only,
        featured_only=featured_only,
    )
    all_user_skills = list_skills(user_id=user_id)
    installed_count = sum(1 for s in all_user_skills if s["is_installed"])

    return SkillsListResponse(
        skills=[SkillItem(**s) for s in skills_data],
        categories=CATEGORIES,
        total_count=len(skills_data),
        installed_count=installed_count,
    )


@router.get("/{skill_id}", response_model=SkillItem)
def get_skill_detail(
    skill_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Fetch details for an individual skill."""
    user_id = user["id"] if user else None
    skill = get_skill_by_id(skill_id, user_id=user_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return SkillItem(**skill)


@router.post("/{skill_id}/install", response_model=SkillItem)
def install_skill_endpoint(
    skill_id: str,
    payload: SkillInstallRequest,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Install a skill after explicit consent."""
    if not payload.consent:
        raise HTTPException(status_code=400, detail="User consent is required before installing this skill.")

    user_id = user["id"] if user else None
    try:
        updated = install_skill(skill_id, user_id=user_id, config=payload.config)
        return SkillItem(**updated)
    except SkillError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/{skill_id}/install")
def uninstall_skill_endpoint(
    skill_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Uninstall a skill."""
    user_id = user["id"] if user else None
    uninstall_skill(skill_id, user_id=user_id)
    return {"status": "uninstalled", "skill_id": skill_id, "message": "Skill uninstalled successfully."}


@router.patch("/{skill_id}/toggle", response_model=SkillItem)
def toggle_skill_endpoint(
    skill_id: str,
    payload: SkillToggleRequest,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Enable or disable an installed skill."""
    user_id = user["id"] if user else None
    try:
        updated = toggle_skill_status(skill_id, enabled=payload.enabled, user_id=user_id)
        return SkillItem(**updated)
    except SkillError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{skill_id}/execute", response_model=SkillExecuteResponse)
def execute_skill_endpoint(
    skill_id: str,
    payload: SkillExecuteRequest,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Execute an installed skill with parameters and record execution result."""
    user_id = user["id"] if user else None
    try:
        result = execute_skill(
            skill_id=skill_id,
            params=payload.params,
            user_id=user_id,
            conversation_id=payload.conversation_id,
        )
        return SkillExecuteResponse(**result)
    except SkillError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/executions/history")
def get_execution_history(
    limit: int = Query(50, ge=1, le=100),
    user: Optional[dict] = Depends(get_current_user_optional),
):
    """Retrieve skill execution log for the user or guest."""
    user_id = user["id"] if user else None
    history = list_skill_executions(user_id=user_id, limit=limit)
    return {"executions": history, "count": len(history)}
