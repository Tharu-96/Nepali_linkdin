from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Users
class AdminWorkerResponse(BaseModel):
    id: int
    name: str
    email: str
    national_id_card: Optional[str] = None
    is_active: bool
    join_date: datetime
    total_applications: int
    avg_rating: float

class AdminEmployerResponse(BaseModel):
    id: int
    company_name: str
    email: str
    national_id_card: Optional[str] = None
    is_active: bool
    total_jobs_posted: int
    total_revenue_paid: float
    avg_rating: float

class UserStatusUpdate(BaseModel):
    is_active: bool

class AdminUserDetailResponse(BaseModel):
    id: int
    name: str
    email: str
    phone_number: Optional[str] = None
    national_id_card: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    company: Optional[str] = None
    location: Optional[str] = None
    office_address: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None

class AdminUserUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    phone_number: str = Field(..., pattern=r"^[0-9]{10}$")
    is_active: bool
    company: Optional[str] = None
    location: Optional[str] = None
    office_address: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[str] = None

class AdminReviewResponse(BaseModel):
    id: int
    job_id: int
    job_title: Optional[str] = None
    reviewer_id: int
    reviewer_name: Optional[str] = None
    reviewee_id: int
    reviewee_name: Optional[str] = None
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

class AdminApplicationResponse(BaseModel):
    id: int
    job_id: int
    job_title: Optional[str] = None
    worker_id: int
    worker_name: Optional[str] = None
    employer_id: Optional[int] = None
    employer_name: Optional[str] = None
    status: str
    applied_at: datetime

class AdminAuditLogResponse(BaseModel):
    id: str
    actor_id: Optional[int] = None
    actor_name: str
    actor_role: str
    action: str
    entity_type: str
    entity_label: str
    details: Optional[str] = None
    created_at: datetime

# Jobs
class AdminJobResponse(BaseModel):
    id: int
    title: str
    description: str
    location: str
    salary: str
    required_skills: Optional[str] = None
    employer_id: int
    employer_name: str
    is_urgent: bool
    status: str
    created_at: datetime

class AdminJobUpdate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=5)
    location: str = Field(..., min_length=2, max_length=150)
    salary: str = Field(..., min_length=1, max_length=100)
    required_skills: Optional[str] = None
    is_urgent: bool = False
    status: Optional[str] = None

# Stats & KPIs
class KpiStats(BaseModel):
    total_workers: int
    total_employers: int
    total_users: int
    total_reports: int
    pending_reports: int
    pending_approvals: int
    revenue_this_month: float = 0.0

class ChartDataPoint(BaseModel):
    name: str
    value: float
    # for stacked charts
    esewa: Optional[float] = None
    khalti: Optional[float] = None
    
# Chat Metadata
class ChatPairStats(BaseModel):
    sender_id: int
    receiver_id: int
    message_count: int

class ChatMetadata(BaseModel):
    total_conversations: int
    messages_per_day: List[ChartDataPoint]
    most_active_pairs: List[ChatPairStats]
