# Bring Your Own API Key (BYOK) System Architecture & Setup Guide

OmniAI features a full multi-tenant **Bring Your Own API Key (BYOK)** system. Every registered user securely provides and manages their own API keys for AI providers (Google Gemini and Groq), eliminating centralized quota exhaustion, shared rate limits, and cross-user credential exposure.

---

## 1. Architectural Overview

```
                      +---------------------------------------+
                      |           React + Vite Frontend        |
                      |  - BYOK Onboarding Modal               |
                      |  - Settings -> AI Providers Tab        |
                      +-------------------+-------------------+
                                          |
                        HTTPS REST API    | (Bearer Session Token)
                                          v
                      +---------------------------------------+
                      |         FastAPI Backend (/api/byok)    |
                      |  - Live Provider Validation           |
                      |  - Fernet AES-256 Key Encryption      |
                      |  - Key Fingerprint Masking            |
                      +-------------------+-------------------+
                                          |
                      +-------------------+-------------------+
                      |                                       |
                      v                                       v
          +-----------------------+              +-----------------------+
          |  Persistent Storage   |              | Upstream AI Providers |
          |  - SQLite (Dev/Test)  |              | - Google Gemini API   |
          |  - Neon PostgreSQL    |              | - Groq Cloud API      |
          |  Encrypted at Rest    |              | Decrypted In-Memory   |
          +-----------------------+              +-----------------------+
```

---

## 2. Cryptographic Security & Key Management

### Fernet Authenticated Symmetric Encryption (AES-128-CBC + HMAC-SHA256)
- **Encryption Algorithm**: Fernet implementation from the Python `cryptography` library (`cryptography>=42.0.0`).
- **Key Derivation**: The system uses `API_KEY_ENCRYPTION_SECRET` (fallback: `APP_SESSION_SECRET` or `JWT_SECRET_KEY`) with SHA-256 and URL-safe base64 encoding to generate a 32-byte key.
- **Tamper Detection**: Fernet automatically checks cryptographic signatures. If an encrypted token is corrupted or modified, decryption aborts with a security error.
- **Masking Format**: Keys are masked as `••••••••••••a8K2` (keeping only the trailing 4 characters). Full plaintext keys are never returned to the frontend, never saved in browser storage, and never logged.
- **Zero Plaintext Persistence**: API keys are only decrypted in transient backend memory at the exact moment an AI completion or stream is initiated.

---

## 3. Database Schema & Multi-Tenant User Isolation

### `user_provider_credentials` Table
```sql
CREATE TABLE IF NOT EXISTS user_provider_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('gemini', 'groq', 'openai', 'anthropic')),
    encrypted_api_key TEXT NOT NULL,
    key_fingerprint TEXT NOT NULL,
    connection_status TEXT NOT NULL DEFAULT 'active' CHECK(connection_status IN ('active', 'error', 'revoked')),
    last_validated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_prov_creds_user ON user_provider_credentials(user_id);
```

### `users.byok_setup_completed`
- Stored as an integer flag (`0` or `1`) in SQLite and PostgreSQL.
- Defaults to `0` (`false`) for both new registrations and existing accounts.
- When `byok_setup_completed` is `0`, OmniAI presents the setup wizard upon login.

---

## 4. User Onboarding Flow

1. **First-Time / Existing User Login**:
   - OmniAI inspects `user.byok_setup_completed`.
   - If `false`, the **BYOK Onboarding Modal** opens automatically.
2. **Welcome Screen**:
   - Explains the BYOK model, data privacy, and personal rate limits.
   - Provides **"Get Started"** and **"I'll Do This Later"** options.
3. **Provider Connection Screen**:
   - **Google Gemini**:
     - Direct link: [Google AI Studio (https://aistudio.google.com/app/apikey)](https://aistudio.google.com/app/apikey)
     - 8-step walkthrough.
   - **Groq Cloud**:
     - Direct link: [Groq Console (https://console.groq.com/keys)](https://console.groq.com/keys)
     - 8-step walkthrough.
4. **Live Verification & Storage**:
   - "Test Connection" makes a live verification call to the provider.
   - "Save API Key" validates, encrypts, saves to the database, and flags `byok_setup_completed = 1`.
5. **Completion Screen**:
   - "You're all set! Your AI workspace is ready" with summary of connected providers and "Start Chatting" button.

---

## 5. Settings Management

In **Settings** &rarr; **AI Providers / API Keys**:
- Displays connection status for Google Gemini and Groq.
- Shows masked fingerprint (`••••••••••••a8K2`).
- Actions:
  - **Test Connection**: Live upstream latency & validity test.
  - **Replace Key**: Obscured password input with show/hide toggle.
  - **Disconnect Key**: Permanently deletes the stored encrypted key.

---

## 6. Auto-Routing Integration

OmniAI's Intelligent Model Router filters available models based on the active user's connected providers:
- If a user connects **only Groq**, requests in `auto` mode route strictly among Groq models (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`).
- If a user connects **both Gemini and Groq**, the router evaluates task complexity, coding needs, and context length across all registered models.
- If a user sends a prompt with **no active keys connected**, OmniAI prompts them to connect an API key.

---

## 7. API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/byok/status` | List connected providers and masked fingerprints | Yes (Bearer) |
| `POST` | `/api/byok/validate` | Test raw API key against upstream provider | Yes (Bearer) |
| `POST` | `/api/byok/save` | Validate, encrypt, and store user key | Yes (Bearer) |
| `DELETE` | `/api/byok/{provider}` | Remove user key for provider | Yes (Bearer) |

---

## 8. Verification & Test Suite

Run full backend test suite:
```bash
python -m pytest backend/tests
```
*Result: 116 passed (including 4 dedicated BYOK integration & unit tests).*

Run full frontend vitest suite:
```bash
npm --prefix frontend test -- --run
```
*Result: 41 passed across 10 test suites.*

Production build verification:
```bash
npm --prefix frontend run build
```
*Result: Clean production bundle built successfully.*

