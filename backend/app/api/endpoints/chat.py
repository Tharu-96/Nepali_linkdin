from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy import or_, and_, desc
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import json
import uuid
import asyncio
import os
from app.api.deps import get_current_user
from app.core.database import get_db, SessionLocal
from app.models.user import User, Message
from app.schemas.chat import MessageResponse, ConversationResponse, MessageCreate

# =====================================================================
# 🛠️ FIXED: Pluralized "websockets" to match your actual filename
# =====================================================================
from app.api.websocket import manager
from app.services.notifications import create_notification, broadcast_notification

router = APIRouter()

@router.get("/history/{user_id}", response_model=List[MessageResponse])
def get_chat_history(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch messages between current user and target user
    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
            and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
        )
    ).order_by(Message.timestamp.asc()).all()
    
    # Mark messages received by current user as read
    unread_received = [m for m in messages if m.receiver_id == current_user.id and not m.is_read]
    if unread_received:
        for m in unread_received:
            m.is_read = True
        db.commit()

    # Convert ORM objects to plain dicts so metadata JSON is parsed correctly
    out = []
    for m in messages:
        try:
            meta = json.loads(m.metadata_json) if m.metadata_json else None
        except Exception:
            meta = None
        out.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "content": m.content or "",
            "file_url": m.file_url,
            "file_type": m.file_type,
            "metadata": meta,
            "is_read": m.is_read,
            "timestamp": m.timestamp,
        })

    return out

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(Message).filter(
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).count()
    return {"unread_count": count}

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    include_contacts: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find all unique user IDs we have communicated with
    sender_ids = db.query(Message.sender_id).filter(Message.receiver_id == current_user.id).distinct().all()
    receiver_ids = db.query(Message.receiver_id).filter(Message.sender_id == current_user.id).distinct().all()
    
    communicated_user_ids = set([r[0] for r in sender_ids] + [r[0] for r in receiver_ids])
    contact_user_ids = set()

    # Also include likely chat contacts so a new user can start a first message.
    # Workers can message employers; employers can message workers. Admin chat is
    # not shown in the main UI, but keep prior admin conversations visible.
    if include_contacts and current_user.role == "worker":
        contact_user_ids = {
            uid for (uid,) in db.query(User.id).filter(User.role == "employer", User.id != current_user.id).all()
        }
    elif include_contacts and current_user.role == "employer":
        contact_user_ids = {
            uid for (uid,) in db.query(User.id).filter(User.role == "worker", User.id != current_user.id).all()
        }

    visible_user_ids = communicated_user_ids | contact_user_ids
    
    conversations = []
    for other_id in visible_user_ids:
        other_user = db.query(User).filter(User.id == other_id).first()
        if not other_user:
            continue
            
        # Get last message
        last_msg = db.query(Message).filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_id),
                and_(Message.sender_id == other_id, Message.receiver_id == current_user.id)
            )
        ).order_by(desc(Message.timestamp)).first()
        
        # Get unread count from this user
        unread_cnt = db.query(Message).filter(
            Message.sender_id == other_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False
        ).count()
        
        # Derive a readable last_message preview (text or attachment hint)
        preview = None
        if last_msg:
            if getattr(last_msg, "content", None):
                preview = last_msg.content
            elif getattr(last_msg, "file_type", None):
                ft = last_msg.file_type or "attachment"
                kind = ft.split("/")[0] if "/" in ft else ft
                preview = f"[{kind.capitalize()}]"

        conversations.append(
            ConversationResponse(
                user_id=other_user.id,
                name=other_user.name,
                email=other_user.email,
                role=other_user.role,
                last_message=preview or "",
                last_message_time=last_msg.timestamp if last_msg else None,
                unread_count=unread_cnt,
                is_online=manager.is_user_online(other_user.id)
            )
        )
        
    # Sort conversations by last message time descending
    conversations.sort(key=lambda x: x.last_message_time or datetime.min, reverse=True)
    return conversations

@router.get("/call/initiate/{user_id}")
def initiate_call(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify the target opponent user exists before allowing the call
    opponent_user = db.query(User).filter(User.id == user_id).first()
    if not opponent_user:
        raise HTTPException(status_code=404, detail="Target user for call not found")
        
    # Generate a completely unique channel session identifier
    session_id = str(uuid.uuid4())[:8]  
    channel_name = f"rozgar_channel_{session_id}"
    
    return {
        "session_id": session_id,
        "channel_name": channel_name,
        "caller_id": current_user.id,
        "receiver_id": opponent_user.id,
        "message": "Call session generated successfully. Use this channel name for real-time signaling over WebSockets."
    }


@router.post("/messages", response_model=MessageResponse)
def create_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.receiver_id:
        raise HTTPException(status_code=400, detail="receiver_id is required")
    if payload.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a message to yourself")

    receiver = db.query(User).filter(User.id == payload.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Message receiver not found")

    content = payload.content.strip() if isinstance(payload.content, str) and payload.content.strip() else None
    if not content and not payload.file_url:
        raise HTTPException(status_code=400, detail="Message content or attachment is required")

    db_msg = Message(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=content,
        file_url=payload.file_url,
        file_type=payload.file_type,
        metadata_json=json.dumps(payload.metadata) if payload.metadata is not None else None,
        timestamp=datetime.utcnow(),
        is_read=False,
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    notification = create_notification(
        db, receiver.id, "New message", f"{current_user.name} sent you a message.",
        "chat", f"/chat?userId={current_user.id}"
    )
    db.commit()
    db.refresh(notification)

    return {
        "id": db_msg.id,
        "sender_id": db_msg.sender_id,
        "receiver_id": db_msg.receiver_id,
        "content": db_msg.content or "",
        "file_url": db_msg.file_url,
        "file_type": db_msg.file_type,
        "metadata": json.loads(db_msg.metadata_json) if db_msg.metadata_json else None,
        "is_read": db_msg.is_read,
        "timestamp": db_msg.timestamp,
    }

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Simple, authenticated upload handler that saves files to `static/uploads`.
    Returns a `file_url` suitable for public consumption (served from /static).
    """
    os.makedirs(os.path.join("static", "uploads"), exist_ok=True)
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    dest = os.path.join("static", "uploads", filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    return {
        "file_url": f"/static/uploads/{filename}",
        "file_type": file.content_type,
        "filename": file.filename,
        "size": len(content),
    }

# =====================================================================
# 🔌 SMART WEBSOCKET SIGNAL ROUTER (FIXED HANDSHAKE FLOW)
# =====================================================================
@router.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    # 1) Accept early (satisfies browser / proxy upgrade requirements)
    await websocket.accept()

    # 2) Extract token from the query string immediately after accept
    token = websocket.query_params.get("token")
    if not token:
        # Enforce immediate teardown for missing token
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3) Create DB session and strictly validate token -> user
    db = SessionLocal()
    try:
        try:
            # Support both sync and async get_current_user implementations
            if asyncio.iscoroutinefunction(get_current_user):
                current_user = await get_current_user(token=token, db=db)
            else:
                from fastapi.concurrency import run_in_threadpool
                # Run blocking auth logic off the event loop
                current_user = await run_in_threadpool(get_current_user, token, db)
        except Exception:
            # Any validation failure must immediately close the socket
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        if not current_user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 4) Connect authorized user to manager and begin safe message loop
        await manager.connect(current_user.id, websocket)
        await manager.broadcast({
            "type": "presence",
            "user_id": current_user.id,
            "is_online": manager.is_user_online(current_user.id),
        })

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    payload = json.loads(data)
                except Exception:
                    # ignore malformed payloads
                    continue

                payload_type = payload.get("type")
                receiver_id = payload.get("receiver_id")
                if receiver_id is not None:
                    try:
                        receiver_id = int(receiver_id)
                    except Exception:
                        receiver_id = None

                if payload_type == "presence_set":
                    manager.set_presence(current_user.id, bool(payload.get("is_online")))
                    await manager.broadcast({
                        "type": "presence",
                        "user_id": current_user.id,
                        "is_online": manager.is_user_online(current_user.id),
                    })
                    continue

                # Preserve existing call signaling logic unchanged
                if payload_type in ["incoming_call", "call_accepted", "call_rejected", "call_offer", "call_answer", "ice_candidate", "hangup"]:
                    payload["sender_id"] = current_user.id
                    if payload_type == "call_offer":
                        manager.add_active_call(current_user.id, receiver_id)
                    elif payload_type in ["call_rejected", "hangup"]:
                        manager.remove_active_call(current_user.id)
                    await manager.send_personal_message(payload, receiver_id)
                    continue

                # Media signals (client-side only media like voice/documents)
                # These should be forwarded to the recipient only and must NOT be
                # persisted to the database. Clients store the actual blobs in
                # their own IndexedDB and show placeholders for remote devices.
                if payload_type == 'media_signal':
                    payload["sender_id"] = current_user.id
                    # Forward only to recipient; do not insert into DB
                    await manager.send_personal_message(payload, receiver_id)
                    # Do not create any DB entries for media signals
                    continue

                # Application / payment / rating lifecycle relays.
                # These are ephemeral real-time signals (not chat rows). They are
                # forwarded to the counterpart, echoed to the sender for optimistic
                # UI, and mirrored to connected admins for the live dashboard log.
                if payload_type in ("work_completed", "worker_rated", "payment_released", "delete_message"):
                    payload["sender_id"] = current_user.id
                    if receiver_id is not None:
                        await manager.send_personal_message(payload, receiver_id)
                    await manager.send_personal_message(payload, current_user.id)
                    continue

                # Standard chat messages (text or attachments)
                raw_content = payload.get("content")
                file_url = payload.get("file_url")
                file_type = payload.get("file_type")
                metadata = payload.get("metadata")

                content = raw_content.strip() if isinstance(raw_content, str) and raw_content.strip() else None
                if not (content or file_url) or not receiver_id:
                    continue
                if receiver_id == current_user.id:
                    continue
                receiver = db.query(User).filter(User.id == receiver_id).first()
                if not receiver:
                    continue

                db_msg = Message(
                    sender_id=current_user.id,
                    receiver_id=receiver_id,
                    content=content,
                    file_url=file_url,
                    file_type=file_type,
                    metadata_json=json.dumps(metadata) if metadata is not None else None,
                    timestamp=datetime.utcnow(),
                    is_read=False
                )
                db.add(db_msg)
                db.commit()
                db.refresh(db_msg)
                notification = create_notification(
                    db, receiver_id, "New message", f"{current_user.name} sent you a message.",
                    "chat", f"/chat?userId={current_user.id}"
                )
                db.commit()
                db.refresh(notification)

                try:
                    meta_out = json.loads(db_msg.metadata_json) if db_msg.metadata_json else None
                except Exception:
                    meta_out = None

                outbound_data = {
                    "type": "message",
                    "data": {
                        "id": db_msg.id,
                        "sender_id": db_msg.sender_id,
                        "receiver_id": db_msg.receiver_id,
                        "content": db_msg.content or "",
                        "file_url": db_msg.file_url,
                        "file_type": db_msg.file_type,
                        "metadata": meta_out,
                        "timestamp": db_msg.timestamp.isoformat(),
                        "is_read": db_msg.is_read,
                    }
                }

                # Deliver to both parties
                await manager.send_personal_message(outbound_data, receiver_id)
                await manager.send_personal_message(outbound_data, current_user.id)
                await broadcast_notification(notification)

        except WebSocketDisconnect:
            pass
        finally:
            # ensure disconnect cleanup
            manager.disconnect(current_user.id)
            await manager.broadcast({
                "type": "presence",
                "user_id": current_user.id,
                "is_online": False,
            })

    finally:
        try:
            db.close()
        except Exception:
            pass
