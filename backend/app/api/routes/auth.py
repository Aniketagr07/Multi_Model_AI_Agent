from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
    GuestInfoResponse,
)
from app.services.auth_service import (
    register_user,
    authenticate_user,
    get_user_by_token,
    logout_user,
    delete_user_account,
    AuthError,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Dependency returning the authenticated user dictionary if a valid Bearer token is provided, else None."""
    if not authorization:
        return None
    return get_user_by_token(authorization)


def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency requiring an authenticated user with a valid session token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_token(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    """Register a new user account with email and password."""
    try:
        data = register_user(req.email, req.username, req.password)
        return AuthResponse(**data)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """Authenticate an existing user and return a session token."""
    try:
        data = authenticate_user(req.email, req.password)
        return AuthResponse(**data)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Revoke and invalidate the active session token."""
    if authorization:
        logout_user(authorization)
    return {"status": "logged_out", "message": "Successfully signed out."}


@router.get("/me", response_model=UserResponse)
def get_current_user(user: dict = Depends(get_current_user_required)):
    """Fetch profile data of the currently signed-in user."""
    return UserResponse(**user)


@router.get("/guest", response_model=GuestInfoResponse)
def get_guest_info():
    """Information endpoint for Guest mode explaining storage boundaries."""
    return GuestInfoResponse()


@router.delete("/account")
def delete_account(user: dict = Depends(get_current_user_required)):
    """Permanently delete user account and all personal conversation data."""
    delete_user_account(user["id"])
    return {
        "status": "deleted",
        "message": "Account and all associated conversations were permanently deleted.",
    }

