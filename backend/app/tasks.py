import asyncio

from app.celery_app import celery_app
from app.database import SessionLocal
from app import models
from app.services import ai_pipeline


@celery_app.task(name="process_capture")
def process_capture(capture_id: str):
    """
    Runs after a voice note or photo is uploaded from the field app.
    Transcribes/analyzes the raw capture, then, once every capture for a
    job has been processed, fuses them into a draft Document with per-field
    confidence scores and runs the compliance check.
    """
    db = SessionLocal()
    try:
        capture = db.query(models.Capture).filter(models.Capture.id == capture_id).first()
        if not capture:
            return

        if capture.kind == "voice":
            capture.transcript = asyncio.run(ai_pipeline.transcribe_audio(capture.file_url))
        elif capture.kind == "photo":
            capture.vision_labels = asyncio.run(ai_pipeline.analyze_image(capture.file_url))
            capture.ocr_labels = asyncio.run(ai_pipeline.extract_text_ocr(capture.file_url))

        capture.processed = True
        db.commit()

        _maybe_build_document(db, capture.job_id)
    finally:
        db.close()


def _maybe_build_document(db, job_id: str):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        return

    captures = db.query(models.Capture).filter(models.Capture.job_id == job_id).all()
    if not captures or any(not c.processed for c in captures):
        return  # wait until everything for this job has been processed

    transcript = " ".join(c.transcript for c in captures if c.transcript)
    vision_results = [c.vision_labels for c in captures if c.vision_labels]
    ocr_results = [c.ocr_text for c in captures if c.ocr_text]

    fields, confidence = asyncio.run(
        ai_pipeline.fuse_into_document(
            transcript=transcript,
            vision_results=vision_results,
            ocr_results=ocr_results,
            job_context={"customer": job.customer, "job_type": job.job_type},
        )
    )

    doc = models.Document(
        job_id=job.id,
        name=f"{job.job_type} Report",
        extracted_fields=fields,
        overall_confidence=confidence,
        status=models.DocStatus.pending_review,
    )
    db.add(doc)

    rule = (
        db.query(models.ComplianceRule)
        .filter(models.ComplianceRule.business_id == job.business_id, models.ComplianceRule.trade == job.job_type)
        .first()
    )
    if rule:
        missing = asyncio.run(ai_pipeline.run_compliance_check(rule.trade, fields, rule.required_fields))
        if missing:
            job.status = models.JobStatus.compliance_flag
            for m in missing:
                db.add(
                    models.ComplianceEvent(
                        job_id=job.id,
                        message=f"{m} missing",
                        severity=models.Severity.high,
                    )
                )
        else:
            job.status = models.JobStatus.awaiting_review

    db.commit()
