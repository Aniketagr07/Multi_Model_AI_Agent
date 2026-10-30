import time
import logging
from collections import defaultdict
from threading import Lock
from typing import Dict, List, Tuple
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """
    Lightweight, thread-safe in-memory sliding-window rate limiter.
    Does not require external dependencies or Redis.
    Tracks timestamps per client IP within a rolling 60-second window.
    """

    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.history: Dict[str, List[float]] = defaultdict(list)
        self.lock = Lock()

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - 60.0

        with self.lock:
            # Prune expired entries
            valid_timestamps = [ts for ts in self.history[client_ip] if ts > window_start]

            if len(valid_timestamps) >= self.rpm:
                # Rate limit exceeded; calculate remaining cool-down seconds
                retry_after = int(valid_timestamps[0] + 60.0 - now) + 1
                return False, max(1, retry_after)

            valid_timestamps.append(now)
            self.history[client_ip] = valid_timestamps

            # Periodically clean up stale IPs to avoid unbounded memory growth
            if len(self.history) > 5000:
                stale_ips = [ip for ip, timestamps in self.history.items() if not timestamps or timestamps[-1] < window_start]
                for ip in stale_ips:
                    del self.history[ip]

            return True, 0


# Global singleton rate limiter instance
_rate_limiter: InMemoryRateLimiter = None


def get_rate_limiter() -> InMemoryRateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        settings = get_settings()
        _rate_limiter = InMemoryRateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)
    return _rate_limiter


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Protects high-throughput endpoints (chat, compare, upload) against flood/DoS attacks.
    """

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if not settings.RATE_LIMIT_ENABLED or request.method == "OPTIONS":
            return await call_next(request)

        # Apply rate limiting to API endpoints
        path = request.url.path
        if path.startswith("/api/chat") or path.startswith("/api/compare") or path.startswith("/api/documents/upload"):
            client_ip = request.client.host if request.client else "127.0.0.1"
            limiter = get_rate_limiter()
            allowed, retry_after = limiter.is_allowed(client_ip)

            if not allowed:
                logger.warning("Rate limit exceeded for client %s on %s", client_ip, path)
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded ({settings.RATE_LIMIT_PER_MINUTE} req/min). Please try again in {retry_after} seconds.",
                        "retry_after": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)


class SingleUserAuthMiddleware(BaseHTTPMiddleware):
    """
    Lightweight single-user authentication boundary for production deployment.
    If APP_ACCESS_TOKEN is configured in environment/settings:
      - Requires requests to provide header 'Authorization: Bearer <token>' OR 'X-OmniAI-Token: <token>'.
      - If no token matches, responds with 401 Unauthorized.
    If APP_ACCESS_TOKEN is unset/empty:
      - Transparently allows requests (zero breaking changes in dev/testing).
    Exempt endpoints:
      - /api/health (required for container probes)
      - / (root service discovery)
      - /docs, /redoc, /openapi.json (API docs)
    """

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        token_configured = bool(settings.APP_ACCESS_TOKEN and settings.APP_ACCESS_TOKEN.strip())

        if not token_configured or request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        exempt_paths = {"/", "/api/health", "/docs", "/redoc", "/openapi.json"}
        if path in exempt_paths:
            return await call_next(request)

        # Extract token from X-OmniAI-Token header or Authorization: Bearer
        provided_token = request.headers.get("X-OmniAI-Token")
        if not provided_token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.lower().startswith("bearer "):
                provided_token = auth_header[7:].strip()

        if not provided_token or provided_token != settings.APP_ACCESS_TOKEN:
            logger.warning("Unauthorized access attempt on %s from %s", path, request.client.host if request.client else "unknown")
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized: A valid single-tenant access token is required."},
                headers={"WWW-Authenticate": "Bearer"},
            )

        return await call_next(request)


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Enforces maximum payload size bounds before buffering large request bodies in memory.
    """

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                length = int(content_length)
                if length > settings.MAX_REQUEST_SIZE_BYTES:
                    max_mb = settings.MAX_REQUEST_SIZE_BYTES // (1024 * 1024)
                    logger.warning("Payload too large (%d bytes > %d MB limit)", length, max_mb)
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"Payload Too Large. Maximum allowed request size is {max_mb} MB."},
                    )
            except ValueError:
                pass

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects enterprise defensive headers into all responses:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: geolocation=(), camera=(), microphone=()
    - Strict-Transport-Security (HSTS in production)
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        settings = get_settings()

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

