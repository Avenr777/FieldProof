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
    cancelled = "Cancelled"


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
    integrations = relationship("Integration", back_populates="business")


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
    # A technician belongs to exactly one company; this links the Technician
    # profile to the User login account for that same person.
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    trade = Column(String, nullable=False)
    status = Column(Enum(TechStatus), default=TechStatus.available)
    compliance_pct = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="technicians")
    user = relationship("User")
    jobs = relationship("Job", back_populates="technician")
    captures = relationship("Capture", back_populates="technician")


class TemplateAssignment(Base):
    __tablename__ = "template_assignments"

    id = Column(String, primary_key=True, default=lambda: gen_id("ASN"))
    template_id = Column(String, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False)
    technician_id = Column(String, ForeignKey("technicians.id", ondelete="CASCADE"), nullable=False)
    assignment_type = Column(String, default="one_time")  # "one_time" | "repeating"
    frequency = Column(String, nullable=True)  # "daily" | "weekly" | "monthly" | "custom"
    frequency_details = Column(JSON, nullable=True)  # { interval, days_of_week, day_of_month, custom_notes }
    due_date = Column(DateTime, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="active")  # "active" | "completed" | "paused"
    notes = Column(Text, nullable=True)
    required_proof_types = Column(JSON, default=lambda: ["photo", "voice"])  # ["photo", "voice", "form_fill", "text_note"]
    min_photos = Column(Integer, default=1)
    require_voice = Column(Boolean, default=False)
    technician_instructions = Column(Text, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("Template", backref="assignments")
    technician = relationship("Technician", backref="assignments")


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
    # Owner of the upload — the technician (and their company) who produced
    # it. Kept directly on the row so storage stays auditable even if the
    # grouping job/template links change later.
    technician_id = Column(String, ForeignKey("technicians.id"), nullable=True, index=True)
    template_id = Column(String, ForeignKey("templates.id"), nullable=True, index=True)
    kind = Column(String, nullable=False)  # "voice" | "photo"
    file_url = Column(String, nullable=False)
    transcript = Column(Text, nullable=True)        # plain text; backward-compat for UI display
    transcript_json = Column(JSON, nullable=True)   # full Transcript dataclass (segments, logprob, latency, model)
    stt_model = Column(String, nullable=True)        # which Whisper model produced the transcript
    stt_latency_s = Column(Float, nullable=True)    # transcription wall-clock time (for eval)
    vision_labels = Column(JSON, nullable=True)     # filled in by vision task
    ocr_text = Column(JSON, nullable=True)          # filled in by OCR task
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)  # last error message if processing failed
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="captures")
    technician = relationship("Technician", back_populates="captures")
    template = relationship("Template")


class Template(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True, default=lambda: gen_id("TPL"))
    business_id = Column(String, ForeignKey("businesses.id"))
    name = Column(String, nullable=False)
    trade = Column(String, nullable=False)
    field_map = Column(JSON, default=list)  # [{field, source, confidence}] - dashboard summary view
    times_used = Column(Integer, default=0)
    source_file_url = Column(String, nullable=True)
    extraction = Column(JSON, nullable=True)
    # The one technician this template is assigned to (operator/owner action
    # from the dashboard). A technician only sees templates assigned to them.
    technician_id = Column(String, ForeignKey("technicians.id"), nullable=True, index=True)
    assigned_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="templates")
    technician = relationship("Technician")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: gen_id("DOC"))
    job_id = Column(String, ForeignKey("jobs.id"))
    template_id = Column(String, ForeignKey("templates.id"), nullable=True)
    name = Column(String, nullable=False)
    extracted_fields = Column(JSON, default=list)  # [{field, value, source, confidence, evidence, grounded, status}]
    overall_confidence = Column(Float, default=0.0)
    status = Column(Enum(DocStatus), default=DocStatus.pending_review)
    file_url = Column(String, nullable=True)
    auto_filled = Column(Boolean, default=True)
    field_sources = Column(JSON, nullable=True)
    # Reviewer edits: [{field, old_value, new_value, user_id, timestamp}] — correction-rate data
    field_edit_log = Column(JSON, default=list)
    # LLM extraction metadata for evaluation
    llm_meta = Column(JSON, nullable=True)  # {prompt_version, model, tokens, latency_s, validation_status}
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="documents")
    review_events = relationship("DocumentReviewEvent", back_populates="document")


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, default=lambda: gen_id("INT"))
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False)
    name = Column(String, nullable=False)  # "CRM" | "QuickBooks" | "Google Calendar"
    enabled = Column(Boolean, default=False)
    config = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    business = relationship("Business", back_populates="integrations")


class DocumentReviewEvent(Base):
    __tablename__ = "document_review_events"

    id = Column(String, primary_key=True, default=lambda: gen_id("REV"))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # "approve" | "request_changes"
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="review_events")
    user = relationship("User")


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(String, primary_key=True, default=lambda: gen_id("RULE"))
    business_id = Column(String, ForeignKey("businesses.id"))
    trade = Column(String, nullable=False)
    required_fields = Column(JSON, default=list)


class ComplianceEvent(Base):
    __tablename__ = "compliance_events"

    id = Column(String, primary_key=True, default=lambda: gen_id("EVT"))
    job_id = Column(String, ForeignKey("jobs.id"))
    message = Column(String, nullable=False)
    severity = Column(Enum(Severity), default=Severity.medium)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"

    id = Column(String, primary_key=True, default=lambda: gen_id("MET"))
    business_id = Column(String, ForeignKey("businesses.id"), nullable=False, index=True)
    snapshot_date = Column(DateTime, nullable=False, index=True)
    avg_documentation_time_mins = Column(Float, default=0.0)
    avg_accuracy_pct = Column(Float, default=0.0)
    compliance_rate_pct = Column(Float, default=100.0)
    total_jobs_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
