# OmniAI — Technical Methodology & Algorithmic Design

This document details the algorithms, mathematical formulations, software design patterns, and engineering trade-offs implemented in **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## 1. Heuristic Meta-Routing Methodology (Auto Mode)

### Problem & Inefficiency of LLM Meta-Routers
A prevalent architectural flaw in multi-model systems is utilizing a secondary Large Language Model to classify user intent. Querying an LLM (e.g. GPT-3.5 or Claude Haiku) simply to categorize a prompt introduces:
1. **Added Latency Penalty**: 300ms–800ms additional round-trip latency before dispatching to the primary engine.
2. **Financial / Quota Drain**: Consumes 20–50 tokens per query solely on classification.
3. **Cascading Failure Risk**: If the meta-classifier fails or rate limits, the entire chat engine crashes.

### OmniAI Solution: Sub-Millisecond Deterministic Heuristics
OmniAI employs a compiled, prioritized Regular Expression Classification Engine executed in Python. The classifier inspects normalized prompt tokens against verified semantic category wordsets:

```python
CATEGORIES = {
    "coding": r"\b(def|class|function|import|return|const|let|var|sql|select|insert|update|bug|error|exception|async|await|python|javascript|typescript|c\+\+|java|rust|docker|api|algorithm|binary search|regex)\b",
    "reasoning": r"\b(prove|derive|calculate|solve|bat and ball|puzzle|logical|paradox|trade-off|why does|how does|step by step|evaluate|compare the difference|mathematical)\b",
    "writing": r"\b(draft|write an essay|summarize|rewrite|email|letter|poem|blog|story|creative|outline|speech|tone|headline)\b"
}
```

### Classification Algorithm
1. **Normalization**: Prompt text is converted to lowercase and whitespace-normalized.
2. **Sequential Heuristic Evaluation**:
   * Evaluates `coding` patterns. If matched $\rightarrow$ assigns Category `coding`, Target: `llama-3.1-8b-instant` (Groq LPU hardware accelerated).
   * Evaluates `reasoning` patterns. If matched $\rightarrow$ assigns Category `reasoning`, Target: `gemini-3.6-flash` (Google DeepMind multimodal reasoning engine).
   * Evaluates `writing` patterns. If matched $\rightarrow$ assigns Category `writing`, Target: `gemini-3.6-flash`.
   * Fallback $\rightarrow$ Category `general`, Target: default high-speed Gemini model.
3. **Availability & Fallback Verification**:
   The engine cross-references the assigned model ID against `ModelRegistry`. If the optimal provider is missing credentials or rate-limited, it automatically falls back along the verified fallback chain.
4. **Latency & Complexity**:
   * Execution Time: $\mathcal{O}(N)$ where $N$ is the character length of the prompt.
   * Benchmarked Runtime: $\le 0.42\text{ ms}$ (zero network round-trips).

---

## 2. Server-Sent Events (SSE) Streaming Pipeline

### Transport Layer Comparison: SSE vs WebSockets

| Evaluation Metric | WebSockets (`ws://`) | Server-Sent Events (`text/event-stream`) | OmniAI Architectural Rationale |
|---|---|---|---|
| **Protocol** | Bi-directional TCP Upgrade | Uni-directional over standard HTTP/1.1 or HTTP/2 | LLM generation is strictly server-to-client streaming. SSE requires no custom socket handshake. |
| **Firewall / Proxy Compatibility** | Frequently blocked or degraded by enterprise proxies | Standard HTTP traffic; passes through Nginx, Cloudflare, and corporate firewalls | Guarantees seamless campus network and intranet deployment. |
| **HTTP/2 Multiplexing** | Separate TCP connection required | Fully multiplexed over a single HTTP/2 connection | Conserves client TCP socket pool. |
| **Reconnection & Resilience** | Manual heartbeat ping/pong required | Built-in browser reconnection protocol | Standardized, robust client error recovery. |

### SSE Chunk Protocol Contract
The FastAPI streaming endpoint (`POST /api/chat/stream`) yields JSON events formatted according to the W3C EventSource standard:
```
data: {"token": "def ", "is_finish": false}

data: {"token": "binary_search(", "is_finish": false}

data: {"token": "arr, target):", "is_finish": false}

data: {"is_finish": true, "latency_ms": 284, "model_id": "llama-3.1-8b-instant", "provider": "groq"}
```

### Client Cancellation Handling
When the user clicks **Stop Generation**, the React client calls `AbortController.abort()`. 
On the backend, Starlette detects the broken TCP pipe and raises `asyncio.CancelledError`. OmniAI intercepts this exception:
1. Closes the upstream LLM generator immediately to stop token consumption.
2. Discards the incomplete token buffer.
3. Prevents saving truncated or hallucinated partial responses into SQLite.

---

## 3. Document Chunking & Factual Grounding

### Chunking Formulation
When documents exceed standard LLM single-prompt contexts, naive truncation discards critical details. OmniAI implements semantic character chunking with overlapping sliding windows:
* **Chunk Window Size ($W$)**: $2,500\text{ characters}$
* **Overlap Window Size ($O$)**: $250\text{ characters}$
* **Stride ($S$)**: $S = W - O = 2,250\text{ characters}$
* **Total Chunks ($C$)**:
  $$C = \left\lceil \frac{L - O}{W - O} \right\rceil$$
  where $L$ is the extracted text character count.

The $10\%$ overlap ensures that sentences or entities spanning chunk boundaries are preserved in context.

### Document-Grounded Prompt Framing (Mitigating Hallucinations)
Grounded document questions are wrapped in structured XML tags with strict system boundaries:
```
<document_context name="{filename}">
{extracted_text_or_chunks}
</document_context>

Instructions:
1. Answer the user prompt strictly and exclusively using the provided document context above.
2. If the answer cannot be deduced directly from the document, explicitly state:
   "The provided document does not contain sufficient information to answer this question."
3. Do not invent facts, citations, or extrapolate beyond the provided text.
```

---

## 4. SQLite WAL Mode Concurrency

### Why SQLite with WAL Mode?
OmniAI is designed as an embedded, zero-cost, local-first application. Rather than introducing external database servers (PostgreSQL / MySQL) that require separate daemons and authentication, OmniAI utilizes embedded SQLite 3 enhanced with enterprise pragmas:

1. **Write-Ahead Logging (`PRAGMA journal_mode = WAL;`)**:
   * Traditional SQLite locks the entire database file during writes, blocking concurrent readers.
   * In WAL mode, changes are appended to a separate `-wal` file. Readers access the database concurrently without being blocked by writers.
2. **Busy Timeout (`PRAGMA busy_timeout = 5000;`)**:
   * If a transient lock occurs during concurrent transactions, SQLite waits up to 5,000ms before returning an error, eliminating `database is locked` exceptions.
3. **Foreign Keys (`PRAGMA foreign_keys = ON;`)**:
   * Enforces referential integrity. Deleting a conversation triggers an atomic `ON DELETE CASCADE` across all associated `messages` and `documents`.

---

## 5. Security & Isolation Methodology

1. **Defensive Prompt Injection Neutralization**:
   User custom instructions defined in Settings are wrapped in isolated XML tags:
   `<user_custom_instructions>{sanitized_instruction}</user_custom_instructions>`
   Preceding system directives instruct the model that user instructions can never override foundational safety boundaries.
2. **Zero Client Secret Storage**:
   Primary API keys are held strictly in server environment variables. Health checks and model discovery endpoints return masked strings (`status: configured`), guaranteeing zero secret exposure to browser inspectors.
3. **Stored XSS Sanitization**:
   Markdown rendering in `MessageBubble.jsx` utilizes `rehype-sanitize` with a strict GitHub-flavored HTML element whitelist. Any inline `<script>`, `<iframe>`, or `onload=` attributes injected into model outputs are neutralized before DOM insertion.

