# Project Abstract

## OmniAI — Intelligent Multi-Model AI Chatbot

### Abstract
In the contemporary landscape of artificial intelligence, foundational Large Language Models (LLMs) demonstrate divergent strengths: specialized hardware architectures like Groq Language Processing Units (LPUs) deliver ultra-low-latency token generation for coding and algorithmic tasks, while Google Gemini models provide deep multimodal context processing and reasoning. Conversely, single-model chat interfaces introduce severe vendor lock-in, latency bottlenecks, and vulnerability to provider outages or deprecations.

This capstone project presents **OmniAI**, an intelligent, decoupled multi-model AI chatbot workbench built with **FastAPI (Python)**, **React 18 + Vite**, and **SQLite (WAL Mode)**. OmniAI eliminates vendor dependency by abstracting model providers behind a unified hexagonal interface. The system features:
1. **Intelligent Rule-Based Meta-Router**: A sub-millisecond deterministic intent classifier that inspects user prompt lexical cues to route queries across specialized models (`coding`, `reasoning`, `writing`, and `general`) with full transparency and zero meta-token overhead.
2. **Real-Time Token Streaming**: High-throughput Server-Sent Events (SSE) pipeline with dynamic client cancellation, markdown rendering, and syntax-highlighted code block execution.
3. **Concurrent Dual-Model Benchmarking**: Parallel dispatch (`asyncio.gather`) broadcasting identical prompts across distinct LLM architectures with live side-by-side latency tracking.
4. **Grounded Document Analysis**: Ingestion of PDF, Markdown, and TXT files with PyPDF extraction, semantic chunking (2,500 characters with 250-character overlap), and anti-hallucination grounding tags.
5. **Robust Local-First Architecture**: Persistent conversation management with title/content search, pinning, archiving, multi-format export (Markdown, Plain Text, JSON), and zero-cost operation via official developer tier APIs.

OmniAI achieves a 100% automated test pass rate across 101 unit, integration, and security test suites, demonstrating a production-ready, resilient personal AI platform.

### Keywords
`Multi-Model LLM Architecture`, `FastAPI`, `React 18`, `Server-Sent Events (SSE)`, `Heuristic Routing`, `Model Comparison Matrix`, `Document Grounding`, `SQLite WAL Mode`, `AI Chatbot`.

### Target Outcomes & Capstone Contributions
* **Decoupled Architecture**: Seamless integration of Google Gemini REST and Groq Cloud OpenAI-compatible endpoints with dynamic active fallback.
* **Deterministic Efficiency**: Sub-1ms heuristic query classification saving 100% of LLM meta-token routing costs.
* **Hermetic Reliability**: Zero-credit automated testing framework (81 backend tests + 20 frontend tests).
* **Enterprise Hardening**: In-memory sliding-window rate limiting (60 RPM), 15MB request limits, secret masking, and single-user token access control.

