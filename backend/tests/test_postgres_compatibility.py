"""
Unit tests for the PostgreSQL / Neon database compatibility layer and query wrapper.
"""

from unittest.mock import MagicMock
from app.db.database import PostgresCursorWrapper, PostgresConnectionWrapper


def test_postgres_cursor_query_translation_basic():
    mock_cursor = MagicMock()
    wrapper = PostgresCursorWrapper(mock_cursor)

    wrapper.execute("SELECT * FROM users WHERE id = ? AND email = ?;", ("u-1", "user@example.com"))

    mock_cursor.execute.assert_called_once_with(
        "SELECT * FROM users WHERE id = %s AND email = %s;",
        ("u-1", "user@example.com"),
    )


def test_postgres_cursor_query_translation_insert_or_ignore():
    mock_cursor = MagicMock()
    wrapper = PostgresCursorWrapper(mock_cursor)

    wrapper.execute(
        "INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?);",
        ("theme", "dark", "2026-10-31T00:00:00Z"),
    )

    mock_cursor.execute.assert_called_once_with(
        "INSERT INTO user_settings (key, value, updated_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
        ("theme", "dark", "2026-10-31T00:00:00Z"),
    )


def test_postgres_cursor_fetch_converts_to_dicts():
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {"id": "conv-1", "title": "AI Research"}
    mock_cursor.fetchall.return_value = [
        {"id": "msg-1", "content": "Hello"},
        {"id": "msg-2", "content": "World"},
    ]

    wrapper = PostgresCursorWrapper(mock_cursor)

    row = wrapper.fetchone()
    assert isinstance(row, dict)
    assert row["id"] == "conv-1"

    rows = wrapper.fetchall()
    assert len(rows) == 2
    assert all(isinstance(r, dict) for r in rows)


def test_postgres_connection_wrapper_executescript_skips_pragmas():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    wrapper = PostgresConnectionWrapper(mock_conn)

    script = """
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sample_table (id TEXT PRIMARY KEY);
    """

    wrapper.executescript(script)
    executed_call = mock_cursor.execute.call_args[0][0]
    assert "PRAGMA" not in executed_call
    assert "CREATE TABLE IF NOT EXISTS sample_table" in executed_call

