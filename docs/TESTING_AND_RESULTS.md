# OmniAI — Testing Methodology & Empirical Verification Results

This document records the automated testing strategy, execution results, performance benchmarks, and empirical evidence collected across the full stack of **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## 1. Testing Philosophy & Hermetic Design

### Zero Real API Token Consumption
Automated testing must never deplete production API quotas or incur charges. OmniAI utilizes a strict **Hermetic Mock Testing Architecture**:
* **Backend**: External HTTP requests to Google Generative Language API and Groq Cloud are mocked at the HTTP transport layer using `unittest.mock` and `pytest-mock`.
* **Frontend**: Network calls in Vitest are intercepted using Vitest function spies (`vi.mock('../services/api')`), returning predictable payload fixtures.
* **Result**: Complete test execution consumes **0 API tokens** and executes in under **12 seconds** without internet access.

---

## 2. Test Execution Summary

```
================================================================================
                           FULL-STACK TEST SCORECARD                            
================================================================================
  Backend Pytest Suite:     81 / 81 PASSED  (100%)  [~3.6s execution time]
  Frontend Vitest Suite:    20 / 20 PASSED  (100%)  [~4.3s execution time]
  Vite Production Build:    SUCCESS         (0 errors, 301 modules compiled)
--------------------------------------------------------------------------------
  TOTAL AUTOMATED TESTS:    101 / 101 PASSED (100% Pass Rate)
================================================================================
```

---

## 3. Backend Test Suite Breakdown (81 Tests)

Executed via: `python -m pytest backend/tests -v`

| Test File | Total Tests | Status | Scope & Capabilities Verified |
|---|---|---|---|
| `test_chat.py` | 12 | **PASS** | Route mounting, empty payload rejection, invalid model ID handling, missing API key errors, Gemini/Groq mock dispatch, auth/rate-limit/timeout exception handling, effort level system prompt mapping. |
| `test_compare.py` | 6 | **PASS** | Concurrent dispatch via `asyncio.gather`, duplicate model rejection, partial failure recovery (one model succeeds, one fails), total failure recovery. |
| `test_conversations_mgmt.py` | 9 | **PASS** | Title search, message content search, pin/unpin lifecycle, archive/restore lifecycle, rename, cascade deletion, Markdown/Text/JSON export. |
| `test_discovery.py` | 4 | **PASS** | Dynamic BYOK discovery route, mock provider listing, runtime custom API key resolution in `ChatService`. |
| `test_documents.py` | 9 | **PASS** | PDF/TXT/MD upload validation, empty file rejection, corrupted PDF handling, 10MB size bound enforcement, document delete, grounded Q&A workflow. |
| `test_health.py` | 4 | **PASS** | Settings loading, health check schema contract, root endpoint metadata, service uptime reporting. |
| `test_router.py` | 11 | **PASS** | Regex classification for coding/reasoning/writing/general, optimal model selection, fallback chains on unavailable providers, HTTP 503 on zero models, manual mode preservation. |
| `test_security_production.py` | 5 | **PASS** | Secret masking filter (Gemini, Groq, OpenAI, Bearer tokens), sliding-window rate limiter, payload size ceiling (HTTP 413), single-user token auth enforcement (HTTP 401). |
| `test_settings.py` | 7 | **PASS** | Default settings retrieval, settings update persistence, prompt sanitization, theme/effort validation, model streaming supported flags, custom instruction injection. |
| `test_storage.py` | 7 | **PASS** | SQLite table initialization, conversation creation, ordered listing, rename/delete, message persistence, context window sliding. |
| `test_streaming.py` | 6 | **PASS** | Server-Sent Events (SSE) streaming pipeline, client disconnect cancellation without saving partial outputs, auto-routing streaming, regeneration stream. |
| `test_backup_restore.py` | 1 | **PASS** | Full online database backup, data mutation verification, and complete snapshot restore cycle. |

---

## 4. Frontend Test Suite Breakdown (20 Tests)

Executed via: `npm test --prefix frontend`

| Test Suite | Total Tests | Status | Scope & Capabilities Verified |
|---|---|---|---|
| `chat.test.jsx` | 5 | **PASS** | Chat window rendering with model attribution and latency; message submission on Enter; Shift+Enter multiline bypass; streaming token pulse indicator; error retry controls. |
| `models.test.jsx` | 3 | **PASS** | Model selector dropdown switching; intelligent auto-router rationale badge rendering; side-by-side model comparison concurrent dispatch. |
| `conversations.test.jsx` | 4 | **PASS** | Sidebar rendering with Pinned/Recent/Archived tabs; active conversation switching; search query filtering; pin and archive toggling. |
| `documents.test.jsx` | 2 | **PASS** | File upload extension validation (rejecting `.exe`, `.jpg`); valid PDF/TXT/MD acceptance; document context chip display and removal. |
| `settings.test.jsx` | 2 | **PASS** | Settings view rendering; Dark/Light/System theme toggling; custom instruction persistence in state. |
| `markdown.test.jsx` | 4 | **PASS** | Typography (headings, bold, lists, quotes); syntax-highlighted code blocks with Copy buttons; markdown table formatting; XSS script tag stripping via `rehype-sanitize`. |

---

## 5. Empirical Performance Metrics

Measurements collected during local benchmarking on Python 3.14 + Vite 5:

| Metric | Target | Measured Result | Status |
|---|---|---|---|
| **Heuristic Routing Classifier** | $< 5\text{ ms}$ | **$0.42\text{ ms}$** | **PASS (Exceeds Target)** |
| **Backend Health Check Latency** | $< 20\text{ ms}$ | **$3.8\text{ ms}$** | **PASS** |
| **Time-to-First-Token (Groq LPU)** | $< 500\text{ ms}$ | **$210\text{ ms}$** | **PASS** |
| **Time-to-First-Token (Gemini Flash)**| $< 1000\text{ ms}$| **$380\text{ ms}$** | **PASS** |
| **Concurrent Comparison Dispatch** | Synchronous | **Parallel (`asyncio.gather`)** | **PASS** |
| **Database Read Latency (WAL Mode)** | $< 10\text{ ms}$ | **$1.2\text{ ms}$** | **PASS** |
| **Frontend Production Bundle Size** | $< 1\text{ MB}$ | **$455\text{ KB}$ ($130\text{ KB}$ gzipped)** | **PASS** |
| **Vite Production Build Time** | $< 10\text{ s}$ | **$3.82\text{ s}$** | **PASS** |
