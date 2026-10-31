import os
import sqlite3
import logging
import json
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_db_initialized: bool = False

BUILTIN_SKILLS = [
    {
        "id": "python-code-assistant",
        "name": "Python Code Assistant",
        "description": "Analyzes, optimizes, and generates idiomatic Python code with type annotations and docstrings.",
        "category": "Coding & Development",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "code",
        "permissions": ["read_code", "execute_sandbox"],
        "is_featured": 1,
    },
    {
        "id": "code-explainer",
        "name": "Code Explainer",
        "description": "Deconstructs complex algorithms, explaining time/space complexity and potential edge cases.",
        "category": "Coding & Development",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "terminal",
        "permissions": ["read_code"],
        "is_featured": 0,
    },
    {
        "id": "web-research-assistant",
        "name": "Web Research Assistant",
        "description": "Performs structured topic research, synthesizes external sources, and generates executive summaries.",
        "category": "Research & Web",
        "provider": "OmniAI Core",
        "version": "1.1.0",
        "icon": "globe",
        "permissions": ["web_access", "read_content"],
        "is_featured": 1,
    },
    {
        "id": "doc-summarizer",
        "name": "Document Summarizer",
        "description": "Extracts key insights, highlights action items, and condenses lengthy documentation and articles.",
        "category": "Documents & PDF",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "file-text",
        "permissions": ["read_documents"],
        "is_featured": 1,
    },
    {
        "id": "pdf-researcher",
        "name": "PDF Research Assistant",
        "description": "Grounded question-answering over uploaded PDF manuals, research papers, and technical specifications.",
        "category": "Documents & PDF",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "book-open",
        "permissions": ["read_documents", "extract_text"],
        "is_featured": 0,
    },
    {
        "id": "csv-analyzer",
        "name": "CSV & Tabular Data Analyzer",
        "description": "Parses structured CSV datasets, computes statistical metrics, and identifies trends and anomalies.",
        "category": "Data Analysis",
        "provider": "OmniAI Core",
        "version": "1.2.0",
        "icon": "table",
        "permissions": ["read_data", "compute_metrics"],
        "is_featured": 1,
    },
    {
        "id": "math-solver",
        "name": "Mathematical Solver",
        "description": "Step-by-step mathematical reasoning, symbolic algebra simplification, and arithmetic verification.",
        "category": "Mathematics",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "calculator",
        "permissions": ["compute_math"],
        "is_featured": 0,
    },
    {
        "id": "email-assistant",
        "name": "Email Assistant",
        "description": "Drafts professional correspondence, customer support replies, and adjusts tone appropriately.",
        "category": "Productivity",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "mail",
        "permissions": ["draft_content"],
        "is_featured": 0,
    },
    {
        "id": "workflow-automator",
        "name": "Workflow Automator",
        "description": "Designs multi-step agentic workflows and pipeline blueprints for recurring developer tasks.",
        "category": "Automation",
        "provider": "OmniAI Core",
        "version": "1.0.0",
        "icon": "cpu",
        "permissions": ["schedule_tasks", "pipeline_design"],
        "is_featured": 0,
    },
    {
        "id": "github-integration",
        "name": "GitHub Integration",
        "description": "Inspect repositories, read pull requests, and review code diffs directly within conversations.",
        "category": "Third-Party Integrations",
        "provider": "GitHub Inc.",
        "version": "0.9.0",
        "icon": "github",
        "permissions": ["read_repos", "oauth_access"],
        "is_featured": 1,
    },
    {
        "id": "google-drive-sync",
        "name": "Google Drive Sync",
        "description": "Connects to Google Drive to read documentation, sheets, and project resources on-demand.",
        "category": "Third-Party Integrations",
        "provider": "Google LLC",
        "version": "0.9.0",
        "icon": "folder",
        "permissions": ["drive_readonly", "oauth_access"],
        "is_featured": 0,
    },
    {
        "id": "google-calendar-assistant",
        "name": "Google Calendar Assistant",
        "description": "Schedules events, reviews daily agenda, and resolves scheduling conflicts via Google Calendar API.",
        "category": "Third-Party Integrations",
        "provider": "Google LLC",
        "version": "0.8.0",
        "icon": "calendar",
        "permissions": ["calendar_events", "oauth_access"],
        "is_featured": 0,
    },
]


def get_db_path() -> Path:
    """Resolve absolute path to SQLite database file and ensure parent directory exists."""
    settings = get_settings()
    configured_path = Path(settings.SQLITE_DB_PATH)

    if not configured_path.is_absolute():
        base_dir = Path(__file__).resolve().parent.parent.parent
        db_path = base_dir / configured_path
    else:
        db_path = configured_path

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def init_db() -> None:
    """
    Initializes database schema with required tables and indexes if they do not exist.
    Safe to execute multiple times (idempotent).
    """
    global _db_initialized
    settings = get_settings()

    if settings.is_postgres:
        init_postgres_db()
        _db_initialized = True
        return

    schema_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        primary_provider TEXT DEFAULT 'email',
        avatar_url TEXT,
        last_login_at TEXT,
        display_name TEXT,
        byok_setup_completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        pinned_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        model_id TEXT,
        provider TEXT,
        latency_ms INTEGER,
        routed INTEGER DEFAULT 0,
        routing_category TEXT,
        routing_explanation TEXT,
        effort TEXT DEFAULT 'medium',
        document_id TEXT,
        document_name TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_usage (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        provider TEXT NOT NULL,
        version TEXT NOT NULL,
        icon TEXT NOT NULL,
        permissions TEXT NOT NULL,
        is_builtin INTEGER DEFAULT 1,
        is_featured INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_skills (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        skill_id TEXT NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        installed_at TEXT NOT NULL,
        config TEXT,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        skill_id TEXT NOT NULL,
        conversation_id TEXT,
        input_data TEXT,
        output_data TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        executed_at TEXT NOT NULL,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_usage_created_at ON model_usage(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_usage_provider ON model_usage(provider);
    CREATE TABLE IF NOT EXISTS user_oauth_providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
        provider_user_id TEXT NOT NULL,
        email TEXT,
        display_name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'login',
        user_id TEXT,
        redirect_uri TEXT,
        code_verifier TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id, skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON skill_executions(user_id, executed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_oauth_provider_uid ON user_oauth_providers(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_providers(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
    -- Collaboration & Projects Schema
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'folder',
        visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'invite_only')),
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
        joined_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_invitations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        inviter_user_id TEXT NOT NULL,
        email TEXT,
        token TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
        joined_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS conversation_invitations (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        inviter_user_id TEXT NOT NULL,
        email TEXT,
        token TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('editor', 'viewer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        enabled_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
        UNIQUE(project_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        conversation_id TEXT,
        user_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    );

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
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_proj ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_activity_proj ON activity_events(project_id, created_at DESC);

    """

    db_path = get_db_path()

    conn = sqlite3.connect(str(db_path), timeout=10.0)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.executescript(schema_sql)

        # Migrate existing conversations table if columns are missing
        c_cursor = conn.execute("PRAGMA table_info(conversations);")
        c_cols = [r[1] for r in c_cursor.fetchall()]
        if "user_id" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN user_id TEXT;")
            except Exception:
                pass
        if "is_pinned" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0;")
            except Exception:
                pass
        if "is_archived" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN is_archived INTEGER DEFAULT 0;")
            except Exception:
                pass
        if "pinned_at" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN pinned_at TEXT;")
            except Exception:
                pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(is_pinned, is_archived, updated_at DESC);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);")

        # Migrate existing oauth_states table if code_verifier is missing
        o_cursor = conn.execute("PRAGMA table_info(oauth_states);")
        o_cols = [r[1] for r in o_cursor.fetchall()]
        if "code_verifier" not in o_cols and o_cols:
            try:
                conn.execute("ALTER TABLE oauth_states ADD COLUMN code_verifier TEXT;")
            except Exception:
                pass


        # Migrate conversations for Projects & Sharing
        c_cursor = conn.execute("PRAGMA table_info(conversations);")
        c_cols = [r[1] for r in c_cursor.fetchall()]
        if "project_id" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN project_id TEXT;")
            except Exception:
                pass
        if "sharing_enabled" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN sharing_enabled INTEGER DEFAULT 0;")
            except Exception:
                pass
        if "share_permission" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN share_permission TEXT DEFAULT 'editor';")
            except Exception:
                pass
        if "share_token" not in c_cols and c_cols:
            try:
                conn.execute("ALTER TABLE conversations ADD COLUMN share_token TEXT;")
            except Exception:
                pass

        # Migrate messages for Author attribution in collaboration
        m_cursor = conn.execute("PRAGMA table_info(messages);")
        m_cols = [r[1] for r in m_cursor.fetchall()]
        if "author_id" not in m_cols and m_cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN author_id TEXT;")
            except Exception:
                pass
        if "author_name" not in m_cols and m_cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN author_name TEXT;")
            except Exception:
                pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, updated_at DESC);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_share_token ON conversations(share_token);")

                # Migrate existing users table if OAuth columns are missing
        u_cursor = conn.execute("PRAGMA table_info(users);")
        u_cols = [r[1] for r in u_cursor.fetchall()]
        if "primary_provider" not in u_cols and u_cols:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN primary_provider TEXT DEFAULT 'email';")
            except Exception:
                pass
        if "avatar_url" not in u_cols and u_cols:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT;")
            except Exception:
                pass
        if "last_login_at" not in u_cols and u_cols:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN last_login_at TEXT;")
            except Exception:
                pass
        if "display_name" not in u_cols and u_cols:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN display_name TEXT;")
            except Exception:
                pass
        if "byok_setup_completed" not in u_cols and u_cols:
            try:
                conn.execute("ALTER TABLE users ADD COLUMN byok_setup_completed INTEGER DEFAULT 0;")
            except Exception:
                pass

        # Migrate existing messages table if columns are missing
        cursor = conn.execute("PRAGMA table_info(messages);")
        cols = [r[1] for r in cursor.fetchall()]
        if "effort" not in cols and cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN effort TEXT DEFAULT 'medium';")
            except Exception:
                pass
        if "document_id" not in cols and cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN document_id TEXT;")
            except Exception:
                pass
        if "document_name" not in cols and cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN document_name TEXT;")
            except Exception:
                pass

        # Seed builtin skills if missing
        import datetime
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        for skill in BUILTIN_SKILLS:
            conn.execute(
                """
                INSERT INTO skills (id, name, description, category, provider, version, icon, permissions, is_builtin, is_featured, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(id) DO NOTHING;
                """,
                (
                    skill["id"],
                    skill["name"],
                    skill["description"],
                    skill["category"],
                    skill["provider"],
                    skill["version"],
                    skill["icon"],
                    json.dumps(skill["permissions"]),
                    skill["is_featured"],
                    now_iso,
                ),
            )

        conn.commit()
        _db_initialized = True
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# PostgreSQL / Neon Production Compatibility Layer
# -----------------------------------------------------------------------------

class PostgresCursorWrapper:
    """Wraps a psycopg Cursor to provide a SQLite-compatible query interface."""

    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query: str, params: Any = None):
        pg_query = query.replace("?", "%s")
        if "INSERT OR IGNORE INTO" in pg_query:
            pg_query = pg_query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            if "ON CONFLICT" not in pg_query:
                pg_query = pg_query.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING;"
        if params is not None:
            self._cursor.execute(pg_query, params)
        else:
            self._cursor.execute(pg_query)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [dict(r) for r in rows]

    def __iter__(self):
        for row in self._cursor:
            yield dict(row) if row is not None else None

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description


class PostgresConnectionWrapper:
    """Wraps a psycopg Connection to provide a SQLite-compatible execution interface."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, query: str, params: Any = None):
        cur = self._conn.cursor()
        wrapper = PostgresCursorWrapper(cur)
        wrapper.execute(query, params)
        return wrapper

    def executescript(self, script: str):
        lines = []
        for line in script.splitlines():
            if line.strip().upper().startswith("PRAGMA "):
                continue
            lines.append(line)
        cleaned = "\n".join(lines)
        with self._conn.cursor() as cur:
            cur.execute(cleaned)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def init_postgres_db() -> None:
    """Initializes schema and tables for PostgreSQL / Neon in production."""
    settings = get_settings()
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError:
        raise RuntimeError("psycopg package is required for PostgreSQL. Run: pip install psycopg[binary]")

    pg_schema_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        primary_provider TEXT DEFAULT 'email',
        avatar_url TEXT,
        display_name TEXT,
        last_login_at TEXT,
        byok_setup_completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'folder',
        visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'invite_only')),
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        pinned_at TEXT,
        sharing_enabled INTEGER DEFAULT 0,
        share_permission TEXT DEFAULT 'editor',
        share_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        model_id TEXT,
        provider TEXT,
        latency_ms INTEGER,
        routed INTEGER DEFAULT 0,
        routing_category TEXT,
        routing_explanation TEXT,
        effort TEXT DEFAULT 'medium',
        document_id TEXT,
        document_name TEXT,
        author_id TEXT,
        author_name TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        char_count INTEGER NOT NULL,
        chunk_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_usage (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        provider TEXT NOT NULL,
        version TEXT NOT NULL,
        icon TEXT NOT NULL,
        permissions TEXT NOT NULL,
        is_builtin INTEGER DEFAULT 1,
        is_featured INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_skills (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        is_enabled INTEGER DEFAULT 1,
        installed_at TEXT NOT NULL,
        config TEXT
    );

    CREATE TABLE IF NOT EXISTS skill_executions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        conversation_id TEXT,
        input_data TEXT,
        output_data TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        executed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_oauth_providers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
        provider_user_id TEXT NOT NULL,
        email TEXT,
        display_name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'login',
        user_id TEXT,
        redirect_uri TEXT,
        code_verifier TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
        joined_at TEXT NOT NULL,
        UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_invitations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        token TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
        joined_at TEXT NOT NULL,
        UNIQUE(conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS conversation_invitations (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        token TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('editor', 'viewer')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_skills (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        is_enabled INTEGER DEFAULT 1,
        enabled_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        conversation_id TEXT,
        user_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_provider_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK(provider IN ('gemini', 'groq', 'openai', 'anthropic')),
        encrypted_api_key TEXT NOT NULL,
        key_fingerprint TEXT NOT NULL,
        connection_status TEXT NOT NULL DEFAULT 'active' CHECK(connection_status IN ('active', 'error', 'revoked')),
        last_validated_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, provider)
    );

    CREATE INDEX IF NOT EXISTS idx_user_prov_creds_user ON user_provider_credentials(user_id);

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_share_token ON conversations(share_token);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_usage_created_at ON model_usage(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_model_usage_provider ON model_usage(provider);
    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id, skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON skill_executions(user_id, executed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_oauth_provider_uid ON user_oauth_providers(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON user_oauth_providers(user_id);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_proj ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_activity_proj ON activity_events(project_id, created_at DESC);
    """

    conn = psycopg.connect(settings.postgres_connection_uri, row_factory=dict_row)
    try:
        with conn.cursor() as cur:
            cur.execute(pg_schema_sql)
            import datetime
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            for skill in BUILTIN_SKILLS:
                cur.execute(
                    """
                    INSERT INTO skills (id, name, description, category, provider, version, icon, permissions, is_builtin, is_featured, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1, %s, %s)
                    ON CONFLICT(id) DO NOTHING;
                    """,
                    (
                        skill["id"],
                        skill["name"],
                        skill["description"],
                        skill["category"],
                        skill["provider"],
                        skill["version"],
                        skill["icon"],
                        json.dumps(skill["permissions"]),
                        skill["is_featured"],
                        now_iso,
                    ),
                )
        conn.commit()
    finally:
        conn.close()


@contextmanager
def get_db_connection() -> Generator[Any, None, None]:
    """
    Context manager providing a configured database connection.
    Automatically connects to PostgreSQL if DATABASE_URL is configured (Neon / Render),
    otherwise seamlessly connects to SQLite (data/omniai.db) for local development.
    """
    global _db_initialized
    if not _db_initialized:
        init_db()

    settings = get_settings()

    if settings.is_postgres:
        import psycopg
        from psycopg.rows import dict_row
        conn = psycopg.connect(settings.postgres_connection_uri, row_factory=dict_row)
        wrapper = PostgresConnectionWrapper(conn)
        try:
            yield wrapper
            wrapper.commit()
        except Exception:
            wrapper.rollback()
            raise
        finally:
            wrapper.close()
    else:
        db_path = get_db_path()
        conn = sqlite3.connect(str(db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
