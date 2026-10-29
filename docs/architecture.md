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
                             | (GET /api/models, POST /api/chat)
                             v
+-----------------------------------------------------------+
|                      FastAPI Backend                      |
|       (Async ASGI Server, Pydantic Schema Contracts)      |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|               ChatService & Model Registry                |
|     (Model Allowlist Validation, Latency Monotonic Timer) |
+-----------------------------------------------------------+
                             |
       +---------------------+---------------------+
       |                                           |
       v                                           v
+-------------------------------+   +-------------------------------+
| GeminiProvider                |   | GroqProvider                  |
| (Adapter for Google Gemini)   |   | (Adapter for Groq Cloud LPUs) |
| [Active Day 3]                |   | [Active Day 4]                |
+-------------------------------+   +-------------------------------+
       |                                           |
       v                                           v
+-------------------------------+   +-------------------------------+
| Google AI Studio REST API     |   | Groq Cloud REST API           |
| (Gemini 1.5 Flash / Pro)      |   | (Llama 3.1 8B / Mixtral 8x7B) |
+-------------------------------+   +-------------------------------+
```

---

## 2. Core Architectural Layers

### Layer 1: Presentation Layer (React Frontend)
* **Technology**: React 18, Vite, JavaScript, Tailwind CSS.
* **Responsibilities**:
  * Renders a responsive, accessible dark-mode chat interface (`#0B0D12` palette).
  * Auto-resizes multiline message input and supports keyboard shortcuts (`Enter`, `Shift + Enter`).
  * Manages client-side asynchronous connection states (`idle`, `checking`, `connected`, `disconnected`).
  * Features a **Multi-Model Selector** allowing the user to select either **Google Gemini** or **Groq Cloud (Llama 3.1)**.
  * Preserves conversation context across multi-turn messages within active session.
  * Displays distinct visual tags for each provider (Google blue, Groq amber) and real latency badges (`⚡ 142ms`).
  * Remains entirely agnostic of upstream AI vendor SDKs (no client-side API keys).

### Layer 2: API Gateway & Application Server (FastAPI Backend)
* **Technology**: Python 3.14+, FastAPI, Uvicorn, HTTPX, Pydantic v2.
* **Responsibilities**:
  * Enforces Cross-Origin Resource Sharing (CORS) security boundaries.
  * Validates inbound payloads using `ChatRequest` schema (enforcing length, non-empty, allowed models).
  * Exposes `GET /api/models` to provide the dynamic model registry to clients.
  * Measures live provider round-trip latency using Python's monotonic clock (`time.perf_counter()`).
  * Exposes health monitoring (`/api/health`), root info (`/`), and chat completion (`/api/chat`).
  * Manages environment configuration and secrets securely outside the web client.

### Layer 3: Server-Side Model Registry (`app.core.model_registry`)
* Centralized registry mapping internal model IDs to upstream provider adapters:
  1. `gemini-1.5-flash`: Provider `gemini`, Provider Model ID `gemini-1.5-flash`
  2. `gemini-1.5-pro`: Provider `gemini`, Provider Model ID `gemini-1.5-pro`
  3. `llama-3.1-8b-instant`: Provider `groq`, Provider Model ID `llama-3.1-8b-instant`
  4. `llama-3.3-70b-versatile`: Provider `groq`, Provider Model ID `llama-3.3-70b-versatile`
  5. `mixtral-8x7b-32768`: Provider `groq`, Provider Model ID `mixtral-8x7b-32768`
* Evaluates live credential availability server-side without exposing API keys.

### Layer 4: Provider Abstraction Layer (`app.providers`)
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
* **Concrete Adapters**:
  * `GeminiProvider`: Formats messages to Google's `{ role: "user" | "model", parts: [{"text": ...}] }` schema.
  * `GroqProvider`: Formats messages to standard OpenAI-compatible `{ role: "user" | "assistant", content: ... }` schema.
  * Both translate HTTP errors into typed exceptions (`ProviderConfigError`, `ProviderAuthError`, `ProviderRateLimitError`, `ProviderTimeoutError`).

---

## 3. Data & Persistence Strategy (Planned for Day 5)

* **Database Engine**: SQLite with SQLAlchemy / SQLModel.
* **Data Models**:
  * `conversations`: Sessions, timestamps, titles.
  * `messages`: Prompt, response, target model, provider, latency (ms), token metrics.

---

## 4. Current Status: Day 4 Multi-Model Integration Complete

* Two distinct, functional AI model providers integrated:
  1. **Google Gemini API** (`gemini-1.5-flash`, `gemini-1.5-pro`)
  2. **Groq Cloud API** (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`)
* Operational FastAPI application with `GET /api/health`, `GET /api/models`, and `POST /api/chat`.
* React UI with interactive model switcher and distinct provider badges.
* 15 automated unit tests verifying routing, validation, error handling, and mock responses.
* Zero external API keys bundled in frontend client code.
