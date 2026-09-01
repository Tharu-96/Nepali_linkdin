from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
import os
from datetime import datetime
from groq import Groq

from app.api.deps import get_current_user, RoleChecker
from app.core.database import get_db
from app.core.location import calculate_haversine_distance
from app.api.websocket import manager
from app.models.user import User, Job, Application, WorkerProfile, Message
from app.services.notifications import create_notification, broadcast_notification
from app.schemas.job import JobCreate, JobResponse, JobNearbyResponse
from app.schemas.application import ApplicationResponse, ApplicationCreate, UserMinResponse


def _worker_min_response(worker: User, db: Session) -> UserMinResponse:
    """Build a worker summary enriched with payment coordinates from the profile."""
    profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == worker.id).first()
    return UserMinResponse(
        id=worker.id,
        name=worker.name,
        email=worker.email,
        professional_headline=profile.headline if profile else None,
        skills=profile.skills if profile else None,
        esewa_number=profile.esewa_number if profile else None,
        khalti_number=profile.khalti_number if profile else None,
    )

router = APIRouter()


client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

employer_required = RoleChecker(["employer"])
worker_required = RoleChecker(["worker"])

async def notify_application_message(receiver_id: int, db_msg: Message):
    outbound_data = {
        "type": "message",
        "data": {
            "id": db_msg.id,
            "sender_id": db_msg.sender_id,
            "receiver_id": db_msg.receiver_id,
            "content": db_msg.content,
            "timestamp": db_msg.timestamp.isoformat(),
            "is_read": db_msg.is_read,
        },
    }
    await manager.send_personal_message(outbound_data, receiver_id)

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    current_user: User = Depends(employer_required),
    db: Session = Depends(get_db)
):
    new_job = Job(
        employer_id=current_user.id,
        title=job_in.title,
        description=job_in.description,
        location=job_in.location,
        salary=job_in.salary,
        required_skills=job_in.required_skills,
        is_urgent=job_in.is_urgent,
        status="open",
        latitude=job_in.latitude,
        longitude=job_in.longitude
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    if new_job.is_urgent and new_job.latitude is not None and new_job.longitude is not None:
        await manager.notify_nearby_workers_of_urgent_job(
            db=db,
            job_id=new_job.id,
            job_lat=new_job.latitude,
            job_lng=new_job.longitude,
            job_title=new_job.title
        )
        
    return new_job

@router.get("", response_model=List[JobResponse])
def get_jobs(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    query = db.query(Job)
    # Rozgar jobs hire one worker. Once one application is accepted the job
    # moves to in_progress and must no longer be discoverable by other workers.
    if current_user.role == "worker":
        query = query.filter(Job.status == "open")

    
    if search and search.strip():
        try:
            
            system_prompt = "You are a database keyword generator. Output ONLY a comma-separated list of lowercase synonyms. No chat, no formatting, no explanations."
            user_prompt = f"Provide exactly 4 alternative job titles or industry synonyms for the search term: '{search}'."

            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,           
                max_completion_tokens=200  
            )

            ai_output = completion.choices[0].message.content.strip()
            
            
            keywords = [search.lower().strip()]
            
            
            for word in ai_output.split(","):
                cleaned_word = word.replace('"', '').replace("'", "").replace(".", "").replace("`", "").lower().strip()
                if cleaned_word and cleaned_word not in keywords:
                    keywords.append(cleaned_word)

            
            print(f"🔮 Expanded search keywords: {keywords}")

            
            query_filters = []
            for kw in keywords:
                query_filters.append(Job.title.ilike(f"%{kw}%"))
                query_filters.append(Job.description.ilike(f"%{kw}%"))
                query_filters.append(Job.required_skills.ilike(f"%{kw}%")) 

            query = query.filter(or_(*query_filters))

        except Exception as e:
            
            print(f"❌ Search expansion unavailable, running basic fallback: {e}")
            query = query.filter(
                or_(
                    Job.title.ilike(f"%{search}%"), 
                    Job.description.ilike(f"%{search}%"),
                    Job.required_skills.ilike(f"%{search}%")
                )
            )

    
    jobs = query.order_by(Job.is_urgent.desc(), Job.created_at.desc()).distinct().all()
    return jobs

@router.get("/recommendations", response_model=List[JobResponse])
def get_job_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(worker_required) # Only workers get job recommendations
):
    # 1. Fetch the logged-in worker's profile to get their skills
    worker_profile = current_user.worker_profile if hasattr(current_user, 'worker_profile') else None
    
    if not worker_profile or not worker_profile.skills:
        # Fallback: If they haven't filled out skills yet, show urgent/latest jobs
        return db.query(Job).filter(Job.status == "open").order_by(
            Job.is_urgent.desc(), Job.created_at.desc()
        ).limit(10).all()
    
    # 2. Clean and split the worker's skills (e.g., "Cleaning, Driving" -> ['cleaning', 'driving'])
    user_skills = [s.strip().lower() for s in worker_profile.skills.split(",") if s.strip()]
    
    # 3. Build an OR filter to find jobs matching any of these skills
    query_filters = []
    for skill in user_skills:
        query_filters.append(Job.required_skills.ilike(f"%{skill}%"))
        query_filters.append(Job.title.ilike(f"%{skill}%"))
        query_filters.append(Job.description.ilike(f"%{skill}%"))
        
    # 4. Execute query, prioritize urgent matching jobs, and return them
    recommended_jobs = db.query(Job).filter(Job.status == "open", or_(*query_filters)).order_by(
        Job.is_urgent.desc(), 
        Job.created_at.desc()
    ).limit(10).all()
    
    return recommended_jobs

@router.get("/nearby", response_model=List[JobNearbyResponse])
def get_nearby_jobs(
    lat: float,
    lng: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jobs_query = db.query(Job)
    if current_user.role == "worker":
        jobs_query = jobs_query.filter(Job.status == "open")
    jobs = jobs_query.all()
    nearby_jobs = []
    for job in jobs:
        if job.latitude is not None and job.longitude is not None:
            dist = calculate_haversine_distance(lat, lng, job.latitude, job.longitude)
            job_data = JobNearbyResponse.from_orm(job)
            job_data.distance = dist
            nearby_jobs.append(job_data)
        else:
            job_data = JobNearbyResponse.from_orm(job)
            job_data.distance = None
            nearby_jobs.append(job_data)
            
    nearby_jobs.sort(key=lambda x: (x.distance is None, x.distance))
    return nearby_jobs

@router.get("/emergency", response_model=List[JobNearbyResponse])
def get_emergency_jobs(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jobs_query = db.query(Job).filter(Job.is_urgent == True)
    if current_user.role == "worker":
        jobs_query = jobs_query.filter(Job.status == "open")
    jobs = jobs_query.all()
    emergency_jobs = []
    for job in jobs:
        dist = None
        if lat is not None and lng is not None and job.latitude is not None and job.longitude is not None:
            dist = calculate_haversine_distance(lat, lng, job.latitude, job.longitude)
        
        job_data = JobNearbyResponse.from_orm(job)
        job_data.distance = dist
        emergency_jobs.append(job_data)
        
    if lat is not None and lng is not None:
        emergency_jobs.sort(key=lambda x: (x.distance is None, x.distance))
    else:
        emergency_jobs.sort(key=lambda x: x.created_at, reverse=True)
        
    return emergency_jobs

@router.get("/{job_id}", response_model=JobResponse)
def get_job_details(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user.role == "worker" and job.status != "open":
        is_selected_worker = db.query(Application).filter(
            Application.job_id == job.id,
            Application.worker_id == current_user.id,
            Application.status.in_(["accepted", "completed"]),
        ).first()
        if not is_selected_worker:
            raise HTTPException(status_code=404, detail="Job is no longer available")
    return job

@router.post("/{job_id}/apply", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def apply_to_job(
    job_id: int,
    proposal: Optional[ApplicationCreate] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(worker_required)
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "open":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This job is no longer accepting applications",
        )
        
    existing_app = db.query(Application).filter(
        Application.job_id == job_id,
        Application.worker_id == current_user.id
    ).first()
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already applied to this job"
        )

    # Persist any submitted payment coordinates onto the worker's profile so the
    # employer can settle payment once the job is completed.
    if proposal is not None:
        profile = db.query(WorkerProfile).filter(WorkerProfile.user_id == current_user.id).first()
        if not profile:
            profile = WorkerProfile(user_id=current_user.id)
            db.add(profile)
        profile.esewa_number = proposal.esewa_number
        profile.khalti_number = proposal.khalti_number

    new_app = Application(
        job_id=job_id,
        worker_id=current_user.id,
        status="pending",
        full_name=proposal.full_name if proposal else current_user.name,
        professional_headline=proposal.professional_headline if proposal else None,
        skills=proposal.skills if proposal else None,
        proposal_pitch=proposal.proposal_pitch if proposal else None,
    )
    db.add(new_app)

    # Persist an employer-facing notification so it appears in chat/unread flows
    # and also reaches the specific job owner in real time if they are online.
    notification_message = Message(
        sender_id=current_user.id,
        receiver_id=job.employer_id,
        content=f"{current_user.name} applied to your job '{job.title}'.",
        timestamp=datetime.utcnow(),
        is_read=False,
    )
    db.add(notification_message)
    platform_notification = create_notification(
        db,
        job.employer_id,
        "New job application",
        f"{current_user.name} applied to your job '{job.title}'.",
        "application",
        f"/jobs/{job_id}/applications",
    )

    db.commit()
    db.refresh(new_app)
    db.refresh(notification_message)
    db.refresh(platform_notification)
    background_tasks.add_task(notify_application_message, job.employer_id, notification_message)
    background_tasks.add_task(broadcast_notification, platform_notification)

    return ApplicationResponse(
        id=new_app.id,
        job_id=new_app.job_id,
        worker_id=new_app.worker_id,
        status=new_app.status,
        applied_at=new_app.applied_at,
        full_name=new_app.full_name,
        professional_headline=new_app.professional_headline,
        skills=new_app.skills,
        proposal_pitch=new_app.proposal_pitch,
        worker=_worker_min_response(current_user, db),
    )

@router.get("/{job_id}/applications", response_model=List[ApplicationResponse])
def get_job_applications(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(employer_required)
):
    job = db.query(Job).filter(Job.id == job_id, Job.employer_id == current_user.id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not owned by you"
        )

    apps = (
        db.query(Application)
        .options(joinedload(Application.worker))
        .filter(Application.job_id == job_id)
        .all()
    )
    return [
        ApplicationResponse(
            id=a.id,
            job_id=a.job_id,
            worker_id=a.worker_id,
            status=a.status,
            applied_at=a.applied_at,
            full_name=a.full_name,
            professional_headline=a.professional_headline,
            skills=a.skills,
            proposal_pitch=a.proposal_pitch,
            worker=_worker_min_response(a.worker, db) if a.worker else None,
        )
        for a in apps
    ]

