# ==============================================================================
# OmniAI Backend Production Dockerfile
# ==============================================================================
FROM python:3.11-slim AS production

# Avoid writing .pyc files and enable immediate stdout flushing
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    DEBUG=false \
    PORT=8000 \
    HOST=0.0.0.0 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:/usr/local/bin:$PATH"

WORKDIR /app

# Install security updates and curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 10001 omniai && \
    useradd -u 10001 -g omniai -m -s /bin/bash omniai

# Setup isolated virtual environment
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements and install python packages into virtual environment
COPY requirements.txt ./
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY --chown=omniai:omniai . .

# Ensure data and uploads directories exist with proper permissions
RUN mkdir -p /app/data /app/data/uploads /app/data/backups && \
    chown -R omniai:omniai /app/data /opt/venv

# Switch to non-root user
USER omniai

EXPOSE 8000

# Docker healthcheck querying the backend health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Production server execution with keep-alive and dynamic Render $PORT support
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --timeout-keep-alive 65"]


