# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (OpenAI GPT, Anthropic Claude, Google Gemini, and local models via Ollama), compare outputs side-by-side, route queries intelligently, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 1 — Project Initialization & Architecture  
> **Target Completion Date**: November 10, 2026

---

## 1. Planned Features

1. **Multi-Model Conversations**: Single chat interface to prompt top-tier commercial and open-weight models.
2. **Manual Model Selection**: User control over the active model per message or per session.
3. **Multi-Model Comparison**: Simultaneous prompt broadcast to multiple models to compare reasoning, speed, and formatting.
4. **Intelligent Query Routing**: Rule- and complexity-based routing to select the most cost-effective and accurate model.
5. **Persistent Conversation History**: Threaded sessions stored in SQLite with schema migrations.
6. **Latency & Metric Tracking**: Response timing (ms), tokens per second, and operational availability telemetry.
7. **AI Council Engine**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.
8. **Local Model Support**: Privacy-first local inference using Ollama (e.g., Llama 3, Mistral, Qwen).

---

## 2. Technology Stack

* **Frontend**:
  * React 18 (Functional components, custom hooks)
  * Vite (Fast HMR bundler)
  * Tailwind CSS (Charcoal dark-mode theme)
  * Fetch API (Native standard REST client)
* **Backend**:
  * Python 3.14+
  * FastAPI (High-performance ASGI framework)
  * Uvicorn (ASGI server)
  * Pydantic v2 (Schema validation and settings management)
  * HTTPX (Asynchronous HTTP client)
  * python-dotenv (Environment configuration)
* **Database (Planned for Day 2+)**:
  * SQLite (Zero-configuration file-based relational database)

---

## 3. Project Directory Structure

```
OmniAI/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components (Header, StatusIndicator, PhaseRoadmap)
│   │   ├── pages/            # View pages and route containers (.gitkeep)
│   │   ├── services/         # API integration layer using Fetch API (api.js)
│   │   ├── hooks/            # Custom React hooks (useHealthCheck.js)
│   │   ├── App.jsx           # Root application component
│   │   ├── main.jsx          # React DOM entry point
│   │   └── index.css         # Tailwind styles & theme variables
│   ├── index.html            # Vite HTML template
│   ├── package.json          # Node dependencies & build scripts
│   ├── postcss.config.js     # PostCSS configuration
│   ├── tailwind.config.js    # Tailwind palette & theme customization
│   ├── vite.config.js        # Vite dev server configuration
│   └── .env.example          # Frontend environment variables template
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/       # Endpoint routers (health.py, __init__.py)
│   │   ├── core/             # Configuration & global settings (config.py)
│   │   ├── providers/        # Multi-model LLM abstraction layer (planned)
│   │   ├── services/         # Business logic & orchestration (planned)
│   │   ├── database/         # SQLite persistence models & connections (planned)
│   │   ├── schemas/          # Pydantic schemas (health.py)
│   │   └── main.py           # FastAPI application factory & CORS configuration
│   ├── tests/                # Automated pytest test suite
│   │   ├── __init__.py
│   │   └── test_health.py
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Backend environment variables template
│
├── docs/
│   └── architecture.md       # Detailed system design & layer documentation
│
├── .gitignore                # Git exclusions (env, venv, node_modules, caches)
└── README.md                 # Project guide & documentation
```

---

## 4. Prerequisites

Before running the project on Windows, verify that the following tools are installed:

* **Node.js**: v18.0.0 or higher (`node -v`)
* **npm**: v9.0.0 or higher (`npm -v`)
* **Python**: 3.10 or higher (`python --version`)
* **Git**: (`git --version`)

---

## 5. Installation Instructions (Windows PowerShell)

### Step 1: Clone or Navigate to the Repository
```powershell
cd "d:\Lpu lecture ppt\Sem 3\CSE 276\Project\1"
```

### Step 2: Configure Environment Variables
Copy the provided `.env.example` templates to create active `.env` files:

```powershell
# Backend configuration
Copy-Item backend\.env.example backend\.env

# Frontend configuration
Copy-Item frontend\.env.example frontend\.env
```

### Step 3: Install Backend Dependencies
```powershell
pip install -r backend\requirements.txt
```

### Step 4: Install Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

---

## 6. Running the Application

To run OmniAI, start both the backend and frontend servers in separate terminal windows.

### Terminal 1: Start the FastAPI Backend
```powershell
# From the project root directory
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```
* The backend API will be available at: **http://127.0.0.1:8000**
* Interactive Swagger API documentation: **http://127.0.0.1:8000/docs**
* Alternative ReDoc documentation: **http://127.0.0.1:8000/redoc**

### Terminal 2: Start the React Frontend
```powershell
# From the project root directory
cd frontend
npm run dev
```
* The frontend development server will launch at: **http://localhost:5173**
* Open your browser and navigate to `http://localhost:5173`. The connection status indicator will automatically verify communication with the FastAPI backend.

---

## 7. Testing the Health Endpoint

### Option A: Via Automated Pytest Suite
Run the backend unit tests from the project root:
```powershell
python -m pytest backend/tests -v
```

### Option B: Via cURL / PowerShell
```powershell
curl http://127.0.0.1:8000/api/health
```
Expected JSON Response:
```json
{
  "app_name": "OmniAI Backend",
  "status": "healthy",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-10-28T12:33:36.808591+00:00"
}
```

### Option C: Via Web Browser / Swagger UI
Visit `http://127.0.0.1:8000/api/health` directly in your browser.

---

## 8. Troubleshooting & Common Issues

### Issue 1: CORS Errors in Browser Console
* **Symptom**: Browser console shows `Access to fetch at 'http://localhost:8000/api/health' from origin 'http://localhost:5173' has been blocked by CORS policy`.
* **Fix**: Ensure `backend/.env` contains `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`. FastAPI reads this setting and configures `CORSMiddleware` accordingly. Restart the FastAPI server after modifying `.env`.

### Issue 2: Frontend Shows "Disconnected" Status
* **Symptom**: The OmniAI interface displays a red "Disconnected" badge with an error message.
* **Fix**:
  1. Confirm the backend is running in Terminal 1 without crashing.
  2. Test `http://127.0.0.1:8000/api/health` in your browser.
  3. Verify `frontend/.env` has `VITE_API_BASE_URL=http://localhost:8000` (or `http://127.0.0.1:8000`).

### Issue 3: Port 8000 or 5173 Already in Use
* **Fix**:
  * Check for running processes on port 8000:
    ```powershell
    Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    ```
  * Or specify an alternate port when starting uvicorn:
    ```powershell
    python -m uvicorn app.main:app --app-dir backend --port 8001
    ```
    Then update `VITE_API_BASE_URL=http://localhost:8001` in `frontend/.env` and reload the frontend.

---

## 9. Academic Context & Defense Notes

As an AI & ML student presenting this architecture for academic evaluation:
1. **Separation of Concerns**: The frontend remains purely a presentation and state management layer; it has no direct dependency on proprietary AI SDKs.
2. **Extensibility via Adapter Pattern**: The planned `providers/` directory uses polymorphism so that any future LLM (proprietary or local Ollama) can be plugged in without refactoring client-side React code.
3. **Zero Secrets in Frontend**: API keys remain strictly server-side, preventing accidental exposure via client bundles.
