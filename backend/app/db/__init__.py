"""Database Package.

Provides SQLite initialization, thread-safe connection context, and conversation repositories.
"""

from app.db.database import get_db_connection, init_db, get_db_path
from app.db.repository import ConversationRepository

__all__ = [
    "get_db_connection",
    "init_db",
    "get_db_path",
    "ConversationRepository",
]
