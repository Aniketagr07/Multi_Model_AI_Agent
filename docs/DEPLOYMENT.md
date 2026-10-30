# OmniAI — Production Deployment & Operations Guide

This guide provides technical specifications, container orchestration instructions, operational procedures, security hardening guidelines, and disaster recovery runbooks for deploying **OmniAI — Intelligent Multi-Model AI Chatbot** in production environments.

---

## 1. System Requirements

### Hardware Requirements
* **CPU**: Minimum 1 vCPU (2+ vCPUs recommended for concurrent SSE streaming and multi-model dispatch).
* **Memory**: Minimum 1 GB RAM (2 GB RAM recommended to handle PDF chunking and in-memory rate limiting).
* **Disk**: Minimum 5 GB free disk space (accounting for container images, SQLite database growth, and uploaded documents).

### Software Requirements
* **Operating System**: Linux (Ubuntu 22.04 LTS / Debian 12 / RHEL 9 recommended), macOS, or Windows 10/11 with WSL2.
* **Container Runtime**: Docker Engine 24.0+ and Docker Compose v2.20+.
* **Bare-Metal (Non-Docker)**:
  * Python 3.10+ (tested through Python 3.14)
  * Node.js 18.x or 20.x+ (with `npm`)
  * SQLite 3.35+ (with WAL mode support)

---

## 2. Production Architecture

OmniAI employs a two-tier decoupled container architecture orchestrated via Docker Compose:

```
                              [Internet / Client Browser]
                                           │
                                           ▼ (Port 80 / 443 HTTPS)
                             ┌───────────────────────────┐
                             │  OmniAI Frontend (Nginx)  │
                             │  - Static Asset Delivery  │
                             │  - Gzip & Client Cache    │
                             │  - Reverse Proxy for /api │
                             │  - SSE Stream Forwarding  │
                             └─────────────┬─────────────┘
                                           │ (Internal Docker Network)
                                           │ http://backend:8000/api/
                                           ▼
                             ┌───────────────────────────┐
                             │  OmniAI Backend (FastAPI) │
                             │  - Single-User Auth Guard │
                             │  - In-Memory Rate Limiter │
                             │  - Request Size Guard     │
                             │  - Sanitized Log Engine   │
                             └─────────────┬─────────────┘
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
          ┌─────────────────────┐                     ┌─────────────────────┐
          │  Volume: omniai_data│                     │Volume:omniai_uploads│
          │  - /app/data/       │                     │  - /app/data/uploads│
          │  - omniai.db (WAL)  │                     │  - Stored Documents │
          │  - Timestamp Backups│                     └─────────────────────┘
          └─────────────────────┘
```

### Why Nginx Reverse Proxy for Frontend?
1. **Zero CORS Friction**: The browser interacts exclusively with origin `http://<domain>/`. Requests to `/api/*` are reverse-proxied internally, eliminating cross-origin preflight overhead.
2. **SSE Streaming Optimization**: Nginx is pre-configured with `proxy_buffering off`, `proxy_cache off`, and `chunked_transfer_encoding on` to ensure real-time sub-second token delivery.
3. **Payload Protection**: Nginx enforces `client_max_body_size 15M`, matching backend application bounds.

---

## 3. Environment Configuration

### Backend Production Configuration (`backend/.env.production`)
Create `backend/.env.production` from the template:
```bash
cp backend/.env.production.example backend/.env.production
```

```ini
APP_NAME="OmniAI Backend"
APP_ENV=production
DEBUG=false
HOST=0.0.0.0
PORT=8000

# CORS Allowed Origins (Nginx domain)
CORS_ORIGINS="http://localhost,http://127.0.0.1,http://localhost:80,http://127.0.0.1:80"

# AI Provider Credentials (Official Free-Tier Keys)
GEMINI_API_KEY="AIzaSy..."
GROQ_API_KEY="gsk_..."

# Single-Tenant Production Access Control (Strong random secret)
APP_ACCESS_TOKEN="omni_sec_994b7e281cfd48348a1d74"

# Security & Traffic Bounds
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
MAX_REQUEST_SIZE_BYTES=15728640

# Logging & Documentation
LOG_LEVEL=INFO
ENABLE_DOCS=false

# Persistent Storage
SQLITE_DB_PATH="data/omniai.db"
UPLOAD_DIR="data/uploads"
```

### Frontend Production Configuration (`frontend/.env.production`)
```ini
# Blank value routes /api calls through the Nginx reverse proxy
VITE_API_BASE_URL=""

# Optional: Pre-configured token matching backend APP_ACCESS_TOKEN
# VITE_ACCESS_TOKEN="omni_sec_994b7e281cfd48348a1d74"
```

---

## 4. Deployment Instructions

### Method A: Docker Compose Deployment (Recommended)

1. **Verify Environment Variables**:
   Export or place your keys in the root `.env` or pass them into Compose:
   ```bash
   export GEMINI_API_KEY="AIzaSy..."
   export GROQ_API_KEY="gsk_..."
   export APP_ACCESS_TOKEN="omni_sec_your_custom_token"
   ```

2. **Build and Launch Container Stack**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify Service Health**:
   ```bash
   docker compose ps
   ```
   Expected output:
   ```
   NAME               IMAGE                    COMMAND                  SERVICE    STATUS
   omniai-backend     project-backend:latest   "uvicorn app.main:ap…"   backend    running (healthy)
   omniai-frontend    project-frontend:latest  "nginx -g 'daemon of…"   frontend   running (healthy)
   ```

4. **Verify Application Access**:
   * Frontend: Open browser at `http://localhost` (or `http://<server-ip>`).
   * Backend Health: `curl -I http://localhost/api/health` (HTTP 200 OK).

5. **Stop Stack**:
   ```bash
   docker compose down
   ```
   *(Data volumes `omniai_data` and `omniai_uploads` remain completely intact).*

---

### Method B: Standalone All-In-One Container

For single-container deployment platforms (Render, Railway, Fly.io):
```bash
# Build the standalone container
docker build -t omniai-allinone -f Dockerfile .

# Run with persistent volume mounts
docker run -d \
  --name omniai \
  --restart unless-stopped \
  -p 8000:8000 \
  -e APP_ENV=production \
  -e DEBUG=false \
  -e GEMINI_API_KEY="AIzaSy..." \
  -e GROQ_API_KEY="gsk_..." \
  -e APP_ACCESS_TOKEN="omni_sec_token" \
  -v omniai_data:/app/backend/data \
  omniai-allinone
```

---

### Method C: Bare-Metal / Systemd Deployment

If hosting directly on an Ubuntu/Debian Linux VM:

1. **Backend Service (`/etc/systemd/system/omniai-backend.service`)**:
   ```ini
   [Unit]
   Description=OmniAI FastAPI Backend
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/omniai/backend
   EnvironmentFile=/var/www/omniai/backend/.env.production
   ExecStart=/var/www/omniai/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --timeout-keep-alive 65
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

2. **Frontend Static Build**:
   ```bash
   cd frontend
   npm ci
   npm run build
   cp -r dist/* /var/www/omniai/frontend/
   ```

3. **Enable & Start**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now omniai-backend
   ```

---

## 5. Security & Access Control Review

### 1. Single-User Authentication Boundary
* **Design Philosophy**: OmniAI is engineered as a single-tenant personal intelligence workbench. Rather than introducing bloated multi-user role matrices or third-party auth services, production deployments utilize a lightweight single-tenant Access Token.
* **Mechanism**:
  * Set `APP_ACCESS_TOKEN=<token>` in the backend environment.
  * Requests to `/api/*` (excluding `/api/health`) require either:
    * HTTP Header: `Authorization: Bearer <token>`
    * Custom Header: `X-OmniAI-Token: <token>`
  * Requests without a matching token receive `401 Unauthorized`.
  * The frontend automatically supplies this header via `getAuthHeaders()` from `localStorage.getItem('omniai_access_token')` or `VITE_ACCESS_TOKEN`.
  * In development environments (`APP_ACCESS_TOKEN=""`), authentication is bypassed seamlessly.

### 2. Traffic Bounds & Rate Limiting
* `InMemoryRateLimiter` enforces a 60 requests-per-minute ceiling per IP on computationally heavy routes (`/api/chat`, `/api/compare`, `/api/documents/upload`).
* Exceeded requests receive `429 Too Many Requests` with a dynamic `Retry-After` header.

### 3. Payload & File Upload Protection
* Request body sizes are capped at 15 MB via `RequestSizeLimitMiddleware` before buffering into memory.
* Uploaded files undergo:
  * Extension whitelist verification (`.pdf`, `.txt`, `.md`, `.markdown`).
  * Unique UUID renaming and path traversal stripping via `os.path.basename`.
  * Files are stored under `/app/data/uploads/` outside any executable path.

### 4. Credential Sanitization
* Primary provider API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`) are kept exclusively in server environment variables.
* The application logging engine employs `SecretMaskingFilter`, which automatically scans all log messages and redacts Google Gemini (`AIza...`), Groq (`gsk_...`), OpenAI (`sk-...`), and Bearer tokens.

### 5. Defensive Security Headers
All HTTP responses include:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
Strict-Transport-Security: max-age=31536000; includeSubDomains (in production)
```

---

## 6. Database Persistence, Backup & Disaster Recovery

### SQLite WAL Mode Architecture
* OmniAI uses SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and a 5000ms busy timeout (`PRAGMA busy_timeout = 5000;`).
* WAL mode allows concurrent readers while writes are serialized without database locking issues.

### Online Backup Procedure
Because SQLite WAL mode is active, you must **never** take backups using naive OS file copies (`cp omniai.db backup.db`) while the backend is running, as this can result in inconsistent or corrupt snapshots.

Instead, execute the provided Python backup utility:
```bash
# Inside backend directory:
python scripts/backup_db.py

# Inside Docker backend container:
docker compose exec backend python scripts/backup_db.py
```
This utility:
1. Connects to the database and streams a non-blocking snapshot using SQLite's native `sqlite3.Connection.backup()` API.
2. Executes `PRAGMA integrity_check` on the backup file to guarantee zero corruption.
3. Saves to `/app/data/backups/omniai_backup_YYYYMMDD_HHMMSS.db`.
4. Automatically retains the 10 most recent backups and removes older snapshots.

### Automated Nightly Backup Cron
Add to the host's crontab (`crontab -e`):
```bash
0 2 * * * docker compose -f /path/to/OmniAI/docker-compose.yml exec -T backend python scripts/backup_db.py >> /var/log/omniai_backup.log 2>&1
```

### Restore Procedure
In the event of accidental data deletion or database corruption:
```bash
# 1. Stop the application to prevent writes
docker compose stop backend

# 2. Run the restore utility (defaults to the most recent validated backup)
docker compose run --rm backend python scripts/restore_db.py

# Or specify a target backup file:
docker compose run --rm backend python scripts/restore_db.py /app/data/backups/omniai_backup_20261030_120000.db

# 3. Restart the backend service
docker compose start backend
```
The restore utility automatically:
* Verifies the backup snapshot's integrity before touching the database.
* Creates a safety copy of the current state at `data/omniai_pre_restore.bak`.
* Restores all tables and indexes.
* Confirms post-restore integrity.

---

## 7. Troubleshooting Runbook

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| **Frontend shows "Network connection failure"** | Backend container down or Nginx proxy misconfigured. | Check `docker compose ps` and `docker compose logs backend`. Verify backend responds at `http://localhost:8000/api/health`. |
| **SSE Streaming freezes or arrives in chunks** | Nginx or intermediate proxy is buffering responses. | Ensure `proxy_buffering off;` and `proxy_set_header Connection '';` are present in Nginx configuration. |
| **API returns HTTP 401 Unauthorized** | `APP_ACCESS_TOKEN` is configured but frontend has not supplied it. | Pass token in header `X-OmniAI-Token` or configure `VITE_ACCESS_TOKEN` / `localStorage.setItem('omniai_access_token', 'token')`. |
| **API returns HTTP 429 Rate Limit Exceeded** | More than 60 requests sent in 1 minute from a single IP. | Wait for the `Retry-After` seconds or increase `RATE_LIMIT_PER_MINUTE` in `.env.production`. |
| **Chat fails with HTTP 503 Provider Unavailable** | `GEMINI_API_KEY` or `GROQ_API_KEY` missing or invalid. | Check backend environment variables. Restart container after setting valid free-tier keys. |
| **Upload returns HTTP 413 Payload Too Large** | Upload exceeds 15 MB boundary. | Ensure file is within 15 MB or increase `MAX_REQUEST_SIZE_BYTES` in backend config and `client_max_body_size` in `nginx.conf`. |

---

## 8. Known Operational Limitations

1. **Single Uvicorn Worker**: SQLite does not support distributed concurrent writes across multiple independent OS processes. The backend container runs with a single Uvicorn worker (`--workers 1`), utilizing Python's asynchronous event loop (`asyncio`) for high concurrency.
2. **Scanned PDF OCR**: PDF text parsing relies on `pypdf`. Image-only scanned PDFs are rejected with HTTP 400 with a notice to provide a text-searchable document.
3. **Single-Tenant Scope**: The database schema is designed for a single developer or team workbench. For multi-tenant hosting, database partitioning by tenant/user ID would be required.
