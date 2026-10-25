from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _serialize_assignment(asn: models.TemplateAssignment) -> schemas.AssignmentOut:
    return schemas.AssignmentOut(
        id=asn.id,
        template_id=asn.template_id,
        template_name=asn.template.name if asn.template else "Unknown Template",
        template_trade=asn.template.trade if asn.template else "General",
        technician_id=asn.technician_id,
        technician_name=asn.technician.name if asn.technician else "Unknown Technician",
        technician_trade=asn.technician.trade if asn.technician else "General",
        assignment_type=asn.assignment_type or "one_time",
        frequency=asn.frequency,
        frequency_details=asn.frequency_details,
        due_date=asn.due_date,
        start_date=asn.start_date,
        end_date=asn.end_date,
        status=asn.status or "active",
        notes=asn.notes,
        required_proof_types=asn.required_proof_types,
        min_photos=asn.min_photos,
        require_voice=asn.require_voice,
        technician_instructions=asn.technician_instructions,
        assigned_at=asn.assigned_at or datetime.utcnow(),
    )


@router.get("", response_model=list[schemas.AssignmentOut])
def list_assignments(
    technician_id: Optional[str] = Query(None),
    template_id: Optional[str] = Query(None),
    assignment_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """List document assignments for the current business."""
    query = (
        db.query(models.TemplateAssignment)
        .join(models.Template, models.TemplateAssignment.template_id == models.Template.id)
        .filter(models.Template.business_id == current_user.business_id)
    )

    if technician_id:
        query = query.filter(models.TemplateAssignment.technician_id == technician_id)
    if template_id:
        query = query.filter(models.TemplateAssignment.template_id == template_id)
    if assignment_type:
        query = query.filter(models.TemplateAssignment.assignment_type == assignment_type)
    if status:
        query = query.filter(models.TemplateAssignment.status == status)

    assignments = query.order_by(models.TemplateAssignment.assigned_at.desc()).all()
    return [_serialize_assignment(a) for a in assignments]


@router.post("", response_model=list[schemas.AssignmentOut], status_code=201)
def create_assignments(
    payload: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    """Create one-time or repeating document assignments for technicians."""
    if not payload.template_ids:
        raise HTTPException(status_code=400, detail="At least one template must be selected")
    if not payload.technician_ids:
        raise HTTPException(status_code=400, detail="At least one technician must be selected")

    # Validate templates belong to this business
    templates = (
        db.query(models.Template)
        .filter(
            models.Template.id.in_(payload.template_ids),
            models.Template.business_id == current_user.business_id,
        )
        .all()
    )
    if len(templates) != len(set(payload.template_ids)):
        raise HTTPException(status_code=404, detail="One or more specified templates were not found")

    # Validate technicians belong to this business
    technicians = (
        db.query(models.Technician)
        .filter(
            models.Technician.id.in_(payload.technician_ids),
            models.Technician.business_id == current_user.business_id,
        )
        .all()
    )
    if len(technicians) != len(set(payload.technician_ids)):
        raise HTTPException(status_code=404, detail="One or more specified technicians were not found")

    created_or_updated = []
    for tpl in templates:
        for tech in technicians:
            existing = (
                db.query(models.TemplateAssignment)
                .filter(
                    models.TemplateAssignment.template_id == tpl.id,
                    models.TemplateAssignment.technician_id == tech.id,
                )
                .first()
            )

            if existing:
                existing.assignment_type = payload.assignment_type
                existing.frequency = payload.frequency
                existing.frequency_details = payload.frequency_details
                existing.due_date = payload.due_date
                existing.start_date = payload.start_date
                existing.end_date = payload.end_date
                existing.status = "active"
                existing.notes = payload.notes
                existing.required_proof_types = (
                    payload.required_proof_types
                    if payload.required_proof_types is not None
                    else ["photo", "voice"]
                )
                existing.min_photos = payload.min_photos if payload.min_photos is not None else 1
                existing.require_voice = payload.require_voice if payload.require_voice is not None else False
                existing.technician_instructions = payload.technician_instructions
                existing.assigned_at = datetime.utcnow()
                asn = existing
            else:
                asn = models.TemplateAssignment(
                    template_id=tpl.id,
                    technician_id=tech.id,
                    assignment_type=payload.assignment_type,
                    frequency=payload.frequency,
                    frequency_details=payload.frequency_details,
                    due_date=payload.due_date,
                    start_date=payload.start_date,
                    end_date=payload.end_date,
                    status="active",
                    notes=payload.notes,
                    required_proof_types=(
                        payload.required_proof_types
                        if payload.required_proof_types is not None
                        else ["photo", "voice"]
                    ),
                    min_photos=payload.min_photos if payload.min_photos is not None else 1,
                    require_voice=payload.require_voice if payload.require_voice is not None else False,
                    technician_instructions=payload.technician_instructions,
                    assigned_at=datetime.utcnow(),
                )
                db.add(asn)

            # Update legacy column for single tech backward compatibility
            tpl.technician_id = tech.id
            tpl.assigned_at = datetime.utcnow()

            created_or_updated.append(asn)

    db.commit()
    for asn in created_or_updated:
        db.refresh(asn)

    return [_serialize_assignment(a) for a in created_or_updated]


@router.patch("/{assignment_id}", response_model=schemas.AssignmentOut)
def update_assignment(
    assignment_id: str,
    payload: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    """Update an existing document assignment."""
    asn = (
        db.query(models.TemplateAssignment)
        .join(models.Template, models.TemplateAssignment.template_id == models.Template.id)
        .filter(
            models.TemplateAssignment.id == assignment_id,
            models.Template.business_id == current_user.business_id,
        )
        .first()
    )
    if not asn:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if payload.assignment_type is not None:
        asn.assignment_type = payload.assignment_type
    if payload.frequency is not None:
        asn.frequency = payload.frequency
    if payload.frequency_details is not None:
        asn.frequency_details = payload.frequency_details
    if payload.due_date is not None:
        asn.due_date = payload.due_date
    if payload.start_date is not None:
        asn.start_date = payload.start_date
    if payload.end_date is not None:
        asn.end_date = payload.end_date
    if payload.status is not None:
        asn.status = payload.status
    if payload.notes is not None:
        asn.notes = payload.notes
    if payload.required_proof_types is not None:
        asn.required_proof_types = payload.required_proof_types
    if payload.min_photos is not None:
        asn.min_photos = payload.min_photos
    if payload.require_voice is not None:
        asn.require_voice = payload.require_voice
    if payload.technician_instructions is not None:
        asn.technician_instructions = payload.technician_instructions

    db.commit()
    db.refresh(asn)
    return _serialize_assignment(asn)


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    """Revoke/delete a document assignment."""
    asn = (
        db.query(models.TemplateAssignment)
        .join(models.Template, models.TemplateAssignment.template_id == models.Template.id)
        .filter(
            models.TemplateAssignment.id == assignment_id,
            models.Template.business_id == current_user.business_id,
        )
        .first()
    )
    if not asn:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(asn)
    db.commit()
    return None
