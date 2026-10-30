# OmniAI REST & Streaming API Documentation

This document specifies the endpoints, request/response formats, error codes, and Server-Sent Event (SSE) contracts for OmniAI.

Base URL: `http://127.0.0.1:8000/api`

---

## 1. System & Health Endpoints

### `GET /`
Returns service root information and documentation links.
* **Response (200 OK)**:
```json
{
  "name": "OmniAI Backend",
  "version": "0.1.0",
  "status": "operational",
  "message": "Welcome to the OmniAI Backend Service",
  "docs": "/docs",
  "health": "/api/health"
}
```

### `GET /api/health`
Health check endpoint reporting system uptime, memory, database, and provider statuses.
* **Response (200 OK)**:
```json
{
  "status": "ok",
  "environment": "development",
  "version": "0.1.0",
  "providers": {
    "gemini": { "status": "configured" },
    "groq": { "status": "configured" }
  },
  "database": { "status": "connected", "type": "sqlite" }
}
```

---

## 2. Models & Discovery Endpoints

### `GET /api/models`
Returns registered AI models, capabilities, effort levels, and streaming flags.
* **Response (200 OK)**:
```json
{
  "models": [
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash (High Speed)",
      "provider": "gemini",
      "description": "Google's active high-speed multimodal intelligence",
      "tag": "Google AI Studio",
      "is_available": true,
      "supported_categories": ["reasoning", "general", "writing", "coding"],
      "context_window": 1048576,
      "cost_tier": "Free tier (15 RPM / 1M TPM)",
      "streaming_supported": true,
      "effort_levels": ["low", "medium", "high"],
      "default_effort": "medium"
    }
  ]
}
```

### `POST /api/models/discover`
Dynamically discovers and registers live models using a user-supplied API key (BYOK).
* **Request Body**:
```json
{
  "provider": "gemini",
  "api_key": "AIzaSy...",
  "base_url": "https://generativelanguage.googleapis.com/v1beta"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "provider": "gemini",
  "models_found": 46,
  "models": [
    {
      "id": "gemini-3.6-flash",
      "name": "Gemini 3.6 Flash (Dynamic)",
      "provider": "gemini",
      "is_available": true
    }
  ]
}
```

---

## 3. Chat & Streaming Endpoints

### `POST /api/chat`
Generates a complete non-streaming chat completion.
* **Request Body**:
```json
{
  "message": "Explain quicksort in 2 sentences.",
  "model_id": "auto",
  "conversation_id": null,
  "effort": "medium",
  "custom_instructions": "Be concise.",
  "document_id": null
}
```
* **Response (200 OK)**:
```json
{
  "conversation_id": "conv-a1b2c3d4e5f6",
  "message_id": "msg-9876543210ab",
  "response": "Quicksort is a divide-and-conquer sorting algorithm...",
  "model_used": "gemini-3.6-flash",
  "model_name": "Gemini 3.6 Flash",
  "provider": "gemini",
  "routed": true,
  "routing_category": "coding",
  "latency_ms": 320,
  "created_at": "2026-10-30T12:00:00Z"
}
```

### `POST /api/chat/stream`
Generates real-time Server-Sent Events (SSE) token stream.
* **Request Body**: Same schema as `POST /api/chat`.
* **SSE Events Streamed**:
  1. `type: meta` — Initial metadata:
  ```json
  data: {"type": "meta", "conversation_id": "conv-123", "model_id": "gemini-3.6-flash", "provider": "gemini", "effort": "medium"}
  ```
  2. `type: token` — Progressive text chunks:
  ```json
  data: {"type": "token", "token": "Quick"}
  data: {"type": "token", "token": "sort "}
  ```
  3. `type: done` — Final completion payload:
  ```json
  data: {"type": "done", "response": "Quicksort is...", "latency_ms": 340, "conversation_id": "conv-123"}
  ```
  4. `type: error` (if failure occurs):
  ```json
  data: {"type": "error", "error": "Provider quota exceeded"}
  ```

---

## 4. Model Comparison Endpoint

### `POST /api/compare`
Executes an identical prompt concurrently across two distinct models and returns comparative performance metrics.
* **Request Body**:
```json
{
  "prompt": "Write a binary search algorithm in Python.",
  "model_a_id": "gemini-3.6-flash",
  "model_b_id": "llama-3.1-8b-instant",
  "effort": "medium"
}
```
* **Response (200 OK)**:
```json
{
  "comparison_id": "cmp-f4e3d2c1",
  "prompt": "Write a binary search algorithm in Python.",
  "result_a": {
    "model_id": "gemini-3.6-flash",
    "status": "success",
    "response": "def binary_search...",
    "latency_ms": 380
  },
  "result_b": {
    "model_id": "llama-3.1-8b-instant",
    "status": "success",
    "response": "def binary_search...",
    "latency_ms": 165
  },
  "summary": {
    "fastest_model_id": "llama-3.1-8b-instant",
    "latency_difference_ms": 215
  }
}
```

---

## 5. Conversations Management Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/conversations` | Lists conversations with optional `search`, `include_archived`, and `archived_only` query params. |
| `POST` | `/api/conversations` | Creates a new conversation thread. |
| `GET` | `/api/conversations/{id}` | Retrieves conversation details and chronological message history. |
| `PUT` | `/api/conversations/{id}` | Updates title, `is_pinned`, or `is_archived` status. |
| `DELETE` | `/api/conversations/{id}` | Permanently deletes conversation with cascading message removal. |
| `GET` | `/api/conversations/{id}/export?format={md\|txt\|json}` | Exports conversation in specified format. |

---

## 6. Document Upload & Analysis Endpoints

### `POST /api/documents/upload`
Uploads a document (PDF, TXT, MD) with multi-part form data.
* **Parameters**: `file` (multipart file), optional `conversation_id`.
* **Limits**: 10 MB maximum, extensions `.pdf`, `.txt`, `.md`, `.markdown`.
* **Response (201 Created)**:
```json
{
  "document_id": "doc-550e8400",
  "filename": "lecture_notes.pdf",
  "file_type": "pdf",
  "file_size": 154200,
  "char_count": 4200,
  "chunk_count": 2,
  "created_at": "2026-10-30T12:00:00Z"
}
```

---

## 7. User Settings Endpoints

### `GET /api/settings`
Returns current user preferences (theme, default model, streaming, custom instructions).
* **Response (200 OK)**:
```json
{
  "theme": "dark",
  "default_model": "gemini-3.8-flash",
  "default_routing_mode": "auto",
  "streaming_enabled": true,
  "default_effort": "medium",
  "custom_instructions": "Prefer concise answers with code examples."
}
```

### `PUT /api/settings`
Updates persistent user preferences in SQLite.
* **Request Body**: Partial or full `SettingsUpdateRequest` payload.
* **Response (200 OK)**: Returns updated settings.
