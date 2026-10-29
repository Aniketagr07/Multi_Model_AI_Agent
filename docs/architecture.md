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
|                Model Orchestration Layer                  |
|   (Strategy Router, Fallback Engine, AI Council Engine)   |
+-----------------------------------------------------------+
                             |
      +----------------------+----------------------+
      |                      |                      |
      v                      v                      v
+------------+         +------------+         +------------+
| Provider A |         | Provider B |         | Local LLM  |
| (OpenAI /  |         | (Anthropic |         |  (Ollama   |
|  GPT-4o)   |         |   Claude)  |         |  Llama 3)  |
+------------+         +------------+         +------------+
```

---

## 2. Core Architectural Layers

### Layer 1: Presentation Layer (React Frontend)
* **Technology**: React 18, Vite, JavaScript, Tailwind CSS.
* **Responsibilities**:
  * Renders a responsive, accessible dark-mode user interface.
  * Captures user input (prompts, model preferences, routing rules).
  * Manages client-side asynchronous connection states (`idle`, `checking`, `connected`, `disconnected`).
  * Communicates strictly via standard REST contracts using the native Fetch API.
  * Remains entirely agnostic of upstream AI vendor SDKs (no OpenAI or Anthropic SDKs bundled on client).

### Layer 2: API Gateway & Application Server (FastAPI Backend)
* **Technology**: Python 3, FastAPI, Uvicorn, HTTPX, Pydantic v2.
* **Responsibilities**:
  * Enforces Cross-Origin Resource Sharing (CORS) security boundaries between frontend and backend.
  * Validates inbound payloads and serializes responses using Pydantic schemas.
  * Exposes health monitoring (`/api/health`) and root metadata (`/`).
  * Manages environment configuration and secrets securely outside the web client.

### Layer 3: Model Orchestration Layer (Scheduled for Day 2+)
* **Responsibilities**:
  * **Routing Strategy**: Directs queries to specific models (e.g. lightweight models for simple queries, reasoning models for math/code).
  * **Parallel Execution**: Dispatches queries concurrently to multiple providers using asynchronous `httpx.AsyncClient`.
  * **AI Council Consensus**: Collects responses from multiple models and synthesizes a consolidated consensus answer.
  * **Telemetry & Tracking**: Records response latency, token consumption, and model availability.

### Layer 4: Provider Abstraction Layer (Planned)
* **Design Pattern**: Adapter / Strategy Pattern.
* **Abstraction Contract**:
  Every model provider implements a uniform abstract interface:
  ```python
  class BaseLLMProvider(ABC):
      @abstractmethod
      async def generate_response(self, prompt: str, **kwargs) -> ModelResponse:
          """Generate a standardized response from the model."""
          pass

      @abstractmethod
      async def check_availability(self) -> bool:
          """Verify provider API reachability and credentials."""
          pass
  ```
* **Why This Matters**:
  1. **Frontend Isolation**: The frontend only ever sends and receives standardized JSON schemas. Adding a new model provider (such as Mistral or a self-hosted Ollama model) requires zero changes to the React code.
  2. **Vendor Independence**: If one provider suffers an outage or changes its pricing, the backend can seamlessly swap providers or fall back to an alternative.
  3. **Zero Secret Leakage**: API tokens stay secure in server environment variables and never reach client bundles.

---

## 3. Data & Persistence Strategy (Planned)

* **Database Engine**: SQLite with SQLAlchemy / SQLModel.
* **Data Models**:
  * `conversations`: Sessions, timestamps, titles.
  * `messages`: Prompt, response, target model, latency (ms), token usage.
  * `model_metrics`: Historical response time, error rate, cost estimation.

---

## 4. Current Status: Day 1 Foundation

On Day 1, the core architectural foundation is established:
* Complete folder hierarchy (`frontend/`, `backend/`, `docs/`).
* Operational FastAPI application with CORS middleware and GET `/api/health`.
* React single-page dashboard with real-time connectivity status checking.
* Environment configurations (`.env.example`) and Git version control exclusion rules.
* Model integrations and provider implementations are deliberately deferred to ensure a clean, testable system foundation.

