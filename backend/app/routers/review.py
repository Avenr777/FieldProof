"""
Admin "review a technician submission" endpoints.

A technician's mobile capture session is grouped as one Job (see
routers/capture.py). When an admin opens one of those submissions to
verify the work, this router:

  1. GET /review/capture-session/{job_id}
     Returns the session's evidence (technician, template, transcripts,
     vision/OCR results per photo, compliance signals) plus an
     auto-suggested {field_id: value} map for the assigned template,
     pre-computed so the admin starts from a mostly-filled form.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.services.storage import resolve_local_path
from app.services.suggestion import build_suggestions

router = APIRouter(prefix="/review", tags=["review"])


def _require_operator(user: models.User) -> None:
    if user.role not in (models.Role.owner, models.Role.admin):
        raise HTTPException(status_code=403, detail="Only owners and admins can review submissions")


def _get_owned_job(db: Session, job_id: str, user: models.User) -> models.Job:
    job = (
        db.query(models.Job)
        .filter(models.Job.id == job_id, models.Job.business_id == user.business_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Capture session not found")
    return job


def _capture_public_dict(c: models.Capture) -> dict:
    """Capture with AI evidence attached; vision/OCR included inline."""
    return {
        "id": c.id,
        "job_id": c.job_id,
        "template_id": c.template_id,
        "kind": c.kind,
        "file_url": c.file_url,
        "processed": bool(c.processed),
        "transcript": c.transcript,
        "vision": c.vision_labels,
        "ocr": c.ocr_text,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/capture-sessions")
def list_capture_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """List technician submissions that do not yet have a generated document."""
    _require_operator(current_user)
    existing_document = (
        db.query(models.Document.id)
        .filter(models.Document.job_id == models.Job.id)
        .exists()
    )
    rows = (
        db.query(
            models.Job,
            models.Technician.name,
            func.count(models.Capture.id),
            func.sum(case((models.Capture.processed.is_(True), 1), else_=0)),
            func.max(models.Capture.created_at),
        )
        .join(models.Capture, models.Capture.job_id == models.Job.id)
        .outerjoin(models.Technician, models.Technician.id == models.Job.technician_id)
        .filter(models.Job.business_id == current_user.business_id)
        .filter(~existing_document)
        .group_by(models.Job.id, models.Technician.name)
        .order_by(func.max(models.Capture.created_at).desc())
        .all()
    )
    return [
        {
            "job_id": job.id,
            "customer": job.customer,
            "job_type": job.job_type,
            "status": job.status.value if hasattr(job.status, "value") else str(job.status),
            "technician_name": technician_name,
            "capture_count": capture_count,
            "processed_capture_count": processed_count or 0,
            "latest_capture_at": latest_capture_at.isoformat() if latest_capture_at else None,
        }
        for job, technician_name, capture_count, processed_count, latest_capture_at in rows
    ]


@router.get("/capture-session/{job_id}")
def review_capture_session(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    _require_operator(current_user)
    job = _get_owned_job(db, job_id, current_user)

    tech = (
        db.query(models.Technician)
        .filter(models.Technician.id == job.technician_id)
        .first()
    ) if job.technician_id else None

    captures = (
        db.query(models.Capture)
        .filter(models.Capture.job_id == job.id)
        .order_by(models.Capture.created_at.asc())
        .all()
    )

    unresolved_flags = (
        db.query(models.ComplianceEvent)
        .filter(
            models.ComplianceEvent.job_id == job.id,
            models.ComplianceEvent.resolved == False,  # noqa: E712 — SQLAlchemy filter
        )
        .order_by(models.ComplianceEvent.created_at.desc())
        .all()
    )

    # The template this session submitted against (from captures, falling
    # back to any assignment for the technician).
    template = None
    for c in captures:
        if c.template_id:
            template = db.query(models.Template).filter(
                models.Template.id == c.template_id,
                models.Template.business_id == current_user.business_id,
            ).first()
            if template:
                break
    if template is None and tech:
        asn = (
            db.query(models.TemplateAssignment)
            .filter(models.TemplateAssignment.technician_id == tech.id)
            .first()
        )
        if asn:
            template = (
                db.query(models.Template)
                .filter(
                    models.Template.id == asn.template_id,
                    models.Template.business_id == current_user.business_id,
                )
                .first()
            )

    # Document(s) already generated for this session, if any.
    docs = db.query(models.Document).filter(models.Document.job_id == job.id).all()

    # --- Auto-suggestion engine -------------------------------------------
    transcript = " ".join(c.transcript for c in captures if c.transcript).strip()
    vision_results = [c.vision_labels for c in captures if c.vision_labels]
    ocr_results = [c.ocr_text for c in captures if c.ocr_text]

    suggestions: dict[str, dict] = {}
    fields: list[dict] = []
    if template and template.extraction and template.extraction.get("fields"):
        fields = template.extraction["fields"]
        suggestions = build_suggestions(
            fields,
            job=job,
            tech=tech,
            transcript=transcript,
            vision_results=vision_results,
            ocr_results=ocr_results,
        )

    filled = {s.get("value") for s in suggestions.values() if s.get("value") not in (None, "")}

    return {
        "job": {
            "id": job.id,
            "customer": job.customer,
            "site_address": job.site_address,
            "job_type": job.job_type,
            "status": job.status.value if hasattr(job.status, "value") else str(job.status),
            "notes": job.notes,
            "scheduled_at": job.scheduled_at.isoformat() if job.scheduled_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        },
        "technician": (
            {
                "id": tech.id,
                "name": tech.name,
                "trade": tech.trade,
                "status": tech.status.value if hasattr(tech.status, "value") else str(tech.status),
            }
            if tech
            else None
        ),
        "template": (
            {
                "id": template.id,
                "name": template.name,
                "trade": template.trade,
                "source_file_url": template.source_file_url,
                "fields": fields,
            }
            if template
            else None
        ),
        "captures": [_capture_public_dict(c) for c in captures],
        "compliance_flags": [
            {
                "id": e.id,
                "message": e.message,
                "severity": e.severity.value if hasattr(e.severity, "value") else str(e.severity),
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in unresolved_flags
        ],
        "documents": [
            {"id": d.id, "name": d.name, "status": d.status.value if hasattr(d.status, "value") else str(d.status), "file_url": d.file_url}
            for d in docs
        ],
        "suggestions": suggestions,
        "suggestion_stats": {
            "total_fields": len(fields),
            "suggested": len(suggestions),
            "blank": max(len(fields) - len(suggestions), 0),
            "with_values": len(filled),
        },
    }
