from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.websocket import manager

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[schemas.DocumentOut])
def list_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    q = (
        db.query(models.Document)
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == current_user.business_id)
    )
    if status_filter:
        q = q.filter(models.Document.status == status_filter)
    return q.order_by(models.Document.created_at.desc()).all()


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_owned_doc(db, doc_id, current_user)
    return doc


@router.post("/{doc_id}/review", response_model=schemas.DocumentOut)
async def review_document(
    doc_id: str,
    payload: schemas.DocumentReviewAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    doc = _get_owned_doc(db, doc_id, current_user)

    if payload.action == "approve":
        doc.status = models.DocStatus.approved
    elif payload.action == "request_changes":
        doc.status = models.DocStatus.pending_review
    else:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'request_changes'")

    db.commit()
    db.refresh(doc)
    await manager.broadcast({"event": "document_reviewed", "document_id": doc.id, "status": doc.status.value})
    return doc


def _get_owned_doc(db: Session, doc_id: str, current_user: models.User) -> models.Document:
    doc = (
        db.query(models.Document)
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Document.id == doc_id, models.Job.business_id == current_user.business_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
