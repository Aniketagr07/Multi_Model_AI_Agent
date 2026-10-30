# OmniAI System Architecture & Engineering Design

This document details the software architecture, design principles, persistence strategies, and multi-model integration layers for **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## 1. High-Level Architectural Flow

OmniAI follows a decoupled, modular client-server architecture designed for high extensibility, testability, model-agnostic communication, and zero third-party lock-in.

```
+-----------------------------------------------------------------------------------+
|                                  React 18 Frontend                                |
|  - Modern Tailwind CSS Interface (Dark / Light / System Theme)                    |
|  - Real-Time SSE Token Streaming & Progressive UI Synthesis                       |
|  - Dual-Model Side-by-Side Comparison Matrix                                      |
|  - Drag-and-Drop Document Upload & Context Attachment                             |
|  - Conversation Management (Search, Pin, Archive, Export as MD/TXT/JSON)          |
|  - Settings & Custom Instructions Personalization                                 |
|  - Dynamic BYOK (Bring Your Own Key) Discovery Modal                              |
+-----------------------------------------------------------------------------------+
                                        |
                 HTTP REST (JSON)       |        Server-Sent Events (SSE)
                 /api/conversations     |        POST /api/chat/stream
                 /api/documents         |        GET /api/models
                 /api/settings          |        POST /api/compare
                                        v
+-----------------------------------------------------------------------------------+
|                                 FastAPI Backend                                   |
|  - Async ASGI Server (Python 3.14 / 3.11+)                                        |
|  - Defensive Security Headers Middleware (CSP, nosniff, DENY)                     |
|  - Strict CORS Origin Controls                                                    |
|  - Centralized Unhandled Exception Redaction (No Stack Trace Leaks)               |
+-----------------------------------------------------------------------------------+
                                        |
       +--------------------------------+--------------------------------+
       |                                |                                |
       v                                v                                v
+------------------+         +--------------------+          +---------------------+
| Heuristic Router |         | Model Registry     |          | Document Service    |
| (Prompt Tagger:  |         | (Metadata, Quotas, |          | (PyPDF Extraction,  |
| Coding, Writing, |         | Tiers, Effort      |          | Semantic Chunking,  |
| Reasoning, Auto) |         | Configurations)    |          | Grounded Context)   |
+------------------+         +--------------------+          +---------------------+
       |                                |                                |
       +--------------------------------+--------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                         Provider Abstraction Layer                                |
|  - BaseLLMProvider (Abstract Base Class interface)                                |
|  - Standardized normalization: generate_response() & stream_response()            |
|  - Resilient Active Fallback Chain across active endpoints                        |
+-----------------------------------------------------------------------------------+
       |                                |                                |
       v                                v                                v
+----------------------+     +----------------------+     +----------------------+
| GeminiProvider       |     | GroqProvider         |     | OpenAICompatible     |
| (Google AI Studio)   |     | (Groq Cloud LPUs)    |     | (Custom BYOK / v1)   |
| - gemini-3.6-flash   |     | - llama-3.1-8b       |     | - Ollama / Open-WebUI|
| - gemini-flash-lite  |     | - llama-3.3-70b      |     | - Local / vLLM       |
| - gemini-3.8-flash   |     | - mixtral-8x7b       |     |                      |
+----------------------+     +----------------------+     +----------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                       Local Persistent Storage (SQLite)                           |
|  - WAL Journaling Mode (Write-Ahead Logging for non-blocking concurrent reads)     |
|  - Foreign Key Constraints & Cascading Deletions                                  |
|  - Parameterized Queries (Zero SQL Injection Vulnerability)                       |
|  - Tables: conversations, messages, documents, user_settings                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Architectural Layers

### Layer 1: Presentation Layer (React 18 Frontend)
* **Technology**: React 18, Vite, Tailwind CSS, Lucide icons, ReactMarkdown, RemarkGFM.
* **Key Components**:
  * `ChatWindow`: Handles message rendering, progressive SSE tokens, empty-state suggestions, and scroll anchoring.
  * `MessageBubble`: Wrapped with `React.memo` to eliminate re-renders during active token generation.
  * `ModelSelector`: Dynamic model selection with provider badges, latency indicators, and BYOK trigger.
  * `CompareView`: Side-by-side prompt execution across two independent models with comparative metrics.
  * `Sidebar`: Conversation searching (title + content), pinning, archiving, and multi-format exports.
  * `SettingsView`: Full configuration dashboard for themes, routing defaults, streaming toggles, and custom instructions.
  * `DocumentAttachmentCard`: Drag-and-drop document upload interface with progress bar and metadata badges.

### Layer 2: API & Gateway Layer (FastAPI)
* **Technology**: FastAPI, Pydantic v2, Starlette, HTTPX.
* **Security & Routing**:
  * Strict schema validation via Pydantic models with input sanitization and length bounds.
  * Defensive HTTP middleware enforcing `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`.
  * Centralized exception handlers preventing stack trace leakage to API consumers.
  * Restrictive CORS configuration bound to authorized frontend development and production origins.

### Layer 3: Intelligence & Routing Layer
* **Heuristic Classifier (`ModelRouter`)**:
  * Analyzes inbound user prompts against specialized semantic rule sets:
    * `coding`: Routes to high-throughput, low-latency models (Groq Llama 3.1 8B, Gemini Flash).
    * `reasoning`: Routes to deep analytical models (Gemini Pro, Llama 3.3 70B).
    * `writing`: Routes to expansive context models (Mixtral 8x7B, Gemini Flash).
    * `general`: Balanced heuristic fallback.
  * Provides transparent explanations for routing decisions displayed on the UI.

### Layer 4: Provider Abstraction & Fallback Engine
* **`BaseLLMProvider` Contract**:
  * Every model provider implements `generate_response()` and `stream_response()`.
* **Active Fallback Chain**:
  * If an upstream model is deprecated (HTTP 404), overloaded (HTTP 503), rate-limited (HTTP 429), or exceeds a 10s deadline, the engine automatically cascades through verified active models (`gemini-3.6-flash` → `gemini-flash-lite-latest` → `gemini-3.1-flash-lite`).
  * Prevents request crashes and ensures zero-downtime streaming.

### Layer 5: Document Intelligence Layer
* **`DocumentService`**:
  * Safe text extraction from PDF files via `pypdf` with empty-page and corruption protection.
  * Multi-encoding support for TXT and Markdown (`utf-8`, `utf-8-sig`, `latin-1`).
  * Semantic chunking (2500-char chunks with 250-char sliding overlap).
  * Injects grounded context with clear system grounding delimiters, significantly reducing model hallucinations by constraining claims to verified document content.

### Layer 6: Persistence & Storage Layer
* **SQLite Database**:
  * Configured with WAL (`PRAGMA journal_mode = WAL;`) allowing concurrent reads during streaming writes.
  * Enforced foreign key cascades (`PRAGMA foreign_keys = ON;`).
  * Safe multi-table migrations on startup.
  * Parameterized SQL queries preventing SQL injection across all endpoints.
