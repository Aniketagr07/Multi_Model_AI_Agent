# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (Google Gemini, Groq-hosted Llama 3.1, Anthropic Claude, and local models via Ollama), compare outputs side-by-side concurrently, route queries intelligently via an automatic rule-based classifier, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 6 — Intelligent Model Router (Deterministic Heuristic Classification & Conservative Fallback Policy)  
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
5. **Intelligent Model Router (Day 6 Completed)**:
   * **Automatic Auto Mode (`model_id="auto"`)**: Server-side rule-based router that classifies incoming queries into categories (`coding`, `reasoning`, `writing`, `general`).
   * **Explainable Routing Decisions**: Every auto-routed response displays the classification category and a clear rationale (e.g., *"Selected Llama 3.1 8B because this request was classified as a coding task"*).
   * **Conservative Fallback Policy**: If the routed primary model experiences a transient error (e.g. HTTP 429 rate limit or timeout), the system attempts a single fallback to an alternate configured provider and informs the user. Auth and configuration failures are strictly not retried.
   * **Inexpensive & Zero Token Cost**: Operates deterministically in `<1ms` via compiled regex heuristics without spending paid API tokens on meta-routing.
   * **Verified Capability Registry**: Extended model registry with supported categories, strengths, verified context windows, and cost tiers.
6. **Persistent Conversation History & SQLite Storage (Day 7 Planned)**: Threaded sessions stored in SQLite with schema migrations.
7. **AI Council Consensus Engine (Day 8 Planned)**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.

---

## 2. Model Router Architecture & Task Classification

The router in `backend/app/services/model_router.py` applies deterministic, transparent contextual heuristics:

| Task Category | Detection Heuristics & Regex Triggers | Preferred Models (Priority Order) | Architectural Rationale |
| :--- | :--- | :--- | :--- |
| **Coding & Debugging** | Code fences (```` ``` ````), keywords (`def`, `class`, `import`, `function`), debugging tokens (`stack trace`, `traceback`, `syntax error`, `bug`, `fix`), complexity (`O(log n)`, `time complexity`). | 1. `llama-3.1-8b-instant`<br>2. `llama-3.3-70b-versatile`<br>3. `gemini-1.5-flash` | Groq LPU engine delivers sub-second deterministic code generation (500+ tok/s). |
| **Reasoning & Problem-Solving** | Step-by-step logic (`think step by step`, `walk through logic`), math derivations (`calculate`, `derive`, `formula`, `equation`, `proof`), trade-offs (`trade-offs`, `pros and cons`). | 1. `gemini-1.5-pro`<br>2. `llama-3.3-70b-versatile`<br>3. `gemini-1.5-flash` | Gemini 1.5 Pro features deep multi-step synthesis and a 1M token context buffer. |
| **Writing & Summarization** | Summarization tokens (`summarize`, `tl;dr`, `bullet point summary`), rewriting (`rewrite`, `paraphrase`, `formal tone`), prose drafting (`draft an email`, `essay`, `cover letter`). | 1. `gemini-1.5-flash`<br>2. `mixtral-8x7b-32768`<br>3. `llama-3.1-8b-instant` | Gemini 1.5 Flash provides high verbal fluency, balanced prose, and a generous 15 RPM free tier. |
| **General Conversational** | Greetings (`hello`, `good morning`), open Q&A, definitions, or queries without strong category triggers. | 1. `gemini-1.5-flash`<br>2. `llama-3.1-8b-instant` | Low latency, reliable default intelligence. |

### Known Limitations of Rule-Based Classification
> **Academic Note**: Rule-based heuristic classification is intentionally lightweight, transparent, deterministic, and free from circular API billing. However, it does not possess natural language understanding; nuanced semantic requests that lack typical category keywords will fall back to the general-purpose policy (`gemini-1.5-flash`). Users can always override the router by selecting a specific model manually in the UI.

---

## 3. Technology Stack

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
* **AI Providers (Active in Day 4–Day 6)**:
  * **Provider 1**: Google Gemini API (`gemini-1.5-flash`, `gemini-1.5-pro` via Google AI Studio)
  * **Provider 2**: Groq Cloud API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` via Groq LPUs)

---

## 4. Project Directory Structure

```
OmniAI/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx            # Collapsible navigation, view switcher & session list (Day 6)
│   │   │   ├── ChatHeader.jsx         # Sidebar toggle, title, model badge & health pill
│   │   │   ├── ChatWindow.jsx         # Scrollable message area & auto-scroll
│   │   │   ├── MessageBubble.jsx      # Formatted bubbles with routing badges & rationales (Day 6)
│   │   │   ├── MessageComposer.jsx    # Auto-resizing textarea, model selector & send button
│   │   │   ├── CompareView.jsx        # Day 5: Side-by-side concurrent response comparison
│   │   │   ├── ModelSelector.jsx      # Multi-Model dropdown with Auto (Smart Router) (Day 6)
│   │   │   ├── WelcomeScreen.jsx      # Zero-state view with 3 interactive prompt cards
│   │   │   └── ConnectionStatus.jsx   # Real-time backend health monitor widget
│   │   ├── hooks/
│   │   │   ├── useChat.js             # Live API dispatch, auto-routing & retry flow (Day 6)
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
│   │   │   └── model_registry.py      # Extended Model Registry with capability categorization (Day 6)
│   │   ├── providers/
│   │   │   ├── base.py                # BaseLLMProvider abstract interface & exceptions
│   │   │   ├── gemini_provider.py     # Provider 1: Google Gemini API adapter
│   │   │   ├── groq_provider.py       # Provider 2: Groq Cloud API adapter
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── chat_service.py        # Orchestrates routing, fallback policy, & latency
│   │   │   ├── comparison_service.py  # Day 5: Concurrent asyncio.gather orchestrator
│   │   │   ├── model_router.py        # Day 6: Deterministic rule-based router & scoring
│   │   │   └── __init__.py
│   │   ├── schemas/
│   │   │   ├── health.py              # Pydantic schema for health response
│   │   │   ├── chat.py                # ChatRequest (model_id='auto'), ChatResponse, ModelItemResponse
│   │   │   ├── compare.py             # CompareRequest, ModelComparisonResult, CompareResponse
│   │   │   └── __init__.py
│   │   └── main.py                    # FastAPI application factory & CORS configuration
│   ├── tests/
│   │   ├── test_health.py             # Automated unit tests for health & routing
│   │   ├── test_chat.py               # 11 unit tests for Gemini, Groq, registry, & errors
│   │   ├── test_compare.py            # 6 unit tests for concurrent compare & validation
│   │   └── test_router.py             # 11 unit tests for routing rules, auto-mode, & fallback (Day 6)
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

## 5. Configuration & Free API Setup

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

## 6. Running the Application

In two separate PowerShell terminal windows:

### Terminal 1: Start FastAPI Backend
```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```
* **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Model Registry**: [http://127.0.0.1:8000/api/models](http://127.0.0.1:8000/api/models)
* **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Chat Endpoint**: `POST http://127.0.0.1:8000/api/chat` (Accepts `model_id="auto"` or specific model ID)
* **Compare Endpoint**: `POST http://127.0.0.1:8000/api/compare`

### Terminal 2: Start React Frontend
```powershell
cd frontend
npm run dev
```
* **Web Interface**: [http://localhost:5173](http://localhost:5173)

---

## 7. Testing & Verification

### Run Backend Automated Tests (32 Test Cases, Mocked)
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
1. **Explainable Meta-Heuristic Routing**: Rather than treating model selection as an opaque black box or invoking an external LLM judge (which would double API latency and costs), OmniAI implements a deterministic rule-based router that executes in $<1\text{ms}$. Every routing decision attaches an explicit, human-readable rationale to the response payload.
2. **Conservative Fallback Invariant**: When `model_id="auto"` is selected, transient failures (HTTP 429 rate limit or 504 gateway timeout) trigger a single graceful fallback to another configured provider. If the failure is caused by invalid credentials (`ProviderAuthError`) or missing configuration (`ProviderConfigError`), fallback is strictly bypassed to prevent repetitive failures and avoid wasting quota.
3. **Decoupled Architecture**: The frontend communicates solely with `POST /api/chat` using `model_id="auto"` or explicit model IDs. Upstream API keys, base URLs, and vendor-specific protocol differences (Google Gemini `contents` vs Groq OpenAI `messages`) remain encapsulated on the backend.
