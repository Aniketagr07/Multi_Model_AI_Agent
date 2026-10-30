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
    ALLOWED_MODELS: str = "gemini-3.8-flash,gemini-3.5-flash,gemini-1.5-flash,gemini-1.5-pro,gemini-2.0-flash-exp,llama-3.1-8b-instant,llama-3.3-70b-versatile,mixtral-8x7b-32768"

    # Database Configuration (Day 7 Persistent SQLite)
    SQLITE_DB_PATH: str = "data/omniai.db"

    # Request Limits & Safeguards
    REQUEST_TIMEOUT_SECONDS: float = 45.0
    MAX_MESSAGE_LENGTH: int = 4000
    MAX_HISTORY_MESSAGES: int = 20

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


@lru_cache()
def get_settings() -> Settings:
    """Return a cached instance of application settings."""
    return Settings()
