"""
End-to-end verification script for FieldProof roadmap features:
1. Auth & RBAC (Owner vs Technician)
2. Analytics summary with historical trend curves (MetricSnapshot)
3. Editable template field review (PATCH /templates/{id}/fields/{field_id})
4. Field capture upload (POST /capture)
"""
import os
import sys

from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.celery_app import celery_app
from app.seed import run as run_seed

celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True

client = TestClient(app)


def test_roadmap_flow():
    print("--- 1. Seeding Database ---")
    run_seed()

    print("--- 2. Auth & RBAC Token Acquisition ---")
    owner_resp = client.post("/auth/login", json={"email": "priya@meridianfieldworks.com", "password": "demo-password-123"})
    assert owner_resp.status_code == 200, f"Owner login failed: {owner_resp.text}"
    owner_token = owner_resp.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    tech_resp = client.post("/auth/login", json={"email": "marcus@meridianfieldworks.com", "password": "demo-password-123"})
    assert tech_resp.status_code == 200, f"Technician login failed: {tech_resp.text}"
    tech_token = tech_resp.json()["access_token"]
    tech_headers = {"Authorization": f"Bearer {tech_token}"}

    print("--- 3. Verifying User Profiles & Roles ---")
    me_owner = client.get("/auth/me", headers=owner_headers).json()
    assert me_owner["role"] == "Owner", f"Expected Owner role, got {me_owner['role']}"

    me_tech = client.get("/auth/me", headers=tech_headers).json()
    assert me_tech["role"] == "Technician", f"Expected Technician role, got {me_tech['role']}"

    print("--- 4. Testing Analytics Trend Curves ---")
    analytics_resp = client.get("/analytics/summary", headers=owner_headers)
    assert analytics_resp.status_code == 200, f"Analytics failed: {analytics_resp.text}"
    data = analytics_resp.json()
    assert len(data["documentation_time_trend"]) >= 7, "Missing documentation_time_trend points"
    assert len(data["accuracy_trend"]) >= 7, "Missing accuracy_trend points"
    assert len(data["compliance_trend"]) >= 7, "Missing compliance_trend points"
    print(f"  Documentation time trend points: {len(data['documentation_time_trend'])}")
    print(f"  Accuracy trend points: {len(data['accuracy_trend'])}")
    print(f"  Compliance trend points: {len(data['compliance_trend'])}")

    print("--- 5. Testing Template Field Patch & RBAC ---")
    tpls = client.get("/templates", headers=owner_headers).json()
    assert len(tpls) > 0, "No templates found"
    target_tpl = tpls[0]

    # Patch field as Technician (should be 403 Forbidden)
    forbidden_resp = client.patch(
        f"/templates/{target_tpl['id']}/fields/dummy_field_id",
        json={"label": "Unauthorized Edit"},
        headers=tech_headers,
    )
    assert forbidden_resp.status_code == 403, f"Expected 403 Forbidden for Technician, got {forbidden_resp.status_code}"
    print("  RBAC Check Passed: Technician received 403 on template patch.")

    print("--- 6. Testing Capture Endpoint ---")
    jobs = client.get("/jobs", headers=tech_headers).json()
    assert len(jobs) > 0, "No jobs found"
    target_job = jobs[0]

    dummy_audio = b"RIFF....WAVEfmt ....data...."
    capture_resp = client.post(
        "/capture",
        data={"job_id": target_job["id"], "kind": "voice"},
        files={"file": ("recording.wav", dummy_audio, "audio/wav")},
        headers=tech_headers,
    )
    assert capture_resp.status_code == 201, f"Capture failed: {capture_resp.text}"
    c_data = capture_resp.json()
    assert c_data["job_id"] == target_job["id"]
    assert c_data["kind"] == "voice"
    print(f"  Capture succeeded: Created Capture ID {c_data['id']}")

    print("\n=== ALL ROADMAP VERIFICATION TESTS PASSED SUCCESSFULLY! ===")


if __name__ == "__main__":
    test_roadmap_flow()
