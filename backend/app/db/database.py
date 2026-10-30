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
    schema_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id, skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_executions_user ON skill_executions(user_id, executed_at DESC);
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
                INSERT OR IGNORE INTO skills (id, name, description, category, provider, version, icon, permissions, is_builtin, is_featured, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
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


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager providing a configured SQLite database connection.
    Enforces foreign keys, WAL journaling for concurrent access, and dictionary row factory.
    Automatically initializes tables if not yet executed in this process.
    """
    global _db_initialized
    if not _db_initialized:
        init_db()

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
