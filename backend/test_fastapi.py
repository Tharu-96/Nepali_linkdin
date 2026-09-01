from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response = client.post(
    "/auth/register",
    json={"name": "Test User", "email": "testreg6@example.com", "password": "password123", "role": "worker"}
)

print(response.status_code)
print(response.text)
if response.status_code == 500:
    import traceback
    try:
        response.raise_for_status()
    except BaseException as e:
        print("Exception occurred inside TestClient:")
        traceback.print_exc()
