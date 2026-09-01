from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class MessageCreate(BaseModel):
    receiver_id: int
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    metadata: Optional[dict] = None

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    metadata: Optional[dict] = None
    is_read: bool
    timestamp: datetime

    class Config:
        orm_mode = True

class ConversationResponse(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int
    is_online: bool = False
