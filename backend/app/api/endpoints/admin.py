from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract, text
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import uuid

from app.api.deps import RoleChecker
from app.core.database import get_db
from app.models.user import User, Report, Job, Application, WorkerProfile, EmployerProfile, Message
from app.models.review import Review
from app.models.payment import Transaction
from app.schemas.user import UserResponse
from app.schemas.report import ReportResponse, ReportUpdate
from app.schemas.admin import (
    AdminWorkerResponse, AdminEmployerResponse, UserStatusUpdate,
    AdminJobResponse, KpiStats, ChartDataPoint, ChatMetadata, ChatPairStats,
    AdminUserDetailResponse, AdminUserUpdate, AdminReviewResponse, AdminApplicationResponse,
    AdminJobUpdate, AdminAuditLogResponse
)
from app.schemas.payment import AdminTransactionResponse

router = APIRouter()

# Enforce admin role for all routes in this router
admin_required = RoleChecker(["admin"])


def _safe_name(user: Optional[User], fallback: str = "Unknown") -> str:
    if not user:
        return fallback
    return user.name or user.email or fallback


def _date_range(days: int):
    today = datetime.utcnow().date()
    start_day = today - timedelta(days=days - 1)
    return [start_day + timedelta(days=i) for i in range(days)]


def _format_day(day):
    return day.strftime("%b %d")


def _daily_series(day_points, value_map):
    return [
        ChartDataPoint(
            name=_format_day(day),
            value=float(value_map.get(day, 0) or 0),
        )
        for day in day_points
    ]

@router.get("/stats/kpi", response_model=KpiStats)
def get_kpi_stats(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    total_workers = db.query(User).filter(User.role == "worker").count()
    total_employers = db.query(User).filter(User.role == "employer").count()
    total_users = db.query(User).count()
    total_reports = db.query(Report).count()
    pending_reports = db.query(Report).filter(Report.status == "pending").count()
    pending_approvals = 0
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_this_month = db.query(
        func.coalesce(func.sum(Transaction.commission_amount_npr), 0)
    ).filter(
        Transaction.status == "success",
        Transaction.initiated_at >= month_start,
    ).scalar() or 0

    return KpiStats(
        total_workers=total_workers,
        total_employers=total_employers,
        total_users=total_users,
        total_reports=total_reports,
        pending_reports=pending_reports,
        pending_approvals=pending_approvals,
        revenue_this_month=float(revenue_this_month),
    )

@router.get("/stats/charts/{chart_type}", response_model=List[ChartDataPoint])
def get_chart_data(
    chart_type: str, 
    range_str: str = Query("30d", alias="range"),
    db: Session = Depends(get_db), 
    current_admin: User = Depends(admin_required)
):
    days = 30
    if range_str == "7d": days = 7
    elif range_str == "90d": days = 90
    day_points = _date_range(days)
    start_dt = datetime.combine(day_points[0], datetime.min.time())
    end_dt = datetime.combine(day_points[-1] + timedelta(days=1), datetime.min.time())
    
    if chart_type == "user_growth":
        data = db.query(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("count"),
        ).filter(
            User.created_at >= start_dt,
            User.created_at < end_dt,
        ).group_by(func.date(User.created_at)).all()
        counts = {datetime.strptime(row.date, "%Y-%m-%d").date(): row.count for row in data}
        return _daily_series(day_points, counts)

    elif chart_type == "job_postings":
        data = db.query(
            func.date(Job.created_at).label("date"),
            func.count(Job.id).label("count"),
        ).filter(
            Job.created_at >= start_dt,
            Job.created_at < end_dt,
        ).group_by(func.date(Job.created_at)).all()
        counts = {datetime.strptime(row.date, "%Y-%m-%d").date(): row.count for row in data}
        return _daily_series(day_points, counts)

    elif chart_type == "applications":
        data = db.query(
            func.date(Application.applied_at).label("date"),
            func.count(Application.id).label("count"),
        ).filter(
            Application.applied_at >= start_dt,
            Application.applied_at < end_dt,
        ).group_by(func.date(Application.applied_at)).all()
        counts = {datetime.strptime(row.date, "%Y-%m-%d").date(): row.count for row in data}
        return _daily_series(day_points, counts)

    elif chart_type == "job_status":
        data = db.query(Job.status, func.count(Job.id)).group_by(Job.status).all()
        return [ChartDataPoint(name=d[0] or "unknown", value=d[1]) for d in data]

    elif chart_type == "revenue":
        data = db.query(
            func.date(func.coalesce(Transaction.completed_at, Transaction.initiated_at)).label("date"),
            Transaction.gateway,
            func.coalesce(func.sum(Transaction.commission_amount_npr), 0).label("total"),
        ).filter(
            Transaction.status == "success",
            func.coalesce(Transaction.completed_at, Transaction.initiated_at) >= start_dt,
            func.coalesce(Transaction.completed_at, Transaction.initiated_at) < end_dt,
        ).group_by(
            func.date(func.coalesce(Transaction.completed_at, Transaction.initiated_at)),
            Transaction.gateway,
        ).all()

        series = {day: {"esewa": 0.0, "khalti": 0.0} for day in day_points}
        for row in data:
            if not row.date:
                continue
            day = datetime.strptime(row.date, "%Y-%m-%d").date()
            gateway = (row.gateway or "").lower()
            if gateway in ("esewa", "khalti") and day in series:
                series[day][gateway] = float(row.total or 0)
        return [
            ChartDataPoint(
                name=_format_day(day),
                value=float(series[day]["esewa"] + series[day]["khalti"]),
                esewa=float(series[day]["esewa"]),
                khalti=float(series[day]["khalti"]),
            )
            for day in day_points
        ]

    elif chart_type == "active_users":
        result = []
        for day in day_points:
            next_day = day + timedelta(days=1)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = datetime.combine(next_day, datetime.min.time())
            active_ids = set()
            active_ids.update(
                uid for (uid,) in db.query(Message.sender_id)
                .filter(Message.timestamp >= day_start, Message.timestamp < day_end)
                .distinct()
                .all()
            )
            active_ids.update(
                uid for (uid,) in db.query(Message.receiver_id)
                .filter(Message.timestamp >= day_start, Message.timestamp < day_end)
                .distinct()
                .all()
            )
            active_ids.update(
                uid for (uid,) in db.query(Application.worker_id)
                .filter(Application.applied_at >= day_start, Application.applied_at < day_end)
                .distinct()
                .all()
            )
            active_ids.update(
                uid for (uid,) in db.query(Job.employer_id)
                .filter(Job.created_at >= day_start, Job.created_at < day_end)
                .distinct()
                .all()
            )
            active_ids.update(
                uid for (uid,) in db.query(Review.reviewer_id)
                .filter(Review.created_at >= day_start, Review.created_at < day_end)
                .distinct()
                .all()
            )
            result.append(ChartDataPoint(name=_format_day(day), value=float(len(active_ids))))
        return result

    return _daily_series(day_points, {})

@router.get("/users/workers", response_model=List[AdminWorkerResponse])
def get_workers(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    workers = db.query(User).filter(User.role == "worker").all()
    res = []
    for w in workers:
        app_count = db.query(Application).filter(Application.worker_id == w.id).count()
        # Compute avg overall rating from reviews table (Module 4)
        rating_rows = db.query(Review.overall_rating).filter(
            Review.reviewee_id == w.id,
            Review.is_deleted == False,
        ).all()
        avg_r = round(sum(r[0] for r in rating_rows) / len(rating_rows), 2) if rating_rows else 0.0
        res.append(AdminWorkerResponse(
            id=w.id,
            name=w.name,
            email=w.email,
            national_id_card=w.national_id_card,
            is_active=w.is_active,
            join_date=w.created_at,
            total_applications=app_count,
            avg_rating=avg_r
        ))
    return res

@router.get("/users/employers", response_model=List[AdminEmployerResponse])
def get_employers(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    employers = db.query(User).filter(User.role == "employer").all()
    res = []
    for e in employers:
        job_count = db.query(Job).filter(Job.employer_id == e.id).count()
        company = e.employer_profile.company if e.employer_profile and e.employer_profile.company else e.name
        # Compute avg overall rating from reviews table
        rating_rows = db.query(Review.overall_rating).filter(
            Review.reviewee_id == e.id,
            Review.is_deleted == False,
        ).all()
        avg_r = round(sum(r[0] for r in rating_rows) / len(rating_rows), 2) if rating_rows else 0.0
        # Real revenue paid by this employer (gross amounts of successful transactions)
        revenue_row = None
        if e.employer_profile:
            revenue_row = db.query(
                func.coalesce(func.sum(Transaction.gross_amount_npr), 0)
            ).filter(
                Transaction.employer_id == e.employer_profile.id,
                Transaction.status == "success",
            ).scalar()
        total_revenue = float(revenue_row or 0)
        res.append(AdminEmployerResponse(
            id=e.id,
            company_name=company,
            email=e.email,
            national_id_card=e.national_id_card,
            is_active=e.is_active,
            total_jobs_posted=job_count,
            total_revenue_paid=total_revenue,
            avg_rating=avg_r
        ))
    return res

@router.get("/users", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    return db.query(User).order_by(User.created_at.desc()).all()

@router.get("/users/{user_id}", response_model=AdminUserDetailResponse)
def get_user_detail(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminUserDetailResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone_number=user.phone_number,
        national_id_card=user.national_id_card,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        company=user.employer_profile.company if user.employer_profile else None,
        location=(
            user.worker_profile.location
            if user.worker_profile
            else user.employer_profile.location
            if user.employer_profile
            else None
        ),
        office_address=user.employer_profile.office_address if user.employer_profile else None,
        headline=user.worker_profile.headline if user.worker_profile else None,
        skills=user.worker_profile.skills if user.worker_profile else None,
    )

@router.put("/users/{user_id}", response_model=AdminUserDetailResponse)
def update_user_detail(
    user_id: int,
    user_update: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email_owner = db.query(User).filter(User.email == user_update.email, User.id != user_id).first()
    if email_owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user.name = user_update.name
    user.email = user_update.email
    user.phone_number = user_update.phone_number
    user.is_active = user_update.is_active

    if user.role == "employer" and user.employer_profile:
        user.employer_profile.company = user_update.company
        user.employer_profile.location = user_update.location
        user.employer_profile.office_address = user_update.office_address

    if user.role == "worker" and user.worker_profile:
        user.worker_profile.headline = user_update.headline
        user.worker_profile.skills = user_update.skills
        user.worker_profile.location = user_update.location

    db.commit()
    db.refresh(user)

    return AdminUserDetailResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone_number=user.phone_number,
        national_id_card=user.national_id_card,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        company=user.employer_profile.company if user.employer_profile else None,
        location=(
            user.worker_profile.location
            if user.worker_profile
            else user.employer_profile.location
            if user.employer_profile
            else None
        ),
        office_address=user.employer_profile.office_address if user.employer_profile else None,
        headline=user.worker_profile.headline if user.worker_profile else None,
        skills=user.worker_profile.skills if user.worker_profile else None,
    )

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(Report).filter(
        (Report.reporter_id == user_id) | (Report.reported_id == user_id)
    ).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return None

@router.put("/users/{user_id}/status")
def update_user_status(user_id: int, status_update: UserStatusUpdate, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = status_update.is_active
    db.commit()
    return {"message": "Status updated"}

@router.get("/jobs", response_model=List[AdminJobResponse])
def get_all_jobs(status: Optional[str] = None, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    jobs = query.all()
    res = []
    for j in jobs:
        company = (
            j.employer.employer_profile.company
            if j.employer and j.employer.employer_profile and j.employer.employer_profile.company
            else j.employer.name
            if j.employer
            else "Unknown"
        )
        res.append(AdminJobResponse(
            id=j.id,
            title=j.title,
            description=j.description,
            location=j.location,
            salary=j.salary,
            required_skills=j.required_skills,
            employer_id=j.employer_id,
            employer_name=j.employer.name if j.employer else "Unknown",
            is_urgent=bool(j.is_urgent),
            status=j.status,
            created_at=j.created_at
        ))
    return res

@router.put("/jobs/{job_id}", response_model=AdminJobResponse)
def update_job(
    job_id: int,
    job_update: AdminJobUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    payload = job_update.dict(exclude_unset=True)
    for field in ("title", "description", "location", "salary", "required_skills", "is_urgent", "status"):
        if field in payload:
            setattr(job, field, payload[field])

    db.commit()
    db.refresh(job)
    return AdminJobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        location=job.location,
        salary=job.salary,
        required_skills=job.required_skills,
        employer_id=job.employer_id,
        employer_name=job.employer.name if job.employer else "Unknown",
        is_urgent=bool(job.is_urgent),
        status=job.status,
        created_at=job.created_at,
    )

@router.delete("/jobs/{job_id}", status_code=status.HTTP_200_OK)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}

@router.get("/applications", response_model=List[AdminApplicationResponse])
def get_all_applications(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    query = db.query(Application)
    if status:
        query = query.filter(Application.status == status)
    applications = query.order_by(Application.applied_at.desc()).all()

    results = []
    for app in applications:
        job = app.job
        employer = job.employer if job else None
        results.append(
            AdminApplicationResponse(
                id=app.id,
                job_id=app.job_id,
                job_title=job.title if job else None,
                worker_id=app.worker_id,
                worker_name=app.worker.name if app.worker else None,
                employer_id=employer.id if employer else None,
                employer_name=employer.name if employer else None,
                status=app.status,
                applied_at=app.applied_at,
            )
        )
    return results

@router.get("/reports", response_model=List[ReportResponse])
def get_all_reports(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    return db.query(Report).all()

@router.get("/reviews", response_model=List[AdminReviewResponse])
def get_all_reviews(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    reviews = db.query(Review).filter(
        Review.is_deleted.is_(False)
    ).order_by(Review.created_at.desc()).all()
    return [
        AdminReviewResponse(
            id=review.id,
            job_id=review.job_id,
            job_title=review.job.title if review.job else None,
            reviewer_id=review.reviewer_id,
            reviewer_name=review.reviewer.name if review.reviewer else None,
            reviewee_id=review.reviewee_id,
            reviewee_name=review.reviewee.name if review.reviewee else None,
            reviewer_role=review.reviewer_role,
            overall_rating=review.overall_rating,
            punctuality=review.punctuality,
            work_quality=review.work_quality,
            communication=review.communication,
            attitude=review.attitude,
            payment_timeliness=review.payment_timeliness,
            work_environment=review.work_environment,
            fairness=review.fairness,
            written_feedback=review.written_feedback,
            is_anonymous=review.is_anonymous,
            is_flagged=review.is_flagged,
            is_deleted=review.is_deleted,
            created_at=review.created_at,
        )
        for review in reviews
    ]


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    """Admin moderation control: hide a review without destroying audit data."""
    review = db.query(Review).filter(
        Review.id == review_id,
        Review.is_deleted.is_(False),
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found or already deleted")

    review.is_deleted = True
    db.commit()
    return None

@router.put("/reports/{id}/resolve", response_model=ReportResponse)
def resolve_report(id: int, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = "resolved"
    db.commit()
    db.refresh(report)
    return report

@router.put("/reports/{id}", response_model=ReportResponse)
def update_report(id: int, report_update: ReportUpdate, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = report_update.status
    db.commit()
    db.refresh(report)
    return report

@router.get("/chat/metadata", response_model=ChatMetadata)
def get_chat_metadata(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    total_convos = db.query(Message.sender_id, Message.receiver_id).distinct().count()
    
    # most active
    active = db.query(
        Message.sender_id, 
        Message.receiver_id, 
        func.count(Message.id).label('c')
    ).group_by(Message.sender_id, Message.receiver_id).order_by(text("c DESC")).limit(10).all()
    
    pairs = [ChatPairStats(sender_id=a[0], receiver_id=a[1], message_count=a[2]) for a in active]
    
    return ChatMetadata(
        total_conversations=total_convos,
        messages_per_day=[], # would group by date
        most_active_pairs=pairs
    )


@router.get("/transactions", response_model=List[AdminTransactionResponse])
def get_all_transactions(
    status: Optional[str] = None,
    gateway: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    """Admin — list all payment transactions with enriched employer/worker/job info."""
    query = db.query(Transaction)
    if status:
        query = query.filter(Transaction.status == status)
    if gateway:
        query = query.filter(Transaction.gateway == gateway)
    txs = query.order_by(Transaction.initiated_at.desc()).all()

    results = []
    for tx in txs:
        job = db.query(Job).filter(Job.id == tx.job_id).first()
        employer_profile = db.query(EmployerProfile).filter(
            EmployerProfile.id == tx.employer_id
        ).first()
        employer_user = (
            db.query(User).filter(User.id == employer_profile.user_id).first()
            if employer_profile else None
        )
        worker_profile = db.query(WorkerProfile).filter(
            WorkerProfile.id == tx.worker_id
        ).first()
        worker_user = (
            db.query(User).filter(User.id == worker_profile.user_id).first()
            if worker_profile else None
        )
        results.append(AdminTransactionResponse(
            id=tx.id,
            job_id=tx.job_id,
            job_title=job.title if job else None,
            employer_name=employer_user.name if employer_user else "Unknown",
            worker_name=worker_user.name if worker_user else "Unknown",
            gross_amount_npr=float(tx.gross_amount_npr),
            commission_amount_npr=float(tx.commission_amount_npr),
            net_amount_npr=float(tx.net_amount_npr),
            gateway=tx.gateway,
            status=tx.status,
            worker_payment_number=tx.worker_payment_number,
            initiated_at=tx.initiated_at,
            completed_at=tx.completed_at,
        ))
    return results


@router.put("/transactions/{transaction_id}/cancel")
def cancel_pending_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(admin_required),
):
    """Admin safety control: close an unverified checkout only."""
    try:
        tx_uuid = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid transaction reference")

    tx = db.query(Transaction).filter(Transaction.id == tx_uuid).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status != "pending":
        raise HTTPException(status_code=409, detail=f"Only pending payments can be cancelled; this payment is {tx.status}")

    tx.status = "cancelled"
    tx.raw_response = {"status": "cancelled", "cancelled_by": "admin", "cancelled_at": datetime.utcnow().isoformat(), "admin_id": current_admin.id}
    db.commit()
    return {"message": "Pending payment cancelled", "status": tx.status}


@router.get("/audit-logs", response_model=List[AdminAuditLogResponse])
def get_audit_logs(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    logs: List[AdminAuditLogResponse] = []

    users = db.query(User).filter(User.role.in_(["worker", "employer"])).all()
    for user in users:
        logs.append(
            AdminAuditLogResponse(
                id=f"user-{user.id}-{int(user.created_at.timestamp()) if user.created_at else user.id}",
                actor_id=user.id,
                actor_name=_safe_name(user),
                actor_role=user.role,
                action="Registered account",
                entity_type="User",
                entity_label=f"{user.role.title()} profile",
                details=user.email,
                created_at=user.created_at,
            )
        )

    jobs = db.query(Job).all()
    for job in jobs:
        employer = job.employer
        logs.append(
            AdminAuditLogResponse(
                id=f"job-{job.id}",
                actor_id=employer.id if employer else None,
                actor_name=_safe_name(employer),
                actor_role="employer",
                action="Posted job",
                entity_type="Job",
                entity_label=job.title,
                details=f"Priority: {'Urgent' if job.is_urgent else 'Normal'}",
                created_at=job.created_at,
            )
        )

    applications = db.query(Application).all()
    for application in applications:
        worker = application.worker
        job = application.job
        logs.append(
            AdminAuditLogResponse(
                id=f"application-{application.id}",
                actor_id=worker.id if worker else None,
                actor_name=_safe_name(worker),
                actor_role="worker",
                action="Submitted application",
                entity_type="Application",
                entity_label=job.title if job else f"Job #{application.job_id}",
                details=f"Application status: {application.status.title()}",
                created_at=application.applied_at,
            )
        )

    reviews = db.query(Review).filter(Review.is_deleted == False).all()
    for review in reviews:
        reviewer = review.reviewer
        reviewee = review.reviewee
        logs.append(
            AdminAuditLogResponse(
                id=f"review-{review.id}",
                actor_id=reviewer.id if reviewer else None,
                actor_name=_safe_name(reviewer),
                actor_role=review.reviewer_role,
                action="Submitted review",
                entity_type="Review",
                entity_label=review.job.title if review.job else f"Job #{review.job_id}",
                details=f"Rated {_safe_name(reviewee)} {review.overall_rating}/5",
                created_at=review.created_at,
            )
        )

    transactions = db.query(Transaction).all()
    for tx in transactions:
        employer_profile = db.query(EmployerProfile).filter(EmployerProfile.id == tx.employer_id).first()
        employer_user = db.query(User).filter(User.id == employer_profile.user_id).first() if employer_profile else None
        worker_profile = db.query(WorkerProfile).filter(WorkerProfile.id == tx.worker_id).first()
        worker_user = db.query(User).filter(User.id == worker_profile.user_id).first() if worker_profile else None
        job = db.query(Job).filter(Job.id == tx.job_id).first()
        timestamp = tx.completed_at or tx.initiated_at or tx.created_at

        logs.append(
            AdminAuditLogResponse(
                id=f"transaction-{tx.id}",
                actor_id=employer_user.id if employer_user else None,
                actor_name=_safe_name(employer_user),
                actor_role="employer",
                action="Processed payment",
                entity_type="Transaction",
                entity_label=job.title if job else f"Job #{tx.job_id}",
                details=f"{tx.gateway.title()} {tx.status.title()} - NPR {float(tx.gross_amount_npr or 0):,.0f} to {_safe_name(worker_user)}",
                created_at=timestamp,
            )
        )

    reports = db.query(Report).all()
    for report in reports:
        reporter = report.reporter
        reported = report.reported
        if reporter and reporter.role in ("worker", "employer"):
            logs.append(
                AdminAuditLogResponse(
                    id=f"report-{report.id}",
                    actor_id=reporter.id,
                    actor_name=_safe_name(reporter),
                    actor_role=reporter.role,
                    action="Submitted report",
                    entity_type="Report",
                    entity_label=f"Against {_safe_name(reported)}",
                    details=f"Status: {report.status.title()}",
                    created_at=report.created_at,
                )
            )

    logs.sort(key=lambda item: item.created_at, reverse=True)
    return logs
