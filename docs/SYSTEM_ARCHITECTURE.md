# OmniAI — System Architecture & Design Specification

This document provides complete architectural blueprints, data flow diagrams, and component models for **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## 1. High-Level System Architecture

OmniAI follows a modern, decoupled layered architecture separating Presentation, Orchestration, Provider Abstraction, and Persistent Storage.

```mermaid
flowchart TD
    Client["Browser Client (React 18 + Vite SPA)"]
    Proxy["Nginx Production Gateway (Port 80 / 443)"]

    subgraph Backend_Services["FastAPI Orchestration Layer (Port 8000)"]
        Security["Security Middlewares\n(Headers, Token Auth, Rate Limiter, Size Guard)"]
        Router["REST / SSE API Router\n(/api/chat, /api/compare, /api/docs, /api/conversations)"]
        MetaRouter["Heuristic Intent Router\n(Sub-1ms Regex Classifier)"]
        DocService["Document Processing Service\n(PyPDF + Semantic Chunking)"]
        ChatService["Chat Orchestrator & Persistence Manager"]
    end

    subgraph Provider_Abstraction["Provider Abstraction Layer"]
        BaseProvider["BaseLLMProvider (Abstract Contract)"]
        Gemini["GeminiProvider\n(Google AI Studio REST/SSE)"]
        Groq["GroqProvider\n(Groq Cloud LPU OpenAI-Compatible)"]
        OpenAI["OpenAICompatibleProvider\n(Local / BYOK Dynamic Endpoints)"]
    end

    subgraph Storage_Layer["Persistent Storage Layer"]
        SQLite[("SQLite 3 Database (WAL Mode)\nomniai.db")]
        Uploads[("Filesystem Document Storage\n/app/data/uploads/")]
        Backups[("Online Backup Snapshots\n/app/data/backups/")]
    end

    Client -->|HTTP / SSE| Proxy
    Proxy -->|Reverse Proxy /api/| Security
    Security --> Router
    Router --> MetaRouter
    Router --> DocService
    Router --> ChatService
    ChatService --> BaseProvider
    BaseProvider --> Gemini
    BaseProvider --> Groq
    BaseProvider --> OpenAI
    ChatService --> SQLite
    DocService --> Uploads
    DocService --> SQLite
    SQLite -.->|scripts/backup_db.py| Backups
```

---

## 2. Frontend Component Architecture

The React 18 user interface is organized into a single-direction reactive state hierarchy managed by custom React hooks.

```mermaid
flowchart TD
    App["App.jsx (Root View Coordinator)"]

    subgraph Custom_Hooks["Custom React State Hooks"]
        useChat["useChat (Messages, Streaming, Model, Effort, Composer)"]
        useConversations["useConversations (List, Search, Pin, Archive, Export)"]
        useSettings["useSettings (Themes, Effort, Custom Instructions)"]
        useCustomKeys["useCustomKeys (BYOK Storage & Discovery)"]
        useHealthCheck["useHealthCheck (Service Health Poller)"]
    end

    subgraph UI_Components["Modular Presentation Components"]
        Header["ChatHeader (Active Title, Model Pill, View Switcher, Health)"]
        Sidebar["Sidebar (Search, Tabs, Pinned, Recent, Archived, Export Dropdown)"]
        ChatArea["ChatWindow (Auto-scroll, Scroll-to-Bottom, WelcomeScreen)"]
        Bubble["MessageBubble (Markdown, CodeBlock + Copy, Retry, Rationale)"]
        Composer["MessageComposer (Input, ModelSelector, Effort, DocumentChip, Stop/Send)"]
        CompareView["CompareView (Dual Model Selectors, Concurrent Dispatch, Benchmark)"]
        SettingsView["SettingsView (General, Appearance, AI Prefs, Personalization, About)"]
        ApiKeyModal["ApiKeyModal (BYOK Multi-Provider Discovery Dialog)"]
    end

    App --> Custom_Hooks
    App --> Header
    App --> Sidebar
    App --> ChatArea
    ChatArea --> Bubble
    App --> Composer
    App --> CompareView
    App --> SettingsView
    App --> ApiKeyModal
```

---

## 3. Backend Service Architecture

The FastAPI backend implements clean domain-driven service boundaries.

```mermaid
flowchart LR
    subgraph Routes["API Route Handlers"]
        RChat["routes/chat.py"]
        RCompare["routes/compare.py"]
        RDocs["routes/documents.py"]
        RConv["routes/conversations.py"]
        RSettings["routes/settings.py"]
        RDisc["routes/discovery.py"]
    end

    subgraph Core_Services["Domain Services"]
        CS["ChatService"]
        MR["ModelRouter"]
        DS["DocumentService"]
        ES["ExportService"]
        Registry["ModelRegistry"]
    end

    subgraph Providers["Provider Implementation"]
        Base["BaseLLMProvider"]
        GP["GeminiProvider"]
        GQ["GroqProvider"]
    end

    subgraph Data_Access["Repository DAO"]
        Repo["ConversationRepository"]
        DB["SQLite Connection (WAL)"]
    end

    RChat --> CS
    RChat --> MR
    RCompare --> Base
    RDocs --> DS
    RConv --> Repo
    RConv --> ES
    RSettings --> Repo
    RDisc --> Base

    CS --> MR
    CS --> Registry
    CS --> Base
    CS --> Repo
    Base --> GP
    Base --> GQ
    Repo --> DB
    DS --> Repo
```

---

## 4. AI Provider Integration Workflow

Providers adhere to a unified asynchronous contract supporting non-streaming completion, streaming token generators, and error normalization.

```mermaid
sequenceDiagram
    autonumber
    participant App as ChatService
    participant Reg as ModelRegistry
    participant Prov as GeminiProvider / GroqProvider
    participant API as External LLM API (Google / Groq)

    App->>Reg: Resolve model ID & credentials
    Reg-->>App: ModelConfig (provider, timeout, fallback chain)
    App->>Prov: generate_stream(messages, effort, custom_instructions)
    Prov->>API: POST /chat/completions (stream=True)
    alt API Returns 200 OK
        loop Token Stream
            API-->>Prov: SSE Data Chunk
            Prov-->>App: Yield StreamChunk(token, finish_reason)
        end
    else Transient 429 / 503 Rate Limit
        API-->>Prov: HTTP 429 Rate Limit
        Prov->>App: ProviderRateLimitError
        App->>Reg: Select fallback model (gemini-flash-lite-latest)
        App->>Prov: Retry stream with fallback
    else Authentication Error (401)
        API-->>Prov: HTTP 401 Unauthorized
        Prov-->>App: ProviderAuthError (Surface immediately without masked retry)
    end
```

---

## 5. Intelligent Routing Workflow (Auto Mode)

Deterministic regex heuristics classify user intent in `<1ms` without consuming secondary LLM tokens.

```mermaid
flowchart TD
    Prompt["Incoming User Prompt"] --> Normalize["Lower-case & Tokenize Text"]
    Normalize --> RegexChecks{"Pattern Matchers"}

    RegexChecks -->|Coding keywords: def, class, bug, sql, async, python| Coding["Category: coding\nTarget: Groq LPU (Llama 3.1 8B Instant)"]
    RegexChecks -->|Reasoning keywords: prove, calculate, evaluate, bat and ball| Reasoning["Category: reasoning\nTarget: Google Gemini (Gemini 3.6 Flash)"]
    RegexChecks -->|Writing keywords: draft, email, essay, poem, summarize| Writing["Category: writing\nTarget: Google Gemini (Gemini 3.6 Flash)"]
    RegexChecks -->|No specific category pattern matched| General["Category: general\nTarget: Default High-Speed Gemini Model"]

    Coding --> CheckAvail{"Is Preferred Model Available?"}
    Reasoning --> CheckAvail
    Writing --> CheckAvail
    General --> CheckAvail

    CheckAvail -->|Yes| Dispatch["Dispatch to Optimal Provider"]
    CheckAvail -->|No (Missing Key / Quota)| Fallback["Active Fallback to Next Configured Engine"]

    Dispatch --> Output["Response with 'Auto: {category}' badge and explanation"]
    Fallback --> Output
```

---

## 6. Model Comparison Workflow

Broadcasts an identical prompt concurrently to two distinct model engines via Python's asynchronous event loop.

```mermaid
sequenceDiagram
    autonumber
    actor User as User Client
    participant API as FastAPI (/api/compare)
    participant TaskA as Async Worker A (Model A)
    participant TaskB as Async Worker B (Model B)

    User->>API: POST /api/compare {prompt, model_a, model_b}
    API->>API: Validate model_a != model_b
    par Dispatch Model A
        API->>TaskA: asyncio.create_task(run_model(model_a, prompt))
        TaskA->>TaskA: Measure Latency Timer
        TaskA-->>API: ModelResponseA (response, latency_ms)
    and Dispatch Model B
        API->>TaskB: asyncio.create_task(run_model(model_b, prompt))
        TaskB->>TaskB: Measure Latency Timer
        TaskB-->>API: ModelResponseB (response, latency_ms)
    end
    API->>API: asyncio.gather(task_a, task_b)
    API-->>User: JSON {model_a: {...}, model_b: {...}, latency_delta}
    User->>User: Render side-by-side Markdown with Speed Winner tag
```

---

## 7. Document Upload & Grounded Analysis Workflow

Ingests documents, chunks text, and strictly grounds model answers in factual context.

```mermaid
flowchart TD
    File["User Uploads Document (.pdf, .txt, .md)"] --> Validate{"Format & Size Check\n(<= 10MB)"}
    Validate -->|Invalid Format / Oversized| Reject["HTTP 400 / 413 Error"]
    Validate -->|Valid| Sanitize["Sanitize Filename & Assign UUID"]

    Sanitize --> TypeCheck{"File Type"}
    TypeCheck -->|PDF| PyPDF["PyPDF Parser: Extract pages\nHandle scanned image error"]
    TypeCheck -->|TXT / MD| UTF["Multi-encoding Text Decoder\n(UTF-8, Latin-1, CP1252)"]

    PyPDF --> Chunking["Semantic Character Chunker\n(2500 chars / 250 overlap)"]
    UTF --> Chunking

    Chunking --> StoreFS["Store File in data/uploads/"]
    Chunking --> StoreDB["Insert Document Record into SQLite"]

    StoreDB --> UserPrompt["User Asks Question Regarding Document"]
    UserPrompt --> GroundingEngine["Grounding Context Assembler"]
    GroundingEngine --> ContextWrapper["Wrap in <document_context> XML tags with Document Grounding Guardrails"]
    ContextWrapper --> LLM["Dispatch Grounded Prompt to Model"]
    LLM --> StreamOut["Stream Grounded Answer with Source Document Pill"]
```

---

## 8. Database Entity Relationship Diagram (ERD)

OmniAI uses an embedded SQLite 3 schema with foreign key cascades and composite indexes.

```mermaid
erDiagram
    CONVERSATIONS ||--o{ MESSAGES : "has many"
    CONVERSATIONS ||--o{ DOCUMENTS : "owns"

    CONVERSATIONS {
        text id PK
        text title
        integer is_pinned
        integer is_archived
        text pinned_at
        text created_at
        text updated_at
    }

    MESSAGES {
        text id PK
        text conversation_id FK
        text role
        text content
        text model_id
        text provider
        integer latency_ms
        integer routed
        text routing_category
        text routing_explanation
        text effort
        text document_id
        text document_name
        text created_at
    }

    DOCUMENTS {
        text id PK
        text conversation_id FK
        text filename
        text file_type
        integer file_size
        text storage_path
        text extracted_text
        integer char_count
        integer chunk_count
        text created_at
    }

    USER_SETTINGS {
        text key PK
        text value
        text updated_at
    }
```

---

## 9. Streaming Response Workflow (Server-Sent Events)

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Browser as React Event Reader
    participant API as FastAPI /api/chat/stream
    participant Engine as AI Provider (Gemini / Groq)
    participant DB as SQLite WAL

    User->>Browser: Submit Prompt
    Browser->>API: POST /api/chat/stream (Accept: text/event-stream)
    API->>Engine: Open Async Stream
    loop Stream Chunks
        Engine-->>API: Token Chunk
        API-->>Browser: data: {"token": "...", "is_finish": false}
        Browser->>Browser: Progressively Append to Message State
    end
    alt Normal Completion
        Engine-->>API: Finish Chunk (finish_reason: "stop")
        API->>DB: Persist Full Assistant Message
        API-->>Browser: data: {"is_finish": true, "latency_ms": 320}
        Browser->>Browser: Finalize UI & Render Controls
    else User Clicks Stop Generation
        Browser->>API: Abort HTTP Signal (client disconnect)
        API->>API: Catch asyncio.CancelledError
        API->>API: Abort LLM stream without saving incomplete response
    end
```

