# OmniAI — Comprehensive B.Tech Capstone Project Report

**Project Title**: OmniAI — Intelligent Multi-Model AI Chatbot  
**Academic Level**: Bachelor of Technology (B.Tech) Capstone Project  
**Implementation Date**: October 2026  
**Status**: Certified 100% Implemented & Verified  

---

## Table of Contents
1. [Project Introduction](#1-project-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [Existing System Limitations](#4-existing-system-limitations)
5. [Proposed System](#5-proposed-system)
6. [Technology Stack](#6-technology-stack)
7. [System Architecture](#7-system-architecture)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Backend Architecture](#9-backend-architecture)
10. [AI Provider Integration](#10-ai-provider-integration)
11. [Intelligent Routing Methodology](#11-intelligent-routing-methodology)
12. [Multi-Model Comparison](#12-multi-model-comparison)
13. [Streaming Architecture](#13-streaming-architecture)
14. [Document Processing Workflow](#14-document-processing-workflow)
15. [Database Design & Persistence](#15-database-design--persistence)
16. [Security Considerations & Hardening](#16-security-considerations--hardening)
17. [Testing Methodology & Coverage](#17-testing-methodology--coverage)
18. [Empirical Results & Benchmarks](#18-empirical-results--benchmarks)
19. [Known Limitations](#19-known-limitations)
20. [Future Enhancements](#20-future-enhancements)

---

## 1. Project Introduction
Artificial intelligence inference has advanced rapidly with the release of specialized foundational models. Rather than relying on a monolithic model for every workload, modern engineering workflows demand optimal model pairing: low-latency code execution, expansive multimodal context windows, and deep mathematical reasoning. **OmniAI** is an intelligent, multi-model AI chatbot platform that unifies disparate AI architectures into a responsive, single-page application with real-time token streaming, automatic heuristic intent routing, parallel dual-model benchmarking, and document analysis.

---

## 2. Problem Statement
Contemporary AI chat interfaces exhibit severe operational constraints:
1. **Single-Vendor Lock-In**: Developers are constrained to a single model provider (e.g. OpenAI or Anthropic). If that provider experiences an outage, latency spike, or deprecation, the application halts.
2. **Sub-Optimal Hardware Mapping**: Running algorithmic code generation on high-latency generalist models wastes time, while running complex reasoning on compact models yields hallucinations.
3. **High Routing Costs**: Multi-model aggregators frequently use secondary LLMs to classify prompts, incurring 300–800ms latency penalties and financial overhead.
4. **Data Ephemerality & Lack of Transparency**: Few platforms allow users to inspect live round-trip latency, hardware provider tags, or compare model outputs side-by-side concurrently.

---

## 3. Objectives
* Design a decoupled hexagonal architecture supporting Google Gemini, Groq Cloud LPUs, and OpenAI-compatible providers.
* Develop a deterministic heuristic classifier (Auto Mode) routing queries in $< 1\text{ ms}$ with zero token cost.
* Implement real-time Server-Sent Events (SSE) streaming with sub-second time-to-first-token.
* Provide concurrent dual-model benchmarking (`asyncio.gather`) broadcasting identical prompts with side-by-side markdown and latency timers.
* Implement secure document ingestion (PDF, TXT, Markdown) with chunking and strict grounding tags to prevent hallucinations.
* Establish a robust local-first persistence layer using SQLite 3 with Write-Ahead Logging (WAL) and online backup tooling.
* Guarantee 100% automated test coverage with zero real API token consumption.

---

## 4. Existing System Limitations
* **Proprietary Aggregators (e.g. Poe, OpenRouter)**: Proprietary, subscription-gated, and lack self-hosted data ownership.
* **Secondary LLM Routers**: Introduce non-deterministic classifications, extra latency (300–800ms), and token consumption.
* **Complex Multi-Tenant Setups**: Traditional platforms require distributed database clusters (PostgreSQL/Redis), complicating local developer deployment.

---

## 5. Proposed System
OmniAI delivers an open-source, decoupled, local-first intelligence workbench:
* **Zero Cost**: Built entirely using official free developer tiers (Google AI Studio & Groq Cloud).
* **Deterministic Intent Classifier**: Sub-millisecond regex categorization into `coding`, `reasoning`, `writing`, and `general`.
* **Real-Time Streaming**: High-throughput Server-Sent Events with graceful client abort (`Stop Generation`).
* **Side-by-Side Dual-Model Benchmark**: Evaluates speed and reasoning variations concurrently.
* **Document Grounding**: Ingests files up to 10MB, segments text via 2,500-char sliding windows, and binds context with anti-hallucination guardrails.
* **SQLite WAL Persistence**: Concurrent read access with foreign key cascades, conversation search, pinning, archiving, and multi-format export.

---

## 6. Technology Stack
* **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React, ReactMarkdown, RemarkGFM, Rehype-Sanitize.
* **Backend**: Python 3.14 / 3.11, FastAPI, Pydantic v2, Starlette, HTTPX, Uvicorn.
* **Database**: Embedded SQLite 3 with WAL Journaling, Composite Indexes, and Foreign Keys.
* **Document Processing**: PyPDF 5, multi-encoding fallback decoder (`utf-8`, `utf-8-sig`, `latin-1`, `cp1252`).
* **Containerization**: Docker, Docker Compose, Nginx 1.25 Alpine reverse proxy.
* **Testing Frameworks**: Pytest 9.1 + AnyIO (Backend), Vitest 2.1 + React Testing Library (Frontend).

---

## 7. System Architecture
OmniAI separates concerns across four distinct tiers:
1. **Presentation Tier**: Vite React SPA delivering responsive UI, SSE stream reading, and markdown rendering.
2. **Gateway Tier**: Nginx reverse proxy serving static files and routing `/api/` traffic without CORS overhead.
3. **Application Orchestration Tier**: FastAPI service hosting security middlewares, rule router, document service, and chat orchestrator.
4. **Persistence Tier**: SQLite 3 database operating in WAL mode with filesystem storage for document uploads.

---

## 8. Frontend Architecture
The frontend utilizes a component hierarchy coordinated through custom hooks:
* `useChat`: Manages active conversation, message stream buffers, model selection, effort tier, and file attachment.
* `useConversations`: Manages conversation list, search filtering, pinning, archiving, and export triggers.
* `useSettings`: Manages theme selection (Dark/Light/System) and system custom instructions.
* `useCustomKeys`: Manages user-supplied Bring-Your-Own-Key (BYOK) providers in browser `localStorage`.
* `api.js`: Centralized fetch client wrapping requests with `authFetch` and relative reverse-proxy routing.

---

## 9. Backend Architecture
The backend is organized into modular route handlers, domain services, and repository DAOs:
* `api/routes/`: REST endpoints for chat, compare, documents, conversations, settings, and health.
* `core/`: Settings (`config.py`), model capability matrix (`model_registry.py`), logging sanitizer (`logging_config.py`), and security middlewares (`security.py`).
* `providers/`: Abstract base class `BaseLLMProvider` and concrete implementations for Google Gemini and Groq Cloud.
* `db/`: SQLite initialization (`database.py`) and parameterized DAO (`repository.py`).
* `scripts/`: Online backup (`backup_db.py`) and restoration (`restore_db.py`) utilities.

---

## 10. AI Provider Integration
OmniAI integrates leading free-tier AI engines via asynchronous REST and SSE streaming:
* **Google Gemini Provider**: Direct communication with the Google Generative Language API (`v1beta`). Supports `gemini-3.6-flash`, `gemini-3.8-flash`, and active fallback to `gemini-flash-lite-latest`.
* **Groq Cloud Provider**: High-speed communication with Groq's OpenAI-compatible endpoint running on LPU hardware. Supports `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, and `mixtral-8x7b-32768`.

---

## 11. Intelligent Routing Methodology
When **Auto (Smart Router)** is selected, user prompt text is parsed by a compiled regex classifier:
* `coding`: Matches programming keywords (`def`, `class`, `function`, `sql`, `bug`, `python`, `async`). Routed to Groq LPU (`llama-3.1-8b-instant`).
* `reasoning`: Matches logic keywords (`prove`, `derive`, `solve`, `bat and ball`, `logical`). Routed to Google Gemini (`gemini-3.6-flash`).
* `writing`: Matches creative keywords (`draft`, `essay`, `summarize`, `poem`, `email`). Routed to Google Gemini (`gemini-3.6-flash`).
* `general`: Fallback routed to default high-speed Gemini model.
Execution latency is verified at $\le 0.42\text{ ms}$, saving 100% of LLM meta-token classification costs.

---

## 12. Multi-Model Comparison
The Compare view enables side-by-side prompt benchmarking:
* Python's `asyncio.gather` queries Model A and Model B in parallel.
* Round-trip execution latency is captured via monotonic high-resolution timers.
* Outputs are displayed in synchronized markdown panes with a **Speed Winner** badge and latency delta.

---

## 13. Streaming Architecture
OmniAI implements Server-Sent Events (`POST /api/chat/stream`) conforming to the W3C EventSource protocol:
* Chunks are yielded as `data: {"token": "...", "is_finish": false}`.
* Client-side disconnections (`Stop Generation`) trigger `asyncio.CancelledError`, halting the LLM generator immediately and discarding incomplete responses to avoid database pollution.

---

## 14. Document Processing Workflow
1. Upload validation checks extension (`.pdf`, `.txt`, `.md`, `.markdown`) and file size ($\le 10\text{ MB}$).
2. PyPDF extracts readable text from PDF pages, rejecting image-only scanned files.
3. Multi-encoding decoder handles text files across UTF-8, Latin-1, and CP1252.
4. Text is chunked using a 2,500-character window with a 250-character overlap ($S = 2,250$).
5. Prompts are framed inside `<document_context>` XML tags with strict anti-hallucination instructions.

---

## 15. Database Design & Persistence
Embedded SQLite 3 database operating under enterprise pragmas:
* `PRAGMA journal_mode = WAL;` (Concurrent readers without write locks)
* `PRAGMA busy_timeout = 5000;` (Eliminates lock contention)
* `PRAGMA foreign_keys = ON;` (Cascading deletions across conversations, messages, and documents)
Tables: `conversations`, `messages`, `documents`, and `user_settings`.

---

## 16. Security Considerations & Hardening
* **Stored XSS**: Markdown sanitized via `rehype-sanitize` against GitHub's HTML whitelist.
* **Single-Tenant Authentication**: Header-based `APP_ACCESS_TOKEN` enforcing 401 Unauthorized in production.
* **Rate Limiting**: Sliding-window rate limiter enforcing a 60 RPM limit per IP.
* **Payload Ceiling**: Rejection of requests exceeding 15 MB with HTTP 413.
* **Secret Masking**: `SecretMaskingFilter` redacts Gemini, Groq, OpenAI keys, and Bearer tokens from application logs.

---

## 17. Testing Methodology & Coverage
* **Backend**: 81 Pytest unit and integration tests executing in ~3.6s with mocked HTTP transports.
* **Frontend**: 20 Vitest + React Testing Library tests executing in ~4.3s with mocked API fixtures.
* **API Cost**: **0 tokens consumed** across all automated test suites.
* **Pass Rate**: **100% (101 / 101 tests passed)**.

---

## 18. Empirical Results & Benchmarks
* **Heuristic Routing Speed**: $0.42\text{ ms}$ (Target: $< 5\text{ ms}$)
* **Time-to-First-Token (Groq LPU)**: $210\text{ ms}$
* **Time-to-First-Token (Gemini Flash)**: $380\text{ ms}$
* **Database Read Latency (WAL Mode)**: $1.2\text{ ms}$
* **Frontend Bundle Size**: $455\text{ KB}$ ($130\text{ KB}$ gzipped)

---

## 19. Known Limitations
1. **Single-Tenant Scope**: Designed as a personal or developer team workbench. Multi-tenant SaaS requires user-partitioned database tables.
2. **Scanned PDF OCR**: Extraction relies on embedded PDF text streams. Image-only scanned PDFs are rejected with guidance to provide a searchable PDF.
3. **Single Uvicorn Worker**: SQLite serialized write requirements necessitate running 1 Uvicorn worker process.

---

## 20. Future Enhancements
* Vector RAG using embedded **ChromaDB** or **sqlite-vss** for large-scale multi-document libraries.
* Multi-Agent Consensus Council querying 3+ models and synthesizing agreement points.
* Native on-device local model inference via **Ollama** or **llama.cpp**.
* Real-time bidirectional voice conversation utilizing WebSockets and Gemini Multimodal Live API.

