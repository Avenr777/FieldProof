from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/technicians", tags=["technicians"])


def _serialize(db: Session, tech: models.Technician) -> schemas.TechnicianOut:
    active_jobs = (
        db.query(func.count(models.Job.id))
        .filter(
            models.Job.technician_id == tech.id,
            models.Job.status.in_([models.JobStatus.scheduled, models.JobStatus.in_progress]),
        )
        .scalar()
    )
    docs_this_week = (
        db.query(func.count(models.Document.id))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.technician_id == tech.id)
        .scalar()
    )
    capture_count = (
        db.query(func.count(models.Capture.id))
        .filter(models.Capture.technician_id == tech.id)
        .scalar()
    )
    return schemas.TechnicianOut(
        id=tech.id,
        name=tech.name,
        trade=tech.trade,
        status=tech.status.value,
        compliance_pct=tech.compliance_pct,
        active_jobs=active_jobs or 0,
        docs_this_week=docs_this_week or 0,
        user_id=tech.user_id,
        # Capture volume for the card; the per-upload breakdown lives in
        # GET /{tech_id}/detail.
        uploads_count=capture_count or 0,
    )


@router.get("", response_model=list[schemas.TechnicianOut])
def list_technicians(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    techs = db.query(models.Technician).filter(models.Technician.business_id == current_user.business_id).all()
    return [_serialize(db, t) for t in techs]


@router.post("", response_model=schemas.TechnicianOut, status_code=201)
def invite_technician(
    payload: schemas.TechnicianCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    if payload.email:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="A user with this email already exists")
        tech_user = models.User(
            business_id=current_user.business_id,
            full_name=payload.name,
            email=payload.email,
            hashed_password=auth.hash_password(payload.password or "technician123"),
            role=models.Role.technician,
        )
        db.add(tech_user)

    tech = models.Technician(
        business_id=current_user.business_id,
        name=payload.name,
        trade=payload.trade,
    )
    db.add(tech)
    db.commit()
    if payload.email:
        db.refresh(tech_user)
        tech.user_id = tech_user.id
        db.commit()
    db.refresh(tech)
    return _serialize(db, tech)


@router.get("/{tech_id}", response_model=schemas.TechnicianOut)
def get_technician(
    tech_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tech = _get_owned_tech(db, tech_id, current_user)
    return _serialize(db, tech)


@router.get("/{tech_id}/detail")
def get_technician_detail(
    tech_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Admin dashboard drill-down for one technician: every capture they've
    uploaded (voice/photo, with owner + template reference and processing
    state) and every document generated from their work with its review
    status.
    """
    tech = _get_owned_tech(db, tech_id, current_user)

    captures = (
        db.query(models.Capture)
        .filter(models.Capture.technician_id == tech.id)
        .order_by(models.Capture.created_at.desc())
        .all()
    )
    documents = (
        db.query(models.Document)
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.technician_id == tech.id)
        .order_by(models.Document.created_at.desc())
        .all()
    )

    templates = (
        db.query(models.Template)
        .filter(models.Template.technician_id == tech.id)
        .all()
    )

    return {
        "technician": _serialize(db, tech),
        "assigned_templates": [
            {"id": t.id, "name": t.name, "trade": t.trade, "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None}
            for t in templates
        ],
        "captures": [
            schemas.CaptureOut(
                id=c.id,
                job_id=c.job_id,
                template_id=c.template_id,
                kind=c.kind,
                file_url=c.file_url,
                processed=bool(c.processed),
                transcript=c.transcript,
                created_at=c.created_at,
            )
            for c in captures
        ],
        "documents": [
            schemas.TechnicianDocumentOut(
                id=d.id,
                job_id=d.job_id,
                name=d.name,
                overall_confidence=d.overall_confidence,
                status=d.status.value,
                file_url=d.file_url,
                created_at=d.created_at,
            )
            for d in documents
        ],
    }


def _get_owned_tech(db: Session, tech_id: str, current_user: models.User) -> models.Technician:
    tech = (
        db.query(models.Technician)
        .filter(models.Technician.id == tech_id, models.Technician.business_id == current_user.business_id)
        .first()
    )
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return tech
