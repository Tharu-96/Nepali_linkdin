from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, Message

client = TestClient(app)


def test_send_message_via_http_endpoint():
    db = SessionLocal()
    try:
        db.query(Message).filter(Message.content == "hello via http").delete(synchronize_session=False)
        db.query(User).filter(User.email.in_(["chat-sender@example.com", "chat-recipient@example.com"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    sender = client.post(
        "/auth/register",
        json={
            "name": "Sender",
            "email": "chat-sender@example.com",
            "phone_number": "9800000004",
            "national_id_card": "NID0000004",
            "password": "sender123",
            "role": "worker",
        },
    )
    recipient = client.post(
        "/auth/register",
        json={
            "name": "Recipient",
            "email": "chat-recipient@example.com",
            "phone_number": "9800000005",
            "national_id_card": "NID0000005",
            "password": "recipient123",
            "role": "employer",
        },
    )
    assert sender.status_code == 201, sender.text
    assert recipient.status_code == 201, recipient.text
    sender_id = sender.json()["id"]
    recipient_id = recipient.json()["id"]

    sender_login = client.post(
        "/auth/login",
        json={"email": "chat-sender@example.com", "password": "sender123"},
    )
    assert sender_login.status_code == 200, sender_login.text
    token = sender_login.json()["access_token"]

    resp = client.post(
        "/chat/messages",
        json={"receiver_id": recipient_id, "content": "hello via http"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["content"] == "hello via http"
