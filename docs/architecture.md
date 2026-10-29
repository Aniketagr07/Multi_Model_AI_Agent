# OmniAI System Architecture & Engineering Design

This document details the software architecture, design principles, and multi-model integration strategy for **OmniAI** — an intelligent multi-model AI chatbot application.

---

## 1. High-Level Architectural Flow

OmniAI follows a decoupled, modular client-server architecture designed for high extensibility, testability, and model-agnostic communication.

```
+-----------------------------------------------------------+
|                      React Frontend                       |
|   (Vite, Tailwind CSS, Component-Driven UI, Fetch API)    |
+-----------------------------------------------------------+
                             |
                             | HTTP / JSON (REST API)
                             v
+-----------------------------------------------------------+
|                      FastAPI Backend                      |
|       (Async ASGI Server, Pydantic Schema Contracts)      |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|               ChatService & Provider Registry             |
|     (Model Allowlist Validation, Latency Monotonic Timer) |
+-----------------------------------------------------------+
                             |
       +---------------------+---------------------+
       |                     |                     |
       v                     v                     v
+--------------+      +--------------+      +--------------+
| Gemini       |      | OpenAI       |      | Local LLM    |
| Provider     |      | Provider     |      | (Ollama)     |
| [Active      |      | [Planned     |      | [Planned     |
|  Day 3]      |      |  Day 4]      |      |  Day 4]      |
+--------------+      +--------------+      +--------------+
       |
       v
+------------------------------+
| Google AI Studio REST API    |
| (Gemini 1.5 Flash / Pro)     |
+------------------------------+
```

---

## 2. Core Architectural Layers

### Layer 1: Presentation Layer (React Frontend)
* **Technology**: React 18, Vite, JavaScript, Tailwind CSS.
* **Responsibilities**:
  * Renders a responsive, accessible dark-mode chat interface (`#0B0D12` palette).
  * Auto-resizes multiline message input and supports keyboard shortcuts (`Enter`, `Shift + Enter`).
  * Manages client-side asynchronous connection states (`idle`, `checking`, `connected`, `disconnected`).
  * Dispatches chat prompts to `POST /api/chat` using native Fetch API.
  * Preserves conversation context across multi-turn messages within active session.
  * Renders syntax-highlighted code blocks with one-click clipboard copying.
  * Remains entirely agnostic of upstream AI vendor SDKs (no client-side API keys).

### Layer 2: API Gateway & Application Server (FastAPI Backend)
* **Technology**: Python 3.14+, FastAPI, Uvicorn, HTTPX, Pydantic v2.
* **Responsibilities**:
  * Enforces Cross-Origin Resource Sharing (CORS) security boundaries.
  * Validates inbound payloads using `ChatRequest` schema (enforcing length, non-empty, allowed models).
  * Measures live provider round-trip latency using Python's monotonic clock (`time.perf_counter()`).
  * Exposes health monitoring (`/api/health`), root info (`/`), and chat completion (`/api/chat`).
  * Manages environment configuration and secrets securely outside the web client.

### Layer 3: Provider Abstraction Layer (`app.providers`)
* **Design Pattern**: Adapter / Strategy Pattern.
* **Contract Interface (`BaseLLMProvider`)**:
  ```python
  class BaseLLMProvider(ABC):
      @abstractmethod
      async def generate_response(self, messages: List[Dict[str, str]], model_id: str) -> str:
          """Generate a standardized text completion from the model."""
          pass

      @abstractmethod
      async def check_availability(self) -> bool:
          """Verify provider API reachability and credentials."""
          pass
  ```
* **Active Concrete Adapter (`GeminiProvider`)**:
  * Communicates directly with Google's Generative Language REST endpoint (`v1beta`).
  * Translates generic chat roles (`user`, `assistant`) to Gemini's expected `{ role: "user" | "model", parts: [{"text": ...}] }` schema.
  * Translates HTTP status codes into typed provider exceptions:
    * `400`: `ProviderError` (Bad request / prompt feedback filter).
    * `401 / 403`: `ProviderAuthError` (Invalid or unauthorized API key).
    * `429`: `ProviderRateLimitError` (Free tier quota or RPM limit reached).
    * Timeout: `ProviderTimeoutError` (Default 30s timeout).
  * Keeps API keys strictly private inside backend environment variables.

---

## 3. Data & Persistence Strategy (Planned for Day 5)

* **Database Engine**: SQLite with SQLAlchemy / SQLModel.
* **Data Models**:
  * `conversations`: Sessions, timestamps, titles.
  * `messages`: Prompt, response, target model, latency (ms), token metrics.

---

## 4. Current Status: Day 3 Integration Complete

* Operational FastAPI application with `GET /api/health` and `POST /api/chat`.
* React single-page dashboard with real-time connectivity status checking and live message submission.
* `GeminiProvider` adapter integrated and validated with 12 automated unit tests.
* Safe fallback and error reporting if `GEMINI_API_KEY` is omitted, returning clean HTTP 503 instead of crashing.
* Zero external API keys bundled in frontend client code.
