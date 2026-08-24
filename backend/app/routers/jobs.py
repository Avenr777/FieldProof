from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.websocket import manager

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[schemas.JobOut])
def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    technician_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = db.query(models.Job).filter(models.Job.business_id == current_user.business_id)
    if status_filter:
        q = q.filter(models.Job.status == status_filter)
    if technician_id:
        q = q.filter(models.Job.technician_id == technician_id)
    return q.order_by(models.Job.created_at.desc()).all()


@router.post("", response_model=schemas.JobOut, status_code=201)
async def create_job(
    payload: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    job = models.Job(business_id=current_user.business_id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    await manager.broadcast({"event": "job_created", "job_id": job.id})
    return job


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    job = (
        db.query(models.Job)
        .filter(models.Job.id == job_id, models.Job.business_id == current_user.business_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=schemas.JobOut)
async def update_job(
    job_id: str,
    payload: schemas.JobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    job = (
        db.query(models.Job)
        .filter(models.Job.id == job_id, models.Job.business_id == current_user.business_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)
    await manager.broadcast({"event": "job_updated", "job_id": job.id, "status": job.status.value})
    return job
