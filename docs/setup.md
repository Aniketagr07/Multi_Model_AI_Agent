# OmniAI Setup & Installation Guide

This guide walks you through setting up, configuring, testing, and running OmniAI on your local machine or server.

---

## 1. System Prerequisites

* **Operating System**: Windows 10/11, macOS, or Linux.
* **Python**: Python 3.10, 3.11, 3.12, 3.13, or 3.14.
* **Node.js**: Node.js 18.x or 20.x+ (with `npm`).
* **Git**: Installed and configured.

---

## 2. API Credentials (Free Tier)

OmniAI uses official free-tier APIs without requiring any credit card or paid services:

1. **Google Gemini API Key (Free)**:
   * Visit: [Google AI Studio](https://aistudio.google.com/app/apikey)
   * Create a free API key.
2. **Groq Cloud API Key (Free)**:
   * Visit: [Groq Console](https://console.groq.com/keys)
   * Create a free API key for ultra-fast LPU inference (30 RPM free).

---

## 3. Clone & Environment Configuration

### Step 1: Clone Repository
```bash
git clone https://github.com/Aniketagr07/Multi_Model_AI_Agent.git
cd Multi_Model_AI_Agent
```

### Step 2: Backend Environment Setup
Create a `.env` file in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your API keys:
```ini
APP_NAME="OmniAI Backend"
APP_ENV=development
DEBUG=true
PORT=8000
HOST=0.0.0.0

# CORS settings for development
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# AI Provider Credentials
GEMINI_API_KEY="your-google-gemini-api-key"
GROQ_API_KEY="your-groq-cloud-api-key"

# Default Model Selection
DEFAULT_MODEL="gemini-3.8-flash"
SQLITE_DB_PATH="data/omniai.db"
```

### Step 3: Frontend Environment Setup
Create a `.env` file in the `frontend/` directory (optional for custom backend port):
```bash
cp frontend/.env.example frontend/.env
```
Default points to `VITE_API_BASE_URL=http://localhost:8000`.

---

## 4. Install Dependencies

### Backend Dependencies
```bash
cd backend
python -m venv venv

# Windows activate:
venv\Scripts\activate

# macOS / Linux activate:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

### Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 5. Running the Application

### Option A: Standard Development Mode (Two Terminals)

**Terminal 1 (Backend FastAPI Server)**:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend React + Vite Dev Server)**:
```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open your browser to:
👉 **[http://127.0.0.1:5173](http://127.0.0.1:5173)**

Interactive API documentation is accessible at:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

---

## 6. Running Automated Tests

OmniAI has comprehensive automated test suites covering both the backend and frontend with zero real API token consumption (all tests use hermetic mocks).

### Backend Automated Test Suite (75 Tests)
Run backend tests using `pytest`:
```bash
# From workspace root:
python -m pytest backend/tests -v

# Or from backend directory:
cd backend
pytest -v
```
Test suites cover:
* `test_chat.py`: Chat endpoints, validation, provider dispatch, error handling, effort parameters.
* `test_compare.py`: Concurrent multi-model comparison, duplicate rejection, partial failure recovery.
* `test_conversations_mgmt.py`: Search, pin/unpin, archive/restore, rename, cascade deletion, multi-format export.
* `test_discovery.py`: BYOK model discovery and custom provider key resolution.
* `test_documents.py`: Document upload validation, PDF/TXT/MD extraction, corruption handling, size bounds, and grounded QA workflow.
* `test_health.py`: Health contracts, routing, and configurations.
* `test_router.py`: Rule-based intent classification, optimal model selection, fallback chains, 503 handling.
* `test_settings.py`: Settings persistence, prompt sanitization, model capability matrix.
* `test_storage.py`: SQLite persistence, conversation schemas, recent context windowing.
* `test_streaming.py`: SSE streaming pipeline, cancellation handling, regeneration, and persistence.

### Frontend Automated Test Suite (20 Tests across 6 Suites)
Run frontend tests using `vitest`:
```bash
# Run tests once:
cd frontend
npm test

# Run tests in watch mode:
npm run test:watch
```
Test suites cover:
* `conversations.test.jsx`: Conversation list rendering, switching, search filtering, pin and archive toggling.
* `documents.test.jsx`: File upload validation, invalid extension rejection, document badge display.
* `settings.test.jsx`: Dark/light/system theme toggling, custom instructions persistence.
* `markdown.test.jsx`: Rich markdown formatting, tables, syntax-highlighted code blocks with Copy buttons, and XSS sanitization.
* `chat.test.jsx`: Message rendering, keyboard shortcuts (Enter vs Shift+Enter), streaming pulse indicators, and error retry states.
* `models.test.jsx`: Model dropdown selection, intelligent routing explanation badges, and side-by-side model comparison dispatch.

### Production Build Validation
Verify zero build errors and clean bundling:
```bash
npm --prefix frontend run build
```

---

## 7. Security and Deployment Guide

### Deployment Architecture
OmniAI is architected for local desktop or private intranet deployment.

```
[Browser / Client]
       │
  (Reverse Proxy / Nginx - HTTPS & Rate Limiting)
       │
  ┌────┴──────────────────────────┐
  ▼                               ▼
Frontend (Vite Static Build)    Backend (FastAPI Uvicorn)
Port 5173 / Static Webroot      Port 8000
                                  │
                             SQLite (WAL)
```

### Production Checklist
1. **Environment Variables**:
   * Set `APP_ENV=production` and `DEBUG=false` in `backend/.env`.
   * Restrict `CORS_ORIGINS` to the exact production domain(s) (e.g., `https://omniai.internal.edu`).
2. **API Keys & Secrets**:
   * Provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`) reside exclusively in `backend/.env` or system environment variables.
   * Never commit `.env` to version control (guaranteed by `.gitignore`).
   * Keys supplied via the frontend Bring-Your-Own-Key (BYOK) modal reside only in user browser `localStorage` and memory; they are never permanently stored in the backend database.
3. **Database Persistence & Backup**:
   * Database file is located at `backend/data/omniai.db`.
   * WAL mode is enabled for high concurrency and crash resilience.
   * **Backup Procedure**: For live backup without stopping the server, execute SQLite vacuum backup:
     ```bash
     sqlite3 backend/data/omniai.db ".backup 'backend/data/omniai_backup.db'"
     ```
   * **Restore Procedure**: Stop backend, replace `omniai.db` with the backup file, and restart.
4. **File Upload Hardening**:
   * Stored under `backend/data/uploads/` outside the web root.
   * File extensions strictly limited to `.pdf`, `.txt`, `.md`.
   * Filenames sanitized via `os.path.basename` and unique UUID prefixes.
   * 10MB size restriction enforced at ingestion before memory buffering.
   * No uploaded files are ever executed or invoked by system shells.

---

## 8. Troubleshooting Common Issues

* **CORS Error in Browser Console**:
  * Verify `backend/.env` contains your exact frontend origin: `CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"`.
* **Gemini Model Timeout / Rate Limit**:
  * OmniAI includes an automatic active fallback chain (`gemini-3.6-flash`, `gemini-flash-lite-latest`). Ensure `GEMINI_API_KEY` is saved in `backend/.env` and the backend server was restarted.
* **Database Locked Error**:
  * OmniAI uses SQLite WAL mode with a 5000ms busy timeout. If a process locks the database, verify no stale SQLite locks exist in `backend/data/`.

