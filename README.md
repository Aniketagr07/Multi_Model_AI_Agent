# OmniAI — Intelligent Multi-Model AI Chatbot

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Python](https://img.shields.io/badge/Python-3.11%20|%203.14-3776AB?logo=python&logoColor=white)](https://python.org)
[![Tests: 145 Passed](https://img.shields.io/badge/Tests-145%20Passed%20(100%25)-brightgreen.svg)](docs/TESTING_AND_RESULTS.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

OmniAI is an intelligent, multi-model AI chatbot application developed as an advanced B.Tech Capstone Project. OmniAI provides a unified, decoupled interface allowing users to converse with multiple leading AI models (Google Gemini, Groq-hosted Llama 3.1 & Mixtral, and OpenAI-compatible endpoints), stream tokens in real-time via Server-Sent Events (SSE), compare outputs side-by-side concurrently, upload and ground prompts in PDF/TXT/Markdown documents, route queries intelligently via an automatic rule-based classifier, search and manage conversations with pinning and archiving, export chat history, and personalize system behavior with custom instructions and theme preferences.

---

## 1. Project Overview

Modern AI workflows frequently require switching between different LLMs depending on the task: high-speed code generation (Groq LPUs), complex multi-step reasoning (Google Gemini Pro), or expansive document synthesis. OmniAI bridges these disparate engines into a cohesive, responsive experience:
* **Zero Cost**: Built entirely using official free-tier developer APIs (Google AI Studio & Groq Cloud).
* **Decoupled Architecture**: Strict separation of concerns between presentation, orchestration, model abstraction, and persistence.
* **Resilient**: Multi-tier active fallback chains prevent outages if an individual preview model is overloaded or deprecated.
* **Secure by Design**: Sanitized Markdown rendering, parameterized SQL, zero credential exposure in frontend code or git, and strict file upload bounds.

---

## 2. Key Features

* **👥 Shared Conversations & Real-Time Multi-User Collaboration**:
  * **Interactive Sharing Dialog**: Generate copyable share links and invite team members by email with granular access roles (`Owner`, `Editor`, `Viewer`).
  * **View-Only vs. Collaborative Modes**:
    * **View Only (`viewer`)**: Read-only access to messages with input composers securely locked and warning banners.
    * **Collaborative Access (`editor`)**: Live multi-user participation where team members send prompts, trigger AI responses, and view synchronized results.
  * **Real-Time WebSocket Synchronization (`/api/conversations/{id}/ws`)**:
    * Instant message broadcasts to all active room participants.
    * Real-time assistant token stream broadcasting across all connected collaborator viewports.
    * Live user presence tracking with online counts and participant badges.
    * Live multi-user typing indicators (`Alice is typing...`).
    * Clear message author attribution tags showing who prompted each query.
  * **Participant & Permission Management**: Owners can invite members, revoke invitations, change permissions, or remove participants; collaborators can leave threads gracefully.

* **📁 Collaborative Projects & Multi-Member Workspaces**:
  * **Comprehensive Project Workspaces**: Dedicated workspace hub with 6 functional tabs:
    1. **Overview**: Project description, member summaries, activity feed, and quick actions.
    2. **Conversations**: Team conversations grouped under the project with direct navigation.
    3. **Members**: Role management (`Owner`, `Admin`, `Member`, `Viewer`) and email invitations.
    4. **Files**: Shared project documents (`.pdf`, `.txt`, `.md`) accessible across project chats.
    5. **Skills**: Workspace-level toggle to enable or disable specific AI skills for the project.
    6. **Settings**: Edit project name, icon, visibility (`private` vs `link`), and workspace deletion.
  * **Project Navigation & Moving Conversations**: Sidebar project list with `+` creation button, and ability to move personal conversations into shared team projects.
  * **Workspace Audit Trail**: Real-time project activity event logging tracking file uploads, member joins, and conversation additions.

* **🔐 Dual-Mode User Authentication & Account Isolation**:
  * **Guest Mode**: Instant access with zero registration; conversations persist in local browser sessions with clear notices.
  * **Registered Accounts**: Email and password registration with PBKDF2-HMAC-SHA256 password hashing (100,000 rounds) and session tokens.
  * Multi-tenant data isolation: User conversations are strictly scoped by account ID and accessible across devices.
  * Minimalist profile control `[ User Profile Icon | Guest User / Username ▼ ]` in the top-right header with Sign In, Create Account, Settings, and Account Deletion.
* **🧩 Skills Marketplace & Tool Execution Framework**:
  * Modular marketplace featuring categories: Coding & Development, Research & Web, Productivity, Data Analysis, Documents & PDF, Mathematics, Automation, and Third-Party Integrations.
  * Explicit permission review and user consent confirmation dialogs before skill installation.
  * Sandboxed execution runners for arithmetic and symbolic algebra (`math-solver`), CSV datasets and statistics (`csv-analyzer`), AST code complexity analysis (`code-explainer`), and document summarization (`doc-summarizer`).
  * Honest reporting for Third-Party Integrations (GitHub, Google Drive, Calendar, Gmail) requiring server-side OAuth credentials without faking connectivity.
* **🧹 Clean Minimal UI Layout**:
  * Uncluttered top header: Removed redundant conversation titles, navigation buttons, and status tags; retained only the account profile menu and sidebar toggle.
  * Minimalist sidebar: Clean top branding, New Chat, search bar, and secondary navigation (Chat, Compare, Skills, Settings); completely removed bottom cards, version numbers, and footer clutter.
  * Compact bottom message composer: `[ 📎 Attach ] [ Selected Model ▼ ] [ 🧩 Skills ] ... [ ✈ Send ]` with floating bottom-right **View Usage** popover tracking 5h and weekly rolling quotas.
* **⚡ Real-Time SSE Token Streaming**:
  * Server-Sent Events (`POST /api/chat/stream`) progressively display token outputs with sub-second time-to-first-token.
  * Interactive controls: Stop Generation, Regenerate, Copy Response, Copy Code Block, and Retry on error.
* **🧠 Heuristic Intelligent Router (Auto Mode)**:
  * Deterministic regex classifier categorizes queries into `coding`, `reasoning`, `writing`, or `general` in `<1ms`.
  * Selects the optimal model with explainable rationale displayed on every response.
* **⚖️ Dual-Model Side-by-Side Comparison**:
  * Concurrent asynchronous dispatch (`asyncio.gather`) sends identical prompts to two models simultaneously.
  * Live comparison metrics: side-by-side markdown, latency timers, and winning speed indicator.
* **📄 Document Upload & Grounded Context Analysis**:
  * Drag-and-drop upload for PDF (`.pdf`), Plain Text (`.txt`), and Markdown (`.md`).
  * Text extraction via `pypdf` with empty-page and corruption protection.
  * Semantic chunking (2500 characters with 250 character overlap) and structured context tags to ground responses in uploaded document facts.
* **🗃️ Conversation Management & Search**:
  * Search conversations by title or message content.
  * Categorization into Pinned, Recent, and Archived sections.
  * Export conversations as Markdown (`.md`), Plain Text (`.txt`), or structured JSON (`.json`).
* **🎨 Settings & Personalization**:
  * Theme switching: Dark, Light, and System Default modes with instant persistence.
  * Custom instructions system injection with prompt-injection neutralization.
  * Model capability matrix and verified streaming status display.
* **🔑 Bring Your Own Key (BYOK) Dynamic Discovery**:
  * Connect custom API keys at runtime to query and register active models dynamically.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | React 18, Vite 5, Tailwind CSS, Lucide React, ReactMarkdown, RemarkGFM |
| **Backend API** | FastAPI, Python 3.11 / 3.14, Pydantic v2, Starlette, HTTPX, Uvicorn |
| **Database** | Embedded SQLite 3 with WAL Journaling, Foreign Keys, Composite Indexes |
| **Document Processing** | PyPDF 5, multi-encoding text decoding (`utf-8`, `utf-8-sig`, `latin-1`) |
| **AI Providers** | Google Generative Language API (REST/SSE), Groq Cloud API, OpenAI-compatible |
| **Testing & QA** | Pytest, Pytest-AsyncIO, Starlette TestClient |

---

## 4. Architecture Overview

OmniAI follows a layered hexagonal architecture:

```
+-----------------------------------------------------------------------------------+
|                                  React 18 Frontend                                |
|   (Vite, Tailwind CSS, Dark/Light Themes, SSE Stream Reader, Document Uploader)   |
+-----------------------------------------------------------------------------------+
                                         │
                          REST / SSE     │  GET /api/models, POST /api/chat/stream
                                         ▼
+-----------------------------------------------------------------------------------+
|                                  FastAPI Backend                                  |
|   (Defensive Security Headers, Strict CORS, Global Exception Redaction, Schemas)  |
+-----------------------------------------------------------------------------------+
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
+--------------------+          +--------------------+          +--------------------+
|  Heuristic Router  |          |   Model Registry   |          |  Document Service  |
|  (Rule Classifier) |          | (Capability Tiers) |          | (Chunk & Grounding)|
+--------------------+          +--------------------+          +--------------------+
        │                                │                                │
        └────────────────────────────────┼────────────────────────────────┘
                                         ▼
+-----------------------------------------------------------------------------------+
|                             Provider Abstraction Layer                            |
|       (BaseLLMProvider: GeminiProvider, GroqProvider, OpenAICompatibleProvider)   |
|                 ↳ Active Fallback Chain across verified endpoints                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                        Embedded SQLite Persistence Layer                          |
|         (WAL Mode, Foreign Key Cascades, Parameterized Queries, Indexing)         |
+-----------------------------------------------------------------------------------+
```

Detailed architectural specifications are documented in [docs/architecture.md](docs/architecture.md).

---

## 5. Folder Structure

```
OmniAI/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/          # REST route handlers (chat, compare, conversations, docs, settings)
│   │   ├── core/                # Configuration, security, model registry
│   │   ├── db/                  # SQLite schema initialization, migrations, and repository DAO
│   │   ├── providers/           # BaseLLMProvider, GeminiProvider, GroqProvider, OpenAIProvider
│   │   ├── schemas/             # Pydantic v2 request/response contracts
│   │   ├── services/            # ChatService, ModelRouter, DocumentService, ExportService
│   │   └── main.py              # Application factory, CORS, security middleware
│   ├── data/                    # SQLite database (omniai.db) and document storage
│   ├── tests/                   # 75 automated unit and integration tests
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── components/          # MessageBubble, ChatWindow, CompareView, SettingsView, etc.
│   │   ├── hooks/               # useChat, useConversations, useSettings, useCustomKeys
│   │   ├── services/            # api.js client (REST & SSE fetch wrappers)
│   │   ├── App.jsx              # Main view state router
│   │   └── index.css            # Custom CSS properties and theme definitions
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite development and build configuration
│   └── .env.example             # Frontend environment template
├── docs/
│   ├── architecture.md          # Architectural blueprints and component designs
│   ├── api.md                   # Complete REST & SSE API contract reference
│   ├── setup.md                 # Setup, configuration, and troubleshooting guide
│   ├── DEPLOYMENT.md            # Production deployment, Docker, and disaster recovery guide
│   └── FINAL_PROJECT_AUDIT.md   # Final audit and verification report
├── docker-compose.yml           # Production container orchestration
├── Dockerfile                   # Standalone production container
├── .gitignore                   # Exclusions for secrets, database, uploads, and node_modules
├── LICENSE                      # MIT Open Source License
└── README.md                    # Project documentation
```

---

## 6. Installation Instructions

### Prerequisites
* Python 3.10+ (tested through Python 3.14)
* Node.js 18.x or 20.x+ with `npm`
* Git

### Step-by-Step Setup
1. **Clone Repository**:
   ```bash
   git clone https://github.com/Aniketagr07/Multi_Model_AI_Agent.git
   cd Multi_Model_AI_Agent
   ```
2. **Setup Backend**:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   pip install -r requirements.txt
   cd ..
   ```
3. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

---

## 7. Environment Configuration

### Backend Configuration (`backend/.env`)
Copy the template:
```bash
cp backend/.env.example backend/.env
```
Populate required environment variables:
```ini
APP_NAME="OmniAI Backend"
APP_ENV=development
DEBUG=true
PORT=8000
HOST=0.0.0.0

# CORS Allowed Origins
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# AI Provider API Keys (Free Tier)
GEMINI_API_KEY="AIzaSy..."
GROQ_API_KEY="gsk_..."

# Default Configurations
DEFAULT_MODEL="gemini-3.8-flash"
SQLITE_DB_PATH="data/omniai.db"
UPLOAD_DIR="data/uploads"
```

### Frontend Configuration (`frontend/.env`)
Copy the template (optional for default port 8000):
```bash
cp frontend/.env.example frontend/.env
```
```ini
VITE_API_BASE_URL="http://localhost:8000"
```

---

## 8. API Setup Instructions

1. **Google Gemini Free API Key**:
   * Navigate to [Google AI Studio](https://aistudio.google.com/app/apikey).
   * Sign in with your Google account and click **Get API Key**.
   * Paste into `GEMINI_API_KEY` in `backend/.env`.
2. **Groq Cloud Free API Key**:
   * Navigate to [Groq Console](https://console.groq.com/keys).
   * Sign in and click **Create API Key**.
   * Paste into `GROQ_API_KEY` in `backend/.env`.

---

## 9. How to Run Frontend and Backend

### Option A: Running with Two Terminals

**Terminal 1 — Backend FastAPI Server**:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend React Dev Server**:
```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Access the application in your browser:
* 🌐 **Chat Interface**: [http://127.0.0.1:5173](http://127.0.0.1:5173)
* 📖 **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* 🩺 **Backend Health Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 10. Automated Testing

OmniAI features an extensive full-stack automated test suite with **145 total tests** (108 Backend pytest tests + 37 Frontend Vitest tests) executing hermetically with zero external network or token costs.

### Run Backend Tests (108 Tests)
```bash
python -m pytest backend/tests -v
```
All tests execute in ~7.5s with zero external network calls:
* **Collaboration & Sharing**: Share link generation, token validation, email invites, role hierarchy (`owner`, `editor`, `viewer`), permission enforcement, and room lifecycle.
* **Collaborative Projects**: Project CRUD, member management, moving conversations into projects, shared file upload/deletion, and activity event logging.
* **OAuth 2.0 & Accounts**: Google & GitHub OAuth state validation, guest conversation migration, session persistence, and multi-tenant isolation.
* **Core LLM & Routing**: Heuristic rule router, active fallbacks, provider failure recovery, rate limits, and streaming cancellation.
* **Persistence & Documents**: SQLite WAL repository, foreign key cascade cleanup, document chunking, and grounded context formatting.

### Run Frontend Tests (37 Tests across 9 Suites)
```bash
cd frontend
npm test
```
Tests run with Vitest and React Testing Library:
* **Collaboration & Projects**: ShareConversationModal, ChatHeader presence/role badges, MessageBubble author attribution, and ProjectWorkspace creation.
* **Chat & Real-time**: Streaming token display, typing indicators, auto-scroll locks, and message retry.
* **Conversation Management**: Sidebar search filtering, thread selection, pinning, archiving, and deletion.
* **Settings & Customization**: Theme switching (Dark/Light/System), custom model registration, and BYOK credentials.
* **Document Handling**: Multi-format upload validation, chunk count presentation, and document grounding.

### Run Production Build Verification
```bash
npm --prefix frontend run build
```

---

## 11. Academic Evaluation & Capstone Documentation

Comprehensive technical documentation packages created for university evaluators and technical viva panelists:

| Document | Purpose & Academic Focus |
|---|---|
| 📑 [**Project Report**](docs/PROJECT_REPORT.md) | Full 20-section capstone report covering objectives, architecture, algorithms, and results. |
| 📝 [**Project Abstract**](docs/PROJECT_ABSTRACT.md) | Academic abstract, keywords, and core project contributions. |
| 🏛️ [**System Architecture**](docs/SYSTEM_ARCHITECTURE.md) | 9 editable Mermaid diagrams covering frontend, backend, ERD, and data workflows. |
| 🔬 [**Technical Methodology**](docs/TECHNICAL_METHODOLOGY.md) | Sub-1ms regex heuristics, SSE vs WebSockets comparison, and chunking formulas. |
| 📦 [**Features & Modules**](docs/FEATURES_AND_MODULES.md) | Complete user story inventory, module specifications, and route directory. |
| 🧪 [**Testing & Results**](docs/TESTING_AND_RESULTS.md) | Empirical benchmarks, test execution matrices, and latency measurements. |
| 🔮 [**Future Scope**](docs/FUTURE_SCOPE.md) | ChromaDB vector RAG, AI Council consensus engine, and local Ollama roadmap. |
| 🎓 [**Viva Preparation Guide**](docs/VIVA_PREPARATION.md) | 16+ technical viva voce Q&As covering LLM inference, LPUs, WAL mode, and security. |
| 🏆 [**Final Capstone Report**](docs/FINAL_CAPSTONE_REPORT.md) | Comprehensive project scorecard, verification verdicts, and demonstration guide. |
| 🚀 [**Deployment Guide**](docs/DEPLOYMENT.md) | Production Docker Compose stack, Nginx reverse proxy, and disaster recovery. |

---

## 12. Security and Deployment Architecture

### Deployment Overview
OmniAI is designed as an open-source, local-first single-tenant AI workbench. In deployment configurations:
* **Docker Setup**: Configured with decoupled backend (FastAPI) and frontend (Nginx reverse proxy), health checks, and persistent SQLite/upload volumes.
* **Local Development Run**: Fully operational and verified on local development servers (`uvicorn` and `vite`).
* **Deployment Status**: Docker configuration is implemented (PASS); Docker Compose execution was not tested on the local Windows host due to absence of the Docker daemon; remote cloud production is not deployed.

### Single-Tenant Security Scope
* **Credential Isolation**: Primary provider keys are kept strictly in backend `.env` files and never exposed to the client. BYOK keys are held strictly in the user's browser memory or `localStorage`.
* **Safe Markdown Rendering**: Frontend uses `rehype-sanitize` with a strict whitelist to prevent Stored XSS attacks in LLM responses.
* **Single-Tenant Access Guard**: Configurable `APP_ACCESS_TOKEN` header check providing an access barrier for personal/private network setups.
* **File Upload Protections**: Strict MIME/extension validation (`.pdf`, `.txt`, `.md`), 10MB file size ceiling, random UUID naming, traversal prevention via `os.path.basename`, and zero code execution.
* **Prompt Injection Isolation**: Custom user instructions are wrapped in system instruction tags with defensive boundaries to mitigate persona override.
* **SQL Injection Immunity**: 100% of SQLite database interactions utilize parameterized queries or DAO abstraction.
* **In-Memory Rate Limiting**: 60 RPM sliding window per IP to mitigate accidental request loops on generation endpoints.

---

## 13. Screenshots Section

| Screen | Description |
|---|---|
| **Chat Interface & Real-Time Streaming** | Interactive conversation with progressive SSE tokens, effort controls, and provider tags. |
| **Model Comparison Matrix** | Concurrent side-by-side prompt execution across two independent models with latency comparison. |
| **Document Analysis** | Drag-and-drop PDF text extraction and grounded Q&A with semantic chunking. |
| **Conversation Organization** | Searchable sidebar with Pinned, Recent, and Archived sections plus multi-format export. |
| **Settings & Personalization** | Theme selection (Dark / Light / System), routing preferences, and custom instruction injection. |

*(Screenshots can be captured during demonstration and placed under `docs/screenshots/`)*

---

## 14. Known Limitations

1. **OCR on Scanned Images**: PDF text extraction relies on `pypdf`. Image-only scanned PDFs without embedded text streams are rejected with a clear user notice rather than processed with heavy OCR libraries.
2. **Free Tier Concurrency**: Google Gemini Free Tier imposes a 15 RPM / 1M TPM limit. Rapid successive testing may trigger temporary HTTP 429 responses, which OmniAI handles via its active fallback chain (`gemini-flash-lite-latest`).
3. **Local Storage / Single User**: In its default configuration, OmniAI is structured as a single-user desktop or local-server application. Multi-tenant authentication (OAuth/JWT) is designed for future cloud deployments.

---

## 15. Future Scope

* **AI Council Consensus Engine**: Multi-agent consensus summarizer that queries 3 models and synthesizes agreement points.
* **Vector Semantic Search (RAG)**: Integration of ChromaDB or sqlite-vss for hybrid lexical and dense vector search across uploaded document libraries.
* **On-Device Local Model Execution**: Direct integration with Ollama for 100% offline private inference.
* **Multi-User JWT Authentication**: Multi-tenant database schema partitioning for cloud hosting.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
