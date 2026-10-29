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
        # Relative to project directory or backend folder
        base_dir = Path(__file__).resolve().parent.parent.parent
        db_path = base_dir / configured_path
    else:
        db_path = configured_path

    # Ensure parent directory exists (e.g. backend/data/)
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
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);
    """

    db_path = get_db_path()

    conn = sqlite3.connect(str(db_path), timeout=10.0)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.executescript(schema_sql)
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
    conn = sqlite3.connect(
        str(db_path),
        timeout=10.0,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row

    try:
        # Enable foreign key constraints and WAL mode
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("SQLite database error during transaction: %s", str(e))
        raise
    finally:
        conn.close()
