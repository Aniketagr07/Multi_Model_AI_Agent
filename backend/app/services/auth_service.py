import re
import uuid
import hmac
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from app.db.database import get_db_connection


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def hash_password(password: str) -> str:
    """
    Hash a password securely using PBKDF2-HMAC-SHA256 with 100,000 iterations
    and a 32-byte cryptographically secure salt.
    Format: salt_hex$hash_hex
    """
    salt = secrets.token_bytes(32)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}${pwd_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored salt$hash with constant-time comparison."""
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
        # Check existing user
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (norm_email,)).fetchone()
        if existing:
            raise AuthError("An account with this email address already exists.", status_code=409)

        conn.execute(
            """
            INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, norm_email, norm_username, pwd_hash, now_iso, now_iso),
        )

        # Generate session token (30 days validity)
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
            "created_at": now_iso,
        },
        "token": token,
    }


def authenticate_user(email: str, password: str) -> Dict[str, Any]:
    """Authenticate existing user credentials and return a new session token."""
    norm_email = validate_email(email)

    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, email, username, password_hash, created_at FROM users WHERE email = ?",
            (norm_email,),
        ).fetchone()

        if not row or not verify_password(password, row["password_hash"]):
            raise AuthError("Invalid email or password.", status_code=401)

        user_id = row["id"]
        now_iso = datetime.now(timezone.utc).isoformat()
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
            "email": row["email"],
            "username": row["username"],
            "created_at": row["created_at"],
        },
        "token": token,
    }


def get_user_by_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retrieve user object for a valid, non-expired session token."""
    if not token:
        return None

    # Handle Bearer prefix if passed raw
    if token.startswith("Bearer "):
        token = token[7:].strip()

    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.username, u.created_at, s.expires_at
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        # Check expiration
        if row["expires_at"] < now_iso:
            conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
            return None

        return {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "created_at": row["created_at"],
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
    """
    Permanently delete a user account and cascade-delete all associated conversations,
    messages, documents, installed skills, and active sessions.
    """
    with get_db_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
