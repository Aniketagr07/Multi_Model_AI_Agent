import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from app.db.database import get_db_connection


def _utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class ConversationRepository:
    """
    Data Access Object (DAO) providing CRUD operations for conversations and messages
    in SQLite using parameterized SQL queries.
    """

    # -------------------------------------------------------------------------
    # Synchronous Core Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def create_conversation(
        conv_id: Optional[str] = None,
        title: str = "New Conversation",
    ) -> Dict[str, Any]:
        """Insert a new conversation record."""
        cid = conv_id or f"conv-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO conversations (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?);
                """,
                (cid, title.strip() or "New Conversation", now, now),
            )

        return {
            "id": cid,
            "title": title.strip() or "New Conversation",
            "created_at": now,
            "updated_at": now,
            "message_count": 0,
        }

    @staticmethod
    def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve conversation by ID along with its message count."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.id = ?
                GROUP BY c.id;
                """,
                (conv_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return dict(row)

    @staticmethod
    def list_conversations(limit: int = 50) -> List[Dict[str, Any]]:
        """List all conversations ordered by last updated descending."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT ?;
                """,
                (limit,),
            )
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def update_conversation_title(conv_id: str, title: str) -> Optional[Dict[str, Any]]:
        """Update conversation title and refresh updated_at timestamp."""
        now = _utc_now_iso()
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE conversations
                SET title = ?, updated_at = ?
                WHERE id = ?;
                """,
                (title.strip(), now, conv_id),
            )
            if cursor.rowcount == 0:
                return None

        return ConversationRepository.get_conversation(conv_id)

    @staticmethod
    def touch_conversation(conv_id: str) -> None:
        """Bump updated_at timestamp on a conversation."""
        now = _utc_now_iso()
        with get_db_connection() as conn:
            conn.execute(
                """
                UPDATE conversations
                SET updated_at = ?
                WHERE id = ?;
                """,
                (now, conv_id),
            )

    @staticmethod
    def delete_conversation(conv_id: str) -> bool:
        """Delete conversation by ID (foreign keys cascade delete messages)."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM conversations WHERE id = ?;",
                (conv_id,),
            )
            return cursor.rowcount > 0

    @staticmethod
    def add_message(
        conv_id: str,
        role: str,
        content: str,
        msg_id: Optional[str] = None,
        model_id: Optional[str] = None,
        provider: Optional[str] = None,
        latency_ms: Optional[int] = None,
        routed: bool = False,
        routing_category: Optional[str] = None,
        routing_explanation: Optional[str] = None,
        effort: Optional[str] = "medium",
    ) -> Dict[str, Any]:
        """Insert a message record and update the parent conversation's updated_at."""
        mid = msg_id or f"msg-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()
        eff = effort or "medium"

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO messages (
                    id, conversation_id, role, content, model_id,
                    provider, latency_ms, routed, routing_category,
                    routing_explanation, effort, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    mid,
                    conv_id,
                    role,
                    content.strip(),
                    model_id,
                    provider,
                    latency_ms,
                    1 if routed else 0,
                    routing_category,
                    routing_explanation,
                    eff,
                    now,
                ),
            )
            # Update parent conversation timestamp
            conn.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?;",
                (now, conv_id),
            )

        return {
            "id": mid,
            "conversation_id": conv_id,
            "role": role,
            "content": content.strip(),
            "model_id": model_id,
            "provider": provider,
            "latency_ms": latency_ms,
            "routed": routed,
            "routing_category": routing_category,
            "routing_explanation": routing_explanation,
            "effort": eff,
            "created_at": now,
        }

    @staticmethod
    def get_messages(conv_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve all messages for a conversation ordered chronologically."""
        query = """
            SELECT id, conversation_id, role, content, model_id, provider,
                   latency_ms, routed, routing_category, routing_explanation, effort, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        """
        params: list = [conv_id]
        if limit:
            query += " LIMIT ?"
            params.append(limit)

        with get_db_connection() as conn:
            cursor = conn.execute(query, tuple(params))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                d = dict(r)
                d["routed"] = bool(d["routed"])
                result.append(d)
            return result

    @staticmethod
    def get_recent_context(conv_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        Fetch the most recent N messages formatted as [{'role': role, 'content': content}]
        for LLM sliding-window context, ordered chronologically.
        """
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                SELECT role, content
                FROM (
                    SELECT role, content, created_at
                    FROM messages
                    WHERE conversation_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                ) sub
                ORDER BY created_at ASC;
                """,
                (conv_id, limit),
            )
            return [{"role": r["role"], "content": r["content"]} for r in cursor.fetchall()]

    # -------------------------------------------------------------------------
    # Asynchronous Non-Blocking Wrappers (via asyncio.to_thread)
    # -------------------------------------------------------------------------

    @classmethod
    async def a_create_conversation(cls, conv_id: Optional[str] = None, title: str = "New Conversation") -> Dict[str, Any]:
        return await asyncio.to_thread(cls.create_conversation, conv_id, title)

    @classmethod
    async def a_get_conversation(cls, conv_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_conversation, conv_id)

    @classmethod
    async def a_list_conversations(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(cls.list_conversations, limit)

    @classmethod
    async def a_update_conversation_title(cls, conv_id: str, title: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.update_conversation_title, conv_id, title)

    @classmethod
    async def a_delete_conversation(cls, conv_id: str) -> bool:
        return await asyncio.to_thread(cls.delete_conversation, conv_id)

    @classmethod
    async def a_add_message(cls, **kwargs) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.add_message, **kwargs)

    @classmethod
    async def a_get_messages(cls, conv_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_messages, conv_id, limit)

    @classmethod
    async def a_get_recent_context(cls, conv_id: str, limit: int = 10) -> List[Dict[str, str]]:
        return await asyncio.to_thread(cls.get_recent_context, conv_id, limit)

