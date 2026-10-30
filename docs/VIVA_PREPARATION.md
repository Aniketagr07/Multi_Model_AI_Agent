# OmniAI — Technical Viva Voce & Oral Defense Preparation Guide

This comprehensive question-and-answer guide is tailored for university examiners, technical evaluators, and viva panelists reviewing **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## Domain 1: Project Overview & Motivation

### Q1: What problem does OmniAI solve, and why is a multi-model architecture necessary?
**Answer**:  
Different LLMs exhibit distinct strengths based on their training objectives and underlying compute infrastructure:
* **Groq Cloud LPUs** run Llama 3.1 on Static Random-Access Memory (SRAM), providing ultra-low-latency inference (up to 500 tokens/sec) ideal for code generation.
* **Google Gemini** features expansive context windows and deep multimodal reasoning.
Single-provider systems suffer from vendor lock-in, rate-limit bottlenecks, and inability to leverage hardware advantages. OmniAI abstracts these models behind a unified interface with intelligent automatic routing and concurrent side-by-side comparison.

### Q2: Why did you not use a secondary LLM to classify prompts in Auto Mode?
**Answer**:  
Using an LLM (e.g. GPT-3.5 or Claude Haiku) as a meta-classifier introduces an extra 300–800ms latency penalty, costs 20–50 tokens per query, and creates a single point of failure. OmniAI uses a compiled, deterministic regular expression heuristic classifier that categorizes prompts into `coding`, `reasoning`, `writing`, or `general` in **under 0.5 milliseconds** with **zero token cost**.

---

## Domain 2: Streaming & Transport Protocols

### Q3: Why did you choose Server-Sent Events (SSE) instead of WebSockets for streaming responses?
**Answer**:  
1. **Unidirectional Nature**: LLM inference is strictly server-to-client streaming once the user sends the prompt. WebSockets are designed for bi-directional socket duplexing (e.g., multiplayer gaming), which adds unnecessary overhead.
2. **Transport & Network Compatibility**: SSE operates over standard HTTP/1.1 and HTTP/2 (`text/event-stream`). It traverses university proxies, corporate firewalls, and Nginx reverse proxies without requiring custom socket upgrades or connection renegotiation.
3. **HTTP/2 Multiplexing**: Multiple SSE streams can share a single TCP connection, preventing socket exhaustion.
4. **Native Browser Reconnection**: The W3C EventSource standard provides built-in reconnection logic.

### Q4: How does OmniAI handle client disconnection when a user clicks "Stop Generation"?
**Answer**:  
The React client calls `AbortController.abort()`, severing the HTTP stream. On the FastAPI backend, Starlette detects the broken TCP connection and raises `asyncio.CancelledError`. OmniAI catches this exception, halts the upstream LLM generator immediately to prevent token wastage, and ensures that truncated or incomplete responses are **not** written to the SQLite database.

---

## Domain 3: AI Hardware & Provider Abstraction

### Q5: What is the architectural difference between Groq LPUs and traditional Nvidia GPUs?
**Answer**:  
* **Nvidia GPUs** utilize High Bandwidth Memory (HBM) connected to compute cores via external buses. In LLM autoregressive token generation (where each token is generated one at a time), performance is memory-bandwidth bound rather than compute bound.
* **Groq Language Processing Units (LPUs)** feature a Tensor Streaming Architecture where compute units and SRAM memory are co-located on the same die. SRAM delivers ~80 TB/s bandwidth with zero memory bus latency, enabling generation speeds 5–10x faster than traditional GPUs.

### Q6: How does OmniAI prevent service downtime if an AI provider is deprecated or rate-limited?
**Answer**:  
OmniAI implements an **Active Fallback Chain**. The `ModelRegistry` maintains a priority hierarchy for each task category. If the primary model fails with a transient HTTP 429 (Rate Limit) or 503 (Unavailable), `ChatService` catches the error and retries the prompt with the next verified operational model (e.g., falling back from `gemini-3.6-flash` to `gemini-flash-lite-latest`), ensuring continuous service.

---

## Domain 4: Database & Persistence

### Q7: Why did you choose SQLite over PostgreSQL for OmniAI, and what makes it production-capable?
**Answer**:  
OmniAI is designed as an embedded, zero-cost, local-first workbench. SQLite requires no external database server, network latency, or credential management. To make it reliable under concurrent operations, OmniAI configures:
1. **Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)**: Allows concurrent readers without blocking writes.
2. **Busy Timeout (`PRAGMA busy_timeout = 5000;`)**: Prevents `database locked` errors by waiting up to 5 seconds during concurrent transactions.
3. **Foreign Keys (`PRAGMA foreign_keys = ON;`)**: Ensures referential integrity with cascading deletions (`ON DELETE CASCADE`).

### Q8: How do you safely take a backup of an active SQLite database in WAL mode?
**Answer**:  
Taking a standard OS copy (`cp omniai.db backup.db`) while SQLite is active can produce corrupted snapshots because recent transactions reside in the `-wal` file. OmniAI provides `scripts/backup_db.py`, which uses SQLite's native online backup API (`sqlite3.Connection.backup()`). This API locks pages briefly, copies consistent data into a destination database, and runs `PRAGMA integrity_check` to verify the backup.

---

## Domain 5: Document Analysis & Grounding

### Q9: What is semantic chunking, and why is an overlap window necessary?
**Answer**:  
When documents exceed direct prompt limits, text is segmented into fixed character windows. OmniAI uses a 2,500-character window with a 250-character (10%) overlap. The overlap ensures that critical sentences, code blocks, or entities that happen to fall across chunk boundaries are not split and lost during LLM context assembly.

### Q10: How does OmniAI eliminate hallucinations during document Q&A?
**Answer**:  
Extracted text is bounded inside structured XML tags (`<document_context name="...">`). System instructions explicitly command the model:
1. To answer strictly and solely using the provided text.
2. If the document does not contain the answer, to state: *"The provided document does not contain sufficient information to answer this question."*
3. Never to invent external facts or extrapolate beyond the text.

---

## Domain 6: Security & Hardening

### Q11: How does OmniAI defend against Stored Cross-Site Scripting (XSS) in Markdown responses?
**Answer**:  
LLM outputs might contain malicious HTML or JavaScript (e.g. `<img src=x onerror=alert(1)>`). In `MessageBubble.jsx`, markdown parsing uses `react-markdown` piped through `rehype-sanitize`. This sanitization filter strips unsafe tags, attributes, and `javascript:` URIs according to GitHub's strict HTML whitelist before rendering in the DOM.

### Q12: How are user Custom Instructions protected against Prompt Injection?
**Answer**:  
User instructions are wrapped in dedicated system delimiters:
`<user_custom_instructions>{sanitized_instruction}</user_custom_instructions>`
System prompts establish a strict hierarchy: system safety rules and developer constraints take absolute precedence, preventing custom instructions from overriding system boundaries.

### Q13: What authentication model does OmniAI use in production?
**Answer**:  
OmniAI is engineered as a single-tenant personal intelligence workbench. Rather than adding complex multi-user registration or third-party auth services, production deployments utilize a lightweight single-tenant Access Token (`APP_ACCESS_TOKEN`). When configured, requests require `Authorization: Bearer <token>` or `X-OmniAI-Token: <token>`. In development, this is bypassed seamlessly.

### Q14: How does the application handle sensitive API keys in logs?
**Answer**:  
The logging pipeline implements a custom `SecretMaskingFilter`. It evaluates all outgoing log records against regular expressions matching Google Gemini keys (`AIza...`), Groq keys (`gsk_...`), OpenAI keys (`sk-...`), and Bearer tokens, replacing them with `[REDACTED_KEY]` before writing to stdout.

---

## Domain 7: Frontend Architecture & Testing

### Q15: How does OmniAI prevent duplicate submissions while a request is in flight?
**Answer**:  
1. **Frontend**: The submit button is disabled when `isLoading` or `isUploadingDocument` is true. The `handleKeyDown` Enter listener enforces `if (!isLoading && input.trim()) onSend()`.
2. **Backend**: An in-memory sliding-window rate limiter restricts generation requests to 60 RPM per client IP, returning HTTP 429 if flooded.

### Q16: How do automated frontend tests verify chat streaming without consuming real API credits?
**Answer**:  
Vitest uses function mocks (`vi.mock('../services/api')`). The mock simulates an asynchronous generator yielding progressive token chunks (`"def "`, `"binary_search"`). React Testing Library renders `MessageBubble`, verifying progressive DOM updates, model attribution, and latency badges without external network calls.

