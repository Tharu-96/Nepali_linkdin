from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api.deps import RoleChecker, get_current_user
from app.core.database import get_db
from app.models.user import User, WorkerProfile, EmployerProfile
from app.schemas.profile import (
    WorkerPaymentMethodsUpdate,
    WorkerProfileResponse,
    WorkerProfileUpdate,
    EmployerProfileResponse,
    EmployerProfileUpdate,
)
from fastapi import File, UploadFile, HTTPException
import os
import uuid
from app.resume_parser import parse_resume

router = APIRouter()

worker_required = RoleChecker(["worker"])
employer_required = RoleChecker(["employer"])

# =========================
# WORKER PROFILE ROUTES
# =========================

@router.get("/worker", response_model=WorkerProfileResponse)
def get_worker_profile(
    current_user: User = Depends(worker_required), 
    db: Session = Depends(get_db)
):
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        # Lazy initialization
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/worker", response_model=WorkerProfileResponse)
def update_worker_profile(
    profile_in: WorkerProfileUpdate,
    current_user: User = Depends(worker_required),
    db: Session = Depends(get_db)
):
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)
        
    for field, value in profile_in.dict(exclude_unset=True).items():
        setattr(profile, field, value)
        
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/worker/payment-methods", response_model=WorkerProfileResponse)
def get_worker_payment_methods(
    current_user: User = Depends(worker_required),
    db: Session = Depends(get_db)
):
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/worker/payment-methods", response_model=WorkerProfileResponse)
def update_worker_payment_methods(
    payment_in: WorkerPaymentMethodsUpdate,
    current_user: User = Depends(worker_required),
    db: Session = Depends(get_db)
):
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)

    payload = payment_in.dict(exclude_unset=True)
    for field in ("esewa_number", "khalti_number"):
        if field in payload:
            setattr(profile, field, payload[field])

    db.commit()
    db.refresh(profile)
    return profile

# =========================
# EMPLOYER PROFILE ROUTES
# =========================

@router.get("/employer", response_model=EmployerProfileResponse)
def get_employer_profile(
    current_user: User = Depends(employer_required), 
    db: Session = Depends(get_db)
):
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    if not profile:
        # Lazy initialization
        profile = EmployerProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.put("/employer", response_model=EmployerProfileResponse)
def update_employer_profile(
    profile_in: EmployerProfileUpdate,
    current_user: User = Depends(employer_required),
    db: Session = Depends(get_db)
):
    profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    if not profile:
        profile = EmployerProfile(user_id=current_user.id)
        db.add(profile)
        
    for field, value in profile_in.dict(exclude_unset=True).items():
        setattr(profile, field, value)
        
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/worker/resume", response_model=WorkerProfileResponse)
async def upload_worker_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(worker_required),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.pdf', '.docx')):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX files are supported")
        
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join("static", "uploads", filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    parsed_data = parse_resume(file_path)
    
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    if not profile:
        profile = WorkerProfile(user_id=current_user.id)
        db.add(profile)
        
    profile.resume_url = f"/static/uploads/{filename}"
    
    # Auto-populate fields if present
    if parsed_data.get('headline'): profile.headline = parsed_data['headline']
    if parsed_data.get('skills'): profile.skills = parsed_data['skills']
    if parsed_data.get('experience'): profile.experience = parsed_data['experience']
    if parsed_data.get('education'): profile.education = parsed_data['education']
    if parsed_data.get('certifications'): profile.certifications = parsed_data['certifications']
    if parsed_data.get('projects'): profile.projects = parsed_data['projects']
    
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/photo", response_model=dict)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    filename = f"photo_{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join("static", "uploads", filename)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    photo_url = f"/static/uploads/{filename}"
    
    if current_user.role == "worker":
        profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
        if not profile:
            profile = WorkerProfile(user_id=current_user.id)
            db.add(profile)
        profile.profile_picture_url = photo_url
    elif current_user.role == "employer":
        profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
        if not profile:
            profile = EmployerProfile(user_id=current_user.id)
            db.add(profile)
        profile.profile_picture_url = photo_url
        
    db.commit()
    return {"profile_picture_url": photo_url}


@router.delete("/profile/avatar", response_model=dict)
def delete_profile_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Select the correct profile table based on role
    profile = None
    if current_user.role == "worker":
        profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
    elif current_user.role == "employer":
        profile = db.query(EmployerProfile).filter(EmployerProfile.user_id == current_user.id).first()
    else:
        raise HTTPException(status_code=400, detail="Unsupported role for profile avatar deletion")

    if not profile or not profile.profile_picture_url:
        raise HTTPException(status_code=404, detail="No profile photo to delete")

    # Remove the physical file if it exists in static/uploads
    filename = os.path.basename(profile.profile_picture_url)
    file_path = os.path.join("static", "uploads", filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to remove profile photo from disk")

    # Reset DB field
    profile.profile_picture_url = None
    db.commit()
    return {"detail": "Profile photo removed"}
