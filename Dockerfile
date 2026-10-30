# ==============================================================================
# OmniAI Standalone All-In-One Production Container
# Builds React frontend and serves via FastAPI static files or Uvicorn
# ==============================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Stage 2: Production Python Backend
FROM python:3.11-slim AS production
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    DEBUG=false

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 10001 omniai && \
    useradd -u 10001 -g omniai -m -s /bin/bash omniai

# Install Python backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY --chown=omniai:omniai backend/ ./backend

# Copy compiled frontend distribution
COPY --from=frontend-builder --chown=omniai:omniai /app/frontend/dist ./frontend/dist

# Ensure data directories exist with proper permissions
RUN mkdir -p /app/backend/data /app/backend/data/uploads /app/backend/data/backups && \
    chown -R omniai:omniai /app/backend/data

USER omniai
WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
