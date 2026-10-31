"""
Pydantic schemas for Bring Your Own API Key (BYOK) credential management.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ProviderCredentialItem(BaseModel):
    provider: str = Field(..., description="Provider identifier (gemini, groq, openai, anthropic)")
    name: str = Field(..., description="Human-readable provider name")
    is_connected: bool = Field(..., description="Whether user has an active validated key")
    key_fingerprint: Optional[str] = Field(None, description="Masked key fingerprint (e.g. ••••••••••••a8K2)")
    connection_status: str = Field("disconnected", description="active, disconnected, error, revoked")
    last_validated_at: Optional[str] = Field(None, description="ISO timestamp of last successful API validation")


class BYOKStatusResponse(BaseModel):
    byok_setup_completed: bool = Field(..., description="Whether user has completed BYOK setup with at least one key")
    has_active_provider: bool = Field(False, description="Whether user has at least one active configured provider")
    total_connected: int = Field(..., description="Count of active user-configured providers")
    providers: List[ProviderCredentialItem]


class BYOKValidateRequest(BaseModel):
    provider: str = Field(..., description="AI Provider (gemini or groq)")
    api_key: str = Field(..., min_length=8, description="API Key to test against upstream provider")


class BYOKValidateResponse(BaseModel):
    success: bool
    provider: str
    status: str = Field(..., description="Status summary (e.g. 'Connected Successfully', 'Invalid API Key')")
    message: str


class BYOKSaveRequest(BaseModel):
    provider: str = Field(..., description="AI Provider (gemini or groq)")
    api_key: str = Field(..., min_length=8, description="Raw API key to encrypt and save")


class BYOKSaveResponse(BaseModel):
    success: bool
    provider: str
    key_fingerprint: str
    message: str
    byok_setup_completed: bool
