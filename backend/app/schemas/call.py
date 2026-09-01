from pydantic import BaseModel

class CallInitiate(BaseModel):
    receiver_id: int

class CallSessionResponse(BaseModel):
    session_id: str
    channel_name: str
    token: str
    status: str
