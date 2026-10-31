import asyncio
import json
import logging
from typing import Dict, Set, Optional, List, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class CollaborationConnectionManager:
    """Manages active WebSockets and user presence across shared conversations."""

    def __init__(self):
        # Maps conversation_id -> Set of active WebSockets
        self._rooms: Dict[str, Set[WebSocket]] = {}
        # Maps WebSocket -> user info dict
        self._conn_meta: Dict[WebSocket, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, conversation_id: str, websocket: WebSocket, user_info: Dict[str, Any]):
        """Register a new connection in a conversation room and notify peers."""
        await websocket.accept()
        async with self._lock:
            if conversation_id not in self._rooms:
                self._rooms[conversation_id] = set()
            self._rooms[conversation_id].add(websocket)
            self._conn_meta[websocket] = {
                "conversation_id": conversation_id,
                "user_id": user_info.get("id"),
                "email": user_info.get("email"),
                "name": user_info.get("display_name") or user_info.get("username") or "Participant",
                "avatar_url": user_info.get("avatar_url"),
            }

        # Broadcast updated presence to the room
        await self.broadcast_presence(conversation_id)

    async def disconnect(self, conversation_id: str, websocket: WebSocket):
        """Remove a connection and broadcast updated presence."""
        async with self._lock:
            if conversation_id in self._rooms:
                self._rooms[conversation_id].discard(websocket)
                if not self._rooms[conversation_id]:
                    del self._rooms[conversation_id]
            self._conn_meta.pop(websocket, None)

        await self.broadcast_presence(conversation_id)

    def get_presence(self, conversation_id: str) -> List[Dict[str, Any]]:
        """Return list of distinct users currently active in the conversation."""
        users_map: Dict[str, Dict[str, Any]] = {}
        sockets = self._rooms.get(conversation_id, set())
        for ws in sockets:
            meta = self._conn_meta.get(ws)
            if meta:
                uid = meta.get("user_id") or "anonymous"
                if uid not in users_map:
                    users_map[uid] = {
                        "user_id": uid,
                        "name": meta.get("name"),
                        "avatar_url": meta.get("avatar_url"),
                    }
        return list(users_map.values())

    async def broadcast_presence(self, conversation_id: str):
        """Broadcast latest presence list to all participants."""
        presence = self.get_presence(conversation_id)
        payload = {
            "type": "presence_update",
            "conversation_id": conversation_id,
            "presence": presence,
        }
        await self.broadcast_to_conversation(conversation_id, payload)

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        message: Dict[str, Any],
        exclude: Optional[WebSocket] = None,
    ):
        """Send a JSON event to all participants in a conversation."""
        sockets = list(self._rooms.get(conversation_id, set()))
        if not sockets:
            return

        text_data = json.dumps(message)
        dead_sockets: List[WebSocket] = []

        for ws in sockets:
            if ws is exclude:
                continue
            try:
                await ws.send_text(text_data)
            except Exception as e:
                logger.debug("Failed sending to websocket in conversation %s: %s", conversation_id, e)
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                for d_ws in dead_sockets:
                    if conversation_id in self._rooms:
                        self._rooms[conversation_id].discard(d_ws)
                    self._conn_meta.pop(d_ws, None)


# Global singleton manager instance
ws_manager = CollaborationConnectionManager()


def get_ws_manager() -> CollaborationConnectionManager:
    return ws_manager

