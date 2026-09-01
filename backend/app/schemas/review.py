from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime


# ─── Request Models ────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    job_id: int
    reviewee_id: int
    reviewer_role: str = Field(..., description="'employer'")
    overall_rating: int = Field(..., ge=1, le=5)

    # Worker-side category ratings (employer fills these when reviewing worker)
    punctuality: Optional[int] = Field(None, ge=1, le=5)
    work_quality: Optional[int] = Field(None, ge=1, le=5)
    communication: Optional[int] = Field(None, ge=1, le=5)
    attitude: Optional[int] = Field(None, ge=1, le=5)

    # Legacy employer-side category ratings. Worker-authored reviews are not allowed.
    payment_timeliness: Optional[int] = Field(None, ge=1, le=5)
    work_environment: Optional[int] = Field(None, ge=1, le=5)
    fairness: Optional[int] = Field(None, ge=1, le=5)

    written_feedback: Optional[str] = Field(None, min_length=20, max_length=500)
    is_anonymous: bool = False

    # Optional wallet numbers echoed back from the settlement flow.
    esewa_number: Optional[str] = None
    khalti_number: Optional[str] = None

    @validator("reviewer_role")
    def validate_reviewer_role(cls, v: str) -> str:
        if v != "employer":
            raise ValueError("reviewer_role must be 'employer'")
        return v

    @validator("overall_rating")
    def validate_overall_rating(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("overall_rating must be between 1 and 5")
        return v


# ─── Response Models ───────────────────────────────────────────────────────────

class ReviewerInfo(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True


class ReviewResponse(BaseModel):
    id: int
    job_id: int
    reviewer_id: int
    reviewee_id: int
    reviewer_role: str
    overall_rating: int

    punctuality: Optional[int] = None
    work_quality: Optional[int] = None
    communication: Optional[int] = None
    attitude: Optional[int] = None
    payment_timeliness: Optional[int] = None
    work_environment: Optional[int] = None
    fairness: Optional[int] = None

    written_feedback: Optional[str] = None
    is_anonymous: bool
    is_flagged: bool
    is_deleted: bool
    created_at: datetime

    # Populated at response-build time (may be None if anonymous)
    reviewer_name: Optional[str] = None
    reviewee_name: Optional[str] = None
    reviewer_role_label: Optional[str] = None

    class Config:
        orm_mode = True


class ReviewSummary(BaseModel):
    """Aggregated rating summary for a user profile page."""
    user_id: int
    total_reviews: int
    avg_overall: Optional[float] = None

    # Worker-side averages
    avg_punctuality: Optional[float] = None
    avg_work_quality: Optional[float] = None
    avg_communication: Optional[float] = None
    avg_attitude: Optional[float] = None

    # Employer-side averages
    avg_payment_timeliness: Optional[float] = None
    avg_work_environment: Optional[float] = None
    avg_fairness: Optional[float] = None


class PaginatedReviews(BaseModel):
    total: int
    page: int
    per_page: int
    reviews: List[ReviewResponse]
