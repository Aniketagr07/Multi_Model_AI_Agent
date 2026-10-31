import io
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import create_application
from app.services.auth_service import register_user


@pytest.fixture
def client():
    app = create_application()
    return TestClient(app)


@pytest.fixture
def project_test_users():
    uid = uuid.uuid4().hex[:6]
    owner = register_user(f"proj_owner_{uid}@test.com", f"powner_{uid}", "Password123!")
    member = register_user(f"proj_member_{uid}@test.com", f"pmember_{uid}", "Password123!")
    viewer = register_user(f"proj_viewer_{uid}@test.com", f"pviewer_{uid}", "Password123!")
    return {
        "owner": owner,
        "member": member,
        "viewer": viewer,
    }


def test_project_workspace_lifecycle(client: TestClient, project_test_users):
    owner = project_test_users["owner"]
    member = project_test_users["member"]
    viewer = project_test_users["viewer"]
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}
    member_headers = {"Authorization": f"Bearer {member['token']}"}
    viewer_headers = {"Authorization": f"Bearer {viewer['token']}"}

    # 1. Create a Project as Owner
    create_res = client.post(
        "/api/projects",
        json={
            "name": "OmniAI Redesign Project",
            "description": "Collaborative project for AI features",
            "icon": "folder",
            "visibility": "private",
        },
        headers=owner_headers,
    )
    assert create_res.status_code == 201
    project_data = create_res.json()
    project_id = project_data["id"]
    assert project_data["name"] == "OmniAI Redesign Project"
    assert project_data["current_user_role"] == "owner"

    # 2. List Projects for Owner
    list_res = client.get("/api/projects", headers=owner_headers)
    assert list_res.status_code == 200
    assert any(p["id"] == project_id for p in list_res.json())

    # 3. Invite Member
    inv_res = client.post(
        f"/api/projects/{project_id}/invitations",
        json={"email": member["user"]["email"], "role": "member", "expiry_days": 5},
        headers=owner_headers,
    )
    assert inv_res.status_code == 201
    inv_token = inv_res.json()["token"]

    # 4. Member Accepts Invitation
    join_res = client.post(f"/api/projects/join/{inv_token}", headers=member_headers)
    assert join_res.status_code == 200
    assert join_res.json()["role"] == "member"

    # 5. Member inspects project details
    detail_res = client.get(f"/api/projects/{project_id}", headers=member_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["current_user_role"] == "member"
    assert len(detail_res.json()["members"]) == 2

    # 6. Move an existing conversation into the project
    conv_res = client.post("/api/conversations", json={"title": "Personal Strategy"}, headers=owner_headers)
    conv_id = conv_res.json()["id"]

    move_res = client.post(
        f"/api/projects/{project_id}/conversations/move",
        json={"conversation_id": conv_id},
        headers=owner_headers,
    )
    assert move_res.status_code == 200

    # Verify conversation now shows in project conversations
    detail_after_move = client.get(f"/api/projects/{project_id}", headers=member_headers)
    assert any(c["id"] == conv_id for c in detail_after_move.json()["conversations"])

    # 7. Upload a Project File
    fake_file = io.BytesIO(b"OmniAI Specification and Architecture Notes")
    upload_res = client.post(
        f"/api/projects/{project_id}/files",
        files={"file": ("specs.txt", fake_file, "text/plain")},
        headers=owner_headers,
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    # 8. Download Project File
    dl_res = client.get(f"/api/projects/{project_id}/files/{file_id}/download", headers=member_headers)
    assert dl_res.status_code == 200
    assert b"OmniAI Specification" in dl_res.content

    # 9. Toggle Skill in Project
    toggle_res = client.patch(
        f"/api/projects/{project_id}/skills/python-code-assistant?is_enabled=false",
        headers=owner_headers,
    )
    assert toggle_res.status_code == 200

    # 10. Invite Viewer and verify viewer permissions
    v_inv_res = client.post(
        f"/api/projects/{project_id}/invitations",
        json={"email": viewer["user"]["email"], "role": "viewer"},
        headers=owner_headers,
    )
    v_join_res = client.post(f"/api/projects/join/{v_inv_res.json()['token']}", headers=viewer_headers)
    assert v_join_res.status_code == 200

    # Viewer cannot upload file
    viewer_upload = client.post(
        f"/api/projects/{project_id}/files",
        files={"file": ("hack.txt", io.BytesIO(b"hack"), "text/plain")},
        headers=viewer_headers,
    )
    assert viewer_upload.status_code == 403

    # 11. Delete file as owner
    del_file = client.delete(f"/api/projects/{project_id}/files/{file_id}", headers=owner_headers)
    assert del_file.status_code == 200

    # 12. Delete project as owner
    del_proj = client.delete(f"/api/projects/{project_id}", headers=owner_headers)
    assert del_proj.status_code == 200

