"""
Cryptographic utility module for OmniAI Bring Your Own API Key (BYOK) system.
Provides authenticated encryption at rest using Fernet (AES-128-CBC + HMAC-SHA256).
"""

import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _get_fernet_cipher() -> Fernet:
    """
    Derives a standard 32-byte URL-safe base64 Fernet key from
    API_KEY_ENCRYPTION_SECRET or APP_SESSION_SECRET.
    """
    settings = get_settings()
    secret = settings.API_KEY_ENCRYPTION_SECRET or settings.APP_SESSION_SECRET or "omniai-secure-default-secret-key-32chars"
    key_bytes = hashlib.sha256(secret.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_api_key(plaintext_key: str) -> str:
    """
    Encrypts a raw API key using authenticated symmetric encryption.
    
    Args:
        plaintext_key: The raw provider API key.
        
    Returns:
        The encrypted, base64-encoded ciphertext string.
    """
    if not plaintext_key or not plaintext_key.strip():
        raise ValueError("Cannot encrypt an empty API key.")
    
    cipher = _get_fernet_cipher()
    encrypted_bytes = cipher.encrypt(plaintext_key.strip().encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_api_key(encrypted_token: str) -> str:
    """
    Decrypts an authenticated ciphertext token back to plaintext.
    
    Args:
        encrypted_token: The ciphertext string stored in the database.
        
    Returns:
        The decrypted raw API key string.
        
    Raises:
        ValueError: If ciphertext has been tampered with or secret changed.
    """
    if not encrypted_token or not encrypted_token.strip():
        raise ValueError("Cannot decrypt an empty ciphertext token.")
    
    cipher = _get_fernet_cipher()
    try:
        decrypted_bytes = cipher.decrypt(encrypted_token.strip().encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt API key: InvalidToken or tampered ciphertext.")
        raise ValueError("Failed to decrypt stored API key. Credential may have been corrupted or secret key changed.")


def mask_api_key(key: str) -> str:
    """
    Masks an API key for safe presentation in user interfaces and audit logs.
    Shows only the last 4 characters preceded by bullets.
    Example: 'AIzaSy...1234' -> '••••••••••••1234'
    """
    clean_key = (key or "").strip()
    if not clean_key:
        return "••••••••"
    
    if len(clean_key) <= 4:
        return "••••" + clean_key
    
    last4 = clean_key[-4:]
    return "••••••••••••" + last4

