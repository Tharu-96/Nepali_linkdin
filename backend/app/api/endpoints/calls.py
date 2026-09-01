from fastapi import APIRouter, Depends
import uuid
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.call import CallInitiate, CallSessionResponse

router = APIRouter()

@router.post("/initiate", response_model=CallSessionResponse)
def initiate_call(
    call_in: CallInitiate,
    current_user: User = Depends(get_current_user)
):
    # Mocking call session generation
    session_id = str(uuid.uuid4())
    channel_name = f"rozgar_channel_{session_id[:8]}"
    mock_token = f"mock_token_{uuid.uuid4().hex}"
    
    return {
        "session_id": session_id,
        "channel_name": channel_name,
        "token": mock_token,
        "status": "connected"
    }
