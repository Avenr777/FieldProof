from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.services import storage

router = APIRouter(prefix="/capture", tags=["capture"])


@router.post("", response_model=schemas.CaptureCreated, status_code=201)
async def create_capture(
    job_id: str = Form(...),
    kind: str = Form(...),  # "voice" | "photo"
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Field technician's core action: record a voice note or snap a photo.
    The file is stored, a Capture row is created, and processing is handed
    off to the Celery task queue so the mobile app gets an instant response
    instead of waiting on Whisper/vision/OCR to finish.
    """
    if kind not in ("voice", "photo"):
        raise HTTPException(status_code=400, detail="kind must be 'voice' or 'photo'")

    job = (
        db.query(models.Job)
        .filter(models.Job.id == job_id, models.Job.business_id == current_user.business_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    file_url = await storage.save_upload(file, prefix=kind)

    capture = models.Capture(job_id=job_id, kind=kind, file_url=file_url)
    db.add(capture)
    db.commit()
    db.refresh(capture)

    # Deferred import avoids requiring a running Redis instance just to
    # import the FastAPI app (e.g. when running tests without a worker).
    try:
        from app.tasks import process_capture
        process_capture.delay(capture.id)
    except Exception as e:
        import logging
        logging.getLogger("fieldproof.capture").warning(f"Could not enqueue Celery task (Redis offline?): {e}")

    return schemas.CaptureCreated(id=capture.id, job_id=job_id, kind=kind)
