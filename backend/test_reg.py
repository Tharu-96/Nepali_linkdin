import urllib.request
import json
import urllib.error

url = 'http://127.0.0.1:8000/auth/register'
data = json.dumps({
    "name": "Test User",
    "email": "testreg5@example.com",
    "password": "password123",
    "role": "worker"
}).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTPError {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
