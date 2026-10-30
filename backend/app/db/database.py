import os
import sqlite3
import logging
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_db_initialized: bool = False


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
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        pinned_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
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

        # Create status index after columns exist
        conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(is_pinned, is_archived, updated_at DESC);")

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
