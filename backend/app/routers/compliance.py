from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/rules", response_model=list[schemas.ComplianceRuleOut])
def list_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.ComplianceRule)
        .filter(models.ComplianceRule.business_id == current_user.business_id)
        .all()
    )


@router.get("/events", response_model=list[schemas.ComplianceEventOut])
def list_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.ComplianceEvent)
        .join(models.Job, models.Job.id == models.ComplianceEvent.job_id)
        .filter(models.Job.business_id == current_user.business_id)
        .order_by(models.ComplianceEvent.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/rate")
def compliance_rate(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Fraction of jobs with no unresolved High/Medium compliance events."""
    total_jobs = (
        db.query(func.count(models.Job.id))
        .filter(models.Job.business_id == current_user.business_id)
        .scalar()
    ) or 0

    flagged_jobs = (
        db.query(func.count(func.distinct(models.ComplianceEvent.job_id)))
        .join(models.Job, models.Job.id == models.ComplianceEvent.job_id)
        .filter(
            models.Job.business_id == current_user.business_id,
            models.ComplianceEvent.resolved.is_(False),
        )
        .scalar()
    ) or 0

    rate = 100.0 if total_jobs == 0 else round(100 * (total_jobs - flagged_jobs) / total_jobs, 1)
    return {"total_jobs": total_jobs, "flagged_jobs": flagged_jobs, "compliance_rate": rate}
