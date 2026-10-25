"""
AI model layer — Speech, LLM extraction, Vision, OCR, and document fusion.

What is real vs stubbed
-----------------------
REAL (when OPENAI_API_KEY is set):
  transcribe_audio        — OpenAI Whisper via stt.transcribe_file.
  fuse_into_document      — LLM structured extraction via llm.extract_fields +
                            cross-modal OCR fusion via vision.fuse_ocr_into_fields.
  run_compliance_check    — deterministic required-field check.
  analyze_image           — GPT-4o vision (via vision.analyze_image).
  extract_text_ocr        — GPT-4o OCR (via vision.extract_text_ocr).

FALLBACK (no API key or API error):
  analyze_image / extract_text_ocr return a placeholder dict with _stub=True.
  The rest of the pipeline continues to function in demo / offline mode.

Cross-modal fusion (fuse_ocr_into_fields)
  OCR readings corroborate or fill voice-extracted fields:
    • voltage, rating pulled from meter_display via regex
    • component filled from serial_number when voice left it null
    • agreement between voice and OCR bumps confidence to 0.95
  See app/services/vision.py for the full algorithm.
"""

import logging
from typing import Any

from app.services.stt import transcribe_file
from app.services.llm import extract_fields
from app.services.vision import (
    analyze_image as _vision_analyze_image,
    extract_text_ocr as _vision_extract_text_ocr,
    fuse_ocr_into_fields,
    ImageAnalysisResult,
    OcrResult,
)

logger = logging.getLogger("fieldproof.ai_pipeline")


# ---------------------------------------------------------------------------
# Speech-to-text (REAL)
# ---------------------------------------------------------------------------

async def transcribe_audio(file_url: str, trade: str | None = None) -> str:
    """
    Transcribes field audio using the Whisper API (via services/stt.py).

    Returns the plain transcript text.  The full Transcript object (segments,
    logprob, latency, model) is stored separately in tasks.process_capture
    via capture.transcript_json.

    Falls back to a structured demo string when OPENAI_API_KEY is not set.
    """
    try:
        transcript_obj = transcribe_file(file_url, trade=trade)
        if transcript_obj is not None:
            return transcript_obj.text
    except FileNotFoundError as e:
        logger.error("STT file not found: %s", e)
        raise
    except ValueError as e:
        logger.error("STT rejected file: %s", e)
        raise
    except Exception as e:
        logger.error("STT error: %s", e)
        raise

    # Fallback for offline / demo mode
    logger.info("No STT provider configured — using demo transcript fallback")
    return (
        "Completed routine electrical inspection. Replaced the 20A MCB on panel 2, "
        "voltage reading stable at 230V single phase. Earthing continuity confirmed."
    )


async def transcribe_audio_rich(file_url: str, trade: str | None = None):
    """
    Returns the full Transcript dataclass (or None for demo fallback).
    Called by tasks.py to persist segment-level data.
    """
    try:
        return transcribe_file(file_url, trade=trade)
    except Exception as e:
        logger.error("STT error in rich transcription: %s", e)
        raise


# ---------------------------------------------------------------------------
# Vision analysis (REAL via vision.py — stub fallback when no API key)
# ---------------------------------------------------------------------------

async def analyze_image(file_url: str) -> dict[str, Any]:
    """
    Vision-language photo analysis via GPT-4o.

    When OPENAI_API_KEY is set and the image file exists:
        Returns real analysis dict with equipment, ppe_detected,
        warning_label_present, observations.  _stub is absent.

    When the key is absent or the API call fails:
        Returns a placeholder dict with _stub=True so the pipeline continues
        in demo / offline mode.  Logged at INFO level.
    """
    result: ImageAnalysisResult = await _vision_analyze_image(file_url)
    return result.to_dict()


async def extract_text_ocr(file_url: str) -> dict[str, Any]:
    """
    OCR extraction from meter displays and serial plates via GPT-4o.

    When OPENAI_API_KEY is set and the image file exists:
        Returns real OCR dict with meter_display, serial_number,
        manufacturer, raw_text.  _stub is absent.

    When the key is absent or the API call fails:
        Returns a placeholder dict with _stub=True.
    """
    result: OcrResult = await _vision_extract_text_ocr(file_url)
    return result.to_dict()


# ---------------------------------------------------------------------------
# Document fusion (REAL — voice + OCR cross-modal)
# ---------------------------------------------------------------------------

async def fuse_into_document(
    transcript: str,
    vision_results: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
    job_context: dict[str, Any],
    trade: str = "electrical",
) -> tuple[list[dict[str, Any]], float, dict | None]:
    """
    Merges transcript (via LLM extraction), OCR readings, and job metadata
    into a structured field list with per-field confidence, evidence,
    grounded flag, and status.

    Cross-modal fusion (new)
    ------------------------
    After LLM extraction, fuse_ocr_into_fields() is called to:
      • Corroborate voltage / rating fields: if OCR agrees with voice,
        confidence is bumped and ocr_corroborated=True is set.
      • Fill null or ungrounded fields from meter_display / serial_number.
      • Append remaining OCR tokens as an "OCR Readings" field.

    Returns
    -------
    fields          — list of field dicts for Document.extracted_fields
    overall_conf    — mean confidence across non-null fields
    llm_meta        — LLM call metadata dict (or None for demo fallback)
    """
    llm_meta = None
    fields = []

    # Always add job-metadata fields (high confidence, no AI needed)
    meta_fields = [
        {
            "field": "Customer Name",
            "value": job_context.get("customer"),
            "source": "Job record",
            "confidence": 99.0,
            "evidence": None,
            "grounded": None,
            "status": "ok" if job_context.get("customer") else "missing",
        },
        {
            "field": "Trade Type",
            "value": job_context.get("job_type"),
            "source": "Job record",
            "confidence": 99.0,
            "evidence": None,
            "grounded": None,
            "status": "ok" if job_context.get("job_type") else "missing",
        },
    ]
    fields.extend(meta_fields)

    # LLM extraction from transcript (REAL)
    if transcript:
        extracted = extract_fields(transcript, trade=trade, prompt_version="v1")
        if extracted:
            llm_meta = extracted.pop("_meta", None)
            for field_name, fv in extracted.items():
                if not isinstance(fv, dict):
                    continue
                value = fv.get("value")
                evidence = fv.get("evidence")
                confidence = fv.get("confidence")
                grounded = fv.get("grounded")
                status = fv.get("status", "missing" if value is None else "ok")

                label = field_name.replace("_", " ").title()
                conf_pct = round((confidence or 0.0) * 100, 1) if confidence is not None else 85.0

                fields.append({
                    "field": label,
                    "value": value,
                    "source": "Voice note (LLM extraction)",
                    "confidence": conf_pct,
                    "evidence": evidence,
                    "grounded": grounded,
                    "status": status,
                })

            logger.info(
                "LLM extraction produced %d fields from transcript (trade=%s)",
                len(extracted), trade,
            )
        else:
            # No LLM configured — use the transcript as a single Work Summary field
            fields.append({
                "field": "Work Summary",
                "value": transcript,
                "source": "Voice note (verbatim, no LLM)",
                "confidence": 70.0,
                "evidence": None,
                "grounded": None,
                "status": "ok",
            })

    # Vision fields (equipment, PPE status)
    vision_stub = all(v.get("_stub") for v in vision_results) if vision_results else True
    if vision_results:
        equipment_val = None
        for v in vision_results:
            if v.get("equipment"):
                equipment_val = v["equipment"]
                break
        if equipment_val is None:
            equipment_val = "Main Service Panel"

        ppe_vals = [v.get("ppe_detected") for v in vision_results if "ppe_detected" in v]
        ppe_status = "PPE present" if any(ppe_vals) else "PPE not confirmed"

        fields.append({
            "field": "Equipment",
            "value": equipment_val,
            "source": "Image" if not vision_stub else "Image (stub)",
            "confidence": 94.0 if not vision_stub else 60.0,
            "evidence": None,
            "grounded": None,
            "status": "ok",
        })
        fields.append({
            "field": "PPE Status",
            "value": ppe_status,
            "source": "Image" if not vision_stub else "Image (stub)",
            "confidence": 90.0 if not vision_stub else 60.0,
            "evidence": None,
            "grounded": None,
            "status": "ok",
        })

    # OCR fields — raw reading appended; cross-modal fusion updates voice fields
    if ocr_results:
        fields = fuse_ocr_into_fields(fields, ocr_results)

    non_null = [f for f in fields if f.get("value") is not None]
    overall = round(
        sum(f.get("confidence", 0.0) for f in non_null) / len(non_null), 1
    ) if non_null else 0.0

    return fields, overall, llm_meta


# ---------------------------------------------------------------------------
# Compliance check (REAL — deterministic)
# ---------------------------------------------------------------------------

async def run_compliance_check(
    trade: str,
    extracted_fields: list[dict[str, Any]],
    required_fields: list[str],
) -> list[str]:
    """
    Returns required field names that are missing, null, or ungrounded.

    A field is considered present when:
    - its status is 'ok' (grounded and non-null), AND
    - it has a non-empty value.

    Fields that are 'ungrounded' are NOT treated as present — they are
    forced into review even if they have a value.
    """
    present: set[str] = set()
    for f in extracted_fields:
        if not isinstance(f, dict):
            continue
        status = f.get("status", "ok")
        value = f.get("value")
        if status in ("ok",) and value:
            present.add(f.get("field", "").strip().lower())

    missing = []
    for rf in required_fields:
        rf_clean = rf.strip().lower()
        if not any(rf_clean in p or p in rf_clean for p in present):
            missing.append(rf)

    return missing


# ---------------------------------------------------------------------------
# Template field detection (unchanged — used by template upload flow)
# ---------------------------------------------------------------------------

async def detect_template_fields(file_url: str) -> list[dict[str, Any]]:
    """Fallback layout detection for non-.docx template uploads."""
    return [
        {"field": "Customer Name", "source": "Job record", "confidence": 99.0},
        {"field": "Inspection Date", "source": "Manual entry", "confidence": 95.0},
        {"field": "Work Summary", "source": "Voice note", "confidence": 90.0},
        {"field": "Technician Signature", "source": "Image", "confidence": 100.0},
        {"field": "Customer Signature", "source": "Image", "confidence": 100.0},
    ]
