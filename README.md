# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (Google Gemini, Groq-hosted Llama 3.1, Anthropic Claude, and local models via Ollama), compare outputs side-by-side concurrently, route queries intelligently, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 5 — Multi-Model Response Comparison (Concurrent Dual-Model Dispatch & Side-by-Side Benchmark)  
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
4. **Multi-Model Response Comparison View (Day 5 Completed)**:
   * **Concurrent Model Dispatch Endpoint**: `POST /api/compare` broadcasting the prompt to two distinct models concurrently.
   * **True Asynchronous Concurrency**: Built with Python's `asyncio.gather()`, initiating non-blocking I/O simultaneously across both providers.
   * **Fault-Tolerant Partial Failures**: If one provider encounters an error (e.g. 429 quota or timeout), the other provider's successful response is preserved and returned.
   * **Independent High-Precision Latency Tracking**: Measured via `time.perf_counter()` individually per model task.
   * **Interactive Side-by-Side UI**: Dynamic dual-panel layout with formatted markdown, syntax-highlighted code blocks, copy buttons, suggestion pills, and retry triggers.
   * **Validation & Guardrails**: Enforces non-empty prompts, distinct model IDs (no duplicate model calls to protect free API quota), and server-side model existence checks.
5. **Persistent Conversation History & SQLite Storage (Day 6 Planned)**: Threaded sessions stored in SQLite with schema migrations.
6. **AI Council Consensus Engine (Day 7 Planned)**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.

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
* **AI Providers (Active in Day 4 & Day 5)**:
  * **Provider 1**: Google Gemini API (`gemini-1.5-flash`, `gemini-1.5-pro` via Google AI Studio)
  * **Provider 2**: Groq Cloud API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` via Groq LPUs)

---

## 3. Project Directory Structure

```
OmniAI/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx            # Collapsible navigation, view switcher & session list
│   │   │   ├── ChatHeader.jsx         # Sidebar toggle, title, model badge & health pill
│   │   │   ├── ChatWindow.jsx         # Scrollable message area & auto-scroll
│   │   │   ├── MessageBubble.jsx      # Formatted bubbles with provider tags & latency badges
│   │   │   ├── MessageComposer.jsx    # Auto-resizing textarea, model selector & send button
│   │   │   ├── CompareView.jsx        # Day 5: Side-by-side concurrent response comparison
│   │   │   ├── ModelSelector.jsx      # Multi-Model dropdown (Gemini & Groq Active)
│   │   │   ├── WelcomeScreen.jsx      # Zero-state view with 3 interactive prompt cards
│   │   │   └── ConnectionStatus.jsx   # Real-time backend health monitor widget
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Live API dispatch, model-locked requests & retry flow
│   │   │   └── useHealthCheck.js      # Backend GET /api/health polling & status hook
│   │   ├── services/
│   │   │   └── api.js                 # API client (GET /api/models, POST /api/chat, POST /api/compare)
│   │   ├── App.jsx                    # Root view orchestrator ('chat' | 'compare')
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
│   │   │       ├── compare.py         # Day 5: POST /api/compare endpoint
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
│   │   │   ├── comparison_service.py  # Day 5: Concurrent asyncio.gather orchestrator
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── health.py              # Pydantic schema for health response
│   │   │   ├── chat.py                # Pydantic schemas for ChatRequest, ChatResponse, ModelRegistryResponse
│   │   │   ├── compare.py             # Day 5: CompareRequest, ModelComparisonResult, CompareResponse
│   │   │   └── __init__.py
│   │   └── main.py                    # FastAPI application factory & CORS configuration
│   ├── tests/
│   │   ├── test_health.py             # Automated unit tests for health & routing
│   │   ├── test_chat.py               # 11 unit tests for Gemini, Groq, registry, & errors
│   │   └── test_compare.py            # 6 unit tests for concurrent compare, partial failure, & validation
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
* **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Model Registry**: [http://127.0.0.1:8000/api/models](http://127.0.0.1:8000/api/models)
* **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Chat Endpoint**: `POST http://127.0.0.1:8000/api/chat`
* **Compare Endpoint**: `POST http://127.0.0.1:8000/api/compare`

### Terminal 2: Start React Frontend
```powershell
cd frontend
npm run dev
```
* **Web Interface**: [http://localhost:5173](http://localhost:5173)

---

## 6. Testing & Verification

### Run Backend Automated Tests (21 Test Cases, Mocked)
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
1. **Concurrent Non-Blocking Orchestration**: The comparison engine uses Python's `asyncio.gather()` to dispatch HTTP requests simultaneously. Rather than sequentially waiting $T_A + T_B$, the total response time is $\max(T_A, T_B) + \epsilon$, halving user latency for multi-model queries.
2. **Independent Monotonic Timing**: Each model task wraps its dispatch with `time.perf_counter()`, isolating provider latency from network jitter and server-side serialization overhead.
3. **Resilient Partial Failure Handling**: If Groq encounters rate limiting (HTTP 429) while Gemini succeeds, the response wraps the failure in `ModelComparisonResult(success=False, error=...)` without aborting the entire request.
4. **Polymorphic Provider Pattern**: `GeminiProvider` and `GroqProvider` both implement `BaseLLMProvider`. The `ComparisonService` treats providers uniformly through runtime polymorphism.
5. **Zero-Quota Waste Protections**: The frontend and backend prevent identical-model comparisons (`model_a_id == model_b_id`) to conserve free-tier API quotas.
