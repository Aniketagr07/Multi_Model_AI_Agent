"""
Service managing Bring Your Own API Key (BYOK) lifecycle:
Live provider authentication, authenticated encryption at rest,
ownership validation, and credential retrieval for AI requests.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
import httpx
from fastapi import HTTPException, status

from app.db.database import get_db_connection
from app.core.encryption import encrypt_api_key, decrypt_api_key, mask_api_key
from app.schemas.byok import (
    ProviderCredentialItem,
    BYOKStatusResponse,
    BYOKValidateResponse,
    BYOKSaveResponse,
)

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "description": "Multimodal reasoning and coding from Google DeepMind (Free tier available).",
        "docs_url": "https://aistudio.google.com/app/apikey",
    },
    {
        "id": "groq",
        "name": "Groq",
        "description": "Ultra-fast inference LPUs hosting Llama 3.1 & Mixtral models (Free tier available).",
        "docs_url": "https://console.groq.com/keys",
    },
]


class BYOKService:
    """Handles end-to-end user provider credential verification, storage, and retrieval."""

    @classmethod
    async def validate_provider_key(cls, provider: str, api_key: str) -> Tuple[bool, str, str]:
        """
        Validates an API key against the provider's official live API.
        Does not persist or log the key.
        Returns: (success: bool, status_label: str, message: str)
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            return False, "Invalid API Key", "API key cannot be empty."

        norm_prov = provider.lower().strip()

        if norm_prov == "gemini":
            # Test against Google Generative Language API
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        return True, "Connected Successfully", "Google Gemini API key authenticated successfully."
                    elif resp.status_code in (400, 401, 403):
                        data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                        err_msg = data.get("error", {}).get("message", "Invalid API Key or permission denied.")
                        return False, "Invalid API Key", f"Google AI Studio rejected the key: {err_msg}"
                    elif resp.status_code == 429:
                        return False, "Provider Rate Limit Reached", "Gemini API rate limit or quota reached. Key is valid but currently restricted."
                    else:
                        return False, "Provider Service Unavailable", f"Google AI Studio returned HTTP {resp.status_code}."
                except httpx.TimeoutException:
                    return False, "Connection Failed", "Connection timed out contacting Google AI Studio."
                except Exception as e:
                    return False, "Connection Failed", f"Could not connect to Google AI Studio: {str(e)}"

        elif norm_prov == "groq":
            # Test against Groq Cloud API
            url = "https://api.groq.com/openai/v1/models"
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    resp = await client.get(url, headers={"Authorization": f"Bearer {clean_key}"})
                    if resp.status_code == 200:
                        return True, "Connected Successfully", "Groq API key authenticated successfully."
                    elif resp.status_code in (401, 403):
                        data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                        err_msg = data.get("error", {}).get("message", "Invalid API Key.")
                        return False, "Invalid API Key", f"Groq rejected the API key: {err_msg}"
                    elif resp.status_code == 429:
                        return False, "Provider Rate Limit Reached", "Groq Cloud rate limit reached. Key is valid but currently rate-limited."
                    else:
                        return False, "Provider Service Unavailable", f"Groq Cloud returned HTTP {resp.status_code}."
                except httpx.TimeoutException:
                    return False, "Connection Failed", "Connection timed out contacting Groq Cloud."
                except Exception as e:
                    return False, "Connection Failed", f"Could not connect to Groq Cloud: {str(e)}"

        elif norm_prov in ("openai", "anthropic"):
            return False, "Integration Pending", f"{norm_prov.capitalize()} integration is scheduled for future updates."

        else:
            return False, "Unsupported Provider", f"Provider '{provider}' is not supported."

    @classmethod
    def get_user_status(cls, user_id: str) -> BYOKStatusResponse:
        """
        Retrieves the provider connection statuses and masked fingerprints for a user.
        Never returns decrypted API keys.
        """
        with get_db_connection() as conn:
            # Query user setup completion flag
            u_row = conn.execute("SELECT byok_setup_completed FROM users WHERE id = ?;", (user_id,)).fetchone()
            completed = bool(dict(u_row).get("byok_setup_completed", 0)) if u_row else False

            # Query user configured credentials
            creds_rows = conn.execute(
                """
                SELECT provider, key_fingerprint, connection_status, last_validated_at
                FROM user_provider_credentials
                WHERE user_id = ?;
                """,
                (user_id,),
            ).fetchall()

        creds_map = {r["provider"]: dict(r) for r in creds_rows}

        provider_items: List[ProviderCredentialItem] = []
        active_count = 0

        for p_def in SUPPORTED_PROVIDERS:
            pid = p_def["id"]
            user_cred = creds_map.get(pid)

            if user_cred and user_cred["connection_status"] == "active":
                active_count += 1
                provider_items.append(
                    ProviderCredentialItem(
                        provider=pid,
                        name=p_def["name"],
                        is_connected=True,
                        key_fingerprint=user_cred["key_fingerprint"],
                        connection_status="active",
                        last_validated_at=user_cred.get("last_validated_at"),
                    )
                )
            else:
                provider_items.append(
                    ProviderCredentialItem(
                        provider=pid,
                        name=p_def["name"],
                        is_connected=False,
                        key_fingerprint=None,
                        connection_status="disconnected",
                        last_validated_at=None,
                    )
                )

        return BYOKStatusResponse(
            byok_setup_completed=bool(completed and active_count > 0),
            has_active_provider=bool(active_count > 0),
            total_connected=active_count,
            providers=provider_items,
        )

    @classmethod
    async def save_user_key(cls, user_id: str, provider: str, api_key: str) -> BYOKSaveResponse:
        """
        Validates the key against the live provider API, encrypts it at rest,
        and saves it strictly scoped to user_id.
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key cannot be empty.")

        norm_prov = provider.lower().strip()
        if norm_prov not in ("gemini", "groq"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Provider '{provider}' is not supported.")

        # 1. Live Validation
        is_valid, status_label, message = await cls.validate_provider_key(norm_prov, clean_key)
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{status_label}: {message}")

        # 2. Authenticated Encryption
        encrypted_token = encrypt_api_key(clean_key)
        fingerprint = mask_api_key(clean_key)
        now_iso = datetime.now(timezone.utc).isoformat()
        cred_id = f"upc-{uuid.uuid4().hex[:12]}"

        # 3. Secure Persistence
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO user_provider_credentials (
                    id, user_id, provider, encrypted_api_key, key_fingerprint,
                    connection_status, last_validated_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    encrypted_api_key = excluded.encrypted_api_key,
                    key_fingerprint = excluded.key_fingerprint,
                    connection_status = 'active',
                    last_validated_at = excluded.last_validated_at,
                    updated_at = excluded.updated_at;
                """,
                (cred_id, user_id, norm_prov, encrypted_token, fingerprint, now_iso, now_iso, now_iso),
            )

            # Mark byok_setup_completed = 1 for the user
            conn.execute("UPDATE users SET byok_setup_completed = 1 WHERE id = ?;", (user_id,))

        logger.info("Successfully encrypted and saved %s API key for user %s", norm_prov, user_id)

        return BYOKSaveResponse(
            success=True,
            provider=norm_prov,
            key_fingerprint=fingerprint,
            message=f"{norm_prov.capitalize()} connected successfully.",
            byok_setup_completed=True,
        )

    @classmethod
    def delete_user_key(cls, user_id: str, provider: str) -> dict:
        """
        Permanently deletes a provider credential for a user.
        """
        norm_prov = provider.lower().strip()
        with get_db_connection() as conn:
            conn.execute(
                "DELETE FROM user_provider_credentials WHERE user_id = ? AND provider = ?;",
                (user_id, norm_prov),
            )

            # Check if any active credentials remain
            remaining = conn.execute(
                "SELECT COUNT(*) as cnt FROM user_provider_credentials WHERE user_id = ? AND connection_status = 'active';",
                (user_id,),
            ).fetchone()
            rem_count = remaining["cnt"] if remaining else 0

            if rem_count == 0:
                conn.execute("UPDATE users SET byok_setup_completed = 0 WHERE id = ?;", (user_id,))

        logger.info("Deleted %s API key credential for user %s", norm_prov, user_id)
        return {"success": True, "provider": norm_prov, "message": f"{norm_prov.capitalize()} API key removed."}

    @classmethod
    def get_decrypted_user_key(cls, user_id: str, provider: str) -> Optional[str]:
        """
        Retrieves and decrypts the provider API key for internal server-side AI execution.
        Never exposed in API responses or frontend code.
        """
        if not user_id:
            return None

        norm_prov = provider.lower().strip()
        with get_db_connection() as conn:
            row = conn.execute(
                """
                SELECT encrypted_api_key, connection_status
                FROM user_provider_credentials
                WHERE user_id = ? AND provider = ?;
                """,
                (user_id, norm_prov),
            ).fetchone()

        if not row or row["connection_status"] != "active":
            return None

        try:
            return decrypt_api_key(row["encrypted_api_key"])
        except Exception as e:
            logger.error("Failed to decrypt API key for user %s, provider %s: %s", user_id, norm_prov, e)
            return None

    @classmethod
    def list_user_active_providers(cls, user_id: str) -> List[str]:
        """
        Returns list of provider identifiers for which the user has configured active keys.
        Used for intelligent model routing.
        """
        if not user_id:
            return []

        with get_db_connection() as conn:
            rows = conn.execute(
                """
                SELECT provider FROM user_provider_credentials
                WHERE user_id = ? AND connection_status = 'active';
                """,
                (user_id,),
            ).fetchall()

        return [r["provider"] for r in rows]
