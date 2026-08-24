from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=schemas.AnalyticsSummary)
def summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    biz_id = current_user.business_id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    active_jobs_today = (
        db.query(func.count(models.Job.id))
        .filter(models.Job.business_id == biz_id, models.Job.created_at >= today_start)
        .scalar()
    ) or 0

    docs_pending = (
        db.query(func.count(models.Document.id))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == biz_id, models.Document.status == models.DocStatus.pending_review)
        .scalar()
    ) or 0

    open_alerts = (
        db.query(func.count(models.ComplianceEvent.id))
        .join(models.Job, models.Job.id == models.ComplianceEvent.job_id)
        .filter(models.Job.business_id == biz_id, models.ComplianceEvent.resolved.is_(False))
        .scalar()
    ) or 0

    total_docs = (
        db.query(func.count(models.Document.id))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == biz_id)
        .scalar()
    ) or 0
    approved_or_sent = (
        db.query(func.count(models.Document.id))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(
            models.Job.business_id == biz_id,
            models.Document.status.in_([models.DocStatus.approved, models.DocStatus.sent]),
        )
        .scalar()
    ) or 0
    auto_approval_rate = round(100 * approved_or_sent / total_docs, 1) if total_docs else 0.0

    avg_confidence = (
        db.query(func.avg(models.Document.overall_confidence))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == biz_id)
        .scalar()
    )
    avg_confidence = round(avg_confidence, 1) if avg_confidence else 0.0

    # Last 7 days of document volume, by weekday label
    since = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.query(func.date(models.Document.created_at), func.count(models.Document.id))
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == biz_id, models.Document.created_at >= since)
        .group_by(func.date(models.Document.created_at))
        .all()
    )
    weekly_docs = [schemas.TrendPoint(label=str(day), value=count) for day, count in rows]

    return schemas.AnalyticsSummary(
        active_jobs_today=active_jobs_today,
        documents_pending_review=docs_pending,
        open_compliance_alerts=open_alerts,
        ai_auto_approval_rate=auto_approval_rate,
        avg_documentation_accuracy=avg_confidence,
        weekly_docs=weekly_docs,
        # These three trends depend on historical snapshots you don't have yet
        # on a fresh install; wire up a nightly Celery job that snapshots them
        # into a metrics table once there's real usage data to trend on.
        documentation_time_trend=[],
        accuracy_trend=[],
        compliance_trend=[],
    )
