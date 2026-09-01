from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.api.deps import get_current_user, RoleChecker
from app.core.database import get_db
from app.models.user import User, Job, Application
from app.models.review import Review
from app.api.websocket import manager
from app.services.notifications import create_notification, broadcast_notification
from app.schemas.review import (
    ReviewCreate, ReviewResponse, ReviewSummary, PaginatedReviews
)

router = APIRouter()

admin_required = RoleChecker(["admin"])


async def _broadcast_worker_rated(reviewee_id: int, reviewer_id: int, rating: int, job_id: int):
    """Push a real-time `worker_rated` event to the person being reviewed so the celebratory toast fires instantly.
    """
    event = {
        "type": "worker_rated",
        "rating": rating,
        "job_id": job_id,
        "reviewee_id": reviewee_id,
        "reviewer_id": reviewer_id,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.send_personal_message(event, reviewee_id)


def _safe_avg(total: float, count: int) -> Optional[float]:
    """Return rounded average or None when no data."""
    if count == 0:
        return None
    return round(total / count, 2)


def _build_review_response(review: Review) -> ReviewResponse:
    """Build ReviewResponse, hiding reviewer name when anonymous."""
    data = ReviewResponse.from_orm(review)
    if review.is_anonymous:
        data.reviewer_name = "Anonymous"
    else:
        data.reviewer_name = review.reviewer.name if review.reviewer else "Unknown"
    data.reviewer_role_label = "Employer" if review.reviewer_role == "employer" else "Worker"
    data.reviewee_name = review.reviewee.name if review.reviewee else "Unknown"
    return data


# ──────────────────────────────────────────────────────────────────────────────
# POST /reviews/
# Submit a review — job must be completed, no duplicate (UNIQUE constraint)
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def submit_review(
    payload: ReviewCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Only employers can review workers.
    if current_user.role != "employer":
        raise HTTPException(status_code=403, detail="Only employers can review workers")
    if payload.reviewer_role != "employer":
        raise HTTPException(
            status_code=400,
            detail="reviewer_role must be 'employer'"
        )

    # 2. The job must exist
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 3. Reviews unlock only after the work is completed.
    accepted_application = db.query(Application).filter(
        Application.job_id == payload.job_id,
        Application.status.in_(["accepted", "completed"]),
    ).first()
    work_completed = job.status == "completed" or (
        accepted_application is not None and accepted_application.status == "completed"
    )
    if not work_completed:
        raise HTTPException(
            status_code=400,
            detail="Reviews are only available after the work is completed"
        )

    # 4. Reviewee must exist and cannot be yourself
    reviewee = db.query(User).filter(User.id == payload.reviewee_id).first()
    if not reviewee:
        raise HTTPException(status_code=404, detail="Reviewee not found")
    if payload.reviewee_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot review yourself")

    # 5. Verify the current user and reviewee were actually paired on this job.
    if not accepted_application:
        raise HTTPException(status_code=400, detail="No accepted worker found for this job")

    if job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the employer of this job")
    if reviewee.role != "worker" or accepted_application.worker_id != payload.reviewee_id:
        raise HTTPException(status_code=400, detail="You can only review the accepted worker for this job")

    # 6. Check for duplicate (also enforced at DB level by UNIQUE constraint)
    existing = db.query(Review).filter(
        Review.job_id == payload.job_id,
        Review.reviewer_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted a review for this job"
        )

    # 7. Create the review
    review = Review(
        job_id=payload.job_id,
        reviewer_id=current_user.id,
        reviewee_id=payload.reviewee_id,
        reviewer_role=payload.reviewer_role,
        overall_rating=payload.overall_rating,
        punctuality=payload.punctuality,
        work_quality=payload.work_quality,
        communication=payload.communication,
        attitude=payload.attitude,
        payment_timeliness=payload.payment_timeliness,
        work_environment=payload.work_environment,
        fairness=payload.fairness,
        written_feedback=payload.written_feedback,
        is_anonymous=payload.is_anonymous,
    )
    db.add(review)
    platform_notification = create_notification(
        db,
        payload.reviewee_id,
        "New review received",
        f"{current_user.name} gave you a {payload.overall_rating}/5 review for '{job.title}'.",
        "review",
        "/reviews",
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You have already submitted a review for this job"
        )
    db.refresh(review)
    db.refresh(platform_notification)

    # Fire the real-time rating event to the reviewee (non-blocking).
    background_tasks.add_task(
        _broadcast_worker_rated,
        review.reviewee_id,
        review.reviewer_id,
        review.overall_rating,
        review.job_id,
    )
    background_tasks.add_task(broadcast_notification, platform_notification)
    return _build_review_response(review)


# ──────────────────────────────────────────────────────────────────────────────
# GET /reviews/user/{user_id}
# Get all non-deleted reviews for a user (paginated, newest first)
# Anonymous reviews hide the reviewer's name
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/user/{user_id}", response_model=PaginatedReviews)
def get_user_reviews(
    user_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = db.query(Review).filter(
        Review.reviewee_id == user_id,
        Review.is_deleted == False,
    )

    total = base_query.count()
    reviews = (
        base_query
        .order_by(Review.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return PaginatedReviews(
        total=total,
        page=page,
        per_page=per_page,
        reviews=[_build_review_response(r) for r in reviews],
    )


@router.get("/me/submitted", response_model=PaginatedReviews)
def get_my_submitted_reviews(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = db.query(Review).filter(
        Review.reviewer_id == current_user.id,
        Review.is_deleted == False,
    )

    total = base_query.count()
    reviews = (
        base_query
        .order_by(Review.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return PaginatedReviews(
        total=total,
        page=page,
        per_page=per_page,
        reviews=[_build_review_response(r) for r in reviews],
    )


# ──────────────────────────────────────────────────────────────────────────────
# GET /reviews/summary/{user_id}
# Aggregated avg ratings per category + total count for a user
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/summary/{user_id}", response_model=ReviewSummary)
def get_review_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reviews = db.query(Review).filter(
        Review.reviewee_id == user_id,
        Review.is_deleted == False,
    ).all()

    if not reviews:
        return ReviewSummary(user_id=user_id, total_reviews=0)

    total = len(reviews)

    def avg_field(field_name: str) -> Optional[float]:
        vals = [getattr(r, field_name) for r in reviews if getattr(r, field_name) is not None]
        return _safe_avg(sum(vals), len(vals))

    return ReviewSummary(
        user_id=user_id,
        total_reviews=total,
        avg_overall=avg_field("overall_rating"),
        avg_punctuality=avg_field("punctuality"),
        avg_work_quality=avg_field("work_quality"),
        avg_communication=avg_field("communication"),
        avg_attitude=avg_field("attitude"),
        avg_payment_timeliness=avg_field("payment_timeliness"),
        avg_work_environment=avg_field("work_environment"),
        avg_fairness=avg_field("fairness"),
    )
