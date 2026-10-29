# OmniAI — Intelligent Multi-Model AI Chatbot

OmniAI is an intelligent, multi-model AI chatbot application developed as a B.Tech Artificial Intelligence and Machine Learning capstone project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple AI models (Google Gemini, Groq-hosted Llama 3.1, Anthropic Claude, and local models via Ollama), compare outputs side-by-side concurrently, route queries intelligently via an automatic rule-based classifier, persist conversation history across sessions via SQLite, and aggregate consensus responses via an AI Council.

> **Project Milestone**: Day 7 — Persistent Chat History & Full Application Stabilization  
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
6. **Persistent Conversation History & Stabilization (Day 7 Completed)**:
   * **Embedded SQLite Database**: Lightweight, zero-dependency persistent storage using Python's standard library `sqlite3` configured with WAL (Write-Ahead Logging) and enforced foreign keys (`PRAGMA foreign_keys = ON`).
   * **Relational Schema**: Normalized `conversations` and `messages` tables with cascading deletion (`ON DELETE CASCADE`) and composite index on `(conversation_id, created_at)`.
   * **Full RESTful CRUD Endpoints**: `GET /api/conversations`, `POST /api/conversations`, `GET /api/conversations/{id}`, `PATCH /api/conversations/{id}` (rename), and `DELETE /api/conversations/{id}`.
   * **Sliding-Window Context Truncation**: Model execution automatically injects the most recent $N$ conversational turns from SQLite into the upstream prompt payload, preventing unbounded token growth while maintaining conversational coherence.
   * **Fail-Safe Message Persistence**: User prompts are committed to SQLite immediately upon receipt; if upstream provider inference fails, the prompt is preserved without fabricating assistant responses.
   * **Frontend History Integration**: Sidebar displays real saved conversations from SQLite, supports inline title renaming, and allows safe deletion with confirmation.
7. **AI Council Consensus Engine (Day 8 Planned)**: Multi-agent synthesis summarizing consensus, disagreements, and optimal answers.

---

## 2. Database Architecture & SQLite Data Model

The application uses an embedded SQLite database stored outside version control at `backend/data/omniai.db` (configured via `SQLITE_DB_PATH`).

```
                    ┌────────────────────────────┐
                    │       conversations        │
                    ├────────────────────────────┤
                    │ id (TEXT, PK)              │
                    │ title (TEXT)               │
                    │ created_at (TEXT, ISO8601) │
                    │ updated_at (TEXT, ISO8601) │
                    └──────────────┬─────────────┘
                                   │ 1
                                   │
                                   │ N (CASCADE DELETE)
                    ┌──────────────▼─────────────┐
                    │          messages          │
                    ├────────────────────────────┤
                    │ id (TEXT, PK)              │
                    │ conversation_id (TEXT, FK) │
                    │ role (user | assistant)    │
                    │ content (TEXT)             │
                    │ model_id (TEXT, nullable)  │
                    │ provider (TEXT, nullable)  │
                    │ latency_ms (INT, nullable) │
                    │ routed (INT: 0 | 1)        │
                    │ routing_category (TEXT)    │
                    │ routing_explanation (TEXT) │
                    │ created_at (TEXT, ISO8601) │
                    └────────────────────────────┘
```

### Performance & Concurrency Features
* **WAL Mode (`PRAGMA journal_mode = WAL`)**: Allows concurrent reads while writes take place, preventing database lock contention.
* **Non-Blocking Execution (`asyncio.to_thread`)**: Database I/O is dispatched to Python's background worker threads, preventing event-loop blockage in asynchronous FastAPI endpoints.
* **Single-User Scope**: Designed and documented for local, single-user operation in this college project version. No multi-user authentication or role-based isolation is claimed.

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
  * SQLite 3 (Built-in relational persistence with WAL mode)
  * python-dotenv (Environment configuration)
* **AI Providers (Active in Day 4–Day 7)**:
  * **Provider 1**: Google Gemini API (`gemini-1.5-flash`, `gemini-1.5-pro` via Google AI Studio)
  * **Provider 2**: Groq Cloud API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` via Groq LPUs)

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & uptime status |
| `GET` | `/api/models` | List registered AI models & verified capabilities |
| `POST` | `/api/chat` | Send prompt to AI model or router (`model_id="auto"`) with SQLite persistence |
| `POST` | `/api/compare` | Parallel side-by-side dual model comparison |
| `GET` | `/api/conversations` | List all saved conversations ordered by `updated_at DESC` |
| `POST` | `/api/conversations` | Create a new conversation session |
| `GET` | `/api/conversations/{id}` | Retrieve conversation metadata and full message history |
| `PATCH` | `/api/conversations/{id}` | Rename conversation title |
| `DELETE` | `/api/conversations/{id}` | Permanently delete conversation and cascaded messages |

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
SQLITE_DB_PATH=data/omniai.db
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
* **Conversations**: [http://127.0.0.1:8000/api/conversations](http://127.0.0.1:8000/api/conversations)

### Terminal 2: Start React Frontend
```powershell
cd frontend
npm run dev
```
* **Web Interface**: [http://localhost:5173](http://localhost:5173)

---

## 7. Testing & Verification

### Run Full Backend Test Suite (39 Test Cases, Mocked)
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
1. **Relational vs NoSQL Decision**: SQLite was selected over Document Stores because chat sessions exhibit clear 1-to-N parent-child relationships with referential integrity requirements. Foreign keys with `ON DELETE CASCADE` guarantee that deleting a conversation leaves no orphaned messages in disk storage.
2. **Asynchronous Non-Blocking SQLite**: Standard SQLite database drivers perform synchronous disk I/O. To prevent blocking FastAPI's asynchronous event loop during database reads and writes, all database operations are wrapped with `asyncio.to_thread()`, delegating execution to Python's background thread pool executor.
3. **Sliding-Window Context Invariant**: If a user exchanges 50 messages, transmitting the entire history to an LLM provider will rapidly exhaust the context window and consume massive input token quotas. OmniAI automatically queries the last $N$ messages from SQLite, ensuring responsive responses and staying well within free-tier TPM limits.
4. **Idempotent Prompt Persistence**: If an upstream model experiences an outage or rate limit error after the user submits a message, the user prompt is already saved in SQLite. When the user clicks "Retry", the frontend re-uses the existing conversation session without creating redundant duplicate threads.
