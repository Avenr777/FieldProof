from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Auth ----------

class SignupRequest(BaseModel):
    business_name: str
    full_name: str
    email: EmailStr
    password: str
    primary_trade: str = "General"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: str
    role: str
    business_id: str


# ---------- Technicians ----------

class TechnicianBase(BaseModel):
    name: str
    trade: str


class TechnicianCreate(TechnicianBase):
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class TechnicianOut(TechnicianBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    compliance_pct: float
    active_jobs: int = 0
    docs_this_week: int = 0
    user_id: Optional[str] = None
    uploads_count: int = 0


# ---------- Template assignment ----------

class TemplateAssignRequest(BaseModel):
    technician_id: Optional[str] = None  # None = unassign


# ---------- Capture (voice / photo ingestion) ----------

class CaptureStartRequest(BaseModel):
    """Body for POST /capture/start — opens a capture session for a template."""
    template_id: str


class CaptureCreated(BaseModel):
    id: str
    job_id: str
    kind: str
    status: str = "queued"
    technician_id: Optional[str] = None
    template_id: Optional[str] = None


# ---------- Technician field detail (uploads + document status) ----------

class CaptureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: Optional[str] = None
    template_id: Optional[str] = None
    kind: str
    file_url: str
    processed: bool
    transcript: Optional[str] = None
    created_at: datetime


class TechnicianDocumentOut(BaseModel):
    """Document with the fields the technician drill-down needs."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    name: str
    overall_confidence: float
    status: str
    file_url: Optional[str] = None
    created_at: datetime


# ---------- Jobs ----------

class JobCreate(BaseModel):
    customer: str
    site_address: Optional[str] = None
    job_type: str
    technician_id: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class JobUpdate(BaseModel):
    status: Optional[str] = None
    technician_id: Optional[str] = None
    notes: Optional[str] = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer: str
    site_address: Optional[str]
    job_type: str
    technician_id: Optional[str]
    status: str
    notes: Optional[str]
    scheduled_at: Optional[datetime]
    created_at: datetime


# ---------- Templates ----------

class TemplateFieldMapping(BaseModel):
    field: str
    source: str
    confidence: float


class TemplateFieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None


class TemplateFillRequest(BaseModel):
    """
    Body for POST /templates/{id}/fill. `values` is {field_id: value} where
    field_id comes from the template's extracted "fields" list (see
    GET /templates/{id}/fields). Most fields take a string; checkbox_option
    fields take a truthy/falsy value (bool, "yes"/"no", 1/0, etc.).
    """
    job_id: str
    values: dict[str, Any]


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    trade: str
    field_map: list[TemplateFieldMapping]
    times_used: int
    technician_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    updated_at: datetime


# ---------- Documents ----------

class DocumentField(BaseModel):
    field: str
    value: Optional[str] = None
    source: str
    confidence: float


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    name: str
    extracted_fields: list[DocumentField]
    overall_confidence: float
    status: str
    file_url: Optional[str] = None
    created_at: datetime


class DocumentReviewAction(BaseModel):
    action: str  # "approve" | "request_changes"
    comment: Optional[str] = None


# ---------- Compliance ----------

class ComplianceRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    trade: str
    required_fields: list[str]


class ComplianceEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    message: str
    severity: str
    resolved: bool
    created_at: datetime


# ---------- Capture (voice / photo ingestion) ----------

# ---------- Analytics ----------

class TrendPoint(BaseModel):
    label: str
    value: float


class AnalyticsSummary(BaseModel):
    active_jobs_today: int
    documents_pending_review: int
    open_compliance_alerts: int
    ai_auto_approval_rate: float
    avg_documentation_accuracy: float
    weekly_docs: list[TrendPoint]
    documentation_time_trend: list[TrendPoint]
    accuracy_trend: list[TrendPoint]
    compliance_trend: list[TrendPoint]
