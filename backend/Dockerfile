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
    HOST=0.0.0.0

WORKDIR /app

# Install security updates and curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 10001 omniai && \
    useradd -u 10001 -g omniai -m -s /bin/bash omniai

# Copy requirements and install python packages
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY --chown=omniai:omniai . .

# Ensure data and uploads directories exist with proper permissions
RUN mkdir -p /app/data /app/data/uploads /app/data/backups && \
    chown -R omniai:omniai /app/data

# Switch to non-root user
USER omniai

EXPOSE 8000

# Docker healthcheck querying the backend health endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Production server execution with keep-alive
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "65"]

