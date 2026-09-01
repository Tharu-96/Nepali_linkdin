from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional
from app.schemas.job import JobResponse

class UserMinResponse(BaseModel):
    id: int
    name: str
    email: str
    professional_headline: Optional[str] = None
    skills: Optional[str] = None
    esewa_number: Optional[str] = None
    khalti_number: Optional[str] = None

    class Config:
        orm_mode = True

class ApplicationCreate(BaseModel):
    """Optional proposal payload sent by a worker when applying to a job.

    Payment coordinates are persisted onto the worker's profile so the
    employer can settle payment for the completed job later on.
    """
    job_id: Optional[int] = None
    full_name: Optional[str] = None
    professional_headline: Optional[str] = None
    skills: Optional[str] = None
    proposal_pitch: Optional[str] = None
    esewa_number: Optional[str] = Field(default=None, regex=r"^[0-9]{10}$")
    khalti_number: Optional[str] = Field(default=None, regex=r"^[0-9]{10}$")

class ApplicationUpdate(BaseModel):
    status: Literal["pending", "accepted", "rejected", "completed"]

class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    worker_id: int
    status: str
    applied_at: datetime
    full_name: Optional[str] = None
    professional_headline: Optional[str] = None
    skills: Optional[str] = None
    proposal_pitch: Optional[str] = None
    job: Optional[JobResponse] = None
    worker: Optional[UserMinResponse] = None

    class Config:
        orm_mode = True
