from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: str


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
