from fastapi import WebSocket
from sqlalchemy.orm import Session
from app.models.user import User, WorkerProfile, Notification
from app.core.location import calculate_haversine_distance
import json

class ConnectionManager:
    def __init__(self):
        # Maps user_id (int) to its active WebSocket connection
        self.active_connections: dict[int, WebSocket] = {}
        # Manual visibility preference; connected users default to visible.
        self.presence_visible: dict[int, bool] = {}
        # List of active call dicts {"caller": user_id, "receiver": user_id, "start_time": datetime}
        self.active_calls = []

    async def connect(self, user_id: int, websocket: WebSocket):
        # Handshake is accepted by the route handler before calling connect()
        self.active_connections[user_id] = websocket
        self.presence_visible.setdefault(user_id, True)

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    def set_presence(self, user_id: int, is_visible: bool):
        self.presence_visible[user_id] = bool(is_visible)

    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.active_connections and self.presence_visible.get(user_id, True)

    async def send_personal_message(self, message: dict, user_id: int):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_text(json.dumps(message))
                return True
            except Exception:
                # Connection might have died
                self.disconnect(user_id)
        return False

    async def broadcast(self, message: dict):
        for user_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_text(json.dumps(message))
            except Exception:
                self.disconnect(user_id)

    async def notify_nearby_workers_of_urgent_job(self, db: Session, job_id: int, job_lat: float, job_lng: float, job_title: str):
        if job_lat is None or job_lng is None:
            return
            
        # Find all active workers
        active_worker_ids = [uid for uid, ws in self.active_connections.items()]
        if not active_worker_ids:
            return
            
        # Get profiles of these workers
        profiles = db.query(WorkerProfile).filter(
            WorkerProfile.user_id.in_(active_worker_ids),
            WorkerProfile.latitude.isnot(None),
            WorkerProfile.longitude.isnot(None)
        ).all()
        
        notifications = []
        for profile in profiles:
            dist = calculate_haversine_distance(job_lat, job_lng, profile.latitude, profile.longitude)
            if dist <= 15.0:  # Within 15 km
                notification = Notification(
                    user_id=profile.user_id,
                    title="Urgent job nearby",
                    body=f"An urgent job, '{job_title}', was posted near you.",
                    notification_type="urgent_job",
                    link=f"/jobs/{job_id}",
                    is_read=False,
                )
                db.add(notification)
                notifications.append(notification)

        if notifications:
            db.commit()
            for notification in notifications:
                db.refresh(notification)
                await self.send_personal_message({
                    "type": "notification",
                    "data": {
                        "id": notification.id,
                        "title": notification.title,
                        "body": notification.body,
                        "notification_type": notification.notification_type,
                        "link": notification.link,
                    },
                }, notification.user_id)

        for profile in profiles:
            dist = calculate_haversine_distance(job_lat, job_lng, profile.latitude, profile.longitude)
            if dist <= 15.0:  # Within 15 km
                # Send WebSocket alert
                alert = {
                    "type": "emergency_job",
                    "job_id": job_id,
                    "title": job_title,
                    "distance": round(dist, 2),
                    "message": f"Urgent job posted nearby: '{job_title}' is {round(dist, 2)} km away!"
                }
                await self.send_personal_message(alert, profile.user_id)

    # Active Call Tracking for Admin
    def add_active_call(self, caller_id: int, receiver_id: int):
        from datetime import datetime
        # Check if already exists
        for call in self.active_calls:
            if (call["caller"] == caller_id and call["receiver"] == receiver_id) or \
               (call["caller"] == receiver_id and call["receiver"] == caller_id):
                return
        self.active_calls.append({
            "caller": caller_id,
            "receiver": receiver_id,
            "start_time": datetime.utcnow()
        })

    def remove_active_call(self, user_id: int):
        self.active_calls = [
            call for call in self.active_calls
            if call["caller"] != user_id and call["receiver"] != user_id
        ]

manager = ConnectionManager()
