import re
import uuid
import json
import base64
import hmac
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import urllib.parse
import httpx

from app.core.config import get_settings
from app.db.database import get_db_connection


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# -----------------------------------------------------------------------------
# Password Utilities
# -----------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """
    Hash a password securely using PBKDF2-HMAC-SHA256 with 100,000 iterations
    and a 32-byte cryptographically secure salt.
    Format: salt_hex$hash_hex
    """
    salt = secrets.token_bytes(32)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}${pwd_hash.hex()}"


def verify_password(password: str, stored_hash: Optional[str]) -> bool:
    """Verify password against stored salt$hash with constant-time comparison."""
    if not stored_hash or "$" not in stored_hash:
        return False
    try:
        salt_hex, hash_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
        computed_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(computed_hash, expected_hash)
    except Exception:
        return False


def validate_email(email: str) -> str:
    """Validate and normalize email address."""
    email = email.strip().lower()
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(pattern, email):
        raise AuthError("Invalid email address format.", status_code=422)
    return email


def validate_password(password: str) -> None:
    """Ensure password meets minimum length requirement."""
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters in length.", status_code=422)


# -----------------------------------------------------------------------------
# Local Email/Password Registration and Login
# -----------------------------------------------------------------------------

def register_user(email: str, username: str, password: str) -> Dict[str, Any]:
    """Register a new user account with secure password hashing and session creation."""
    norm_email = validate_email(email)
    validate_password(password)
    norm_username = username.strip()
    if not norm_username or len(norm_username) < 2:
        raise AuthError("Username must be at least 2 characters.", status_code=422)

    user_id = f"user-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    pwd_hash = hash_password(password)

    with get_db_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (norm_email,)).fetchone()
        if existing:
            raise AuthError("An account with this email address already exists.", status_code=409)

        conn.execute(
            """
            INSERT INTO users (id, email, username, password_hash, primary_provider, last_login_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'email', ?, ?, ?)
            """,
            (user_id, norm_email, norm_username, pwd_hash, now_iso, now_iso, now_iso),
        )

        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        conn.execute(
            """
            INSERT INTO user_sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, expires_at, now_iso),
        )

    return {
        "user": {
            "id": user_id,
            "email": norm_email,
            "username": norm_username,
            "primary_provider": "email",
            "avatar_url": None,
            "last_login_at": now_iso,
            "byok_setup_completed": False,
            "created_at": now_iso,
            "linked_providers": [],
        },
        "token": token,
    }


def authenticate_user(email: str, password: str) -> Dict[str, Any]:
    """Authenticate existing user credentials and return a new session token."""
    norm_email = validate_email(email)

    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT id, email, username, password_hash, primary_provider, avatar_url, byok_setup_completed, created_at
            FROM users WHERE email = ?
            """,
            (norm_email,),
        ).fetchone()

        if not row or not verify_password(password, row["password_hash"]):
            raise AuthError("Invalid email or password.", status_code=401)

        user_id = row["id"]
        now_iso = datetime.now(timezone.utc).isoformat()

        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso, user_id))

        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        conn.execute(
            """
            INSERT INTO user_sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, expires_at, now_iso),
        )

        linked_rows = conn.execute(
            "SELECT provider FROM user_oauth_providers WHERE user_id = ?", (user_id,)
        ).fetchall()
        linked = [r["provider"] for r in linked_rows]

    return {
        "user": {
            "id": user_id,
            "email": row["email"],
            "username": row["username"],
            "primary_provider": row["primary_provider"] or "email",
            "avatar_url": row["avatar_url"],
            "last_login_at": now_iso,
            "byok_setup_completed": bool(dict(row).get("byok_setup_completed", 0)),
            "created_at": row["created_at"],
            "linked_providers": linked,
        },
        "token": token,
    }


def get_user_by_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retrieve user object for a valid, non-expired session token."""
    if not token:
        return None

    if token.startswith("Bearer "):
        token = token[7:].strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.username, u.primary_provider, u.avatar_url,
                   u.byok_setup_completed, u.last_login_at, u.created_at, s.expires_at
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        if row["expires_at"] < now_iso:
            conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            return None

        user_id = row["id"]
        linked_rows = conn.execute(
            "SELECT provider FROM user_oauth_providers WHERE user_id = ?", (user_id,)
        ).fetchall()
        linked = [r["provider"] for r in linked_rows]

        return {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "primary_provider": row["primary_provider"] or "email",
            "avatar_url": row["avatar_url"],
            "last_login_at": row["last_login_at"],
            "byok_setup_completed": bool(dict(row).get("byok_setup_completed", 0)),
            "created_at": row["created_at"],
            "linked_providers": linked,
        }


def logout_user(token: str) -> None:
    """Invalidate and remove a session token."""
    if not token:
        return
    if token.startswith("Bearer "):
        token = token[7:].strip()

    with get_db_connection() as conn:
        conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))


def delete_user_account(user_id: str) -> None:
    """Permanently delete a user account and cascade delete all associated data."""
    with get_db_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


# -----------------------------------------------------------------------------
# OAuth State Management (CSRF Protection)
# -----------------------------------------------------------------------------


def generate_pkce_pair() -> Tuple[str, str]:
    """Generate (code_verifier, code_challenge) using S256."""
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("ascii")).digest()
    ).decode("ascii").rstrip("=")
    return code_verifier, code_challenge

def create_oauth_state(
    provider: str,
    action: str = "login",
    user_id: Optional[str] = None,
    redirect_uri: Optional[str] = None,
    code_verifier: Optional[str] = None,
) -> str:
    """Generate and store a single-use CSRF state token valid for 10 minutes."""
    state = f"{provider}_{secrets.token_urlsafe(32)}"
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = (now + timedelta(minutes=10)).isoformat()

    with get_db_connection() as conn:
        # Prune expired states
        conn.execute("DELETE FROM oauth_states WHERE expires_at < ?", (now_iso,))
        conn.execute(
            """
            INSERT INTO oauth_states (state, provider, action, user_id, redirect_uri, code_verifier, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (state, provider, action, user_id, redirect_uri, code_verifier, expires_at, now_iso),
        )

    return state


def validate_and_consume_oauth_state(state: str, provider: str) -> Dict[str, Any]:
    """Validate that the OAuth state exists, matches provider, has not expired, and delete it."""
    if not state:
        raise AuthError("Missing OAuth state parameter.", status_code=400)

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT state, provider, action, user_id, redirect_uri, code_verifier, expires_at
            FROM oauth_states
            WHERE state = ? AND provider = ?
            """,
            (state, provider),
        ).fetchone()

        if not row:
            raise AuthError("Invalid or already consumed OAuth state token.", status_code=400)

        # Single-use consumption
        conn.execute("DELETE FROM oauth_states WHERE state = ?", (state,))

        if row["expires_at"] < now_iso:
            raise AuthError("OAuth authorization session expired. Please try again.", status_code=400)

        return {
            "state": row["state"],
            "provider": row["provider"],
            "action": row["action"],
            "user_id": row["user_id"],
            "redirect_uri": row["redirect_uri"],
            "code_verifier": row["code_verifier"] if "code_verifier" in row.keys() else None,
        }


# -----------------------------------------------------------------------------
# Google OAuth 2.0 / OpenID Connect
# -----------------------------------------------------------------------------

def get_google_auth_url(
    action: str = "login",
    user_id: Optional[str] = None,
    redirect_uri: Optional[str] = None,
) -> Dict[str, str]:
    """Generate official Google OAuth 2.0 authorization URL with minimum necessary scopes."""
    settings = get_settings()
    if not settings.is_google_auth_configured:
        raise AuthError(
            "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.",
            status_code=400,
        )

    resolved_redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI
    code_verifier, code_challenge = generate_pkce_pair()
    state = create_oauth_state(
        "google",
        action=action,
        user_id=user_id,
        redirect_uri=resolved_redirect,
        code_verifier=code_verifier,
    )

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": resolved_redirect,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"provider": "google", "url": auth_url, "state": state}


def _verify_google_jwt_claims(id_token: str, client_id: str) -> Dict[str, Any]:
    """Decode and verify Google JWT id_token claims (issuer, audience, expiration)."""
    try:
        parts = id_token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed JWT format")

        payload_b64 = parts[1]
        # Fix base64 padding
        padded_b64 = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload_bytes = base64.urlsafe_b64decode(padded_b64)
        claims = json.loads(payload_bytes.decode("utf-8"))

        # Verify audience
        aud = claims.get("aud")
        if aud != client_id:
            raise AuthError(f"Invalid Google token audience: {aud}", status_code=401)

        # Verify issuer
        iss = claims.get("iss")
        if iss not in ("https://accounts.google.com", "accounts.google.com"):
            raise AuthError(f"Invalid Google token issuer: {iss}", status_code=401)

        # Verify expiration
        exp = claims.get("exp", 0)
        now_ts = datetime.now(timezone.utc).timestamp()
        if exp < now_ts - 60:  # 60s clock skew allowance
            raise AuthError("Google identity token has expired.", status_code=401)

        return claims
    except Exception as e:
        if isinstance(e, AuthError):
            raise e
        raise AuthError(f"Failed to verify Google identity token: {str(e)}", status_code=401)


async def handle_google_callback(
    code: str,
    state: str,
    redirect_uri: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Exchange authorization code for Google tokens, verify identity, and authenticate
    or link to OmniAI account. Never trust client-supplied user profile data.
    """
    settings = get_settings()
    if not settings.is_google_auth_configured:
        raise AuthError("Google OAuth credentials are not configured on the server.", status_code=500)

    # 1. CSRF state validation
    state_info = validate_and_consume_oauth_state(state, "google")
    action = state_info["action"]
    link_user_id = state_info["user_id"]
    resolved_redirect = state_info.get("redirect_uri") or redirect_uri or settings.GOOGLE_REDIRECT_URI

    # 2. Token exchange at Google OAuth token endpoint
    token_url = "https://oauth2.googleapis.com/token"
    token_payload = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": resolved_redirect,
    }
    if state_info.get("code_verifier"):
        token_payload["code_verifier"] = state_info["code_verifier"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            token_resp = await client.post(token_url, data=token_payload)
        except Exception as e:
            raise AuthError(f"Network error contacting Google OAuth token server: {str(e)}", status_code=502)

        if token_resp.status_code != 200:
            err_data = token_resp.json() if "application/json" in token_resp.headers.get("content-type", "") else {}
            err_msg = err_data.get("error_description") or err_data.get("error") or token_resp.text
            raise AuthError(f"Google authorization code exchange failed: {err_msg}", status_code=400)

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")

        if not access_token or not id_token:
            raise AuthError("Google OAuth response was missing access_token or id_token.", status_code=502)

        # 3. Verify ID token claims
        claims = _verify_google_jwt_claims(id_token, settings.GOOGLE_CLIENT_ID)

        # 4. Fetch verified profile from official Google userinfo endpoint
        userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        userinfo_resp = await client.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
        if userinfo_resp.status_code != 200:
            raise AuthError("Failed to fetch verified user profile from Google userinfo API.", status_code=502)

        user_info = userinfo_resp.json()

    # 5. Extract verified user attributes
    google_user_id = str(user_info.get("sub") or claims.get("sub"))
    email = validate_email(user_info.get("email") or claims.get("email"))
    email_verified = bool(user_info.get("email_verified") or claims.get("email_verified"))
    display_name = (user_info.get("name") or claims.get("name") or email.split("@")[0]).strip()
    avatar_url = user_info.get("picture") or claims.get("picture")

    if not email_verified:
        raise AuthError("The Google account email is not verified. Please verify your email with Google first.", status_code=400)

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        # Check if this Google identity is already registered
        existing_link = conn.execute(
            "SELECT user_id FROM user_oauth_providers WHERE provider = 'google' AND provider_user_id = ?",
            (google_user_id,),
        ).fetchone()

        # ACTION: LINK TO EXISTING AUTHENTICATED ACCOUNT
        if action == "link":
            if not link_user_id:
                raise AuthError("Account linking requires an authenticated session.", status_code=401)

            if existing_link:
                if existing_link["user_id"] != link_user_id:
                    raise AuthError("This Google account is already linked to a different OmniAI user.", status_code=409)
                return {
                    "status": "already_linked",
                    "message": "This Google account is already linked to your OmniAI profile.",
                }

            link_id = f"link-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO user_oauth_providers (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
                VALUES (?, ?, 'google', ?, ?, ?, ?, ?, ?)
                """,
                (link_id, link_user_id, google_user_id, email, display_name, avatar_url, now_iso, now_iso),
            )
            return {
                "status": "linked",
                "provider": "google",
                "email": email,
                "display_name": display_name,
            }

        # ACTION: LOGIN OR REGISTER VIA GOOGLE
        if existing_link:
            # Existing user logging in via Google
            user_id = existing_link["user_id"]
            user_row = conn.execute(
                "SELECT id, email, username, primary_provider, avatar_url, byok_setup_completed, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if not user_row:
                raise AuthError("Associated OmniAI user account was not found.", status_code=404)

            conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso, user_id))
        else:
            # Check if email is already in use by email/password account
            existing_user = conn.execute(
                "SELECT id, primary_provider FROM users WHERE email = ?", (email,)
            ).fetchone()

            if existing_user:
                # Security Rule: Do NOT automatically merge accounts solely because emails match
                raise AuthError(
                    f"An OmniAI account with email '{email}' already exists. Please sign in with your email/password or existing login method, then link Google from Settings.",
                    status_code=409,
                )

            # Create brand new user account
            user_id = f"user-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO users (id, email, username, password_hash, primary_provider, avatar_url, byok_setup_completed, last_login_at, created_at, updated_at)
                VALUES (?, ?, ?, 'OAUTH_MANAGED', 'google', ?, 0, ?, ?, ?)
                """,
                (user_id, email, display_name, avatar_url, now_iso, now_iso, now_iso),
            )

            link_id = f"link-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO user_oauth_providers (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
                VALUES (?, ?, 'google', ?, ?, ?, ?, ?, ?)
                """,
                (link_id, user_id, google_user_id, email, display_name, avatar_url, now_iso, now_iso),
            )

            user_row = conn.execute(
                "SELECT id, email, username, primary_provider, avatar_url, byok_setup_completed, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()

        # Generate session token (30 days)
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        conn.execute(
            """
            INSERT INTO user_sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, expires_at, now_iso),
        )

        linked_rows = conn.execute(
            "SELECT provider FROM user_oauth_providers WHERE user_id = ?", (user_id,)
        ).fetchall()
        linked = [r["provider"] for r in linked_rows]

    return {
        "user": {
            "id": user_row["id"],
            "email": user_row["email"],
            "username": user_row["username"],
            "primary_provider": user_row["primary_provider"] or "google",
            "avatar_url": user_row["avatar_url"],
            "last_login_at": now_iso,
            "byok_setup_completed": bool(dict(user_row).get("byok_setup_completed", 0)),
            "created_at": user_row["created_at"],
            "linked_providers": linked,
        },
        "token": token,
    }


# -----------------------------------------------------------------------------
# GitHub OAuth
# -----------------------------------------------------------------------------

def get_github_auth_url(
    action: str = "login",
    user_id: Optional[str] = None,
    redirect_uri: Optional[str] = None,
) -> Dict[str, str]:
    """Generate official GitHub OAuth authorization URL with read:user user:email scopes."""
    settings = get_settings()
    if not settings.is_github_auth_configured:
        raise AuthError(
            "GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.",
            status_code=400,
        )

    resolved_redirect = redirect_uri or settings.GITHUB_REDIRECT_URI
    state = create_oauth_state("github", action=action, user_id=user_id, redirect_uri=resolved_redirect)

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": resolved_redirect,
        "scope": "read:user user:email",
        "state": state,
    }
    auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return {"provider": "github", "url": auth_url, "state": state}


async def handle_github_callback(
    code: str,
    state: str,
    redirect_uri: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Exchange authorization code for GitHub access token, query profile and verified email APIs,
    and authenticate or link to OmniAI account. Never expose client secrets to frontend.
    """
    settings = get_settings()
    if not settings.is_github_auth_configured:
        raise AuthError("GitHub OAuth credentials are not configured on the server.", status_code=500)

    # 1. CSRF state validation
    state_info = validate_and_consume_oauth_state(state, "github")
    action = state_info["action"]
    link_user_id = state_info["user_id"]
    resolved_redirect = state_info.get("redirect_uri") or redirect_uri or settings.GITHUB_REDIRECT_URI

    # 2. Token exchange at GitHub OAuth token endpoint
    token_url = "https://github.com/login/oauth/access_token"
    token_payload = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "code": code,
        "redirect_uri": resolved_redirect,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            token_resp = await client.post(
                token_url,
                data=token_payload,
                headers={"Accept": "application/json"},
            )
        except Exception as e:
            raise AuthError(f"Network error contacting GitHub OAuth server: {str(e)}", status_code=502)

        if token_resp.status_code != 200:
            raise AuthError(f"GitHub token exchange returned HTTP {token_resp.status_code}", status_code=400)

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            err_desc = token_data.get("error_description") or token_data.get("error") or "No access_token returned"
            raise AuthError(f"GitHub authorization failed: {err_desc}", status_code=400)

        # 3. Retrieve user profile
        user_headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "OmniAI-App",
        }
        user_resp = await client.get("https://api.github.com/user", headers=user_headers)
        if user_resp.status_code != 200:
            raise AuthError("Failed to fetch user profile from GitHub API.", status_code=502)

        user_data = user_resp.json()
        github_user_id = str(user_data["id"])
        username = (user_data.get("login") or user_data.get("name") or "GitHubUser").strip()
        avatar_url = user_data.get("avatar_url")
        email = user_data.get("email")

        # 4. If email is private or missing, query GitHub user/emails endpoint
        if not email or "@" not in email:
            emails_resp = await client.get("https://api.github.com/user/emails", headers=user_headers)
            if emails_resp.status_code == 200:
                emails_list = emails_resp.json()
                # Find primary verified email
                for item in emails_list:
                    if item.get("primary") and item.get("verified"):
                        email = item.get("email")
                        break
                # Fallback to any verified email
                if not email:
                    for item in emails_list:
                        if item.get("verified"):
                            email = item.get("email")
                            break

        if not email or "@" not in email:
            # Fallback identifier for private email without public email
            email = f"{username.lower()}@users.noreply.github.com"

        email = validate_email(email)

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        existing_link = conn.execute(
            "SELECT user_id FROM user_oauth_providers WHERE provider = 'github' AND provider_user_id = ?",
            (github_user_id,),
        ).fetchone()

        # ACTION: LINK TO EXISTING AUTHENTICATED ACCOUNT
        if action == "link":
            if not link_user_id:
                raise AuthError("Account linking requires an authenticated session.", status_code=401)

            if existing_link:
                if existing_link["user_id"] != link_user_id:
                    raise AuthError("This GitHub account is already linked to a different OmniAI user.", status_code=409)
                return {
                    "status": "already_linked",
                    "message": "This GitHub account is already linked to your OmniAI profile.",
                }

            link_id = f"link-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO user_oauth_providers (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
                VALUES (?, ?, 'github', ?, ?, ?, ?, ?, ?)
                """,
                (link_id, link_user_id, github_user_id, email, username, avatar_url, now_iso, now_iso),
            )
            return {
                "status": "linked",
                "provider": "github",
                "email": email,
                "display_name": username,
            }

        # ACTION: LOGIN OR REGISTER VIA GITHUB
        if existing_link:
            user_id = existing_link["user_id"]
            user_row = conn.execute(
                "SELECT id, email, username, primary_provider, avatar_url, byok_setup_completed, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if not user_row:
                raise AuthError("Associated OmniAI user account was not found.", status_code=404)

            conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now_iso, user_id))
        else:
            # Check if email is in use by another account
            existing_user = conn.execute(
                "SELECT id FROM users WHERE email = ?", (email,)
            ).fetchone()

            if existing_user:
                raise AuthError(
                    f"An OmniAI account with email '{email}' already exists. Please sign in with your email/password or existing login method, then link GitHub from Settings.",
                    status_code=409,
                )

            user_id = f"user-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO users (id, email, username, password_hash, primary_provider, avatar_url, byok_setup_completed, last_login_at, created_at, updated_at)
                VALUES (?, ?, ?, 'OAUTH_MANAGED', 'github', ?, 0, ?, ?, ?)
                """,
                (user_id, email, username, avatar_url, now_iso, now_iso, now_iso),
            )

            link_id = f"link-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO user_oauth_providers (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
                VALUES (?, ?, 'github', ?, ?, ?, ?, ?, ?)
                """,
                (link_id, user_id, github_user_id, email, username, avatar_url, now_iso, now_iso),
            )

            user_row = conn.execute(
                "SELECT id, email, username, primary_provider, avatar_url, byok_setup_completed, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()

        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        conn.execute(
            """
            INSERT INTO user_sessions (token, user_id, expires_at, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user_id, expires_at, now_iso),
        )

        linked_rows = conn.execute(
            "SELECT provider FROM user_oauth_providers WHERE user_id = ?", (user_id,)
        ).fetchall()
        linked = [r["provider"] for r in linked_rows]

    return {
        "user": {
            "id": user_row["id"],
            "email": user_row["email"],
            "username": user_row["username"],
            "primary_provider": user_row["primary_provider"] or "github",
            "avatar_url": user_row["avatar_url"],
            "last_login_at": now_iso,
            "byok_setup_completed": bool(dict(user_row).get("byok_setup_completed", 0)),
            "created_at": user_row["created_at"],
            "linked_providers": linked,
        },
        "token": token,
    }


# -----------------------------------------------------------------------------
# Account Linking & Linked Providers API
# -----------------------------------------------------------------------------

def get_linked_providers(user_id: str) -> List[Dict[str, Any]]:
    """Return all OAuth providers currently linked to this OmniAI account."""
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT provider, provider_user_id, email, display_name, created_at
            FROM user_oauth_providers
            WHERE user_id = ?
            ORDER BY created_at ASC
            """,
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def unlink_provider(user_id: str, provider: str) -> None:
    """
    Unlink an OAuth provider from user account. Requires that the user has either
    a password set or at least one other linked OAuth provider so they do not get locked out.
    """
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT password_hash FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            raise AuthError("User not found.", status_code=404)

        has_password = bool(user["password_hash"] and user["password_hash"] != "OAUTH_MANAGED")

        linked = conn.execute(
            "SELECT id, provider FROM user_oauth_providers WHERE user_id = ?", (user_id,)
        ).fetchall()

        other_providers = [l for l in linked if l["provider"] != provider]

        if not has_password and len(other_providers) == 0:
            raise AuthError(
                "Cannot unlink the only authentication method for this account. Set a password or link another provider first.",
                status_code=400,
            )

        deleted = conn.execute(
            "DELETE FROM user_oauth_providers WHERE user_id = ? AND provider = ?",
            (user_id, provider),
        )
        if deleted.rowcount == 0:
            raise AuthError(f"No linked account found for provider '{provider}'.", status_code=404)


# -----------------------------------------------------------------------------
# Password Reset (Forgot Password)
# -----------------------------------------------------------------------------

def request_password_reset(email: str) -> Dict[str, Any]:
    """
    Create a secure, time-limited password reset token for the specified email.
    In development/demo mode, returns reset instructions and token.
    """
    norm_email = validate_email(email)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = (now + timedelta(hours=1)).isoformat()
    reset_token = secrets.token_urlsafe(32)

    with get_db_connection() as conn:
        user = conn.execute("SELECT id FROM users WHERE email = ?", (norm_email,)).fetchone()
        if user:
            conn.execute(
                """
                INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at, used)
                VALUES (?, ?, ?, ?, 0)
                """,
                (reset_token, user["id"], expires_at, now_iso),
            )

    return {
        "status": "success",
        "message": "If an OmniAI account exists with this email, password reset instructions have been generated.",
        "reset_token": reset_token if get_settings().DEBUG else None,
    }


# -----------------------------------------------------------------------------
# Guest Conversation Migration
# -----------------------------------------------------------------------------

def migrate_guest_conversations(user_id: str, conversation_ids: Optional[List[str]] = None) -> int:
    """
    Migrate unowned (guest) conversations to an authenticated user account.
    Prevents silent data loss when a guest decides to register or sign in.
    """
    with get_db_connection() as conn:
        if conversation_ids:
            placeholders = ",".join("?" for _ in conversation_ids)
            cursor = conn.execute(
                f"UPDATE conversations SET user_id = ? WHERE id IN ({placeholders}) AND user_id IS NULL",
                [user_id, *conversation_ids],
            )
        else:
            cursor = conn.execute(
                "UPDATE conversations SET user_id = ? WHERE user_id IS NULL",
                (user_id,),
            )
        migrated_count = cursor.rowcount

    return migrated_count
