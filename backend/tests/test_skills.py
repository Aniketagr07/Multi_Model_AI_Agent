import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_skills_catalog():
    """Verify skills catalog returns builtin skills and categories."""
    resp = client.get("/api/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert "skills" in data
    assert "categories" in data
    assert len(data["skills"]) >= 10
    categories = data["categories"]
    assert "Coding & Development" in categories
    assert "Mathematics" in categories
    assert "Third-Party Integrations" in categories


def test_skill_installation_consent_required():
    """Verify installation requires explicit consent."""
    # Attempt install without consent
    no_consent = client.post("/api/skills/math-solver/install", json={"consent": False})
    assert no_consent.status_code == 400

    # Install with consent
    install_resp = client.post("/api/skills/math-solver/install", json={"consent": True})
    assert install_resp.status_code == 200
    assert install_resp.json()["is_installed"] is True
    assert install_resp.json()["is_enabled"] is True

    # Check installed filter
    installed_list = client.get("/api/skills?installed_only=true").json()
    ids = [s["id"] for s in installed_list["skills"]]
    assert "math-solver" in ids


def test_skill_toggle_and_uninstall():
    """Verify enabling, disabling, and uninstalling skills."""
    # Ensure installed
    client.post("/api/skills/doc-summarizer/install", json={"consent": True})

    # Disable
    toggle_resp = client.patch("/api/skills/doc-summarizer/toggle", json={"enabled": False})
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_enabled"] is False

    # Enable
    toggle_on = client.patch("/api/skills/doc-summarizer/toggle", json={"enabled": True})
    assert toggle_on.status_code == 200
    assert toggle_on.json()["is_enabled"] is True

    # Uninstall
    del_resp = client.delete("/api/skills/doc-summarizer/install")
    assert del_resp.status_code == 200

    # Verify not installed
    skill_detail = client.get("/api/skills/doc-summarizer").json()
    assert skill_detail["is_installed"] is False


def test_skill_execution_math_solver():
    """Verify execution of the math solver skill with AST safety."""
    # Install math solver
    client.post("/api/skills/math-solver/install", json={"consent": True})

    # Execute valid math
    exec_resp = client.post(
        "/api/skills/math-solver/execute",
        json={"params": {"expression": "(15 * 4) + 2^3"}},
    )
    assert exec_resp.status_code == 200
    data = exec_resp.json()
    assert data["status"] == "success"
    assert data["result"]["result"] == 68  # (15*4) + 8 = 68

    # Verify execution logged in history
    hist_resp = client.get("/api/skills/executions/history")
    assert hist_resp.status_code == 200
    assert any(e["skill_id"] == "math-solver" for e in hist_resp.json()["executions"])


def test_skill_execution_csv_analyzer():
    """Verify execution of the CSV analyzer skill."""
    client.post("/api/skills/csv-analyzer/install", json={"consent": True})

    sample_csv = "product,units,price\nWidget A,10,25.50\nWidget B,5,100.00\nWidget C,20,15.00"
    exec_resp = client.post(
        "/api/skills/csv-analyzer/execute",
        json={"params": {"csv_text": sample_csv}},
    )
    assert exec_resp.status_code == 200
    res = exec_resp.json()["result"]
    assert res["status"] == "success"
    assert res["row_count"] == 3
    assert "units" in res["statistics"]
    assert res["statistics"]["units"]["sum"] == 35.0


def test_skill_execution_code_explainer():
    """Verify execution of the code explainer skill."""
    client.post("/api/skills/code-explainer/install", json={"consent": True})

    sample_code = """def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
"""
    exec_resp = client.post(
        "/api/skills/code-explainer/execute",
        json={"params": {"code": sample_code, "language": "python"}},
    )
    assert exec_resp.status_code == 200
    res = exec_resp.json()["result"]
    assert res["status"] == "success"
    assert "binary_search" in res["details"]["functions"]
    assert res["details"]["loops_count"] == 1


def test_third_party_integration_honest_status():
    """Verify third-party integrations require server-side credentials and do not fake connection."""
    # Install GitHub integration
    client.post("/api/skills/github-integration/install", json={"consent": True})

    # Executing unconnected integration returns 422 explaining OAuth requirement
    exec_resp = client.post(
        "/api/skills/github-integration/execute",
        json={"params": {"repo": "owner/repo"}},
    )
    assert exec_resp.status_code == 422
    assert "requires connected OAuth credentials" in exec_resp.json()["detail"]

