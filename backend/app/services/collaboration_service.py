import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from fastapi import HTTPException, status

from app.db.database import get_db_connection
from app.db.repository import ConversationRepository
from app.schemas.collaboration import (
    ShareDetailsResponse,
    ConversationMemberResponse,
    ConversationInvitationResponse,
    JoinConversationResponse,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_user_id(user: Any) -> Optional[str]:
    if not user:
        return None
    if isinstance(user, dict):
        return user.get("id")
    return getattr(user, "id", None)


class CollaborationService:
    """Service handling conversation sharing, invitations, access control, and membership."""

    @staticmethod
    def get_conversation_access(conv_id: str, user: Optional[dict]) -> Dict[str, Any]:
        """
        Determine user's role and permission on a conversation.
        Returns: {
            "conversation": conv_dict,
            "role": "owner" | "editor" | "viewer" | "none",
            "can_read": bool,
            "can_write": bool,
            "can_manage": bool
        }
        """
        conv = ConversationRepository.get_conversation(conv_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation '{conv_id}' not found.",
            )

        # 1. Guest user check
        if not user:
            # Standalone guest conversation
            if not conv.get("user_id") or conv.get("user_id") == "guest":
                return {
                    "conversation": conv,
                    "role": "owner",
                    "can_read": True,
                    "can_write": True,
                    "can_manage": True,
                }
            # Publicly shared conversation accessible to guest
            if conv.get("sharing_enabled"):
                perm = conv.get("share_permission") or "editor"
                return {
                    "conversation": conv,
                    "role": perm,
                    "can_read": True,
                    "can_write": (perm == "editor"),
                    "can_manage": False,
                }
            return {
                "conversation": conv,
                "role": "none",
                "can_read": False,
                "can_write": False,
                "can_manage": False,
            }

        user_id = _extract_user_id(user)

        # 2. Check direct ownership
        if conv.get("user_id") == user_id:
            return {
                "conversation": conv,
                "role": "owner",
                "can_read": True,
                "can_write": True,
                "can_manage": True,
            }

        # 3. Check explicit conversation membership
        with get_db_connection() as conn:
            cur = conn.execute(
                "SELECT role FROM conversation_members WHERE conversation_id = ? AND user_id = ?;",
                (conv_id, user_id),
            )
            row = cur.fetchone()
            if row:
                m_role = row["role"]
                return {
                    "conversation": conv,
                    "role": m_role,
                    "can_read": True,
                    "can_write": (m_role in ("owner", "editor")),
                    "can_manage": (m_role == "owner"),
                }

            # 4. Check project membership if conversation belongs to a project
            proj_id = conv.get("project_id")
            if proj_id:
                p_cur = conn.execute(
                    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?;",
                    (proj_id, user_id),
                )
                p_row = p_cur.fetchone()
                if p_row:
                    p_role = p_row["role"]
                    if p_role in ("owner", "admin"):
                        return {
                            "conversation": conv,
                            "role": "editor",
                            "can_read": True,
                            "can_write": True,
                            "can_manage": True,
                        }
                    elif p_role == "member":
                        return {
                            "conversation": conv,
                            "role": "editor",
                            "can_read": True,
                            "can_write": True,
                            "can_manage": False,
                        }
                    elif p_role == "viewer":
                        return {
                            "conversation": conv,
                            "role": "viewer",
                            "can_read": True,
                            "can_write": False,
                            "can_manage": False,
                        }

        # 5. Check if link sharing is enabled
        if conv.get("sharing_enabled"):
            perm = conv.get("share_permission") or "editor"
            return {
                "conversation": conv,
                "role": perm,
                "can_read": True,
                "can_write": (perm == "editor"),
                "can_manage": False,
            }

        return {
            "conversation": conv,
            "role": "none",
            "can_read": False,
            "can_write": False,
            "can_manage": False,
        }

    @classmethod
    def get_share_details(cls, conv_id: str, user: Optional[dict]) -> ShareDetailsResponse:
        """Fetch sharing configuration, members, and pending invitations."""
        access = cls.get_conversation_access(conv_id, user)
        if not access["can_read"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view sharing details for this conversation.",
            )

        conv = access["conversation"]
        share_token = conv.get("share_token")
        if not share_token:
            # Auto-generate if missing
            share_token = secrets.token_urlsafe(16)
            with get_db_connection() as conn:
                conn.execute(
                    "UPDATE conversations SET share_token = ? WHERE id = ?;",
                    (share_token, conv_id),
                )
            conv["share_token"] = share_token

        # Fetch Owner info
        owner_info = None
        if conv.get("user_id"):
            with get_db_connection() as conn:
                u_cur = conn.execute(
                    "SELECT id, email, username, avatar_url FROM users WHERE id = ?;",
                    (conv["user_id"],),
                )
                u_row = u_cur.fetchone()
                if u_row:
                    owner_info = {
                        "id": u_row["id"],
                        "email": u_row["email"],
                        "display_name": u_row["username"],
                        "avatar_url": u_row["avatar_url"],
                    }

        # Fetch active members
        members: List[ConversationMemberResponse] = []
        # If there's an owner, include owner as first member
        if owner_info:
            members.append(
                ConversationMemberResponse(
                    id=f"owner-{conv['user_id']}",
                    user_id=owner_info["id"],
                    email=owner_info.get("email"),
                    display_name=owner_info.get("display_name"),
                    avatar_url=owner_info.get("avatar_url"),
                    role="owner",
                    joined_at=conv.get("created_at") or _utc_now_iso(),
                )
            )

        with get_db_connection() as conn:
            m_cur = conn.execute(
                """
                SELECT cm.id, cm.user_id, cm.role, cm.joined_at,
                       u.email, u.username, u.avatar_url
                FROM conversation_members cm
                LEFT JOIN users u ON cm.user_id = u.id
                WHERE cm.conversation_id = ?
                ORDER BY cm.joined_at ASC;
                """,
                (conv_id,),
            )
            for row in m_cur.fetchall():
                # Avoid duplicate owner if in members table
                if row["user_id"] != conv.get("user_id"):
                    members.append(
                        ConversationMemberResponse(
                            id=row["id"],
                            user_id=row["user_id"],
                            email=row["email"],
                            display_name=row["username"],
                            avatar_url=row["avatar_url"],
                            role=row["role"],
                            joined_at=row["joined_at"],
                        )
                    )

            # Fetch pending invitations
            inv_cur = conn.execute(
                """
                SELECT id, conversation_id, inviter_user_id, email, token, role, status, expires_at, created_at
                FROM conversation_invitations
                WHERE conversation_id = ? AND status = 'pending' AND expires_at > ?
                ORDER BY created_at DESC;
                """,
                (conv_id, _utc_now_iso()),
            )
            invitations = [
                ConversationInvitationResponse(
                    id=r["id"],
                    conversation_id=r["conversation_id"],
                    inviter_user_id=r["inviter_user_id"],
                    email=r["email"],
                    token=r["token"],
                    role=r["role"],
                    status=r["status"],
                    expires_at=r["expires_at"],
                    created_at=r["created_at"],
                )
                for r in inv_cur.fetchall()
            ]

        return ShareDetailsResponse(
            conversation_id=conv["id"],
            title=conv.get("title") or "Conversation",
            sharing_enabled=bool(conv.get("sharing_enabled", 0)),
            share_permission=conv.get("share_permission") or "editor",
            share_token=share_token,
            share_url=f"/join/c/{share_token}",
            current_user_role=access["role"],
            owner=owner_info,
            members=members,
            pending_invitations=invitations,
        )

    @classmethod
    def update_share_settings(
        cls,
        conv_id: str,
        user: dict,
        sharing_enabled: bool,
        share_permission: str,
    ) -> ShareDetailsResponse:
        """Update public sharing flag and permissions (Owner only)."""
        access = cls.get_conversation_access(conv_id, user)
        if not access["can_manage"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation owners or admins can modify share settings.",
            )

        if share_permission not in ("editor", "viewer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Share permission must be either 'editor' or 'viewer'.",
            )

        conv = access["conversation"]
        share_token = conv.get("share_token") or secrets.token_urlsafe(16)
        enabled_val = 1 if sharing_enabled else 0

        with get_db_connection() as conn:
            conn.execute(
                """
                UPDATE conversations
                SET sharing_enabled = ?, share_permission = ?, share_token = ?, updated_at = ?
                WHERE id = ?;
                """,
                (enabled_val, share_permission, share_token, _utc_now_iso(), conv_id),
            )

        return cls.get_share_details(conv_id, user)

    @classmethod
    def create_invitation(
        cls,
        conv_id: str,
        user: dict,
        email: Optional[str],
        role: str,
        expiry_days: int = 7,
    ) -> ConversationInvitationResponse:
        """Invite a collaborator by email or create an invitation link (Owner only)."""
        access = cls.get_conversation_access(conv_id, user)
        if not access["can_manage"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation owners can invite collaborators.",
            )

        if role not in ("editor", "viewer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'editor' or 'viewer'.",
            )

        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=expiry_days)).isoformat()
        token = uuid.uuid4().hex
        inv_id = f"cinv-{uuid.uuid4().hex[:12]}"
        clean_email = email.strip().lower() if email else None

        user_id = _extract_user_id(user)
        with get_db_connection() as conn:
            # Check if email is already a member
            if clean_email:
                u_cur = conn.execute("SELECT id FROM users WHERE LOWER(email) = ?;", (clean_email,))
                u_row = u_cur.fetchone()
                if u_row:
                    m_cur = conn.execute(
                        "SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?;",
                        (conv_id, u_row["id"]),
                    )
                    if m_cur.fetchone():
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="User is already a participant in this conversation.",
                        )

            conn.execute(
                """
                INSERT INTO conversation_invitations (
                    id, conversation_id, inviter_user_id, email, token, role, status, expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?);
                """,
                (inv_id, conv_id, user_id, clean_email, token, role, expires_at, now.isoformat()),
            )

        return ConversationInvitationResponse(
            id=inv_id,
            conversation_id=conv_id,
            inviter_user_id=user_id or "system",
            email=clean_email,
            token=token,
            role=role,
            status="pending",
            expires_at=expires_at,
            created_at=now.isoformat(),
            invite_url=f"/join/c/{token}",
        )

    @classmethod
    def accept_invitation(cls, token: str, user: dict) -> JoinConversationResponse:
        """Accept an invitation to join a conversation."""
        now = _utc_now_iso()
        user_id = _extract_user_id(user)
        with get_db_connection() as conn:
            # First check if this is an invitation token
            cur = conn.execute(
                """
                SELECT id, conversation_id, email, role, status, expires_at
                FROM conversation_invitations
                WHERE token = ?;
                """,
                (token,),
            )
            inv = cur.fetchone()
            if inv:
                if inv["status"] != "pending":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"This invitation has already been {inv['status']}.",
                    )
                if inv["expires_at"] < now:
                    conn.execute("UPDATE conversation_invitations SET status = 'expired' WHERE id = ?;", (inv["id"],))
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This invitation has expired.",
                    )

                conv_id = inv["conversation_id"]
                role = inv["role"]

                # Add or update member
                member_id = f"cmem-{uuid.uuid4().hex[:12]}"
                conn.execute(
                    """
                    INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(conversation_id, user_id) DO UPDATE SET role = excluded.role;
                    """,
                    (member_id, conv_id, user_id, role, now),
                )
                conn.execute("UPDATE conversation_invitations SET status = 'accepted' WHERE id = ?;", (inv["id"],))

                # Fetch title
                c_cur = conn.execute("SELECT title FROM conversations WHERE id = ?;", (conv_id,))
                c_row = c_cur.fetchone()
                title = c_row["title"] if c_row else "Conversation"

                return JoinConversationResponse(
                    conversation_id=conv_id,
                    role=role,
                    title=title,
                    message="You have joined the conversation successfully.",
                )

            # If not an invitation token, check if it's a conversation public share_token
            c_cur = conn.execute(
                """
                SELECT id, title, sharing_enabled, share_permission
                FROM conversations
                WHERE share_token = ?;
                """,
                (token,),
            )
            c_row = c_cur.fetchone()
            if c_row and c_row["sharing_enabled"]:
                conv_id = c_row["id"]
                role = c_row["share_permission"] or "editor"

                member_id = f"cmem-{uuid.uuid4().hex[:12]}"
                conn.execute(
                    """
                    INSERT INTO conversation_members (id, conversation_id, user_id, role, joined_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(conversation_id, user_id) DO NOTHING;
                    """,
                    (member_id, conv_id, user_id, role, now),
                )
                return JoinConversationResponse(
                    conversation_id=conv_id,
                    role=role,
                    title=c_row["title"] or "Shared Conversation",
                    message="Joined shared conversation successfully.",
                )

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or expired invitation or share link.",
            )

    @classmethod
    def remove_member(cls, conv_id: str, current_user: dict, target_user_id: str) -> dict:
        """Remove a participant from the conversation (Owner only, or self leaving)."""
        access = cls.get_conversation_access(conv_id, current_user)
        curr_uid = _extract_user_id(current_user)
        is_self = (curr_uid == target_user_id)

        if not access["can_manage"] and not is_self:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to remove this participant.",
            )

        conv = access["conversation"]
        if conv.get("user_id") == target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The conversation owner cannot be removed.",
            )

        with get_db_connection() as conn:
            conn.execute(
                "DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?;",
                (conv_id, target_user_id),
            )

        return {"success": True, "message": "Participant removed successfully."}

    @classmethod
    def revoke_invitation(cls, conv_id: str, current_user: dict, invitation_id: str) -> dict:
        """Revoke a pending conversation invitation (Owner only)."""
        access = cls.get_conversation_access(conv_id, current_user)
        if not access["can_manage"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only conversation owners can revoke invitations.",
            )

        with get_db_connection() as conn:
            cur = conn.execute(
                "UPDATE conversation_invitations SET status = 'revoked' WHERE id = ? AND conversation_id = ?;",
                (invitation_id, conv_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Invitation not found or already modified.",
                )

        return {"success": True, "message": "Invitation revoked successfully."}
