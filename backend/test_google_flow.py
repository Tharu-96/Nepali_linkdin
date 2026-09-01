from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, WorkerProfile, EmployerProfile

client = TestClient(app)

def test_google_flow():
    print("Testing Google login integration flow...")
    db = SessionLocal()
    try:
        # Clean up mock users
        db.query(User).filter(User.email == "new_google_user@example.com").delete()
        db.commit()
    finally:
        db.close()

    # 1. Mock callback with a new user (email does not exist)
    res = client.post("/auth/google/callback", json={"code": "mock_new_user"})
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["needs_role_selection"] is True
    assert "temp_token" in res_data
    temp_token = res_data["temp_token"]

    # 2. Complete registration as worker
    res2 = client.post("/auth/google/complete-registration", json={
        "temp_token": temp_token,
        "role": "worker"
    })
    assert res2.status_code == 200
    res2_data = res2.json()
    assert "access_token" in res2_data
    assert res2_data["role"] == "worker"

    # Verify user and profile exist in database
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "new_google_user@example.com").first()
        assert user is not None
        assert user.role == "worker"
        profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == user.id).first()
        assert profile is not None
    finally:
        db.close()

    # 3. Callback again for same user (existing user now)
    res3 = client.post("/auth/google/callback", json={"code": "mock_new_user"})
    assert res3.status_code == 200
    res3_data = res3.json()
    assert res3_data["needs_role_selection"] is False
    assert "access_token" in res3_data
    assert res3_data["role"] == "worker"

    print("Google flow tests passed successfully!")

if __name__ == "__main__":
    test_google_flow()
