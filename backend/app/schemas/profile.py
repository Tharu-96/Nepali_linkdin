from pydantic import BaseModel
from typing import Optional

class WorkerProfileBase(BaseModel):
    headline: Optional[str] = None
    skills: Optional[str] = None
    location: Optional[str] = None
    availability: Optional[bool] = True
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_sharing_consent: Optional[bool] = False
    experience: Optional[str] = None
    education: Optional[str] = None
    certifications: Optional[str] = None
    projects: Optional[str] = None
    resume_url: Optional[str] = None
    profile_picture_url: Optional[str] = None
    esewa_number: Optional[str] = None
    khalti_number: Optional[str] = None

class WorkerProfileUpdate(WorkerProfileBase):
    pass

class WorkerPaymentMethodsUpdate(BaseModel):
    esewa_number: Optional[str] = None
    khalti_number: Optional[str] = None

class WorkerProfileResponse(WorkerProfileBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True

class EmployerProfileBase(BaseModel):
    company: Optional[str] = None
    location: Optional[str] = None
    profile_picture_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    office_address: Optional[str] = None

class EmployerProfileUpdate(EmployerProfileBase):
    pass

class EmployerProfileResponse(EmployerProfileBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True
