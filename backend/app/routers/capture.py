from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.services import storage

router = APIRouter(prefix="/capture", tags=["capture"])


def _get_technician_for_user(db: Session, user: models.User) -> models.Technician | None:
    """Resolve the Technician profile that belongs to this login (one company, one profile)."""
    return (
        db.query(models.Technician)
        .filter(models.Technician.business_id == user.business_id, models.Technician.user_id == user.id)
        .first()
    )


def _resolve_assignment(
    db: Session,
    user: models.User,
    template_id: str | None,
) -> tuple[models.Job, models.Template | None]:
    """
    Capture sessions are template-first: the operator assigns a template to
    the technician, and the technician captures against it. The grouping Job
    (still used by the document pipeline) is auto-created per session so the
    mobile app never has to pick one.
    """
    tech = _get_technician_for_user(db, user)
    if not tech:
        raise HTTPException(
            status_code=403,
            detail="No technician profile is linked to this account. Ask your operator to create one.",
        )

    template = None
    if template_id:
        template = (
            db.query(models.Template)
            .filter(models.Template.id == template_id, models.Template.business_id == user.business_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        if template.technician_id and template.technician_id != tech.id:
            raise HTTPException(status_code=403, detail="This template is not assigned to you")

    job = models.Job(
        business_id=user.business_id,
        customer=tech.name,
        job_type=template.trade if template else tech.trade,
        technician_id=tech.id,
        notes=f"Field capture session · technician {tech.id}",
    )
    db.add(job)
    db.flush()

    return job, template


@router.post("/start", status_code=201)
def start_capture_session(
    payload: schemas.CaptureStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Opens a capture session for a template assigned to the logged-in
    technician. Creates the grouping Job up front so every voice note and
    photo uploaded afterwards carries the same job_id, the technician as
    owner, and the template reference.
    """
    job, template = _resolve_assignment(db, current_user, payload.template_id)
    tech = _get_technician_for_user(db, current_user)
    db.commit()
    return {
        "job_id": job.id,
        "template_id": template.id if template else None,
        "template_name": template.name if template else None,
        "technician_id": tech.id if tech else None,
    }


@router.post("", response_model=schemas.CaptureCreated, status_code=201)
async def create_capture(
    job_id: str = Form(...),
    kind: str = Form(...),  # "voice" | "photo"
    template_id: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Field technician's core action: record a voice note or snap a photo.
    The file is stored under an owner-maintained folder trail
    (uploads/captures/<business>/<technician>/<kind>/), a Capture row is
    created recording exactly who uploaded it, and processing is handed off
    to the Celery task queue so the mobile app gets an instant response
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
        raise HTTPException(status_code=404, detail="Capture session not found")

    tech = _get_technician_for_user(db, current_user)
    if job.technician_id and (not tech or tech.id != job.technician_id):
        raise HTTPException(status_code=403, detail="This capture session belongs to another technician")
    technician_id = tech.id if tech else None

    template = None
    if template_id:
        template = (
            db.query(models.Template)
            .filter(models.Template.id == template_id, models.Template.business_id == current_user.business_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

    file_url = await storage.save_capture_upload(
        file,
        kind=kind,
        business_id=current_user.business_id,
        technician_id=technician_id,
    )

    capture = models.Capture(
        job_id=job.id,
        technician_id=technician_id,
        template_id=template.id if template else None,
        kind=kind,
        file_url=file_url,
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)

    # Deferred import avoids requiring a running Redis instance just to
    # import the FastAPI app (e.g. when running tests without a worker).
    # The enqueue must never hang the HTTP response: bounded by Celery's
    # fail-fast broker settings plus a hard watchdog here. The pool is shut
    # down without waiting so a stuck connect() can't block the response.
    import concurrent.futures
    import logging

    def _enqueue() -> None:
        from app.tasks import process_capture
        process_capture.delay(capture.id)

    pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        future = pool.submit(_enqueue)
        future.result(timeout=5)
    except concurrent.futures.TimeoutError:
        logging.getLogger("fieldproof.capture").warning(
            f"Celery enqueue timed out after 5s (Redis offline?); capture {capture.id} saved without processing"
        )
    except Exception as e:
        logging.getLogger("fieldproof.capture").warning(f"Could not enqueue Celery task (Redis offline?): {e}")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    return schemas.CaptureCreated(
        id=capture.id,
        job_id=job.id,
        kind=kind,
        technician_id=technician_id,
        template_id=template.id if template else None,
    )
