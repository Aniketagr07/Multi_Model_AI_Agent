# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (Google Gemini, OpenAI GPT, Anthropic Claude, and local models via Ollama), compare outputs side-by-side, route queries intelligently, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 3 — First Real AI Model Integration (Google Gemini API)  
> **Target Completion Date**: November 10, 2026  
> **API Budget**: ₹0 (Using Google AI Studio Free Tier Quota)

---

## 1. Planned & Completed Features

1. **Professional Dark Chat Interface (Day 2 Completed)**:
   * Modern, minimalist dark theme (#0B0D12, #10131A, #151923, #8B5CF6 accent).
   * CSS custom variables for dynamic theme customization.
   * Collapsible desktop sidebar and responsive mobile slide-over drawer.
   * Auto-resizing message composer with keyboard shortcuts (`Enter` to send, `Shift + Enter` for new lines).
   * Formatted message bubbles preserving line breaks and code blocks with one-click clipboard copying.
   * Welcome screen with three interactive prompt suggestions.
   * Active conversation management with realistic local demo sessions and state retention across switches.
   * Real-time backend connection status indicator connected to FastAPI `GET /api/health`.
2. **First Real AI Model Integration (Day 3 Completed)**:
   * **Real Provider Adapter**: `GeminiProvider` using Google AI Studio's Generative Language REST API (`gemini-1.5-flash` and `gemini-1.5-pro`).
   * **Polymorphic Architecture**: `BaseLLMProvider` abstract interface ready for Day 4 expansion.
   * **Real Chat Endpoint**: `POST /api/chat` with schema validation, model allowlist, and conversation history support.
   * **Monotonic Latency Tracking**: Real backend elapsed time recorded via `time.perf_counter()`.
   * **Zero Secrets in Frontend**: API keys remain strictly server-side in `backend/.env`.
   * **Graceful Error Handling**: Typed exceptions for missing keys (503), auth failures (502), rate limits (429), and timeouts (504).
3. **Multi-Model Provider Adapters (Day 4 Planned)**: Integration of additional providers (OpenAI, Anthropic Claude, and local Ollama) + multi-model comparison view.
4. **Intelligent Query Routing (Day 4 Planned)**: Complexity-based routing to select the optimal model.
5. **Persistent Conversation History (Day 5 Planned)**: Threaded sessions stored in SQLite with schema migrations.
6. **AI Council Consensus Engine (Day 6 Planned)**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.

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
* **AI Provider (Active in Day 3)**:
  * Google Gemini API (`gemini-1.5-flash`, `gemini-1.5-pro` via Google AI Studio Free Tier)

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
│   │   │   ├── MessageBubble.jsx      # Formatted bubbles, syntax panels & latency tags
│   │   │   ├── MessageComposer.jsx    # Auto-resizing textarea, model selector & send button
│   │   │   ├── ModelSelector.jsx      # Reusable AI model dropdown selector (Day 3 Active)
│   │   │   ├── WelcomeScreen.jsx      # Zero-state view with 3 interactive prompt cards
│   │   │   └── ConnectionStatus.jsx   # Real-time backend health monitor widget
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Live API dispatch, conversation state & retry flow
│   │   │   └── useHealthCheck.js      # Backend GET /api/health polling & status hook
│   │   ├── services/
│   │   │   └── api.js                 # Fetch API client (health check + POST /api/chat)
│   │   ├── App.jsx                    # Root application container & layout
│   │   ├── main.jsx                   # React DOM entry point
│   │   └── index.css                  # CSS custom variables & Tailwind configuration
│   ├── package.json                   # Node dependencies & build scripts
│   ├── tailwind.config.js             # Extended color palette & utilities
│   ├── vite.config.js                 # Vite dev server configuration (port 5173)
│   ├── .env.example                   # Frontend environment variables template
│   └── .env                           # Local frontend environment config
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py          # GET /api/health endpoint
│   │   │       ├── chat.py            # POST /api/chat endpoint (Day 3 Active)
│   │   │       └── __init__.py        # Main API router mounting /api routes
│   │   ├── core/
│   │   │   └── config.py              # Settings, Gemini config, CORS & model allowlist
│   │   ├── providers/
│   │   │   ├── base.py                # BaseLLMProvider abstract interface & exceptions
│   │   │   ├── gemini_provider.py     # Google Gemini API adapter using HTTPX (Day 3 Active)
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── chat_service.py        # Model validation, latency timer & provider dispatch
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── health.py              # Pydantic schema for health response
│   │   │   ├── chat.py                # Pydantic schemas for ChatRequest, ChatResponse, ChatMessage
│   │   │   └── __init__.py
│   │   └── main.py                    # FastAPI application factory & CORS configuration
│   ├── tests/
│   │   ├── test_health.py             # Automated unit tests for health & routing
│   │   └── test_chat.py               # Automated unit tests for chat validation, errors & mocks
│   ├── requirements.txt               # Backend Python dependencies
│   ├── .env.example                   # Backend environment variables template
│   └── .env                           # Local backend environment config
│
├── docs/
│   └── architecture.md                # System architecture, layers & adapter pattern
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

## 5. Configuration & Setup Instructions

### Step 1: Clone or Navigate to the Repository
```powershell
cd "d:\Lpu lecture ppt\Sem 3\CSE 276\Project\1"
```

### Step 2: Configure Environment Variables
Copy the templates to create active `.env` files:
```powershell
# Backend configuration
Copy-Item backend\.env.example backend\.env

# Frontend configuration
Copy-Item frontend\.env.example frontend\.env
```

### Step 3: Add Your Free Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and generate a free API key.
2. Open `backend/.env` in an editor and set:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
   *(If omitted, the application will still start and provide clear guidance if a chat prompt is sent).*

---

## 6. Running the Application

Start both the backend and frontend servers in separate terminal windows.

### Terminal 1: Start the FastAPI Backend
```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```
* **API Root**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Chat Endpoint**: `POST http://127.0.0.1:8000/api/chat`

### Terminal 2: Start the React Frontend
```powershell
cd frontend
npm run dev
```
* The frontend development server will launch at: **http://localhost:5173**
* Open your browser and navigate to `http://localhost:5173`.

---

## 7. Testing & Verification

### Run Backend Automated Tests (12 Test Cases, Mocked)
```powershell
python -m pytest backend/tests -v
```
All unit tests execute with mocked provider calls and do not consume API credits or require an active key.

### Build Frontend for Production
```powershell
npm --prefix frontend run build
```

---

## 8. Academic Context & Defense Notes

As an AI & ML student presenting this architecture for academic evaluation:
1. **The Adapter Pattern for Vendor Independence**: The `BaseLLMProvider` abstract base class isolates vendor-specific REST schemas inside `GeminiProvider`. Adding OpenAI or Ollama on Day 4 requires only adding a new provider adapter class without rewriting the frontend.
2. **Zero Secrets in Frontend**: `GEMINI_API_KEY` is loaded by FastAPI using Pydantic Settings and is never transmitted to the browser bundle.
3. **Monotonic Latency Measurement**: Round-trip time is recorded on the backend with `time.perf_counter()`, preventing client clock drift and providing telemetry data for multi-model comparison.
4. **Graceful Degradation**: If an API key is missing or quota is exceeded, the server returns structured HTTP status codes (503, 429) and user-friendly error guidance rather than crashing.
