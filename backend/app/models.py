import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, JSON, Boolean
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class JobStatus(str, enum.Enum):
    scheduled = "Scheduled"
    in_progress = "In Progress"
    awaiting_review = "Awaiting Review"
    compliance_flag = "Compliance Flag"
    completed = "Completed"


class DocStatus(str, enum.Enum):
    pending_review = "Pending Review"
    approved = "Approved"
    sent = "Sent"


class TechStatus(str, enum.Enum):
    on_site = "On Site"
    available = "Available"
    off_duty = "Off Duty"


class Severity(str, enum.Enum):
    high = "High"
    medium = "Medium"
    low = "Low"


class Role(str, enum.Enum):
    owner = "Owner"
    admin = "Admin"
    technician = "Technician"


class Business(Base):
    __tablename__ = "businesses"

    id = Column(String, primary_key=True, default=lambda: gen_id("BIZ"))
    name = Column(String, nullable=False)
    primary_trade = Column(String, default="General")
    address = Column(String, nullable=True)
    plan = Column(String, default="Growth")
    seats = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="business")
    technicians = relationship("Technician", back_populates="business")
    jobs = relationship("Job", back_populates="business")
    templates = relationship("Template", back_populates="business")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: gen_id("USR"))
    business_id = Column(String, ForeignKey("businesses.id"))
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.owner)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="users")


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(String, primary_key=True, default=lambda: gen_id("TECH"))
    business_id = Column(String, ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    trade = Column(String, nullable=False)
    status = Column(Enum(TechStatus), default=TechStatus.available)
    compliance_pct = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="technicians")
    jobs = relationship("Job", back_populates="technician")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: gen_id("JOB"))
    business_id = Column(String, ForeignKey("businesses.id"))
    customer = Column(String, nullable=False)
    site_address = Column(String, nullable=True)
    job_type = Column(String, nullable=False)
    technician_id = Column(String, ForeignKey("technicians.id"), nullable=True)
    status = Column(Enum(JobStatus), default=JobStatus.scheduled)
    notes = Column(Text, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="jobs")
    technician = relationship("Technician", back_populates="jobs")
    captures = relationship("Capture", back_populates="job")
    documents = relationship("Document", back_populates="job")


class Capture(Base):
    """A raw voice note or photo uploaded from the field, pre-AI-processing."""
    __tablename__ = "captures"

    id = Column(String, primary_key=True, default=lambda: gen_id("CAP"))
    job_id = Column(String, ForeignKey("jobs.id"))
    kind = Column(String, nullable=False)  # "voice" | "photo"
    file_url = Column(String, nullable=False)
    transcript = Column(Text, nullable=True)       # filled in by Whisper task
    vision_labels = Column(JSON, nullable=True)     # filled in by vision task
    ocr_text = Column(JSON, nullable=True)          # filled in by OCR task
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="captures")


class Template(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True, default=lambda: gen_id("TPL"))
    business_id = Column(String, ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    trade = Column(String, nullable=False)
    field_map = Column(JSON, default=list)  # [{field, source, confidence}]
    times_used = Column(Integer, default=0)
    source_file_url = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="templates")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: gen_id("DOC"))
    job_id = Column(String, ForeignKey("jobs.id"))
    template_id = Column(String, ForeignKey("templates.id"), nullable=True)
    name = Column(String, nullable=False)
    extracted_fields = Column(JSON, default=list)  # [{field, value, source, confidence}]
    overall_confidence = Column(Float, default=0.0)
    status = Column(Enum(DocStatus), default=DocStatus.pending_review)
    file_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="documents")


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(String, primary_key=True, default=lambda: gen_id("RULE"))
    business_id = Column(String, ForeignKey("businesses.id"))
    trade = Column(String, nullable=False)
    required_fields = Column(JSON, default=list)  # list[str]


class ComplianceEvent(Base):
    __tablename__ = "compliance_events"

    id = Column(String, primary_key=True, default=lambda: gen_id("EVT"))
    job_id = Column(String, ForeignKey("jobs.id"))
    message = Column(String, nullable=False)
    severity = Column(Enum(Severity), default=Severity.medium)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
