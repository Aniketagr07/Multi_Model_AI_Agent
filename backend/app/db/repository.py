import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
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
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a new conversation record."""
        cid = conv_id or f"conv-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO conversations (id, user_id, title, is_pinned, is_archived, pinned_at, created_at, updated_at)
                VALUES (?, ?, ?, 0, 0, NULL, ?, ?);
                """,
                (cid, user_id, title.strip() or "New Conversation", now, now),
            )

        return {
            "id": cid,
            "user_id": user_id,
            "title": title.strip() or "New Conversation",
            "is_pinned": False,
            "is_archived": False,
            "pinned_at": None,
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
                SELECT c.id, c.title, c.is_pinned, c.is_archived, c.pinned_at, c.created_at, c.updated_at,
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
            res = dict(row)
            res["is_pinned"] = bool(res.get("is_pinned", 0))
            res["is_archived"] = bool(res.get("is_archived", 0))
            return res

    @staticmethod
    def list_conversations(
        limit: int = 100,
        include_archived: bool = True,
        archived_only: bool = False,
        search_query: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve conversations ordered by pinned status (descending) and last activity (descending).
        Supports searching across conversation titles and message contents with parameterized SQL.
        """
        with get_db_connection() as conn:
            params: List[Any] = []
            where_clauses: List[str] = []

            if user_id:
                where_clauses.append("c.user_id = ?")
                params.append(user_id)
            else:
                where_clauses.append("(c.user_id IS NULL OR c.user_id = 'guest')")

            if archived_only:
                where_clauses.append("c.is_archived = 1")
            elif not include_archived:
                where_clauses.append("c.is_archived = 0")

            if search_query and search_query.strip():
                clean_term = f"%{search_query.strip()}%"
                where_clauses.append("(c.title LIKE ? OR m.content LIKE ?)")
                params.extend([clean_term, clean_term])

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            query = f"""
                SELECT c.id, c.title, c.is_pinned, c.is_archived, c.pinned_at, c.created_at, c.updated_at,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                {where_sql}
                GROUP BY c.id
                ORDER BY c.is_pinned DESC, c.updated_at DESC
                LIMIT ?;
            """
            params.append(limit)

            cursor = conn.execute(query, params)
            rows = []
            for r in cursor.fetchall():
                d = dict(r)
                d["is_pinned"] = bool(d.get("is_pinned", 0))
                d["is_archived"] = bool(d.get("is_archived", 0))
                rows.append(d)
            return rows

    @staticmethod
    def pin_conversation(conv_id: str, is_pinned: bool) -> Optional[Dict[str, Any]]:
        """Toggle or set pinned state of a conversation."""
        now = _utc_now_iso()
        pinned_at = now if is_pinned else None
        pinned_val = 1 if is_pinned else 0

        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                UPDATE conversations
                SET is_pinned = ?, pinned_at = ?
                WHERE id = ?;
                """,
                (pinned_val, pinned_at, conv_id),
            )
            if cursor.rowcount == 0:
                return None

        return ConversationRepository.get_conversation(conv_id)

    @staticmethod
    def archive_conversation(conv_id: str, is_archived: bool) -> Optional[Dict[str, Any]]:
        """Toggle or set archived state of a conversation."""
        archived_val = 1 if is_archived else 0
        now = _utc_now_iso()

        with get_db_connection() as conn:
            # When archiving, we also unpin to keep pinned list clean
            if is_archived:
                cursor = conn.execute(
                    """
                    UPDATE conversations
                    SET is_archived = ?, is_pinned = 0, pinned_at = NULL, updated_at = ?
                    WHERE id = ?;
                    """,
                    (archived_val, now, conv_id),
                )
            else:
                cursor = conn.execute(
                    """
                    UPDATE conversations
                    SET is_archived = ?, updated_at = ?
                    WHERE id = ?;
                    """,
                    (archived_val, now, conv_id),
                )
            if cursor.rowcount == 0:
                return None

        return ConversationRepository.get_conversation(conv_id)

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
    def delete_conversation(conv_id: str, user_id: Optional[str] = None) -> bool:
        """Delete conversation by ID (foreign keys cascade delete messages and documents)."""
        with get_db_connection() as conn:
            if user_id:
                cursor = conn.execute(
                    "DELETE FROM conversations WHERE id = ? AND user_id = ?;",
                    (conv_id, user_id),
                )
            else:
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
    # User Settings DAO Operations
    # -------------------------------------------------------------------------

    @staticmethod
    def get_all_settings() -> Dict[str, Any]:
        """Fetch all user settings from SQLite as a key-value dictionary."""
        with get_db_connection() as conn:
            cursor = conn.execute("SELECT key, value FROM user_settings;")
            results = {}
            for row in cursor.fetchall():
                key = row["key"]
                raw_val = row["value"]
                try:
                    results[key] = json.loads(raw_val)
                except Exception:
                    results[key] = raw_val
            return results

    @staticmethod
    def set_setting(key: str, value: Any) -> None:
        """Upsert a single setting into SQLite."""
        val_str = json.dumps(value) if not isinstance(value, str) else value
        now = _utc_now_iso()
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO user_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
                """,
                (key, val_str, now),
            )

    @staticmethod
    def set_multiple_settings(settings_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Upsert multiple settings in a single transaction and return the updated dictionary."""
        now = _utc_now_iso()
        with get_db_connection() as conn:
            for key, value in settings_dict.items():
                val_str = json.dumps(value) if not isinstance(value, str) else value
                conn.execute(
                    """
                    INSERT INTO user_settings (key, value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
                    """,
                    (key, val_str, now),
                )
        return ConversationRepository.get_all_settings()

    # -------------------------------------------------------------------------
    # Asynchronous Non-Blocking Wrappers (via asyncio.to_thread)
    # -------------------------------------------------------------------------

    @classmethod
    async def a_create_conversation(cls, conv_id: Optional[str] = None, title: str = "New Conversation", user_id: Optional[str] = None) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.create_conversation, conv_id, title, user_id)

    @classmethod
    async def a_get_conversation(cls, conv_id: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.get_conversation, conv_id)

    @classmethod
    async def a_list_conversations(
        cls,
        limit: int = 100,
        include_archived: bool = True,
        archived_only: bool = False,
        search_query: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(
            cls.list_conversations,
            limit=limit,
            include_archived=include_archived,
            archived_only=archived_only,
            search_query=search_query,
            user_id=user_id,
        )

    @classmethod
    async def a_pin_conversation(cls, conv_id: str, is_pinned: bool) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.pin_conversation, conv_id, is_pinned)

    @classmethod
    async def a_archive_conversation(cls, conv_id: str, is_archived: bool) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.archive_conversation, conv_id, is_archived)

    @classmethod
    async def a_update_conversation_title(cls, conv_id: str, title: str) -> Optional[Dict[str, Any]]:
        return await asyncio.to_thread(cls.update_conversation_title, conv_id, title)

    @classmethod
    async def a_delete_conversation(cls, conv_id: str, user_id: Optional[str] = None) -> bool:
        return await asyncio.to_thread(cls.delete_conversation, conv_id, user_id)

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

    @classmethod
    async def a_get_all_settings(cls) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.get_all_settings)

    @classmethod
    async def a_set_multiple_settings(cls, settings_dict: Dict[str, Any]) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.set_multiple_settings, settings_dict)

    # ---------------------------------------------------------
    # Model Usage Tracking (Sliding 5-Hour & Weekly Ceilings)
    # ---------------------------------------------------------

    @classmethod
    def record_usage(cls, model_id: str, provider: str, tokens: int = 0) -> None:
        """Record model request event in SQLite for sliding usage analytics."""
        usage_id = f"usg-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        clean_provider = (provider or "gemini").lower()
        if "gemini" in clean_provider or "google" in clean_provider:
            clean_provider = "google"
        elif "groq" in clean_provider:
            clean_provider = "groq"
        elif "openai" in clean_provider or "gpt" in clean_provider:
            clean_provider = "openai"
        elif "anthropic" in clean_provider or "claude" in clean_provider:
            clean_provider = "anthropic"

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO model_usage (id, model_id, provider, tokens, created_at) VALUES (?, ?, ?, ?, ?)",
                (usage_id, model_id, clean_provider, max(0, tokens), now),
            )
            conn.commit()

    @classmethod
    async def a_record_usage(cls, model_id: str, provider: str, tokens: int = 0) -> None:
        """Asynchronously record model request event in SQLite."""
        await asyncio.to_thread(cls.record_usage, model_id, provider, tokens)

    @classmethod
    def get_usage_analytics(cls) -> Dict[str, Any]:
        """Compute rolling 5-hour and 7-day usage ceilings per provider."""
        now = datetime.now(timezone.utc)
        five_hours_ago = (now - timedelta(hours=5)).isoformat()
        seven_days_ago = (now - timedelta(days=7)).isoformat()

        # Configured OmniAI sliding ceilings (can be tuned per tier)
        FIVE_HOUR_LIMIT = 50
        WEEKLY_LIMIT = 300

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 5-hour request count per provider
            cursor.execute(
                """
                SELECT provider, COUNT(*) as req_count, COALESCE(SUM(tokens), 0) as token_sum
                FROM model_usage
                WHERE created_at >= ?
                GROUP BY provider
                """,
                (five_hours_ago,)
            )
            five_hr_data = {row["provider"]: dict(row) for row in cursor.fetchall()}

            # 7-day weekly request count per provider
            cursor.execute(
                """
                SELECT provider, COUNT(*) as req_count, COALESCE(SUM(tokens), 0) as token_sum
                FROM model_usage
                WHERE created_at >= ?
                GROUP BY provider
                """,
                (seven_days_ago,)
            )
            weekly_data = {row["provider"]: dict(row) for row in cursor.fetchall()}

            # Per-model breakdown
            cursor.execute(
                """
                SELECT provider, model_id, COUNT(*) as model_count, COALESCE(SUM(tokens), 0) as model_tokens
                FROM model_usage
                WHERE created_at >= ?
                GROUP BY provider, model_id
                ORDER BY model_count DESC
                """,
                (seven_days_ago,)
            )
            model_breakdown = {}
            for row in cursor.fetchall():
                p = row["provider"]
                if p not in model_breakdown:
                    model_breakdown[p] = []
                model_breakdown[p].append({
                    "model_id": row["model_id"],
                    "requests": row["model_count"],
                    "tokens": row["model_tokens"],
                })

        # Calculate reset countdowns
        reset_5h_dt = (now + timedelta(hours=5)).replace(minute=0, second=0, microsecond=0)
        reset_5h_sec = max(60, int((reset_5h_dt - now).total_seconds()))
        hours_5h = reset_5h_sec // 3600
        mins_5h = (reset_5h_sec % 3600) // 60
        reset_5h_countdown = f"Resets in {hours_5h}h {mins_5h}m"

        days_until_sunday = (6 - now.weekday()) % 7 or 7
        reset_week_dt = (now + timedelta(days=days_until_sunday)).replace(hour=0, minute=0, second=0, microsecond=0)
        reset_week_sec = max(3600, int((reset_week_dt - now).total_seconds()))
        days_wk = reset_week_sec // 86400
        reset_week_countdown = f"Resets in {days_wk}d"

        providers = [
            {"id": "google", "name": "Google Gemini"},
            {"id": "groq", "name": "Groq"},
            {"id": "openai", "name": "OpenAI"},
            {"id": "anthropic", "name": "Claude"},
        ]

        provider_summaries = []
        for p in providers:
            p_id = p["id"]
            fh = five_hr_data.get(p_id, {"req_count": 0, "token_sum": 0})
            wk = weekly_data.get(p_id, {"req_count": 0, "token_sum": 0})

            fh_used = fh["req_count"]
            wk_used = wk["req_count"]

            fh_left_pct = max(0, 100 - int((fh_used / FIVE_HOUR_LIMIT) * 100))
            wk_left_pct = max(0, 100 - int((wk_used / WEEKLY_LIMIT) * 100))

            provider_summaries.append({
                "provider": p_id,
                "display_name": p["name"],
                "five_hour": {
                    "used": fh_used,
                    "limit": FIVE_HOUR_LIMIT,
                    "percent_left": fh_left_pct,
                    "reset_countdown": reset_5h_countdown,
                    "reset_in_seconds": reset_5h_sec,
                },
                "weekly": {
                    "used": wk_used,
                    "limit": WEEKLY_LIMIT,
                    "percent_left": wk_left_pct,
                    "reset_countdown": reset_week_countdown,
                    "reset_in_seconds": reset_week_sec,
                },
                "total_tokens_used": wk["token_sum"],
                "models": model_breakdown.get(p_id, []),
            })

        return {
            "tracking_type": "sliding_window",
            "disclaimer": "Local usage tracking based on configured OmniAI sliding windows (5h/7d), not provider-enforced hard quotas.",
            "providers": provider_summaries,
            "timestamp": now.isoformat(),
        }

    @classmethod
    async def a_get_usage_analytics(cls) -> Dict[str, Any]:
        """Asynchronously compute rolling usage ceilings."""
        return await asyncio.to_thread(cls.get_usage_analytics)

