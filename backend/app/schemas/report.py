from pydantic import BaseModel, Field
from datetime import datetime

class ReportCreate(BaseModel):
    reported_id: int
    reason: str = Field(..., min_length=5)

class ReportUpdate(BaseModel):
    status: str  # pending, resolved

class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reported_id: int
    reason: str
    status: str
    created_at: datetime

    class Config:
        orm_mode = True
