from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ChatbotHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1000)

class ChatbotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: List[ChatbotHistoryMessage] = Field(default_factory=list, max_items=12)
    current_path: Optional[str] = Field(default=None, max_length=200)

class ChatbotResponse(BaseModel):
    reply: str
