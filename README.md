# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (Google Gemini, Groq-hosted Llama 3.1, Anthropic Claude, and local models via Ollama), compare outputs side-by-side, route queries intelligently, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 4 — Second Real AI Model Integration (Groq Cloud API & Multi-Model Switching)  
> **Target Completion Date**: November 10, 2026  
> **API Budget**: ₹0 (Using Google AI Studio & Groq Cloud Free Tier Quotas)

---

## 1. Planned & Completed Features

1. **Professional Dark Chat Interface (Day 2 Completed)**:
   * Modern, minimalist dark theme (#0B0D12, #10131A, #151923, #8B5CF6 accent).
   * CSS custom variables for dynamic theme customization.
   * Collapsible desktop sidebar and responsive mobile slide-over drawer.
   * Auto-resizing message composer with keyboard shortcuts (`Enter` to send, `Shift + Enter` for new lines).
   * Formatted message bubbles preserving line breaks and code blocks with one-click clipboard copying.
   * Real-time backend connection status indicator connected to FastAPI `GET /api/health`.
2. **First Real AI Model Integration (Day 3 Completed)**:
   * `GeminiProvider` using Google AI Studio's Generative Language REST API (`gemini-1.5-flash` and `gemini-1.5-pro`).
   * `BaseLLMProvider` abstract interface establishing common provider adapter contracts.
   * `POST /api/chat` endpoint with input validation and latency measurement.
3. **Second Real AI Model Integration & Multi-Model Switching (Day 4 Completed)**:
   * **Second Real Provider**: `GroqProvider` using Groq Cloud's ultra-fast LPU inference engine (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`).
   * **Server-Side Model Registry**: `ModelRegistry` mapping internal IDs to provider adapters with live availability tracking.
   * **Model Registry Endpoint**: `GET /api/models` exposing available models to clients.
   * **Seamless Multi-Model Switching**: Users can select Model A (Gemini), send a query, switch to Model B (Groq Llama 3.1), and send another query.
   * **Distinct Provider Styling**: Google responses feature blue badges, and Groq responses feature amber/orange badges with latency metrics.
   * **15 Automated Unit Tests**: Comprehensive tests covering both providers, error states, and mock responses.
4. **Persistent Conversation History & SQLite Storage (Day 5 Planned)**: Threaded sessions stored in SQLite with schema migrations.
5. **Multi-Model Comparison View (Day 5 Planned)**: Simultaneous prompt broadcast to multiple models to compare reasoning, speed, and formatting.
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
* **AI Providers (Active in Day 4)**:
  * **Provider 1**: Google Gemini API (`gemini-1.5-flash`, `gemini-1.5-pro` via Google AI Studio)
  * **Provider 2**: Groq Cloud API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` via Groq LPUs)

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
│   │   │   ├── MessageBubble.jsx      # Formatted bubbles with provider tags & latency badges
│   │   │   ├── MessageComposer.jsx    # Auto-resizing textarea, model selector & send button
│   │   │   ├── ModelSelector.jsx      # Multi-Model dropdown (Gemini & Groq Active)
│   │   │   ├── WelcomeScreen.jsx      # Zero-state view with 3 interactive prompt cards
│   │   │   └── ConnectionStatus.jsx   # Real-time backend health monitor widget
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Live API dispatch, model-locked requests & retry flow
│   │   │   └── useHealthCheck.js      # Backend GET /api/health polling & status hook
│   │   ├── services/
│   │   │   └── api.js                 # Fetch API client (GET /api/models, POST /api/chat)
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
│   │   │       ├── chat.py            # POST /api/chat & GET /api/models endpoints
│   │   │       └── __init__.py        # Main API router mounting /api routes
│   │   ├── core/
│   │   │   ├── config.py              # Settings, Gemini & Groq configs, CORS & model allowlist
│   │   │   └── model_registry.py      # Server-Side Model Registry & availability evaluator
│   │   ├── providers/
│   │   │   ├── base.py                # BaseLLMProvider abstract interface & exceptions
│   │   │   ├── gemini_provider.py     # Provider 1: Google Gemini API adapter
│   │   │   ├── groq_provider.py       # Provider 2: Groq Cloud API adapter (Day 4 Active)
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── chat_service.py        # Multi-provider routing & monotonic latency timer
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── health.py              # Pydantic schema for health response
│   │   │   ├── chat.py                # Pydantic schemas for ChatRequest, ChatResponse, ModelRegistryResponse
│   │   │   └── __init__.py
│   │   └── main.py                    # FastAPI application factory & CORS configuration
│   ├── tests/
│   │   ├── test_health.py             # Automated unit tests for health & routing
│   │   └── test_chat.py               # 11 unit tests for Gemini, Groq, registry, & errors
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

## 4. Configuration & Free API Setup

Both AI providers offer free developer tiers requiring ₹0:

1. **Google Gemini API**:
   * Generate free API key at: [Google AI Studio](https://aistudio.google.com/app/apikey)
   * Free Quota: 15 RPM, 1 Million TPM

2. **Groq Cloud API**:
   * Generate free API key at: [Groq Console](https://console.groq.com/keys)
   * Free Quota: 30 RPM, 6,000 TPM

Add them to `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

---

## 5. Running the Application

In two separate PowerShell terminal windows:

### Terminal 1: Start FastAPI Backend
```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```
* **Interactive Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Model Registry**: [http://127.0.0.1:8000/api/models](http://127.0.0.1:8000/api/models)
* **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Chat Endpoint**: `POST http://127.0.0.1:8000/api/chat`

### Terminal 2: Start React Frontend
```powershell
cd frontend
npm run dev
```
* **Web Interface**: [http://localhost:5173](http://localhost:5173)

---

## 6. Testing & Verification

### Run Backend Automated Tests (15 Test Cases, Mocked)
```powershell
python -m pytest backend/tests -v
```

### Build Frontend for Production
```powershell
npm --prefix frontend run build
```

---

## 7. Academic Context & Defense Notes

As an AI & ML student presenting this architecture for academic evaluation:
1. **Polymorphic Provider Pattern**: `GeminiProvider` and `GroqProvider` both implement `BaseLLMProvider`. The `ChatService` selects the provider at runtime based on the `ModelRegistry`, ensuring zero vendor lock-in.
2. **Heterogeneous Protocol Handling**: Gemini uses Google's custom `contents: [{role, parts}]` JSON schema, whereas Groq uses the industry-standard OpenAI `messages: [{role, content}]` schema. The backend abstracts these protocol differences completely from the frontend.
3. **In-Flight Model Isolation**: The frontend locks in the selected model identifier per request closure, preventing UI model switches from corrupting in-flight network requests.
