# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (OpenAI GPT, Anthropic Claude, Google Gemini, and local models via Ollama), compare outputs side-by-side, route queries intelligently, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 2 — Professional Chat Interface  
> **Target Completion Date**: November 10, 2026

---

## 1. Planned & Completed Features

1. **Professional Dark Chat Interface (Day 2 Completed)**:
   * Modern, minimalist dark theme (#0B0D12, #10131A, #151923, #8B5CF6 accent).
   * CSS custom variables for dynamic theme customization.
   * Collapsible desktop sidebar and responsive mobile slide-over drawer.
   * Auto-resizing message composer with keyboard shortcuts (Enter to send, Shift + Enter for new lines).
   * Formatted message bubbles preserving line breaks and highlighting code blocks with one-click clipboard copy.
   * Reusable `ModelSelector` component with configurable model placeholders.
   * Welcome screen with three interactive prompt suggestions.
   * Active conversation management with realistic local demo sessions and state retention across switches.
   * Real-time backend connection status indicator connected to FastAPI GET `/api/health`.
2. **Multi-Model Provider Adapters (Day 3 Planned)**: Unified backend provider adapters for OpenAI, Anthropic Claude, Google Gemini, and Ollama.
3. **Multi-Model Comparison (Day 4 Planned)**: Simultaneous prompt broadcast to multiple models to compare reasoning, speed, and formatting.
4. **Intelligent Query Routing (Day 4 Planned)**: Rule- and complexity-based routing to select the most cost-effective and accurate model.
5. **Persistent Conversation History (Day 5 Planned)**: Threaded sessions stored in SQLite with schema migrations.
6. **Latency & Metric Tracking (Day 5 Planned)**: Response timing (ms), tokens per second, and operational availability telemetry.
7. **AI Council Consensus Engine (Day 6 Planned)**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.

---

## 2. Technology Stack

* **Frontend**:
  * React 18 (Functional components, custom hooks `useChat`, `useHealthCheck`)
  * Vite (Fast HMR bundler)
  * Tailwind CSS (Charcoal dark-mode theme, CSS custom variables)
  * Fetch API (Native standard REST client)
* **Backend**:
  * Python 3.14+
  * FastAPI (High-performance ASGI framework)
  * Uvicorn (ASGI server)
  * Pydantic v2 (Schema validation and settings management)
  * HTTPX (Asynchronous HTTP client)
  * python-dotenv (Environment configuration)
* **Database (Planned for Day 5+)**:
  * SQLite (Zero-configuration file-based relational database)

---

## 3. Project Directory Structure

```
OmniAI/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx            # Collapsible navigation, new chat & session list
│   │   │   ├── ChatHeader.jsx         # Sidebar toggle, title, model badge & health pill
│   │   │   ├── ChatWindow.jsx         # Scrollable message area & auto-scroll
│   │   │   ├── MessageBubble.jsx      # Formatted bubbles & syntax-highlighted code blocks
│   │   │   ├── MessageComposer.jsx    # Auto-resizing textarea, model selector & send button
│   │   │   ├── ModelSelector.jsx      # Reusable AI model dropdown selector
│   │   │   ├── WelcomeScreen.jsx      # Zero-state view with 3 interactive prompt cards
│   │   │   └── ConnectionStatus.jsx   # Real-time backend health monitor widget
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Conversation management, demo data & submission state
│   │   │   └── useHealthCheck.js      # Backend GET /api/health polling & status hook
│   │   ├── services/
│   │   │   └── api.js                 # Fetch API client (health check + chat contract boundary)
│   │   ├── pages/
│   │   │   └── .gitkeep               # Placeholder for multi-page routing in future phases
│   │   ├── App.jsx                    # Root application container & layout
│   │   ├── main.jsx                   # React DOM entry point
│   │   └── index.css                  # CSS custom variables & Tailwind configuration
│   ├── index.html                     # Vite HTML template
│   ├── package.json                   # Node dependencies & build scripts
│   ├── postcss.config.js              # PostCSS configuration
│   ├── tailwind.config.js             # Extended color palette & utilities
│   ├── vite.config.js                 # Vite dev server configuration (port 5173)
│   ├── .env.example                   # Frontend environment variables template
│   └── .env                           # Local frontend environment config
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py          # GET /health endpoint handler returning HealthResponse
│   │   │       └── __init__.py        # Main API router mounting /api routes
│   │   ├── core/
│   │   │   └── config.py              # Pydantic Settings & CORS configuration
│   │   ├── providers/                 # LLM provider adapter interfaces (planned Day 3)
│   │   ├── services/                  # Business logic & orchestration (planned Day 4)
│   │   ├── database/                  # SQLite persistence models & connections (planned Day 5)
│   │   ├── schemas/
│   │   │   └── health.py              # Pydantic schema for /api/health response contract
│   │   └── main.py                    # FastAPI application factory & CORS configuration
│   ├── tests/
│   │   └── test_health.py             # Automated unit tests for config, health & routing
│   ├── requirements.txt               # Backend Python dependencies
│   ├── .env.example                   # Backend environment variables template
│   └── .env                           # Local backend environment config
│
├── docs/
│   └── architecture.md                # System architecture, layers & adapter pattern
│
├── .gitignore                         # Git exclusions (env, venv, node_modules, caches)
└── README.md                          # Project guide & documentation
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

### Step 1: Navigate to the Repository
```powershell
cd "d:\Lpu lecture ppt\Sem 3\CSE 276\Project\1"
```

### Step 2: Configure Environment Variables
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
* Health endpoint: **http://127.0.0.1:8000/api/health**

### Terminal 2: Start the React Frontend
```powershell
# From the project root directory
cd frontend
npm run dev
```
* The frontend development server will launch at: **http://localhost:5173**
* Open your browser and navigate to `http://localhost:5173`.

---

## 7. Testing & Verification

### Run Backend Automated Unit Tests
```powershell
python -m pytest backend/tests -v
```

### Build Frontend for Production
```powershell
npm --prefix frontend run build
```

---

## 8. Academic Context & Defense Notes

As an AI & ML student presenting this architecture for academic evaluation:
1. **Clean Separation of Concerns**: The React application is strictly a presentation and state management layer; it has no direct dependency on proprietary AI SDKs.
2. **Extensibility via Model Selection**: The `ModelSelector` and `useChat` hook are structured so that future backend provider adapters (OpenAI, Anthropic Claude, Gemini, Ollama) can be plugged in seamlessly on Day 3 without restructuring the UI.
3. **Honest Engineering Boundaries**: No fake token counters or fabricated AI responses are presented. The UI accurately reflects whether backend AI adapters are connected.
