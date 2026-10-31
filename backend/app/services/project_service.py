import os
import uuid
import secrets
import shutil
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from fastapi import HTTPException, status, UploadFile

from app.db.database import get_db_connection
from app.db.repository import ConversationRepository
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectMemberResponse,
    ProjectInvitationResponse,
    ProjectFileResponse,
    ProjectSkillResponse,
    ActivityEventResponse,
    ProjectDetailResponse,
    ProjectListItemResponse,
)
from app.schemas.conversation import ConversationResponse


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_user_id(user: Any) -> Optional[str]:
    if not user:
        return None
    if isinstance(user, dict):
        return user.get("id")
    return getattr(user, "id", None)


class ProjectService:
    """Service implementing Collaborative Project Workspaces, memberships, files, and skills."""

    @staticmethod
    def get_project_role(project_id: str, user: Optional[Any]) -> str:
        """Return role: 'owner', 'admin', 'member', 'viewer', or 'none'."""
        if not user:
            return "none"
        user_id = _extract_user_id(user)

        with get_db_connection() as conn:
            # Check owner in projects table
            p_cur = conn.execute("SELECT owner_id, visibility FROM projects WHERE id = ?;", (project_id,))
            p_row = p_cur.fetchone()
            if not p_row:
                return "none"
            if p_row["owner_id"] == user_id:
                return "owner"

            # Check project_members table
            m_cur = conn.execute(
                "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?;",
                (project_id, user_id),
            )
            m_row = m_cur.fetchone()
            if m_row:
                return m_row["role"]

        return "none"

    @classmethod
    def record_activity(
        cls,
        project_id: Optional[str],
        user: Optional[Any],
        event_type: str,
        details: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ):
        """Log an event to the activity_events table."""
        user_id = _extract_user_id(user)
        event_id = f"act-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO activity_events (
                    id, project_id, conversation_id, user_id, event_type, details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (event_id, project_id, conversation_id, user_id, event_type, details, now),
            )

    @classmethod
    def list_user_projects(cls, user: Any) -> List[ProjectListItemResponse]:
        """List all projects user owns or is a member of."""
        user_id = _extract_user_id(user)
        if not user_id:
            return []

        with get_db_connection() as conn:
            cur = conn.execute(
                """
                SELECT p.id, p.name, p.description, p.icon, p.visibility, p.owner_id, p.updated_at,
                       COALESCE(pm.role, CASE WHEN p.owner_id = ? THEN 'owner' ELSE 'viewer' END) as user_role,
                       (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
                       (SELECT COUNT(*) FROM conversations WHERE project_id = p.id) as conversation_count
                FROM projects p
                LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
                WHERE p.owner_id = ? OR pm.user_id = ?
                GROUP BY p.id
                ORDER BY p.updated_at DESC;
                """,
                (user_id, user_id, user_id, user_id),
            )
            items = []
            for r in cur.fetchall():
                items.append(
                    ProjectListItemResponse(
                        id=r["id"],
                        name=r["name"],
                        description=r["description"],
                        icon=r["icon"] or "folder",
                        visibility=r["visibility"],
                        current_user_role=r["user_role"] or "member",
                        member_count=max(1, r["member_count"]),
                        conversation_count=r["conversation_count"],
                        updated_at=r["updated_at"],
                    )
                )
            return items

    @classmethod
    def create_project(cls, payload: ProjectCreate, user: Any) -> ProjectDetailResponse:
        """Create a new project workspace."""
        user_id = _extract_user_id(user)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

        pid = f"proj-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO projects (id, name, description, icon, visibility, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (pid, payload.name.strip(), payload.description, payload.icon or "folder", payload.visibility or "private", user_id, now, now),
            )
            # Add creator as owner in project_members
            conn.execute(
                """
                INSERT INTO project_members (id, project_id, user_id, role, joined_at)
                VALUES (?, ?, ?, 'owner', ?);
                """,
                (f"pm-{uuid.uuid4().hex[:12]}", pid, user_id, now),
            )

            # Enable all built-in skills for the new project by default
            s_cur = conn.execute("SELECT id FROM skills;")
            for s_row in s_cur.fetchall():
                conn.execute(
                    """
                    INSERT INTO project_skills (id, project_id, skill_id, is_enabled, enabled_by, created_at)
                    VALUES (?, ?, ?, 1, ?, ?);
                    """,
                    (f"psk-{uuid.uuid4().hex[:12]}", pid, s_row["id"], user_id, now),
                )

        cls.record_activity(pid, user, "project_created", f"Created project '{payload.name}'")
        return cls.get_project_detail(pid, user)

    @classmethod
    def get_project_detail(cls, project_id: str, user: Optional[Any]) -> ProjectDetailResponse:
        """Fetch full workspace view: overview, members, conversations, files, skills, activity."""
        role = cls.get_project_role(project_id, user)
        if role == "none":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this project.")

        with get_db_connection() as conn:
            p_cur = conn.execute("SELECT * FROM projects WHERE id = ?;", (project_id,))
            p = p_cur.fetchone()
            if not p:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

            # Members
            m_cur = conn.execute(
                """
                SELECT pm.id, pm.user_id, pm.role, pm.joined_at, u.email, u.username, u.avatar_url
                FROM project_members pm
                LEFT JOIN users u ON pm.user_id = u.id
                WHERE pm.project_id = ?
                ORDER BY CASE pm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'member' THEN 3 ELSE 4 END, pm.joined_at ASC;
                """,
                (project_id,),
            )
            members = [
                ProjectMemberResponse(
                    id=r["id"],
                    user_id=r["user_id"],
                    email=r["email"],
                    display_name=r["username"],
                    avatar_url=r["avatar_url"],
                    role=r["role"],
                    joined_at=r["joined_at"],
                )
                for r in m_cur.fetchall()
            ]

            # Conversations
            c_cur = conn.execute(
                """
                SELECT c.id, c.title, c.is_pinned, c.is_archived, c.pinned_at, c.created_at, c.updated_at,
                       c.project_id, c.sharing_enabled, c.share_permission, c.share_token,
                       COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.project_id = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC;
                """,
                (project_id,),
            )
            conversations = []
            for row in c_cur.fetchall():
                c = dict(row)
                conversations.append(
                    ConversationResponse(
                        id=c["id"],
                        title=c["title"],
                        is_pinned=bool(c.get("is_pinned", 0)),
                        is_archived=bool(c.get("is_archived", 0)),
                        pinned_at=c.get("pinned_at"),
                        created_at=c["created_at"],
                        updated_at=c["updated_at"],
                        message_count=c.get("message_count", 0),
                        project_id=c.get("project_id"),
                        sharing_enabled=bool(c.get("sharing_enabled", 0)),
                        share_permission=c.get("share_permission") or "editor",
                        share_token=c.get("share_token"),
                        current_user_role=role,
                    )
                )

            # Project Files
            f_cur = conn.execute(
                """
                SELECT pf.id, pf.project_id, pf.uploaded_by, pf.filename, pf.file_type, pf.file_size,
                       pf.created_at, u.username as uploader_name
                FROM project_files pf
                LEFT JOIN users u ON pf.uploaded_by = u.id
                WHERE pf.project_id = ?
                ORDER BY pf.created_at DESC;
                """,
                (project_id,),
            )
            files = [
                ProjectFileResponse(
                    id=f["id"],
                    project_id=f["project_id"],
                    filename=f["filename"],
                    file_type=f["file_type"],
                    file_size=f["file_size"],
                    uploaded_by=f["uploaded_by"],
                    uploaded_by_name=f["uploader_name"],
                    created_at=f["created_at"],
                    download_url=f"/api/projects/{project_id}/files/{f['id']}/download",
                )
                for f in f_cur.fetchall()
            ]

            # Project Skills
            sk_cur = conn.execute(
                """
                SELECT s.id, s.name, s.description, s.icon, s.category,
                       COALESCE(ps.is_enabled, 1) as is_enabled
                FROM skills s
                LEFT JOIN project_skills ps ON s.id = ps.skill_id AND ps.project_id = ?
                ORDER BY s.name ASC;
                """,
                (project_id,),
            )
            skills = [
                ProjectSkillResponse(
                    skill_id=s["id"],
                    name=s["name"],
                    description=s["description"],
                    icon=s["icon"],
                    category=s["category"],
                    is_enabled=bool(s["is_enabled"]),
                )
                for s in sk_cur.fetchall()
            ]

            # Recent Activity
            act_cur = conn.execute(
                """
                SELECT a.id, a.project_id, a.conversation_id, a.user_id, a.event_type, a.details, a.created_at,
                       u.username
                FROM activity_events a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.project_id = ?
                ORDER BY a.created_at DESC
                LIMIT 20;
                """,
                (project_id,),
            )
            recent_activity = [
                ActivityEventResponse(
                    id=a["id"],
                    project_id=a["project_id"],
                    conversation_id=a["conversation_id"],
                    user_id=a["user_id"],
                    user_name=a["username"] or "User",
                    event_type=a["event_type"],
                    details=a["details"],
                    created_at=a["created_at"],
                )
                for a in act_cur.fetchall()
            ]

            # Pending Invitations (visible to owner & admin)
            pending_invs: List[ProjectInvitationResponse] = []
            if role in ("owner", "admin"):
                now_iso = _utc_now_iso()
                inv_cur = conn.execute(
                    """
                    SELECT id, project_id, inviter_user_id, email, token, role, status, expires_at, created_at
                    FROM project_invitations
                    WHERE project_id = ? AND status = 'pending' AND expires_at > ?
                    ORDER BY created_at DESC;
                    """,
                    (project_id, now_iso),
                )
                pending_invs = [
                    ProjectInvitationResponse(
                        id=r["id"],
                        project_id=r["project_id"],
                        inviter_user_id=r["inviter_user_id"],
                        email=r["email"],
                        token=r["token"],
                        role=r["role"],
                        status=r["status"],
                        expires_at=r["expires_at"],
                        created_at=r["created_at"],
                        invite_url=f"/join/p/{r['token']}",
                    )
                    for r in inv_cur.fetchall()
                ]

        return ProjectDetailResponse(
            id=p["id"],
            name=p["name"],
            description=p["description"],
            icon=p["icon"] or "folder",
            visibility=p["visibility"],
            owner_id=p["owner_id"],
            created_at=p["created_at"],
            updated_at=p["updated_at"],
            current_user_role=role,
            member_count=len(members),
            conversation_count=len(conversations),
            file_count=len(files),
            members=members,
            conversations=conversations,
            files=files,
            skills=skills,
            recent_activity=recent_activity,
            pending_invitations=pending_invs,
        )

    @classmethod
    def update_project(cls, project_id: str, payload: ProjectUpdate, user: Any) -> ProjectDetailResponse:
        """Update project details (Owner or Admin only)."""
        role = cls.get_project_role(project_id, user)
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners or admins can update project settings.")

        now = _utc_now_iso()
        updates = []
        params = []
        if payload.name is not None:
            updates.append("name = ?")
            params.append(payload.name.strip())
        if payload.description is not None:
            updates.append("description = ?")
            params.append(payload.description.strip())
        if payload.icon is not None:
            updates.append("icon = ?")
            params.append(payload.icon)
        if payload.visibility is not None:
            updates.append("visibility = ?")
            params.append(payload.visibility)

        if updates:
            updates.append("updated_at = ?")
            params.append(now)
            params.append(project_id)
            with get_db_connection() as conn:
                conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?;", tuple(params))

        cls.record_activity(project_id, user, "project_updated", f"Updated project settings")
        return cls.get_project_detail(project_id, user)

    @classmethod
    def delete_project(cls, project_id: str, user: Any) -> dict:
        """Delete project workspace (Owner only)."""
        role = cls.get_project_role(project_id, user)
        if role != "owner":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the project owner can delete this workspace.")

        with get_db_connection() as conn:
            conn.execute("DELETE FROM projects WHERE id = ?;", (project_id,))

        # Clean up files directory if present
        upload_dir = Path("backend/data/projects") / project_id
        if upload_dir.exists():
            shutil.rmtree(upload_dir, ignore_errors=True)

        return {"success": True, "message": "Project workspace deleted successfully."}

    @classmethod
    def create_invitation(
        cls,
        project_id: str,
        user: Any,
        email: Optional[str],
        role: str,
        expiry_days: int = 7,
    ) -> ProjectInvitationResponse:
        """Invite a member by email or generate a project invitation link (Owner or Admin only)."""
        u_role = cls.get_project_role(project_id, user)
        if u_role not in ("owner", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners or admins can invite new members.")

        if role not in ("admin", "member", "viewer"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role specified.")

        user_id = _extract_user_id(user)
        token = uuid.uuid4().hex
        inv_id = f"pinv-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=expiry_days)).isoformat()
        clean_email = email.strip().lower() if email else None

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO project_invitations (id, project_id, inviter_user_id, email, token, role, status, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?);
                """,
                (inv_id, project_id, user_id, clean_email, token, role, expires_at, now.isoformat()),
            )

        cls.record_activity(project_id, user, "member_invited", f"Invited {clean_email or 'collaborator'} as {role}")
        return ProjectInvitationResponse(
            id=inv_id,
            project_id=project_id,
            inviter_user_id=user_id,
            email=clean_email,
            token=token,
            role=role,
            status="pending",
            expires_at=expires_at,
            created_at=now.isoformat(),
            invite_url=f"/join/p/{token}",
        )

    @classmethod
    def accept_invitation(cls, token: str, user: Any) -> dict:
        """Accept an invitation to join a project workspace."""
        user_id = _extract_user_id(user)
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

        now = _utc_now_iso()
        with get_db_connection() as conn:
            cur = conn.execute(
                "SELECT id, project_id, role, status, expires_at FROM project_invitations WHERE token = ?;",
                (token,),
            )
            inv = cur.fetchone()
            if not inv:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
            if inv["status"] != "pending":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invitation has already been {inv['status']}.")
            if inv["expires_at"] < now:
                conn.execute("UPDATE project_invitations SET status = 'expired' WHERE id = ?;", (inv["id"],))
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation has expired.")

            pid = inv["project_id"]
            role = inv["role"]

            conn.execute(
                """
                INSERT INTO project_members (id, project_id, user_id, role, joined_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role;
                """,
                (f"pm-{uuid.uuid4().hex[:12]}", pid, user_id, role, now),
            )
            conn.execute("UPDATE project_invitations SET status = 'accepted' WHERE id = ?;", (inv["id"],))

        cls.record_activity(pid, user, "member_joined", f"Joined project as {role}")
        return {"success": True, "project_id": pid, "role": role, "message": "Joined project workspace successfully."}

    @classmethod
    def remove_member(cls, project_id: str, target_user_id: str, user: Any) -> dict:
        """Remove a project member or leave the project."""
        current_user_id = _extract_user_id(user)
        caller_role = cls.get_project_role(project_id, user)
        is_self = (current_user_id == target_user_id)

        if not is_self and caller_role not in ("owner", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to remove member.")

        with get_db_connection() as conn:
            p_cur = conn.execute("SELECT owner_id FROM projects WHERE id = ?;", (project_id,))
            p = p_cur.fetchone()
            if not p:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
            if p["owner_id"] == target_user_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project owner cannot be removed.")

            conn.execute("DELETE FROM project_members WHERE project_id = ? AND user_id = ?;", (project_id, target_user_id))

        cls.record_activity(project_id, user, "member_removed", f"Removed user from project")
        return {"success": True, "message": "Member removed successfully."}

    @classmethod
    def update_member_role(cls, project_id: str, target_user_id: str, new_role: str, user: Any) -> dict:
        """Update role of a project member (Owner only, or Admin modifying member/viewer)."""
        caller_role = cls.get_project_role(project_id, user)
        if caller_role not in ("owner", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners and admins can update member roles.")

        if new_role not in ("admin", "member", "viewer"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role specified.")

        if caller_role == "admin" and new_role == "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners can grant admin privileges.")

        with get_db_connection() as conn:
            conn.execute(
                "UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?;",
                (new_role, project_id, target_user_id),
            )

        cls.record_activity(project_id, user, "role_changed", f"Changed role of member to {new_role}")
        return {"success": True, "message": f"Member role updated to {new_role}."}

    @classmethod
    def move_conversation_to_project(cls, project_id: str, conv_id: str, user: Any) -> dict:
        """Move an existing personal conversation into a project."""
        caller_role = cls.get_project_role(project_id, user)
        if caller_role in ("none", "viewer"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to add conversations to this project.")

        conv = ConversationRepository.get_conversation(conv_id)
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

        user_id = _extract_user_id(user)
        if conv.get("user_id") and conv.get("user_id") != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only move your own conversations.")

        now = _utc_now_iso()
        with get_db_connection() as conn:
            conn.execute(
                "UPDATE conversations SET project_id = ?, updated_at = ? WHERE id = ?;",
                (project_id, now, conv_id),
            )

        cls.record_activity(project_id, user, "conversation_added", f"Moved conversation '{conv.get('title')}' into project", conversation_id=conv_id)
        return {"success": True, "message": "Conversation moved into project successfully."}

    @classmethod
    def toggle_project_skill(cls, project_id: str, skill_id: str, is_enabled: bool, user: Any) -> dict:
        """Toggle an installed skill specifically for this project (Admin or Owner only)."""
        caller_role = cls.get_project_role(project_id, user)
        if caller_role not in ("owner", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project owners or admins can toggle project skills.")

        user_id = _extract_user_id(user)
        now = _utc_now_iso()
        val = 1 if is_enabled else 0

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO project_skills (id, project_id, skill_id, is_enabled, enabled_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, skill_id) DO UPDATE SET is_enabled = excluded.is_enabled;
                """,
                (f"psk-{uuid.uuid4().hex[:12]}", project_id, skill_id, val, user_id, now),
            )

        state_str = "enabled" if is_enabled else "disabled"
        cls.record_activity(project_id, user, "skill_toggled", f"{state_str.capitalize()} skill '{skill_id}'")
        return {"success": True, "skill_id": skill_id, "is_enabled": is_enabled}

    @classmethod
    async def upload_project_file(cls, project_id: str, file: UploadFile, user: Any) -> ProjectFileResponse:
        """Upload a grounded project document (PDF, TXT, MD)."""
        caller_role = cls.get_project_role(project_id, user)
        if caller_role in ("none", "viewer"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewers cannot upload files to this project.")

        filename = os.path.basename(file.filename or "uploaded_file.txt")
        ext = os.path.splitext(filename)[1].lower()
        if ext not in (".pdf", ".txt", ".md"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .pdf, .txt, and .md files are allowed.")

        upload_dir = Path("backend/data/projects") / project_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_id = f"pfile-{uuid.uuid4().hex[:12]}"
        storage_filename = f"{file_id}{ext}"
        target_path = upload_dir / storage_filename

        content = await file.read()
        file_size = len(content)
        if file_size > 20 * 1024 * 1024:  # 20MB limit
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds maximum 20MB limit.")

        with open(target_path, "wb") as f_out:
            f_out.write(content)

        user_id = _extract_user_id(user)
        now = _utc_now_iso()

        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO project_files (id, project_id, uploaded_by, filename, file_type, file_size, storage_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (file_id, project_id, user_id, filename, ext, file_size, str(target_path), now),
            )

        cls.record_activity(project_id, user, "file_uploaded", f"Uploaded document '{filename}' ({file_size // 1024} KB)")
        return ProjectFileResponse(
            id=file_id,
            project_id=project_id,
            filename=filename,
            file_type=ext,
            file_size=file_size,
            uploaded_by=user_id or "system",
            uploaded_by_name="You",
            created_at=now,
            download_url=f"/api/projects/{project_id}/files/{file_id}/download",
        )

    @classmethod
    def delete_project_file(cls, project_id: str, file_id: str, user: Any) -> dict:
        """Delete a shared project file."""
        caller_role = cls.get_project_role(project_id, user)
        if caller_role in ("none", "viewer"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to delete files.")

        with get_db_connection() as conn:
            f_cur = conn.execute("SELECT * FROM project_files WHERE id = ? AND project_id = ?;", (file_id, project_id))
            file_record = f_cur.fetchone()
            if not file_record:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")

            user_id = _extract_user_id(user)
            # If member, only can delete files they uploaded; admin/owner can delete any
            if caller_role == "member" and file_record["uploaded_by"] != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete files you uploaded.")

            conn.execute("DELETE FROM project_files WHERE id = ?;", (file_id,))

        storage_path = Path(file_record["storage_path"])
        if storage_path.exists():
            try:
                storage_path.unlink()
            except Exception:
                pass

        cls.record_activity(project_id, user, "file_deleted", f"Deleted file '{file_record['filename']}'")
        return {"success": True, "message": "File deleted successfully."}
