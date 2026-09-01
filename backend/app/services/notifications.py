from sqlalchemy.orm import Session

from app.api.websocket import manager
from app.models.user import Notification


def create_notification(db: Session, user_id: int, title: str, body: str, notification_type: str, link: str | None = None) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        link=link,
        is_read=False,
    )
    db.add(notification)
    return notification


async def broadcast_notification(notification: Notification) -> None:
    await manager.send_personal_message(
        {
            "type": "notification",
            "data": {
                "id": notification.id,
                "title": notification.title,
                "body": notification.body,
                "notification_type": notification.notification_type,
                "link": notification.link,
            },
        },
        notification.user_id,
    )
