import re
import logging
import sys
from typing import Optional

# Regex patterns to detect and redact API keys and bearer tokens from logs
SENSITIVE_PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z\-_]{35}"), "[REDACTED_GEMINI_KEY]"),
    (re.compile(r"gsk_[0-9A-Za-z]{48,}"), "[REDACTED_GROQ_KEY]"),
    (re.compile(r"sk-[0-9A-Za-z]{32,}"), "[REDACTED_OPENAI_KEY]"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]{16,}", re.IGNORECASE), r"\1[REDACTED_TOKEN]"),
    (re.compile(r"('api_key':\s*['\"])[^'\"]+(['\"])"), r"\1[REDACTED_KEY]\2"),
    (re.compile(r"(\"api_key\":\s*[\"])[^\"]+([\"])"), r"\1[REDACTED_KEY]\2"),
]


class SecretMaskingFilter(logging.Filter):
    """
    Logging filter that sanitizes log records, masking API keys,
    bearer tokens, and sensitive credential patterns to prevent accidental leaks.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, replacement in SENSITIVE_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)
        if record.args:
            if isinstance(record.args, dict):
                clean_args = {}
                for k, v in record.args.items():
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in SENSITIVE_PATTERNS:
                            val = pattern.sub(replacement, val)
                        clean_args[k] = val
                    else:
                        clean_args[k] = v
                record.args = clean_args
            elif isinstance(record.args, tuple):
                clean_args = []
                for v in record.args:
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in SENSITIVE_PATTERNS:
                            val = pattern.sub(replacement, val)
                        clean_args.append(val)
                    else:
                        clean_args.append(v)
                record.args = tuple(clean_args)
        return True


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configures structured, sanitized logging for the OmniAI application.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Format with clean timestamps
    log_format = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"

    formatter = logging.Formatter(fmt=log_format, datefmt=date_format)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(SecretMaskingFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid adding duplicate handlers if already configured
    if not any(isinstance(h, logging.StreamHandler) and any(isinstance(f, SecretMaskingFilter) for f in h.filters) for h in root_logger.handlers):
        root_logger.handlers = [handler]
    else:
        root_logger.handlers = [handler]

    # Silence overly verbose third-party loggers in production
    logging.getLogger("uvicorn.access").setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
