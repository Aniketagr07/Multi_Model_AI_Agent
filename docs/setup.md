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

Run backend tests using `pytest`:
```bash
python -m pytest backend/tests -v
```
To run frontend production build validation:
```bash
npm --prefix frontend run build
```

---

## 7. Troubleshooting Common Issues

* **CORS Error in Browser Console**:
  * Verify `backend/.env` contains your exact frontend origin: `CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"`.
* **Gemini Model Timeout / Rate Limit**:
  * OmniAI includes an automatic active fallback chain (`gemini-3.6-flash`, `gemini-flash-lite-latest`). Ensure `GEMINI_API_KEY` is saved in `backend/.env` and the backend server was restarted.
* **Database Locked Error**:
  * OmniAI uses SQLite WAL mode with a 5000ms busy timeout. If a process locks the database, verify no stale SQLite locks exist in `backend/data/`.
