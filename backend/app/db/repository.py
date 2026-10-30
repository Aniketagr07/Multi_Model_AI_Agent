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
    Data Access Object (DAO) providing CRUD operations for conversations, messages,
    and attached documents in SQLite using parameterized SQL queries.
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
        """Retrieve all conversations ordered by updated_at descending."""
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
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def update_conversation_title(conv_id: str, title: str) -> Optional[Dict[str, Any]]:
        """Update conversation title."""
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
        """Delete conversation by ID (foreign keys cascade delete messages and documents)."""
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
        document_id: Optional[str] = None,
        document_name: Optional[str] = None,
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
                    routing_explanation, effort, document_id, document_name, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
                    document_id,
                    document_name,
                    now,
                ),
            )
            # Update parent conversation's updated_at timestamp
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
            "document_id": document_id,
            "document_name": document_name,
            "created_at": now,
        }

    @staticmethod
    def get_messages(conv_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Retrieve chronological messages for a given conversation."""
        query = """
            SELECT id, conversation_id, role, content, model_id,
                   provider, latency_ms, routed, routing_category,
                   routing_explanation, effort, document_id, document_name, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        """
        params: List[Any] = [conv_id]
        if limit is not None:
            query += " LIMIT ?;"
            params.append(limit)
        else:
            query += ";"

        with get_db_connection() as conn:
            cursor = conn.execute(query, tuple(params))
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d["routed"] = bool(d["routed"])
                results.append(d)
            return results

    @staticmethod
    def get_recent_context(conv_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """Retrieve the latest `limit` messages formatted as role/content dicts."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                SELECT role, content FROM (
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
    # Document Records Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def add_document(
        doc_id: str,
        filename: str,
        file_type: str,
        file_size: int,
        storage_path: str,
        extracted_text: str,
        char_count: int,
        chunk_count: int,
        conv_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a document record associated with a conversation."""
        now = _utc_now_iso()
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    id, conversation_id, filename, file_type, file_size,
                    storage_path, extracted_text, char_count, chunk_count, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    doc_id,
                    conv_id,
                    filename,
                    file_type,
                    file_size,
                    storage_path,
                    extracted_text,
                    char_count,
                    chunk_count,
                    now,
                ),
            )
            if conv_id:
                conn.execute(
                    "UPDATE conversations SET updated_at = ? WHERE id = ?;",
                    (now, conv_id),
                )

        return {
            "id": doc_id,
            "conversation_id": conv_id,
            "filename": filename,
            "file_type": file_type,
            "file_size": file_size,
            "char_count": char_count,
            "chunk_count": chunk_count,
            "created_at": now,
        }

    @staticmethod
    def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve document record by ID."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, conversation_id, filename, file_type, file_size,
                       storage_path, extracted_text, char_count, chunk_count, created_at
                FROM documents
                WHERE id = ?;
                """,
                (doc_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return dict(row)

    @staticmethod
    def list_documents(conv_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """List documents, optionally filtered by conversation_id."""
        with get_db_connection() as conn:
            if conv_id:
                cursor = conn.execute(
                    """
                    SELECT id, conversation_id, filename, file_type, file_size,
                           char_count, chunk_count, created_at
                    FROM documents
                    WHERE conversation_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?;
                    """,
                    (conv_id, limit),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT id, conversation_id, filename, file_type, file_size,
                           char_count, chunk_count, created_at
                    FROM documents
                    ORDER BY created_at DESC
                    LIMIT ?;
                    """,
                    (limit,),
                )
            return [dict(r) for r in cursor.fetchall()]

    @staticmethod
    def update_document_conversation(doc_id: str, conv_id: str) -> bool:
        """Associate a document with a conversation."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                "UPDATE documents SET conversation_id = ? WHERE id = ?;",
                (conv_id, doc_id),
            )
            return cursor.rowcount > 0

    @staticmethod
    def delete_document(doc_id: str) -> Optional[str]:
        """Delete document record from database and return its storage_path for filesystem cleanup."""
        with get_db_connection() as conn:
            cursor = conn.execute(
                "SELECT storage_path FROM documents WHERE id = ?;",
                (doc_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            storage_path = row["storage_path"]

            conn.execute("DELETE FROM documents WHERE id = ?;", (doc_id,))
            return storage_path

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

    @classmethod
    async def a_add_document(cls, **kwargs) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.add_document, **kwargs)

    @classmethod
    async def a_get_document(cls, doc_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_document, doc_id)

    @classmethod
    async def a_list_documents(cls, conv_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(cls.list_documents, conv_id, limit)

    @classmethod
    async def a_update_document_conversation(cls, doc_id: str, conv_id: str) -> bool:
        return await asyncio.to_thread(cls.update_document_conversation, doc_id, conv_id)

    @classmethod
    async def a_delete_document(cls, doc_id: str) -> Optional[str]:
        return await asyncio.to_thread(cls.delete_document, doc_id)
