import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent.parent
_backend_env = _backend_dir / ".env"
_root_env = _backend_dir.parent / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    APP_NAME: str = "OmniAI Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Comma-separated or list of allowed origins for CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI Provider 1: Google Gemini API (Day 3)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    DEFAULT_GEMINI_MODEL: str = "gemini-3.8-flash"

    # AI Provider 2: Groq API (Day 4)
    GROQ_API_KEY: Optional[str] = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    DEFAULT_GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Default application model
    DEFAULT_MODEL: str = "gemini-3.8-flash"

    # Allowed models list (comma-separated IDs)
    ALLOWED_MODELS: str = "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-lite-latest,gemini-1.5-flash,gemini-1.5-pro,gemini-2.0-flash-exp,llama-3.1-8b-instant,llama-3.3-70b-versatile,mixtral-8x7b-32768"

    # Database Configuration (Neon PostgreSQL in production / SQLite in local dev)
    DATABASE_URL: Optional[str] = None
    SQLITE_DB_PATH: str = "data/omniai.db"

    # Single-Tenant Access Control (Production Authentication)
    APP_ACCESS_TOKEN: Optional[str] = None

    # Google OAuth 2.0 Credentials
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/callback/google"

    # GitHub OAuth Credentials
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: str = "http://localhost:5173/auth/callback/github"

    # Server-Side Session & Cookie Security
    APP_SESSION_SECRET: str = "omniai-secure-session-secret-key-32chars"
    API_KEY_ENCRYPTION_SECRET: Optional[str] = None

    # Request Limits, Rate Limiting & Safeguards
    REQUEST_TIMEOUT_SECONDS: float = 45.0
    MAX_MESSAGE_LENGTH: int = 4000
    MAX_HISTORY_MESSAGES: int = 20
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_REQUEST_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB ceiling

    # Production & Logging Controls
    ENABLE_DOCS: Optional[bool] = None
    LOG_LEVEL: str = "INFO"

    # Document Upload & Processing Settings
    UPLOAD_DIR: str = "data/uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_DOCUMENT_EXTENSIONS: str = ".pdf,.txt,.md,.markdown"

    model_config = SettingsConfigDict(
        env_file=(_backend_env, _root_env, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        """Return True if running in production mode."""
        return self.APP_ENV.lower() == "production"

    @property
    def docs_enabled(self) -> bool:
        """Return True if Swagger / OpenAPI documentation UI should be mounted."""
        if self.ENABLE_DOCS is not None:
            return self.ENABLE_DOCS
        return not self.is_production

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS_ORIGINS string into a list of origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_models_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_MODELS string into a list of model IDs."""
        return [model.strip() for model in self.ALLOWED_MODELS.split(",") if model.strip()]

    @property
    def allowed_document_extensions_list(self) -> List[str]:
        """Parse allowed document extensions into lowercase normalized list."""
        return [ext.strip().lower() for ext in self.ALLOWED_DOCUMENT_EXTENSIONS.split(",") if ext.strip()]

    @property
    def is_postgres(self) -> bool:
        """Return True if PostgreSQL / Neon database URL is configured."""
        if not self.DATABASE_URL:
            return False
        clean = self.DATABASE_URL.strip().lower()
        return clean.startswith("postgres://") or clean.startswith("postgresql://")

    @property
    def postgres_connection_uri(self) -> Optional[str]:
        """Normalize postgres:// to postgresql:// for standard driver compatibility."""
        if not self.DATABASE_URL:
            return None
        uri = self.DATABASE_URL.strip()
        if uri.startswith("postgres://"):
            return "postgresql://" + uri[len("postgres://"):]
        return uri

    @property
    def is_google_auth_configured(self) -> bool:
        """Return True if Google OAuth client ID and secret are configured."""
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def is_github_auth_configured(self) -> bool:
        """Return True if GitHub OAuth client ID and secret are configured."""
        return bool(self.GITHUB_CLIENT_ID and self.GITHUB_CLIENT_SECRET)


@lru_cache()
def get_settings() -> Settings:
    """Return a cached instance of application settings."""
    return Settings()
