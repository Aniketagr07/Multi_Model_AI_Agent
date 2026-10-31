# OmniAI — Features & Functional Modules Specification

This document provides a comprehensive inventory of all user-facing features, backend modules, interface controls, and functional capabilities implemented across **OmniAI — Intelligent Multi-Model AI Chatbot**.

---

## 1. Feature Matrix by Domain

### 1. Real-Time Chat & Streaming Engine
* **Server-Sent Events (SSE) Streaming**: Delivers tokens in real time with progressive display in the browser.
* **Stop Generation**: Immediately aborts active HTTP stream and upstream generator without persisting truncated responses.
* **Response Regeneration**: Re-runs the last prompt with the same or an alternative model to compare variations.
* **Message Retry**: Allows one-click retry of failed or rate-limited queries.
* **Syntax-Highlighted Code Blocks**: Automatically formats code blocks with syntax styling and a dedicated **Copy Code** button.
* **Response Markdown Rendering**: Secure rendering of headings, bold/italics, bulleted/numbered lists, blockquotes, inline code, and tables.
* **Effort Tier Controls**: Three-tier reasoning depth configuration (`low`, `medium`, `high`) mapped to provider system instructions.
* **Provider & Latency Attribution**: Every assistant response displays the exact model name, provider badge, and round-trip execution latency in milliseconds (e.g. `⚡ 240ms`).

### 2. Intelligent Auto-Router (Auto Mode)
* **Deterministic Rule Classifier**: Inspects prompt text to classify intent into `coding`, `reasoning`, `writing`, or `general` in `<1ms`.
* **Hardware-Optimized Model Mapping**:
  * `coding` $\rightarrow$ Dispatched to ultra-fast Groq LPU engine (`llama-3.1-8b-instant`).
  * `reasoning` $\rightarrow$ Dispatched to Google DeepMind engine (`gemini-3.6-flash`).
  * `writing` $\rightarrow$ Dispatched to Google DeepMind engine (`gemini-3.6-flash`).
  * `general` $\rightarrow$ Dispatched to default active Gemini model.
* **Transparent Rationale Badges**: Renders an explainable UI badge (`Auto: coding`, `Auto: reasoning`) with the exact routing reason.
* **Active Fallback Resilience**: Seamlessly routes to secondary fallback models if the preferred provider lacks credentials or encounters quota limits.

### 3. Dual-Model Side-by-Side Comparison Matrix
* **Concurrent Prompt Broadcasting**: Dispatches the identical prompt to two distinct models simultaneously via `asyncio.gather`.
* **Parallel Latency Timer**: Displays independent latency counters for Model A and Model B.
* **Speed Winner Tag**: Highlights the faster model with a **Speed Winner** pill and latency differential (e.g., `180ms faster`).
* **Side-by-Side Formatting**: Synchronized dual-pane markdown rendering for comparing reasoning depth and accuracy.

### 4. Document Grounding & File Analysis
* **Multi-Format Upload**: Drag-and-drop and file-picker ingestion for `.pdf`, `.txt`, `.md`, and `.markdown`.
* **PyPDF Extraction**: Extracts text streams from PDF files with error handling for corrupted files and image-only scanned documents.
* **Semantic Chunking**: Automatically segments large documents into 2,500-character windows with 250-character overlap.
* **Document-Grounded Prompting**: Wraps extracted text in structured XML tags with negative constraints to ground model answers strictly in document facts.
* **Document Attachment Cards**: Shows filename, file size, character count, chunk count, and upload progress in the chat composer.

### 5. Conversation History & Management
* **Dual-Field Search**: Filters conversations in real time by conversation title or individual message content.
* **Tri-Section Organization**: Automatically partitions chats into **Pinned**, **Recent**, and **Archived** sections.
* **Conversation Pinning**: Pins important threads to the top of the sidebar with persistent timestamps.
* **Conversation Archiving**: Hides completed chats into a collapsible archived drawer.
* **Cascade Deletion**: Removes a conversation and automatically cascades deletion to all stored messages and document attachments.
* **Multi-Format Export**: One-click download of conversation history as Markdown (`.md`), Plain Text (`.txt`), or sanitized JSON (`.json`).

### 6. Settings & Personalization
* **Theme Switching**: Dark, Light, and System Default themes with instant CSS variable updates and persistence across browser sessions.
* **System Prompt Custom Instructions**: Inject personalized instructions (e.g. "Explain simply", "Include code examples", "Concise output") with defensive boundary isolation.
* **Live Model Capability Matrix**: Live inspection of registered models, context windows, supported task categories, and verified streaming capabilities.
* **Bring-Your-Own-Key (BYOK) Dynamic Discovery**: Runtime modal allowing users to enter private API keys, query live provider endpoints, and register discovered models in browser memory.

### 7. Production Security & Reliability
* **Single-Tenant Token Access Guard**: Header-based authentication (`APP_ACCESS_TOKEN`) protecting API endpoints in production.
* **In-Memory Rate Limiter**: 60 RPM sliding window per IP on generation endpoints to defend against floods.
* **Request Ceiling**: 15 MB payload guard rejecting oversized requests with HTTP 413.
* **Secret Masking Logger**: Automatically redacts API keys and bearer tokens from application logs.
* **Online SQLite Backups**: Non-blocking atomic database snapshot utility (`scripts/backup_db.py`) and restore utility (`scripts/restore_db.py`).

---

## 2. Backend Modules & Endpoint Directory

| Module Path | Route Prefix | Primary Responsibilities |
|---|---|---|
| `app.api.routes.chat` | `/api/chat` | Chat completions, SSE token streaming, model registry listing. |
| `app.api.routes.compare` | `/api/compare` | Concurrent dual-model benchmark dispatch. |
| `app.api.routes.conversations`| `/api/conversations` | Conversation CRUD, search, pin/archive toggles, multi-format export. |
| `app.api.routes.documents` | `/api/documents` | File upload validation, text extraction, document metadata retrieval. |
| `app.api.routes.settings` | `/api/settings` | User settings persistence and custom instruction retrieval. |
| `app.api.routes.discovery` | `/api/models/discover`| BYOK runtime API key model querying and registration. |
| `app.api.routes.health` | `/api/health` | Service uptime, memory, database, and provider readiness checks. |
| `app.services.document_service`| N/A (Service) | PyPDF parsing, filename sanitization, character chunking. |
| `app.services.router` | N/A (Service) | Regex classification and optimal model selection. |
| `app.services.export_service`| N/A (Service) | Formatting conversation transcripts into Markdown, Text, and JSON. |
| `app.db.repository` | N/A (DAO) | Parameterized SQLite queries and transaction handling. |



### 7. Dual-Mode Authentication & Multi-Tenant Data Isolation
* **Guest Mode**: Instant zero-barrier conversational workbench; saves conversations under local session boundaries with explicit cross-device sync disclaimers.
* **Registered Accounts**: User registration and login utilizing NIST-compliant PBKDF2-HMAC-SHA256 password hashing with 32-byte cryptographic salts and 100,000 iterations.
* **Secure Session Tokens**: 30-day cryptographically random session tokens managed via `user_sessions` SQLite table.
* **Data Scoping & Ownership**: Strict database foreign key cascades and user ID filtering ensuring user A cannot view, mutate, or delete user B's conversations or messages.
* **Permanent Account Deletion**: Self-service account termination that automatically wipes user profile, sessions, chats, messages, documents, and installed skills.

### 8. Skills Marketplace & Sandboxed Tool Execution
* **Extensibility Framework**: Dedicated marketplace separating AI model orchestration from tool invocation.
* **Categorized Discovery**: Search and category filtering across Coding, Research, Productivity, Data Analysis, Documents, Math, Automation, and Integrations.
* **Permission Consent Dialog**: Displays required permissions (e.g. `read_code`, `compute_metrics`, `web_access`) and mandates explicit confirmation before installation.
* **Built-in Execution Handlers**:
  * `math-solver`: AST-validated mathematical evaluator avoiding dangerous `eval`.
  * `csv-analyzer`: Parses tabular datasets, computing row counts, sums, means, and anomalies.
  * `code-explainer`: AST-based parser inspecting functions, classes, imports, and loops.
  * `doc-summarizer`: Extracts structural insights, word counts, and executive bullet points.
* **Third-Party Integrations**: Architectural foundation for GitHub, Google Drive, Calendar, and Gmail with honest connection states.

### 9. Minimalist Interface Architecture
* **Clean Top Header**: Completely eliminates redundant title headers, navigation buttons, and status indicators; features a single account profile dropdown `[ User Profile Icon | Guest User / Username ▼ ]`.
* **Clean Sidebar**: Minimalist layout containing OmniAI branding, New Chat, conversation search, view links, and genuine conversation history with an empty state for new users; zero bottom-left footer clutter.
* **Integrated Model Selector**: Compact trigger showing `[ Provider Logo ] Short Model Name ▼` with reasoning effort segmented controls and BYOK API key configuration inside the dropdown.
* **Floating Usage Popover**: Non-intrusive floating popover anchored at the bottom-right displaying 5-hour and 7-day rolling quota windows.

### 10. Shared Conversations & Real-Time Collaboration
* **Granular Share Dialog**: Instant sharing modal with copyable URL link generation and email address invitations.
* **Access Modes**:
  * **View-Only (`viewer`)**: Read-only observation with locked input composers, disabled file uploads, and viewer warning banners.
  * **Collaborative Access (`editor`)**: Full interactive co-authoring where invited team members can send queries, invoke tools, and prompt AI models.
* **WebSocket Real-Time Synchronization**:
  * Real-time room multiplexing at `/api/conversations/{id}/ws` with token and session authorization.
  * Instant multi-user chat broadcasting (`new_message` events).
  * Live assistant token streaming (`assistant_chunk` and `assistant_done` events) synced across all connected devices.
  * Live presence detection (`presence_update` events) with online counter badge in header.
  * Collaborative typing indicators (`user_typing` events).
  * Author attribution tagging showing the creator name and timestamp for every user message.
* **Member Management**:
  * Owner capabilities: Revoke invitations, remove members, toggle public link permissions, and delete conversations.
  * Member capabilities: Voluntarily leave shared threads with automatic presence and state cleanup.

### 11. Collaborative Projects & Multi-Member Workspaces
* **Project Workspaces**: Collaborative project containers organizing related conversations, members, shared files, and specialized AI skills.
* **6-Tab Dedicated Workspace Interface**:
  1. **Overview Tab**: Project statistics, description, member avatars, and real-time activity timeline.
  2. **Conversations Tab**: Conversations attached to the project, with quick creation and one-click chat launching.
  3. **Members Tab**: Multi-user team roster with role-based permissions (`Owner`, `Admin`, `Member`, `Viewer`), email invitations, and role management.
  4. **Files Tab**: Shared workspace files (`.pdf`, `.txt`, `.md`) uploaded once and available across all project conversations.
  5. **Skills Tab**: Workspace-level toggle switches to enable or disable specific AI skills per project.
  6. **Settings Tab**: Update project title, icon, visibility (`private` vs `link`), and project deletion.
* **Thread Migration**: Easily move individual personal conversations into collaborative team projects.
* **Workspace Audit Trail**: Real-time event logging (`activity_events`) recording file uploads, new members, and conversation additions.

