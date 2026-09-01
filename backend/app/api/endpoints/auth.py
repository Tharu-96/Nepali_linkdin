from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks  # 👈 Added BackgroundTasks here
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.schemas.token import Token

# Import your email utility safely
from app.email_utils import send_login_notification

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user with this email already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_national_id = db.query(User).filter(User.national_id_card == user_in.national_id_card.strip()).first()
    if existing_national_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="National ID Card number is already registered",
        )
    
    # Ensure role is not admin (in case schema Literal validation is bypassed)
    if user_in.role not in ["worker", "employer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration is only allowed for 'worker' or 'employer' roles.",
        )
        
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        phone_number=user_in.phone_number,
        national_id_card=user_in.national_id_card.strip(),
        password=hash_password(user_in.password),
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db), background_tasks: BackgroundTasks = BackgroundTasks()):  # 👈 Added parameter here
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    if user_in.role and user.role != user_in.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as {user.role}. Please sign in as {user.role}.",
        )
    
    # 🎯 TRIGGER EMAIL NOTIFICATION DIRECTLY IN THE BACKGROUND
    # This fires off asynchronously only if the credentials above match completely!
    try:
        # Falls back to user.name if name property isn't filled out entirely
        username_display = getattr(user, "name", "User")
        background_tasks.add_task(send_login_notification, user.email, username_display)
        print(f"Background login notification email queued for: {user.email}")
    except Exception as e:
        print(f"Failed to queue email task: {str(e)}")

    # Generate JWT token
    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role
    }

# --- Google OAuth Login / Registration Complete Flow ---
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt
from pydantic import BaseModel
from typing import Optional

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:  # pragma: no cover - defensive for fresh environments
    id_token = None
    requests = None
    GOOGLE_AUTH_AVAILABLE = False

from app.core.config import settings
from app.models.user import WorkerProfile, EmployerProfile

# Admin/owner override list — only these emails may become admin
OWNER_EMAILS = ["rozgar123@gmail.com"]

class GoogleLoginRequest(BaseModel):
    code: str
    # Optional role passed from frontend (worker | employer). Never trust 'admin' from clients.
    role: Optional[str] = None

class GoogleTokenRequest(BaseModel):
    token: str
    role: Optional[str] = "worker"

class GoogleCompleteRegistration(BaseModel):
    temp_token: str
    role: str

def create_temp_token(data: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode = {**data, "exp": expire, "type": "temp_registration"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_temp_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "temp_registration":
            raise HTTPException(status_code=400, detail="Invalid token type")
        return payload
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

@router.post("/google")
def google_auth(body: GoogleTokenRequest, db: Session = Depends(get_db)):
    """
    Securely verify Google ID token and return system JWT.
    Syncs user profile with database automatically.
    """
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication dependency is not installed. Please install google-auth and restart the backend.",
        )
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Sign-In is not configured on the backend. Set GOOGLE_CLIENT_ID and restart the backend.",
        )

    try:
        # Verify the ID token from Google
        idinfo = id_token.verify_oauth2_token(
            body.token,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        
        email = idinfo['email']
        name = idinfo.get('name', 'Google User')
        
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Safely create their profile with status active (default for new user)
            # Use the role selected by the user on the frontend
            final_role = body.role if body.role in ["worker", "employer"] else "worker"
            
            user = User(
                name=name,
                email=email,
                password=hash_password(secrets.token_urlsafe(16)),
                role=final_role
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create appropriate sub-profile
            if final_role == "worker":
                profile = WorkerProfile(user_id=user.id)
                db.add(profile)
            else:
                profile = EmployerProfile(user_id=user.id)
                db.add(profile)
            db.commit()
        else:
            # Optional: Update role if user explicitly wants to switch (might be restricted in production)
            # For now, we respect existing user role to prevent data inconsistency
            if body.role in ["worker", "employer"] and user.role != body.role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"This Google account is registered as {user.role}. Please sign in as {user.role}.",
                )

        # Generate JWT token
        access_token = create_access_token(subject=user.id, role=user.role)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Google Auth Error: {str(e)}")
        # Invalid token or other verification issues
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {str(e)}")

@router.post("/google/callback")
def google_callback(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    code = body.code
    # Mocking Google user identity based on the mock code
    if code == "mock_existing_worker":
        email = "worker@rozgar.com"
        full_name = "John Worker"
        google_id = "google_worker"
        profile_picture = None
    elif code == "mock_existing_employer":
        email = "employer@rozgar.com"
        full_name = "Jane Employer"
        google_id = "google_employer"
        profile_picture = None
    elif code == "mock_existing_admin":
        email = "admin@rozgar.com"
        full_name = "Admin User"
        google_id = "google_admin"
        profile_picture = None
    elif code == "mock_new_user":
        email = "new_google_user@example.com"
        full_name = "New Google User"
        google_id = "google_123456789"
        profile_picture = "https://lh3.googleusercontent.com/a/default-user"
    else:
        email = f"{code}@example.com"
        full_name = f"Google User {code}"
        google_id = f"google_{code}"
        profile_picture = None

    user = db.query(User).filter(User.email == email).first()
    if user:
        # If this email is an owner email, ensure role is admin in DB
        if email in OWNER_EMAILS and user.role != "admin":
            user.role = "admin"
            db.add(user)
            db.commit()
            db.refresh(user)

        access_token = create_access_token(subject=user.id, role=user.role)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": user.role,
            "needs_role_selection": False
        }

    # New user: always require role selection client-side to complete registration
    temp_data = {
        "google_id": google_id,
        "email": email,
        "full_name": full_name,
        "profile_picture": profile_picture
    }
    temp_token = create_temp_token(temp_data)
    return {
        "temp_token": temp_token,
        "needs_role_selection": True
    }

@router.post("/google/complete-registration")
def google_complete_registration(body: GoogleCompleteRegistration, db: Session = Depends(get_db)):
    if body.role not in ["worker", "employer"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'worker' or 'employer'")

    payload = verify_temp_token(body.temp_token)
    email = payload.get("email")
    full_name = payload.get("full_name")
    profile_picture = payload.get("profile_picture")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        # Ensure owner emails are always admin
        if email in OWNER_EMAILS and existing_user.role != "admin":
            existing_user.role = "admin"
            db.add(existing_user)
            db.commit()
            db.refresh(existing_user)

        access_token = create_access_token(subject=existing_user.id, role=existing_user.role)
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "role": existing_user.role
        }

    # If this email is an owner, force admin regardless of supplied role
    final_role = "admin" if email in OWNER_EMAILS else body.role

    new_user = User(
        name=full_name,
        email=email,
        password=hash_password(secrets.token_urlsafe(16)),
        role=final_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if final_role == "worker":
        profile = WorkerProfile(user_id=new_user.id, profile_picture_url=profile_picture)
        db.add(profile)
    elif final_role == "employer":
        profile = EmployerProfile(user_id=new_user.id, profile_picture_url=profile_picture)
        db.add(profile)

    db.commit()

    access_token = create_access_token(subject=new_user.id, role=new_user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": new_user.role
    }

# --- Forgot / Reset Password Flow ---
from app.models.password_reset_token import PasswordResetToken
from app.email_utils import send_password_reset_email

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        # Generate token and store
        token_value = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token_value,
            expires_at=expires
        )
        db.add(reset_token)
        db.commit()

        reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={token_value}"
        background_tasks.add_task(send_password_reset_email, user.email, reset_link)

    # Always return 200 — never reveal whether email exists
    return {"message": "If that email exists, a reset link has been sent."}

@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token
    ).first()

    if not reset_token or reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Update password
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.password = hash_password(body.new_password)
    db.delete(reset_token)  # One-time use
    db.commit()

    return {"message": "Password reset successfully."}
