from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User

client = TestClient(app)

def test_flow():
    print("Starting integration test flows...")
    
    # Clean up test accounts if they exist from previous runs
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.in_(["worker@rozgar.com", "employer@rozgar.com", "fakeadmin@rozgar.com"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    # 1. Test registration of worker
    print("Testing registration of worker...")
    reg_worker = client.post("/auth/register", json={
        "name": "John Worker",
        "email": "worker@rozgar.com",
        "phone_number": "9800000001",
        "national_id_card": "NID0000001",
        "password": "workerpassword",
        "role": "worker"
    })
    assert reg_worker.status_code == 201, f"Failed: {reg_worker.text}"
    assert reg_worker.json()["role"] == "worker"
    assert reg_worker.json()["email"] == "worker@rozgar.com"
    
    # 2. Test registration of employer
    print("Testing registration of employer...")
    reg_employer = client.post("/auth/register", json={
        "name": "Jane Employer",
        "email": "employer@rozgar.com",
        "phone_number": "9800000002",
        "national_id_card": "NID0000002",
        "password": "employerpassword",
        "role": "employer"
    })
    assert reg_employer.status_code == 201, f"Failed: {reg_employer.text}"
    assert reg_employer.json()["role"] == "employer"
    
    # 3. Test registration of admin is rejected (blocked by Schema Literal validator)
    print("Testing that admin registration is rejected...")
    reg_admin = client.post("/auth/register", json={
        "name": "Fake Admin",
        "email": "fakeadmin@rozgar.com",
        "phone_number": "9800000003",
        "national_id_card": "NID0000003",
        "password": "adminpassword",
        "role": "admin"
    })
    assert reg_admin.status_code == 422, f"Failed: Registration of admin should return validation error, got {reg_admin.status_code}"
    
    # 4. Test login of worker
    print("Testing login of worker...")
    login_worker = client.post("/auth/login", json={
        "email": "worker@rozgar.com",
        "password": "workerpassword"
    })
    assert login_worker.status_code == 200, f"Failed: {login_worker.text}"
    worker_token = login_worker.json()["access_token"]
    assert login_worker.json()["role"] == "worker"
    
    # 5. Test login of employer
    print("Testing login of employer...")
    login_employer = client.post("/auth/login", json={
        "email": "employer@rozgar.com",
        "password": "employerpassword"
    })
    assert login_employer.status_code == 200, f"Failed: {login_employer.text}"
    employer_token = login_employer.json()["access_token"]
    assert login_employer.json()["role"] == "employer"
    
    # 6. Test login of admin (seeded previously)
    print("Testing login of admin...")
    login_admin = client.post("/auth/login", json={
        "email": "admin@rozgar.com",
        "password": "admin123"
    })
    assert login_admin.status_code == 200, f"Failed: {login_admin.text}"
    admin_token = login_admin.json()["access_token"]
    assert login_admin.json()["role"] == "admin"
    
    # 7. Test /users/me endpoint
    print("Testing /users/me route...")
    headers_worker = {"Authorization": f"Bearer {worker_token}"}
    me_worker = client.get("/users/me", headers=headers_worker)
    assert me_worker.status_code == 200
    assert me_worker.json()["email"] == "worker@rozgar.com"
    
    # 8. Test role-protected routes
    print("Testing role checks on endpoints...")
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_employer = {"Authorization": f"Bearer {employer_token}"}
    
    # Worker-only route
    assert client.get("/users/worker-only", headers=headers_worker).status_code == 200
    assert client.get("/users/worker-only", headers=headers_admin).status_code == 403
    assert client.get("/users/worker-only", headers=headers_employer).status_code == 403
    
    # Employer-only route
    assert client.get("/users/employer-only", headers=headers_employer).status_code == 200
    assert client.get("/users/employer-only", headers=headers_worker).status_code == 403
    assert client.get("/users/employer-only", headers=headers_admin).status_code == 403
    
    # Admin-only route
    assert client.get("/users/admin-only", headers=headers_admin).status_code == 200
    assert client.get("/users/admin-only", headers=headers_worker).status_code == 403
    assert client.get("/users/admin-only", headers=headers_employer).status_code == 403
    
    # Invalid token route
    assert client.get("/users/me", headers={"Authorization": "Bearer invalidtoken"}).status_code == 401
    
    print("\nSUCCESS: All integration tests passed! Auth logic is solid.")

if __name__ == "__main__":
    test_flow()
