from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SkillItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    provider: str
    version: str
    icon: str
    permissions: List[str]
    is_builtin: bool
    is_featured: bool
    is_installed: bool
    is_enabled: bool
    installed_at: Optional[str] = None
    is_third_party: bool = False
    connection_status: str = "active"
    has_executable_runner: bool = False


class SkillsListResponse(BaseModel):
    skills: List[SkillItem]
    categories: List[str]
    total_count: int
    installed_count: int


class SkillInstallRequest(BaseModel):
    consent: bool = Field(..., description="User confirmation acknowledging required permissions")
    config: Optional[Dict[str, Any]] = None


class SkillToggleRequest(BaseModel):
    enabled: bool = Field(..., description="Enable or disable the installed skill")


class SkillExecuteRequest(BaseModel):
    params: Dict[str, Any] = Field(default_factory=dict, description="Parameters for skill execution")
    conversation_id: Optional[str] = None


class SkillExecuteResponse(BaseModel):
    execution_id: str
    skill_id: str
    skill_name: str
    status: str
    result: Optional[Dict[str, Any]] = None
    executed_at: str
