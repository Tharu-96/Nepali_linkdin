from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, WorkerProfile, EmployerProfile, Job, Application, Message, Report

client = TestClient(app)

def test_flow():
    print("Starting integration test for all features...")
    
    # 1. Database Cleanup
    db = SessionLocal()
    try:
        db.query(Report).delete()
        db.query(Message).delete()
        db.query(Application).delete()
        db.query(Job).delete()
        db.query(WorkerProfile).delete()
        db.query(EmployerProfile).delete()
        db.query(User).filter(User.email.in_([
            "worker_a@rozgar.com", "worker_b@rozgar.com", "employer_a@rozgar.com"
        ])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    # Ensure admin user exists for admin-related checks
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@rozgar.com").first()
        if not admin:
            db.add(User(
                name="Admin User",
                email="admin@rozgar.com",
                password=hash_password("admin123"),
                role="admin",
            ))
            db.commit()
    finally:
        db.close()

    # 2. Register users
    print("Registering users...")
    # Worker A (Kathmandu: 27.7172, 85.3240)
    w_a = client.post("/auth/register", json={
        "name": "Worker A", "email": "worker_a@rozgar.com", "phone_number": "9800000008", "national_id_card": "NID0000008", "password": "password123", "role": "worker"
    }).json()
    # Worker B (Pokhara: 28.2096, 83.9856)
    w_b = client.post("/auth/register", json={
        "name": "Worker B", "email": "worker_b@rozgar.com", "phone_number": "9800000009", "national_id_card": "NID0000009", "password": "password123", "role": "worker"
    }).json()
    # Employer A
    emp_a = client.post("/auth/register", json={
        "name": "Employer A", "email": "employer_a@rozgar.com", "phone_number": "9800000010", "national_id_card": "NID0000010", "password": "password123", "role": "employer"
    }).json()

    # Login to get tokens
    tok_wa = client.post("/auth/login", json={"email": "worker_a@rozgar.com", "password": "password123"}).json()["access_token"]
    tok_wb = client.post("/auth/login", json={"email": "worker_b@rozgar.com", "password": "password123"}).json()["access_token"]
    tok_emp = client.post("/auth/login", json={"email": "employer_a@rozgar.com", "password": "password123"}).json()["access_token"]
    tok_admin = client.post("/auth/login", json={"email": "admin@rozgar.com", "password": "admin123"}).json()["access_token"]

    headers_wa = {"Authorization": f"Bearer {tok_wa}"}
    headers_wb = {"Authorization": f"Bearer {tok_wb}"}
    headers_emp = {"Authorization": f"Bearer {tok_emp}"}
    headers_admin = {"Authorization": f"Bearer {tok_admin}"}

    # 3. Setup Worker Profiles with GPS coordinates
    print("Setting up worker profiles with coordinates...")
    client.put("/profiles/worker", headers=headers_wa, json={"skills": "Masonry", "location": "Kathmandu", "latitude": 27.7172, "longitude": 85.3240})
    client.put("/profiles/worker", headers=headers_wb, json={"skills": "Carpentry", "location": "Pokhara", "latitude": 28.2096, "longitude": 83.9856})

    # 4. Employer creates 3 jobs (some urgent, different locations)
    print("Creating jobs...")
    # Job A in Kathmandu (urgent)
    job_a = client.post("/jobs", headers=headers_emp, json={
        "title": "Urgent Construction", "description": "Need builder immediately", "location": "Kathmandu", "salary": "Rs 1500/day", "is_urgent": True, "latitude": 27.7172, "longitude": 85.3240
    }).json()
    # Job B in Lalitpur (5km from Kathmandu, not urgent)
    job_b = client.post("/jobs", headers=headers_emp, json={
        "title": "Carpentry Project", "description": "Need woodworker", "location": "Lalitpur", "salary": "Rs 1200/day", "is_urgent": False, "latitude": 27.6744, "longitude": 85.3123
    }).json()
    # Job C in Pokhara (140km from Kathmandu, urgent)
    job_c = client.post("/jobs", headers=headers_emp, json={
        "title": "Kitchen Help", "description": "Urgent kitchen cleaner", "location": "Pokhara", "salary": "Rs 1000/day", "is_urgent": True, "latitude": 28.2096, "longitude": 83.9856
    }).json()

    # 5. Verify Priority Ranking (Get all jobs shows URGENT jobs first)
    print("Verifying priority ranking...")
    all_jobs = client.get("/jobs", headers=headers_wa).json()
    assert all_jobs[0]["is_urgent"] == True
    assert all_jobs[1]["is_urgent"] == True
    assert all_jobs[2]["is_urgent"] == False

    # 6. Verify Proximity sorting (from Kathmandu)
    print("Verifying proximity sorting from Kathmandu...")
    nearby_ktm = client.get("/jobs/nearby?lat=27.7172&lng=85.3240", headers=headers_wa).json()
    # Nearest should be Job A (0 km), then Job B (~5 km), then Job C (~140 km)
    assert nearby_ktm[0]["id"] == job_a["id"]
    assert nearby_ktm[1]["id"] == job_b["id"]
    assert nearby_ktm[2]["id"] == job_c["id"]
    assert nearby_ktm[0]["distance"] == 0.0
    assert nearby_ktm[1]["distance"] < 10.0

    # 7. Verify Emergency Endpoint
    print("Verifying emergency endpoint...")
    emergency_ktm = client.get("/jobs/emergency?lat=27.7172&lng=85.3240", headers=headers_wa).json()
    # Should only return urgent jobs: Job A and Job C, sorted by distance from KTM (Job A first, then Job C)
    assert len(emergency_ktm) == 2
    assert emergency_ktm[0]["id"] == job_a["id"]
    assert emergency_ktm[1]["id"] == job_c["id"]
    for j in emergency_ktm:
        assert j["is_urgent"] == True

    # 8. Job Application Workflow
    print("Testing applications...")
    apply_wa = client.post(f"/jobs/{job_a['id']}/apply", headers=headers_wa).json()
    assert apply_wa["status"] == "pending"

    # Worker B tries to apply
    apply_wb = client.post(f"/jobs/{job_a['id']}/apply", headers=headers_wb).json()
    assert apply_wb["status"] == "pending"

    # Try applying again (should fail)
    fail_apply = client.post(f"/jobs/{job_a['id']}/apply", headers=headers_wa)
    assert fail_apply.status_code == 400

    # Employer updates status (Accept WA, Reject WB)
    app_id_wa = apply_wa["id"]
    app_id_wb = apply_wb["id"]
    accept_wa = client.put(f"/applications/{app_id_wa}/status", headers=headers_emp, json={"status": "accepted"}).json()
    assert accept_wa["status"] == "accepted"
    reject_wb = client.put(f"/applications/{app_id_wb}/status", headers=headers_emp, json={"status": "rejected"}).json()
    assert reject_wb["status"] == "rejected"

    # 9. Verify auto-chat on acceptance (no manual DB insert needed)
    print("Testing auto-chat on application acceptance...")
    assert client.get("/chat/unread-count", headers=headers_wa).json()["unread_count"] == 1

    conversations = client.get("/chat/conversations", headers=headers_wa).json()
    assert len(conversations) == 1
    assert conversations[0]["user_id"] == emp_a["id"]
    assert "accepted your application" in conversations[0]["last_message"]
    assert conversations[0]["unread_count"] == 1

    history = client.get(f"/chat/history/{emp_a['id']}", headers=headers_wa).json()
    assert len(history) == 2
    assert "applied to your job" in history[0]["content"]
    assert "accepted your application" in history[1]["content"]

    # Employer completes WA
    complete_wa = client.put(f"/applications/{app_id_wa}/status", headers=headers_emp, json={"status": "completed"}).json()
    assert complete_wa["status"] == "completed"

    # Verify unread is 0 after reading history
    assert client.get("/chat/unread-count", headers=headers_wa).json()["unread_count"] == 0

    # 10. Call Placeholder
    print("Testing call placeholder...")
    call_res = client.post("/calls/initiate", headers=headers_wa, json={"receiver_id": emp_a["id"]}).json()
    assert "token" in call_res
    assert call_res["status"] == "connected"

    # 11. Chatbot
    print("Testing chatbot responses...")
    bot_a = client.post("/chatbot", json={"message": "I want to search for jobs"}, headers=headers_wa).json()
    assert "reply" in bot_a and len(bot_a["reply"]) > 10
    bot_b = client.post("/chatbot", json={"message": "How do I post a job?"}, headers=headers_wa).json()
    assert "reply" in bot_b and len(bot_b["reply"]) > 10
    bot_c = client.post("/chatbot", json={"message": "What is the fee?"}, headers=headers_wa).json()
    assert "reply" in bot_c and len(bot_c["reply"]) > 10
    bot_d = client.post("/chatbot", json={"message": "hi!"}, headers=headers_wa).json()
    assert "reply" in bot_d and len(bot_d["reply"]) > 5

    print("\nSUCCESS: All backend tests passed successfully!")

if __name__ == "__main__":
    test_flow()
