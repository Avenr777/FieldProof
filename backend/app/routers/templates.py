from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.services import ai_pipeline, storage

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
    tpl = (
        db.query(models.Template)
        .filter(models.Template.id == template_id, models.Template.business_id == current_user.business_id)
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.post("/upload", response_model=schemas.TemplateOut, status_code=201)
async def upload_template(
    name: str = Form(...),
    trade: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Accepts an existing company PDF/Word form. The file is stored, then handed
    to the AI layout-detection pipeline to infer field names + likely data
    sources, matching the "AI Template Mapping" flow in the project spec.
    """
    file_url = await storage.save_upload(file, prefix="templates")
    detected_fields = await ai_pipeline.detect_template_fields(file_url)

    tpl = models.Template(
        business_id=current_user.business_id,
        name=name,
        trade=trade,
        field_map=detected_fields,
        source_file_url=file_url,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl
