from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.api.deps import get_current_user, RoleChecker
from app.core.database import get_db
from app.models.user import User, Application, Job, Message
from app.api.websocket import manager
from app.services.notifications import create_notification, broadcast_notification
from app.schemas.application import ApplicationResponse, ApplicationUpdate

router = APIRouter()

worker_required = RoleChecker(["worker"])
employer_required = RoleChecker(["employer"])

@router.get("/my-applications", response_model=List[ApplicationResponse])
def get_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(worker_required)
):
    return db.query(Application).filter(Application.worker_id == current_user.id).all()

async def notify_new_chat(sender_id: int, receiver_id: int, db_msg: Message):
    outbound_data = {
        "type": "message",
        "data": {
            "id": db_msg.id,
            "sender_id": db_msg.sender_id,
            "receiver_id": db_msg.receiver_id,
            "content": db_msg.content,
            "timestamp": db_msg.timestamp.isoformat(),
            "is_read": db_msg.is_read
        }
    }
    await manager.send_personal_message(outbound_data, receiver_id)
    await manager.send_personal_message(outbound_data, sender_id)

@router.put("/{application_id}/status", response_model=ApplicationResponse)
def update_application_status(
    application_id: int,
    app_update: ApplicationUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(employer_required)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
        
    # Verify the current user is the employer who posted this job
    job = db.query(Job).filter(Job.id == application.job_id, Job.employer_id == current_user.id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this application"
        )
        
  # If the application is being accepted, auto-initiate a chat!
    db_msg = None
    platform_notification = None
    unavailable_notifications = []
    if app_update.status == "accepted" and application.status != "accepted":
        other_accepted = db.query(Application).filter(
            Application.job_id == job.id,
            Application.status.in_(["accepted", "completed"]),
            Application.id != application.id,
        ).first()
        if other_accepted:
            raise HTTPException(status_code=409, detail="This job already has an accepted worker")
        if job.status not in ["open", "in_progress"]:
            raise HTTPException(status_code=400, detail=f"Cannot accept a worker for a '{job.status}' job")
        job.status = "in_progress"

        # A Rozgar job has one vacancy. Close every other pending application
        # immediately and persist an explicit notification for each worker.
        pending_applications = db.query(Application).filter(
            Application.job_id == job.id,
            Application.status == "pending",
            Application.id != application.id,
        ).all()
        for pending_application in pending_applications:
            pending_application.status = "rejected"
            unavailable_notifications.append(create_notification(
                db,
                pending_application.worker_id,
                "Job no longer available",
                f"'{job.title}' is no longer available because another worker was selected.",
                "application",
                "/jobs?tab=applications",
            ))
        db_msg = Message(
            sender_id=current_user.id,
            receiver_id=application.worker_id,
            content=f"Hello! I have accepted your application for the position: '{job.title}'. Let's discuss the details.",
            timestamp=datetime.utcnow(),
            is_read=False
        )
        db.add(db_msg)
        platform_notification = create_notification(
            db, application.worker_id, "Application accepted",
            f"Your application for '{job.title}' was accepted.", "application", "/jobs?tab=applications"
        )
    elif app_update.status == "rejected" and application.status != "rejected":
        db_msg = Message(
            sender_id=current_user.id,
            receiver_id=application.worker_id,
            content=f"Your application for '{job.title}' was rejected.",
            timestamp=datetime.utcnow(),
            is_read=False
        )
        db.add(db_msg)
        platform_notification = create_notification(
            db, application.worker_id, "Application update",
            f"Your application for '{job.title}' was rejected.", "application", "/jobs?tab=applications"
        )

    application.status = app_update.status
    db.commit()
    db.refresh(application)

    if db_msg:
        db.refresh(db_msg)
        background_tasks.add_task(notify_new_chat, current_user.id, application.worker_id, db_msg)
    if platform_notification:
        db.refresh(platform_notification)
        background_tasks.add_task(broadcast_notification, platform_notification)
    for notification in unavailable_notifications:
        db.refresh(notification)
        background_tasks.add_task(broadcast_notification, notification)

    return application


@router.delete("/{application_id}", status_code=status.HTTP_200_OK)
def cancel_application(
    application_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(worker_required)
):
    application = db.query(Application).filter(
        Application.id == application_id,
        Application.worker_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending applications can be cancelled"
        )

    job = db.query(Job).filter(Job.id == application.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    db_msg = Message(
        sender_id=current_user.id,
        receiver_id=job.employer_id,
        content=f"{current_user.name} cancelled the application for your job '{job.title}'.",
        timestamp=datetime.utcnow(),
        is_read=False
    )
    db.add(db_msg)
    platform_notification = create_notification(
        db, job.employer_id, "Application cancelled",
        f"{current_user.name} cancelled their application for '{job.title}'.", "application", f"/jobs/{job.id}/applications"
    )
    db.delete(application)
    db.commit()
    db.refresh(db_msg)
    db.refresh(platform_notification)

    background_tasks.add_task(notify_new_chat, current_user.id, job.employer_id, db_msg)
    background_tasks.add_task(broadcast_notification, platform_notification)

    return {"message": "Application cancelled successfully"}
