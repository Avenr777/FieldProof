import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app import models, schemas, auth
from app.services import ai_pipeline, storage
from app.services.docx_extractor import extract_docx
from app.services.docx_writer import fill_docx

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[schemas.TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Template)
        .filter(models.Template.business_id == current_user.business_id)
        .all()
    )


@router.get("/{template_id}", response_model=schemas.TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_owned_template(db, template_id, current_user)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    tpl = _get_owned_template(db, template_id, current_user)
    db.delete(tpl)
    db.commit()
    return None


@router.post("/upload", response_model=schemas.TemplateOut, status_code=201)
async def upload_template(
    name: str = Form(...),
    trade: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    """
    Accepts an existing company form. For .docx files this runs the real
    docx_extractor pipeline (blank/checkbox detection, label inference,
    table field mapping) and stores the full result so the admin dashboard
    can review/correct fields and later fill + generate a completed
    document via POST /{template_id}/fill.

    Non-.docx uploads (e.g. a legacy PDF) fall back to the AI
    layout-detection stub in ai_pipeline.py, which only produces a
    summary field_map — there's no write-back path for those yet.
    """
    file_url = await storage.save_upload(file, prefix="templates")
    local_path = storage.resolve_local_path(file_url)

    extraction = None
    if local_path.lower().endswith(".docx"):
        extraction_dir = os.path.join(
            "uploads", "templates", "extracted", os.path.splitext(os.path.basename(local_path))[0]
        )
        extraction = extract_docx(local_path, extraction_dir)
        field_map = _simplify_field_map(extraction["fields"])
    else:
        field_map = await ai_pipeline.detect_template_fields(file_url)

    tpl = models.Template(
        business_id=current_user.business_id,
        name=name,
        trade=trade,
        field_map=field_map,
        extraction=extraction,
        source_file_url=file_url,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/{template_id}/fields")
def get_template_fields(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Returns the full docx_extractor output (elements + fields, each field
    with its label, inferred field_type, and locator) for the admin review
    screen. This is richer than TemplateOut.field_map, which is just a
    {field, source, confidence} summary for the template gallery card.
    """
    tpl = _get_owned_template(db, template_id, current_user)
    if not tpl.extraction:
        raise HTTPException(
            status_code=404,
            detail="This template has no extracted field data (it was likely uploaded as a non-.docx file)",
        )
    return tpl.extraction


@router.post("/{template_id}/fill", response_model=schemas.DocumentOut, status_code=201)
async def fill_template(
    template_id: str,
    payload: schemas.TemplateFillRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Runs docx_writer.fill_docx() against the template's original file using
    admin-supplied {field_id: value} pairs, saves the completed document,
    and creates a Document row for it (status Pending Review, same as
    AI-generated documents) linked to the given job.
    """
    tpl = _get_owned_template(db, template_id, current_user)
    if not tpl.extraction:
        raise HTTPException(status_code=400, detail="Template has no extracted field data to fill")

    job = (
        db.query(models.Job)
        .filter(models.Job.id == payload.job_id, models.Job.business_id == current_user.business_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    input_path = storage.resolve_local_path(tpl.source_file_url)
    output_dir = os.path.join("uploads", "documents")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{job.id}_{tpl.id}.docx")

    fill_docx(input_path, output_path, payload.values, tpl.extraction["fields"])

    fields_by_id = {f["field_id"]: f for f in tpl.extraction["fields"]}
    extracted_fields = [
        {
            "field": fields_by_id[fid].get("label") or fid,
            "value": str(value),
            "source": "Manual entry",
            "confidence": 100.0,
        }
        for fid, value in payload.values.items()
        if fid in fields_by_id
    ]

    doc = models.Document(
        job_id=job.id,
        template_id=tpl.id,
        name=tpl.name,
        extracted_fields=extracted_fields,
        overall_confidence=100.0,
        status=models.DocStatus.pending_review,
        file_url=f"/{output_path}",
    )
    db.add(doc)
    tpl.times_used += 1
    db.commit()
    db.refresh(doc)
    return doc


@router.patch("/{template_id}/fields/{field_id}")
def update_template_field(
    template_id: str,
    field_id: str,
    payload: schemas.TemplateFieldUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_owner_or_admin),
):
    """
    Updates the label and/or field_type of an extracted field in a template.
    Persists changes to tpl.extraction["fields"] and keeps tpl.field_map in sync.
    """
    tpl = _get_owned_template(db, template_id, current_user)
    if not tpl.extraction or "fields" not in tpl.extraction:
        raise HTTPException(
            status_code=404,
            detail="Template has no extracted field data to modify",
        )

    fields = tpl.extraction.get("fields", [])
    target_field = None
    for f in fields:
        if f.get("field_id") == field_id:
            target_field = f
            break

    if not target_field:
        raise HTTPException(status_code=404, detail=f"Field '{field_id}' not found in template")

    if payload.label is not None:
        target_field["label"] = payload.label.strip() if payload.label.strip() else None
    if payload.field_type is not None:
        target_field["field_type"] = payload.field_type

    # Re-calculate statistics if present
    if "statistics" in tpl.extraction:
        stats = tpl.extraction["statistics"]
        types_count = {}
        for f in fields:
            ft = f.get("field_type", "text")
            types_count[ft] = types_count.get(ft, 0) + 1
        stats["fields_by_type"] = types_count

    # Re-assign and flag modified for SQLAlchemy to commit JSON mutations
    tpl.extraction = dict(tpl.extraction)
    tpl.field_map = _simplify_field_map(fields)
    tpl.updated_at = datetime.utcnow()

    flag_modified(tpl, "extraction")
    flag_modified(tpl, "field_map")

    db.commit()
    db.refresh(tpl)
    return {"field": target_field, "extraction": tpl.extraction}


def _simplify_field_map(fields: list[dict]) -> list[dict]:
    """
    Collapses docx_extractor's rich field records (locator, kind, hint,
    etc.) into the {field, source, confidence} shape TemplateOut.field_map
    already exposes to the dashboard's template gallery/field-mapping
    panel. Confidence here reflects label-inference confidence, not
    extraction data confidence (there's no data yet - it's a fresh
    template) — fields where a label was successfully inferred score
    higher than ones that will need a name typed in by an admin.
    """
    simplified = []
    for f in fields:
        if f["kind"] == "multiline_blank_group":
            field_name = f.get("label") or f"Multi-line field ({f['line_count']} lines)"
        else:
            field_name = f.get("label") or f["field_id"]
        simplified.append({
            "field": field_name,
            "source": "Document template (auto-detected)",
            "confidence": 85.0 if f.get("label") else 40.0,
        })
    return simplified


def _get_owned_template(db: Session, template_id: str, current_user: models.User) -> models.Template:
    tpl = (
        db.query(models.Template)
        .filter(models.Template.id == template_id, models.Template.business_id == current_user.business_id)
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl
