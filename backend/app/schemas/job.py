from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class JobBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=5)
    location: str = Field(..., min_length=2, max_length=150)
    # Keep the API field name as `salary` for compatibility; UI presents it as Estimated Salary.
    salary: str = Field(..., min_length=1, max_length=100)
    required_skills: Optional[str] = None
    is_urgent: Optional[bool] = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class JobCreate(JobBase):
    pass

class JobResponse(JobBase):
    id: int
    employer_id: int
    status: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True

class JobNearbyResponse(JobResponse):
    distance: Optional[float] = None
