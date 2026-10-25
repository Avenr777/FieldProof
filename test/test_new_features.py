"""
Verification test script for newly wired FieldProof features & document intelligence tools.
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

def test_new_features_flow():
    print("--- 1. Seeding Database ---")
    run_seed()

    print("--- 2. Logging in as Owner ---")
    owner_resp = client.post("/auth/login", json={"email": "priya@meridianfieldworks.com", "password": "demo-password-123"})
    assert owner_resp.status_code == 200, f"Owner login failed: {owner_resp.text}"
    token = owner_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("--- 3. Testing Profile & Business Update (PATCH /auth/me & PATCH /auth/business) ---")
    user_patch = client.patch("/auth/me", json={"full_name": "Priya Sharma Updated"}, headers=headers)
    assert user_patch.status_code == 200, f"User patch failed: {user_patch.text}"
    assert user_patch.json()["full_name"] == "Priya Sharma Updated"

    biz_patch = client.patch("/auth/business", json={"name": "Meridian Fieldworks Ltd", "address": "123 Field Way"}, headers=headers)
    assert biz_patch.status_code == 200, f"Biz patch failed: {biz_patch.text}"
    assert biz_patch.json()["name"] == "Meridian Fieldworks Ltd"
    assert biz_patch.json()["address"] == "123 Field Way"

    print("--- 4. Testing Integrations (GET & PATCH /integrations) ---")
    integrations_get = client.get("/integrations", headers=headers)
    assert integrations_get.status_code == 200, f"Integrations list failed: {integrations_get.text}"
    items = integrations_get.json()
    assert len(items) >= 3, f"Expected 3 default integrations, got {len(items)}"

    crm_patch = client.patch("/integrations/CRM", json={"enabled": False}, headers=headers)
    assert crm_patch.status_code == 200, f"CRM toggle failed: {crm_patch.text}"
    assert crm_patch.json()["enabled"] == False

    print("--- 5. Testing Job Updates & Status (PATCH /jobs/{id}) ---")
    jobs = client.get("/jobs", headers=headers).json()
    assert len(jobs) > 0
    job = jobs[0]

    job_update = client.patch(f"/jobs/{job['id']}", json={"status": "Cancelled", "notes": "Job cancelled by client request"}, headers=headers)
    assert job_update.status_code == 200, f"Job update failed: {job_update.text}"
    assert job_update.json()["status"] == "Cancelled"

    print("--- 6. Testing Technician Status Update (PATCH /technicians/{id}) ---")
    techs = client.get("/technicians", headers=headers).json()
    assert len(techs) > 0
    tech = techs[0]

    tech_update = client.patch(f"/technicians/{tech['id']}", json={"status": "On Site"}, headers=headers)
    assert tech_update.status_code == 200, f"Tech update failed: {tech_update.text}"
    assert tech_update.json()["status"] == "On Site"

    print("--- 7. Testing Document Search & CSV Export ---")
    docs = client.get("/documents", headers=headers).json()
    assert len(docs) > 0
    doc = docs[0]

    search_resp = client.get(f"/documents/search?q={doc['name'][:4]}", headers=headers)
    assert search_resp.status_code == 200, f"Search failed: {search_resp.text}"
    assert len(search_resp.json()) > 0

    export_all = client.get("/documents/export", headers=headers)
    assert export_all.status_code == 200, f"Export CSV failed: {export_all.text}"
    assert "Document ID,Document Name" in export_all.text

    export_single = client.get(f"/documents/{doc['id']}/export", headers=headers)
    assert export_single.status_code == 200, f"Single export failed: {export_single.text}"
    assert doc['id'] in export_single.text

    print("--- 8. Testing Document Review Comment & History (POST review & GET history) ---")
    review_resp = client.post(
        f"/documents/{doc['id']}/review",
        json={"action": "request_changes", "comment": "Please re-check voltage readings"},
        headers=headers,
    )
    assert review_resp.status_code == 200, f"Review failed: {review_resp.text}"

    history_resp = client.get(f"/documents/{doc['id']}/history", headers=headers)
    assert history_resp.status_code == 200, f"History failed: {history_resp.text}"
    h_data = history_resp.json()
    assert len(h_data) > 0
    assert h_data[0]["action"] == "request_changes"
    assert h_data[0]["comment"] == "Please re-check voltage readings"

    print("--- 9. Testing Recurring Compliance Events (GET /compliance/events/recurring) ---")
    rec_resp = client.get("/compliance/events/recurring", headers=headers)
    assert rec_resp.status_code == 200, f"Recurring compliance failed: {rec_resp.text}"
    assert isinstance(rec_resp.json(), list)

    print("\n=== ALL NEW FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_new_features_flow()
