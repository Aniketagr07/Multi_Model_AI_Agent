from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class UserSettingsSchema(BaseModel):
    """Schema representing persisted user configuration and preferences."""

    # Appearance
    theme: Literal["dark", "light", "system"] = Field(
        default="dark",
        description="User interface visual theme mode"
    )

    # AI Preferences
    default_model: str = Field(
        default="gemini-3.6-flash",
        description="Default AI model identifier selected for new chats"
    )
    default_routing_mode: Literal["auto", "manual"] = Field(
        default="auto",
        description="Whether auto smart routing is active by default"
    )
    streaming_enabled: bool = Field(
        default=True,
        description="Whether real-time Server-Sent Events (SSE) token streaming is enabled"
    )
    default_effort: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Default reasoning effort level ('low', 'medium', 'high')"
    )

    # General & Personalization
    new_chat_behavior: Literal["default", "clear", "summarize"] = Field(
        default="default",
        description="Default behavior when creating a new conversation"
    )
    custom_instructions: str = Field(
        default="",
        max_length=2000,
        description="User custom instructions / persona preferences passed securely to AI providers"
    )

    @field_validator("custom_instructions")
    @classmethod
    def sanitize_instructions(cls, v: Optional[str]) -> str:
        if v is None:
            return ""
        # Trim leading and trailing whitespace
        trimmed = v.strip()
        # Security protection against common prompt injection patterns
        prohibited_phrases = [
            "ignore all previous instructions",
            "ignore previous instructions",
            "disregard all previous directions",
            "override system prompt",
            "bypass safety filters",
        ]
        clean_text = trimmed
        for phrase in prohibited_phrases:
            clean_text = clean_text.replace(phrase, "")
            clean_text = clean_text.replace(phrase.upper(), "")
            clean_text = clean_text.replace(phrase.title(), "")
        return clean_text.strip()
