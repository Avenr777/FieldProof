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
    return schemas.TechnicianOut(
        id=tech.id,
        name=tech.name,
        trade=tech.trade,
        status=tech.status.value,
        compliance_pct=tech.compliance_pct,
        active_jobs=active_jobs or 0,
        docs_this_week=docs_this_week or 0,
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
    current_user: models.User = Depends(auth.get_current_user),
):
    tech = models.Technician(
        business_id=current_user.business_id,
        name=payload.name,
        trade=payload.trade,
    )
    db.add(tech)
    db.commit()
    db.refresh(tech)
    return _serialize(db, tech)


@router.get("/{tech_id}", response_model=schemas.TechnicianOut)
def get_technician(
    tech_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    tech = (
        db.query(models.Technician)
        .filter(models.Technician.id == tech_id, models.Technician.business_id == current_user.business_id)
        .first()
    )
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    return _serialize(db, tech)
