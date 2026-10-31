from typing import Optional, List
import urllib.parse
from fastapi import APIRouter, Depends, Header, Request, Response, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
    GuestInfoResponse,
    OAuthUrlResponse,
    OAuthCallbackRequest,
    OAuthProvidersStatusResponse,
    OAuthProviderStatus,
    LinkedProvidersResponse,
    LinkedProviderItem,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    MigrateGuestConversationsRequest,
    MigrateGuestConversationsResponse,
)
from app.services.auth_service import (
    register_user,
    authenticate_user,
    get_user_by_token,
    logout_user,
    delete_user_account,
    get_google_auth_url,
    handle_google_callback,
    get_github_auth_url,
    handle_github_callback,
    get_linked_providers,
    unlink_provider,
    request_password_reset,
    migrate_guest_conversations,
    AuthError,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# -----------------------------------------------------------------------------
# Cookie & Token Helpers
# -----------------------------------------------------------------------------

def set_auth_cookie(response: Response, token: str) -> None:
    """Set secure HTTP-only session cookie with SameSite protection."""
    settings = get_settings()
    response.set_cookie(
        key="omniai_session",
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=30 * 86400,  # 30 days
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear HTTP-only session cookie upon logout."""
    response.delete_cookie(key="omniai_session", path="/")


def extract_token_from_request(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    """Extract session token from Authorization header or HTTP-only session cookie."""
    if authorization and authorization.strip():
        val = authorization.strip()
        if val.startswith("Bearer "):
            return val[7:].strip()
        return val
    return request.cookies.get("omniai_session")


# -----------------------------------------------------------------------------
# FastApi Dependencies
# -----------------------------------------------------------------------------

def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[dict]:
    """Dependency returning authenticated user if token present in header or cookie, else None."""
    token = extract_token_from_request(request, authorization)
    if not token:
        return None
    return get_user_by_token(token)


def get_current_user_required(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> dict:
    """Dependency requiring an authenticated user with a valid, non-expired session."""
    token = extract_token_from_request(request, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# -----------------------------------------------------------------------------
# Authentication Endpoints
# -----------------------------------------------------------------------------

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, response: Response):
    """Register a new user account with email and password."""
    try:
        data = register_user(req.email, req.username, req.password)
        set_auth_cookie(response, data["token"])
        return AuthResponse(**data)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, response: Response):
    """Authenticate an existing user, return session token, and set HTTP-only cookie."""
    try:
        data = authenticate_user(req.email, req.password)
        set_auth_cookie(response, data["token"])
        return AuthResponse(**data)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/logout")
def logout(request: Request, response: Response, authorization: Optional[str] = Header(None)):
    """Revoke and invalidate the active session token and clear session cookie."""
    token = extract_token_from_request(request, authorization)
    if token:
        logout_user(token)
    clear_auth_cookie(response)
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
def delete_account(response: Response, user: dict = Depends(get_current_user_required)):
    """Permanently delete user account, associated conversations, and clear cookie."""
    delete_user_account(user["id"])
    clear_auth_cookie(response)
    return {
        "status": "deleted",
        "message": "Account and all associated conversations were permanently deleted.",
    }


# -----------------------------------------------------------------------------
# OAuth Endpoints (Google & GitHub)
# -----------------------------------------------------------------------------

@router.get("/oauth/providers", response_model=OAuthProvidersStatusResponse)
def get_oauth_providers_status():
    """Return availability and configuration status of Google and GitHub OAuth."""
    settings = get_settings()
    return OAuthProvidersStatusResponse(
        google=OAuthProviderStatus(
            enabled=settings.is_google_auth_configured,
            client_id_configured=bool(settings.GOOGLE_CLIENT_ID),
        ),
        github=OAuthProviderStatus(
            enabled=settings.is_github_auth_configured,
            client_id_configured=bool(settings.GITHUB_CLIENT_ID),
        ),
    )


@router.get("/oauth/{provider}/url", response_model=OAuthUrlResponse)
def get_oauth_authorization_url(
    provider: str,
    action: str = Query("login", description="'login' or 'link'"),
    redirect_uri: Optional[str] = Query(None, description="Custom OAuth redirect URI"),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Generate official OAuth authorization URL for Google or GitHub with CSRF state protection.
    When action='link', records the authenticated user ID in the state token.
    """
    norm_provider = provider.lower().strip()
    if norm_provider not in ("google", "github"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider '{provider}'. Only 'google' and 'github' are supported.",
        )

    user_id = current_user["id"] if (action == "link" and current_user) else None
    if action == "link" and not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to link an OAuth provider.",
        )

    try:
        if norm_provider == "google":
            url_data = get_google_auth_url(action=action, user_id=user_id, redirect_uri=redirect_uri)
        else:
            url_data = get_github_auth_url(action=action, user_id=user_id, redirect_uri=redirect_uri)

        return OAuthUrlResponse(**url_data)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/oauth/{provider}/callback")
async def handle_oauth_callback(
    provider: str,
    payload: OAuthCallbackRequest,
    response: Response,
):
    """
    Handle authorization code exchange for Google or GitHub OAuth.
    Validates CSRF state, checks token signature/audience/issuer, retrieves verified identity,
    and returns an authenticated session or links the account.
    """
    norm_provider = provider.lower().strip()
    if norm_provider not in ("google", "github"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider '{provider}'.",
        )

    try:
        if norm_provider == "google":
            result = await handle_google_callback(
                code=payload.code,
                state=payload.state,
                redirect_uri=payload.redirect_uri,
            )
        else:
            result = await handle_github_callback(
                code=payload.code,
                state=payload.state,
                redirect_uri=payload.redirect_uri,
            )

        # If login was performed, set HTTP-only cookie
        if "token" in result:
            set_auth_cookie(response, result["token"])
            return AuthResponse(**result)

        # If action was 'link'
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/oauth/{provider}/login")
def oauth_login_redirect(
    provider: str,
    action: str = Query("login", description="'login' or 'link'"),
    redirect_uri: Optional[str] = Query(None, description="Custom OAuth redirect URI"),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Direct browser redirect endpoint for Google / GitHub OAuth.
    Generates official authorization URL and issues HTTP 307 Temporary Redirect.
    """
    norm_provider = provider.lower().strip()
    if norm_provider not in ("google", "github"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider '{provider}'. Only 'google' and 'github' are supported.",
        )

    user_id = current_user["id"] if (action == "link" and current_user) else None
    if action == "link" and not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to link an OAuth provider.",
        )

    try:
        if norm_provider == "google":
            url_data = get_google_auth_url(action=action, user_id=user_id, redirect_uri=redirect_uri)
        else:
            url_data = get_github_auth_url(action=action, user_id=user_id, redirect_uri=redirect_uri)

        return RedirectResponse(url=url_data["url"], status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/oauth/{provider}/callback")
async def handle_oauth_get_callback(
    provider: str,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    response: Response = None,
):
    """
    Direct HTTP GET callback handler when provider redirects directly to backend.
    Completes code exchange, sets secure HTTP-only cookie, and redirects user to frontend chat.
    """
    settings = get_settings()
    frontend_base = "http://localhost:5173"

    if error:
        err_msg = error_description or error
        return RedirectResponse(
            url=f"{frontend_base}/?error={urllib.parse.quote(error)}&error_description={urllib.parse.quote(err_msg)}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code or not state:
        return RedirectResponse(
            url=f"{frontend_base}/?error=missing_code_or_state&error_description=Missing+OAuth+code+or+state",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        norm_provider = provider.lower().strip()
        if norm_provider == "google":
            result = await handle_google_callback(code=code, state=state)
        elif norm_provider == "github":
            result = await handle_github_callback(code=code, state=state)
        else:
            return RedirectResponse(
                url=f"{frontend_base}/?error=unsupported_provider",
                status_code=status.HTTP_302_FOUND,
            )

        redirect_resp = RedirectResponse(url=f"{frontend_base}/?auth_success=true", status_code=status.HTTP_302_FOUND)
        if "token" in result:
            set_auth_cookie(redirect_resp, result["token"])
        return redirect_resp
    except AuthError as e:
        return RedirectResponse(
            url=f"{frontend_base}/?error=auth_error&error_description={urllib.parse.quote(e.message)}",
            status_code=status.HTTP_302_FOUND,
        )


# -----------------------------------------------------------------------------
# Account Linking Endpoints
# -----------------------------------------------------------------------------

@router.get("/linked-providers", response_model=LinkedProvidersResponse)
def list_linked_providers(user: dict = Depends(get_current_user_required)):
    """List all third-party OAuth providers linked to the authenticated user account."""
    providers = get_linked_providers(user["id"])
    return LinkedProvidersResponse(providers=[LinkedProviderItem(**p) for p in providers])


@router.delete("/linked-providers/{provider}")
def unlink_account_provider(provider: str, user: dict = Depends(get_current_user_required)):
    """
    Unlink an OAuth provider from the account.
    Fails if this is the only authentication method to prevent account lockout.
    """
    norm_provider = provider.lower().strip()
    try:
        unlink_provider(user["id"], norm_provider)
        return {
            "status": "unlinked",
            "message": f"Successfully unlinked {provider.capitalize()} from your account.",
        }
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# -----------------------------------------------------------------------------
# Password Recovery
# -----------------------------------------------------------------------------

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(req: ForgotPasswordRequest):
    """Initiate password recovery by generating a secure time-limited reset token."""
    try:
        result = request_password_reset(req.email)
        return ForgotPasswordResponse(**result)
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# -----------------------------------------------------------------------------
# Guest Conversation Migration
# -----------------------------------------------------------------------------

@router.post("/migrate-guest-conversations", response_model=MigrateGuestConversationsResponse)
def migrate_guest_data(
    payload: Optional[MigrateGuestConversationsRequest] = None,
    user: dict = Depends(get_current_user_required),
):
    """
    Migrate guest conversations into newly registered or signed-in user account.
    Ensures work done in guest mode is not lost.
    """
    ids = payload.conversation_ids if payload else None
    count = migrate_guest_conversations(user["id"], ids)
    return MigrateGuestConversationsResponse(
        status="success",
        migrated_count=count,
        message=f"Successfully migrated {count} guest conversation(s) to your account.",
    )
