import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
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


@router.get("/search", response_model=list[schemas.DocumentOut])
def search_documents(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    term = q.lower().strip()
    docs = (
        db.query(models.Document)
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == current_user.business_id)
        .all()
    )

    matching = []
    for d in docs:
        if term in d.name.lower() or term in d.id.lower():
            matching.append(d)
            continue
        # Search extracted fields
        fields_str = json.dumps(d.extracted_fields or []).lower()
        if term in fields_str:
            matching.append(d)

    return matching



@router.get("/export")
def export_documents_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    docs = (
        db.query(models.Document)
        .join(models.Job, models.Job.id == models.Document.job_id)
        .filter(models.Job.business_id == current_user.business_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Document ID", "Document Name", "Job ID", "Status", "Confidence %", "Field Name", "Field Value", "Confidence"])

    for d in docs:
        fields = d.extracted_fields or []
        if not fields:
            writer.writerow([d.id, d.name, d.job_id, d.status.value if hasattr(d.status, "value") else str(d.status), d.overall_confidence, "", "", ""])
        else:
            for f in fields:
                field_name = f.get("field", "") if isinstance(f, dict) else getattr(f, "field", "")
                field_val = f.get("value", "") if isinstance(f, dict) else getattr(f, "value", "")
                field_conf = f.get("confidence", 0) if isinstance(f, dict) else getattr(f, "confidence", 0)
                writer.writerow([d.id, d.name, d.job_id, d.status.value if hasattr(d.status, "value") else str(d.status), d.overall_confidence, field_name, field_val, field_conf])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=documents_export.csv"},
    )


@router.get("/{doc_id}/export")
def export_single_document_csv(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_owned_doc(db, doc_id, current_user)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Document ID", "Document Name", "Job ID", "Status", "Field Name", "Field Value", "Confidence"])

    fields = doc.extracted_fields or []
    for f in fields:
        field_name = f.get("field", "") if isinstance(f, dict) else getattr(f, "field", "")
        field_val = f.get("value", "") if isinstance(f, dict) else getattr(f, "value", "")
        field_conf = f.get("confidence", 0) if isinstance(f, dict) else getattr(f, "confidence", 0)
        writer.writerow([doc.id, doc.name, doc.job_id, doc.status.value if hasattr(doc.status, "value") else str(doc.status), field_name, field_val, field_conf])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={doc.id}_export.csv"},
    )


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_owned_doc(db, doc_id, current_user)
    return doc


@router.get("/{doc_id}/history", response_model=list[schemas.DocumentReviewEventOut])
def get_document_history(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    doc = _get_owned_doc(db, doc_id, current_user)
    events = (
        db.query(models.DocumentReviewEvent)
        .filter(models.DocumentReviewEvent.document_id == doc.id)
        .order_by(models.DocumentReviewEvent.created_at.desc())
        .all()
    )
    res = []
    for ev in events:
        user_name = ev.user.full_name if ev.user else "System"
        res.append(schemas.DocumentReviewEventOut(
            id=ev.id,
            document_id=ev.document_id,
            user_id=ev.user_id,
            user_name=user_name,
            action=ev.action,
            comment=ev.comment,
            created_at=ev.created_at,
        ))
    return res


@router.post("/{doc_id}/review", response_model=schemas.DocumentOut)
async def review_document(
    doc_id: str,
    payload: schemas.DocumentReviewAction,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    doc = _get_owned_doc(db, doc_id, current_user)

    if payload.action == "approve":
        # Check blocking compliance flags for this job
        blocking_events = (
            db.query(models.ComplianceEvent)
            .filter(
                models.ComplianceEvent.job_id == doc.job_id,
                models.ComplianceEvent.resolved == False,
                models.ComplianceEvent.severity == models.Severity.high,
            )
            .all()
        )
        if blocking_events:
            msg = blocking_events[0].message
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve document: Unresolved blocking compliance alert for job {doc.job_id}: {msg}",
            )

        doc.status = models.DocStatus.approved
    elif payload.action == "request_changes":
        doc.status = models.DocStatus.pending_review
    else:
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'request_changes'")

    # Log review event
    review_evt = models.DocumentReviewEvent(
        document_id=doc.id,
        user_id=current_user.id,
        action=payload.action,
        comment=payload.comment,
    )
    db.add(review_evt)

    db.commit()
    db.refresh(doc)
    await manager.broadcast({"event": "document_reviewed", "document_id": doc.id, "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status)})
    return doc



@router.patch("/{doc_id}/fields", response_model=schemas.DocumentOut)
async def patch_document_fields(
    doc_id: str,
    payload: schemas.DocumentFieldPatch,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Reviewer edits one or more extracted fields on a document.

    Each changed field is appended to ``Document.field_edit_log`` so the
    correction-rate can be measured for the paper (how often the AI was wrong
    and a human had to fix it).

    Body::

        {
            "edits": [
                {"field": "voltage", "new_value": "240V"},
                {"field": "rating",  "new_value": "32A"}
            ],
            "comment": "Voltage mis-read by model"
        }
    """
    doc = _get_owned_doc(db, doc_id, current_user)

    fields: list[dict] = list(doc.extracted_fields or [])
    edit_log: list[dict] = list(doc.field_edit_log or [])
    now_iso = datetime.now(timezone.utc).isoformat()

    field_index = {f["field"]: i for i, f in enumerate(fields) if isinstance(f, dict)}

    for edit in payload.edits:
        old_value = None
        if edit.field in field_index:
            old_value = fields[field_index[edit.field]].get("value")
            fields[field_index[edit.field]]["value"] = edit.new_value
            # Reset grounding/status so the edit is treated as human-verified
            fields[field_index[edit.field]]["source"] = "human_edit"
            fields[field_index[edit.field]]["grounded"] = True
            fields[field_index[edit.field]]["status"] = "ok"
        else:
            # Field not yet extracted — add a new row
            fields.append({
                "field": edit.field,
                "value": edit.new_value,
                "source": "human_edit",
                "confidence": 1.0,
                "evidence": None,
                "grounded": True,
                "status": "ok",
            })

        edit_log.append({
            "field": edit.field,
            "old_value": old_value,
            "new_value": edit.new_value,
            "user_id": current_user.id,
            "timestamp": now_iso,
            "comment": payload.comment,
        })

    doc.extracted_fields = fields
    doc.field_edit_log = edit_log

    # Recompute overall confidence: human edits count as 1.0
    confidences = [f.get("confidence", 0.0) for f in fields if isinstance(f, dict)]
    doc.overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    db.commit()
    db.refresh(doc)

    await manager.broadcast({
        "event": "document_fields_patched",
        "document_id": doc.id,
        "edited_fields": [e.field for e in payload.edits],
        "editor": current_user.full_name,
    })
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

