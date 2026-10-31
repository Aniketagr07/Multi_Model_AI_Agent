import json
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from app.api.routes.auth import get_current_user_required, get_current_user_optional
from app.services.auth_service import get_user_by_token
from app.services.collaboration_service import CollaborationService
from app.core.websocket_manager import get_ws_manager
from app.schemas.collaboration import (
    ShareDetailsResponse,
    ShareSettingsUpdate,
    ConversationInviteRequest,
    ConversationInvitationResponse,
    JoinConversationResponse,
)

router = APIRouter()


@router.websocket("/ws/{conversation_id}")
@router.websocket("/{conversation_id}/ws")
async def conversation_websocket(
    websocket: WebSocket,
    conversation_id: str,
    token: Optional[str] = Query(default=None),
):
    """
    WebSocket endpoint for real-time conversation collaboration.
    Broadcasts message sync, assistant streaming, presence updates, and typing indicators.
    """
    ws_mgr = get_ws_manager()
    user = get_user_by_token(token) if token else None

    # Verify conversation access
    try:
        access = CollaborationService.get_conversation_access(conversation_id, user)
        if not access["can_read"]:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied.")
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Access denied.")
        return

    user_info = user or {
        "id": f"guest-{secrets.token_hex(4)}",
        "display_name": "Guest",
        "username": "Guest",
        "avatar_url": None,
    }

    await ws_mgr.connect(conversation_id, websocket, user_info)

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
                event_type = data.get("type")
                if event_type == "user_typing":
                    # Broadcast typing indicator to other room participants
                    await ws_mgr.broadcast_to_conversation(
                        conversation_id=conversation_id,
                        message={
                            "type": "user_typing",
                            "conversation_id": conversation_id,
                            "user_id": user_info.get("id"),
                            "name": user_info.get("display_name") or user_info.get("username") or "Participant",
                            "is_typing": bool(data.get("is_typing", True)),
                        },
                        exclude=websocket,
                    )
                elif event_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await ws_mgr.disconnect(conversation_id, websocket)


@router.get(
    "/{conversation_id}/share",
    response_model=ShareDetailsResponse,
    summary="Get Conversation Share Settings",
    description="Retrieve conversation sharing configuration, active participants, and pending invitations.",
)
async def get_share_settings(
    conversation_id: str,
    user: Optional[dict] = Depends(get_current_user_optional),
) -> ShareDetailsResponse:
    return CollaborationService.get_share_details(conversation_id, user)


@router.patch(
    "/{conversation_id}/share",
    response_model=ShareDetailsResponse,
    summary="Update Share Settings",
    description="Toggle public link sharing and default link permission (editor/viewer).",
)
async def update_share_settings(
    conversation_id: str,
    payload: ShareSettingsUpdate,
    user: dict = Depends(get_current_user_required),
) -> ShareDetailsResponse:
    return CollaborationService.update_share_settings(
        conv_id=conversation_id,
        user=user,
        sharing_enabled=payload.sharing_enabled,
        share_permission=payload.share_permission,
    )


@router.post(
    "/{conversation_id}/invitations",
    response_model=ConversationInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Conversation Invitation",
    description="Invite a user by email or generate a collaboration invite token.",
)
async def create_invitation(
    conversation_id: str,
    payload: ConversationInviteRequest,
    user: dict = Depends(get_current_user_required),
) -> ConversationInvitationResponse:
    return CollaborationService.create_invitation(
        conv_id=conversation_id,
        user=user,
        email=payload.email,
        role=payload.role,
        expiry_days=payload.expiry_days,
    )


@router.delete(
    "/{conversation_id}/invitations/{invitation_id}",
    summary="Revoke Conversation Invitation",
)
async def revoke_invitation(
    conversation_id: str,
    invitation_id: str,
    user: dict = Depends(get_current_user_required),
):
    return CollaborationService.revoke_invitation(
        conv_id=conversation_id,
        current_user=user,
        invitation_id=invitation_id,
    )


@router.delete(
    "/{conversation_id}/members/{target_user_id}",
    summary="Remove Conversation Participant or Leave",
)
async def remove_member(
    conversation_id: str,
    target_user_id: str,
    user: dict = Depends(get_current_user_required),
):
    return CollaborationService.remove_member(
        conv_id=conversation_id,
        current_user=user,
        target_user_id=target_user_id,
    )


@router.post(
    "/join/{token}",
    response_model=JoinConversationResponse,
    summary="Join Shared Conversation via Token or Link",
)
async def join_conversation(
    token: str,
    user: dict = Depends(get_current_user_required),
) -> JoinConversationResponse:
    return CollaborationService.accept_invitation(token=token, user=user)
