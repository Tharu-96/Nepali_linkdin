from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, nullable=True)
    national_id_card = Column(String, unique=True, index=True, nullable=True)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, worker, employer
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    worker_profile = relationship("WorkerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    employer_profile = relationship("EmployerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="employer", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="worker", cascade="all, delete-orphan")

class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    headline = Column(String, nullable=True)
    skills = Column(String, nullable=True)
    location = Column(String, nullable=True)
    availability = Column(Boolean, default=True, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_sharing_consent = Column(Boolean, default=False, nullable=False)
    experience = Column(Text, nullable=True) # JSON array of dicts
    education = Column(Text, nullable=True) # JSON array of dicts
    certifications = Column(Text, nullable=True) # JSON array
    projects = Column(Text, nullable=True) # JSON array
    resume_url = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    esewa_number = Column(String, nullable=True)
    khalti_number = Column(String, nullable=True)

    user = relationship("User", back_populates="worker_profile")

class EmployerProfile(Base):
    __tablename__ = "employer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    company = Column(String, nullable=True)
    location = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    office_address = Column(String, nullable=True)

    user = relationship("User", back_populates="employer_profile")

class Job(Base):
    __tablename__ = "jobs"
    # Prevent SQLite from reusing a deleted job ID in newly created databases.
    # This complements FK cascades and avoids old references ever being
    # confused with a later job during development/testing.
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    employer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    # Stored as `salary` for compatibility; shown in the product as Estimated Salary.
    salary = Column(String, nullable=False)
    required_skills = Column(String, nullable=True)
    is_urgent = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="open")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    employer = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, accepted, rejected, completed
    # Snapshot the information supplied with this specific application.  A
    # worker may update their profile later, but an employer must still see
    # what was submitted when deciding whom to hire.
    full_name = Column(String, nullable=True)
    professional_headline = Column(String, nullable=True)
    skills = Column(Text, nullable=True)
    proposal_pitch = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    job = relationship("Job", back_populates="applications")
    worker = relationship("User", back_populates="applications")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Message text content (nullable because messages can be pure attachments)
    content = Column(Text, nullable=True)
    # Optional multimedia support
    file_url = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    # Use a non-reserved name for JSON metadata storage
    metadata_json = Column(Text, nullable=True)  # JSON string with extra info like filename/size
    is_read = Column(Boolean, default=False, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    notification_type = Column(String, nullable=False, default="system")
    link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    reported = relationship("User", foreign_keys=[reported_id])
