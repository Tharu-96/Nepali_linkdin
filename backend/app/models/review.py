from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # 'employer' or 'worker' — who is writing this review
    reviewer_role = Column(String, nullable=False)

    # Overall rating 1–5
    overall_rating = Column(Integer, nullable=False)

    # Worker-side categories (set when an employer reviews a worker)
    punctuality = Column(Integer, nullable=True)
    work_quality = Column(Integer, nullable=True)
    communication = Column(Integer, nullable=True)
    attitude = Column(Integer, nullable=True)

    # Employer-side categories (set when a worker reviews an employer)
    payment_timeliness = Column(Integer, nullable=True)
    work_environment = Column(Integer, nullable=True)
    fairness = Column(Integer, nullable=True)

    written_feedback = Column(Text, nullable=True)
    is_anonymous = Column(Boolean, default=False, nullable=False, server_default="false")
    is_flagged = Column(Boolean, default=False, nullable=False, server_default="false")
    is_deleted = Column(Boolean, default=False, nullable=False, server_default="false")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # One review per person per job — enforced by DB constraint
    __table_args__ = (
        UniqueConstraint("job_id", "reviewer_id", name="uq_reviews_job_reviewer"),
    )

    # Relationships
    job = relationship("Job")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    reviewee = relationship("User", foreign_keys=[reviewee_id])
