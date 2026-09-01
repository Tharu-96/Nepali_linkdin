from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, WorkerProfile, EmployerProfile, Report

client = TestClient(app)

def test_features_flow():
    print("Starting integration test for role-based dashboard features...")

    # Clean up any leftover test data
    db = SessionLocal()
    try:
        db.query(Report).delete()
        db.query(WorkerProfile).delete()
        db.query(EmployerProfile).delete()
        db.query(User).filter(User.email.in_(["test_worker@rozgar.com", "test_employer@rozgar.com"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    # 1. Register test worker and employer
    print("Registering worker and employer...")
    res_w = client.post("/auth/register", json={
        "name": "Test Worker",
        "email": "test_worker@rozgar.com",
        "phone_number": "9800000006",
        "national_id_card": "NID0000006",
        "password": "password123",
        "role": "worker"
    })
    assert res_w.status_code == 201, f"Failed: {res_w.text}"
    worker_id = res_w.json()["id"]

    res_e = client.post("/auth/register", json={
        "name": "Test Employer",
        "email": "test_employer@rozgar.com",
        "phone_number": "9800000007",
        "national_id_card": "NID0000007",
        "password": "password123",
        "role": "employer"
    })
    assert res_e.status_code == 201, f"Failed: {res_e.text}"
    employer_id = res_e.json()["id"]

    # Log in to get tokens
    print("Logging in to get tokens...")
    tok_w = client.post("/auth/login", json={"email": "test_worker@rozgar.com", "password": "password123"}).json()["access_token"]
    tok_e = client.post("/auth/login", json={"email": "test_employer@rozgar.com", "password": "password123"}).json()["access_token"]
    tok_a = client.post("/auth/login", json={"email": "admin@rozgar.com", "password": "admin123"}).json()["access_token"]

    headers_w = {"Authorization": f"Bearer {tok_w}"}
    headers_e = {"Authorization": f"Bearer {tok_e}"}
    headers_a = {"Authorization": f"Bearer {tok_a}"}

    # 2. Test Worker Profile GET (lazy initialization)
    print("Testing Worker Profile (lazy create & retrieve)...")
    get_wp = client.get("/profiles/worker", headers=headers_w)
    assert get_wp.status_code == 200, f"Failed: {get_wp.text}"
    assert get_wp.json()["user_id"] == worker_id
    assert get_wp.json()["skills"] is None
    assert get_wp.json()["availability"] is True

    # 3. Test Worker Profile PUT (update)
    print("Testing Worker Profile update...")
    put_wp = client.put("/profiles/worker", headers=headers_w, json={
        "skills": "Python, FastAPI, React",
        "location": "Kathmandu",
        "availability": False
    })
    assert put_wp.status_code == 200, f"Failed: {put_wp.text}"
    assert put_wp.json()["skills"] == "Python, FastAPI, React"
    assert put_wp.json()["location"] == "Kathmandu"
    assert put_wp.json()["availability"] is False

    # 4. Test Employer Profile GET (lazy initialization)
    print("Testing Employer Profile (lazy create & retrieve)...")
    get_ep = client.get("/profiles/employer", headers=headers_e)
    assert get_ep.status_code == 200, f"Failed: {get_ep.text}"
    assert get_ep.json()["user_id"] == employer_id
    assert get_ep.json()["company"] is None

    # 5. Test Employer Profile PUT (update)
    print("Testing Employer Profile update...")
    put_ep = client.put("/profiles/employer", headers=headers_e, json={
        "company": "Rozgar Corp",
        "location": "Lalitpur"
    })
    assert put_ep.status_code == 200, f"Failed: {put_ep.text}"
    assert put_ep.json()["company"] == "Rozgar Corp"
    assert put_ep.json()["location"] == "Lalitpur"

    # 6. Verify cross-access protection (Workers cannot access Employer Profile)
    print("Testing profile access security guards...")
    assert client.get("/profiles/employer", headers=headers_w).status_code == 403
    assert client.get("/profiles/worker", headers=headers_e).status_code == 403

    # 7. File a report (Worker reports Employer)
    print("Testing report submission...")
    post_rep = client.post("/reports", headers=headers_w, json={
        "reported_id": employer_id,
        "reason": "Late payments and unsafe working environment."
    })
    assert post_rep.status_code == 201, f"Failed: {post_rep.text}"
    report_id = post_rep.json()["id"]
    assert post_rep.json()["status"] == "pending"

    # Verify self-reporting is blocked
    self_rep = client.post("/reports", headers=headers_w, json={
        "reported_id": worker_id,
        "reason": "Reporting myself."
    })
    assert self_rep.status_code == 400

    # 8. Test Admin Management: view all users
    print("Testing Admin GET /admin/users...")
    all_users = client.get("/admin/users", headers=headers_a)
    assert all_users.status_code == 200, f"Failed: {all_users.text}"
    emails = [u["email"] for u in all_users.json()]
    assert "test_worker@rozgar.com" in emails
    assert "test_employer@rozgar.com" in emails

    # 9. Test Admin Management: view all reports
    print("Testing Admin GET /admin/reports...")
    all_reports = client.get("/admin/reports", headers=headers_a)
    assert all_reports.status_code == 200, f"Failed: {all_reports.text}"
    assert len(all_reports.json()) >= 1
    assert all_reports.json()[0]["reason"] == "Late payments and unsafe working environment."

    # 10. Test Admin Management: resolve report
    print("Testing Admin PUT /admin/reports/{id} (resolve)...")
    res_rep = client.put(f"/admin/reports/{report_id}", headers=headers_a, json={
        "status": "resolved"
    })
    assert res_rep.status_code == 200, f"Failed: {res_rep.text}"
    assert res_rep.json()["status"] == "resolved"

    # 11. Test Admin Management: delete user (cascade test)
    print("Testing Admin DELETE /admin/users/{id} (cascade delete profile check)...")
    del_user = client.delete(f"/admin/users/{employer_id}", headers=headers_a)
    assert del_user.status_code == 204

    # Verify user is deleted
    db = SessionLocal()
    try:
        user_in_db = db.query(User).filter(User.id == employer_id).first()
        assert user_in_db is None, "User was not deleted from DB!"

        # Verify profile is deleted (cascade delete check)
        profile_in_db = db.query(EmployerProfile).filter(EmployerProfile.user_id == employer_id).first()
        assert profile_in_db is None, "Employer profile was not cascade-deleted from DB!"

        # Verify linked reports are deleted (cascade check)
        report_in_db = db.query(Report).filter(Report.reported_id == employer_id).first()
        assert report_in_db is None, "Linked reports were not cascade-deleted from DB!"
        
    finally:
        db.close()

    print("\nSUCCESS: All dashboard features, profile models, and admin management tests passed!")

if __name__ == "__main__":
    test_features_flow()
