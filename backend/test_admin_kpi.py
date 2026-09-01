from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User

client = TestClient(app)

def test_admin_kpis():
    # Log in as admin to get token
    login_res = client.post("/auth/login", json={
        "email": "admin@rozgar.com",
        "password": "admin123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    kpi_res = client.get("/admin/stats/kpi", headers=headers)
    assert kpi_res.status_code == 200
    kpis = kpi_res.json()
    print("KPIs:", kpis)
    assert "total_users" in kpis
    assert "total_reports" in kpis
    assert "pending_reports" in kpis
    print("KPI keys verification passed!")

if __name__ == "__main__":
    test_admin_kpis()
