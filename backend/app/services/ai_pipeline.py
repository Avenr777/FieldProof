"""
AI model layer — Speech, LLM extraction, Vision, OCR, and document fusion.

What is real vs stubbed
-----------------------
REAL:
  transcribe_audio        — OpenAI Whisper via stt.transcribe_file; falls back
                            to demo string when OPENAI_API_KEY is not set.
  fuse_into_document      — LLM structured extraction via llm.extract_fields for
                            the transcript half; returns per-field evidence,
                            grounding status, and confidence.  Vision/OCR half
                            remains heuristic until Phase 3 photos/OCR work.
  run_compliance_check    — deterministic required-field check.

STUBBED / FUTURE WORK:
  analyze_image           — vision-language photo analysis (placeholder).
  extract_text_ocr        — OCR on meter photos (placeholder).

All stubs are labelled clearly so the paper's methodology section accurately
describes what was implemented.
"""

import base64
import json
import logging
import mimetypes
import os
from datetime import datetime
from typing import Any

import httpx

from app.config import settings
from app.services import storage
from app.services.stt import transcribe_file
from app.services.llm import extract_fields

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
# Vision analysis (STUBBED — future work)
# ---------------------------------------------------------------------------

async def analyze_image(file_url: str) -> dict[str, Any]:
    """
    [FUTURE WORK — STUBBED]
    Vision-language photo analysis is out of scope for the current research
    phase. Returns heuristic placeholder data so the rest of the pipeline
    continues to function.

    When implemented, this will use a VLM (e.g. GPT-4o vision) to detect
    equipment, PPE compliance, warning labels, and safety hazards.
    """
    local_path = storage.resolve_local_path(file_url)
    if settings.openai_api_key and os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            mime_type, _ = mimetypes.guess_type(local_path)
            data_url = f"data:{mime_type or 'image/jpeg'};base64,{img_b64}"

            prompt = (
                "You are an industrial safety and equipment inspection AI. "
                "Analyze this field photo taken by a tradesperson (electrician, HVAC, plumber, etc.). "
                "Respond in strictly valid JSON with the following structure:\n"
                "{\n"
                '  "equipment": "detected equipment type name or null",\n'
                '  "ppe_detected": true/false,\n'
                '  "warning_label_present": true/false,\n'
                '  "observations": ["key observation 1", "key observation 2"]\n'
                "}"
            )

            payload = {
                "model": settings.ai_model_vision,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 500,
            }

            async with httpx.AsyncClient(timeout=45.0) as client:
                headers = {
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                }
                resp = await client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                if resp.is_success:
                    content = resp.json()["choices"][0]["message"]["content"]
                    return json.loads(content)
                else:
                    logger.warning(f"Vision API returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Error during image analysis: {e}")

    # Heuristic fallback
    return {
        "equipment": "Distribution Panel / Breaker",
        "ppe_detected": True,
        "warning_label_present": True,
        "observations": ["Clear clearance around enclosure", "Grounded enclosure verified"],
        "_stub": True,
    }


# ---------------------------------------------------------------------------
# OCR extraction (STUBBED — future work)
# ---------------------------------------------------------------------------

async def extract_text_ocr(file_url: str) -> dict[str, Any]:
    """
    [FUTURE WORK — STUBBED]
    OCR fusion with the voice transcript is out of scope for the current
    research phase. Returns heuristic placeholder data.
    """
    local_path = storage.resolve_local_path(file_url)
    if settings.openai_api_key and os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            mime_type, _ = mimetypes.guess_type(local_path)
            data_url = f"data:{mime_type or 'image/jpeg'};base64,{img_b64}"

            prompt = (
                "You are an OCR tool extracting text from field equipment, gauge dials, digital meters, and serial plates. "
                "Extract all numbers, readings, and labels. "
                "Respond in strictly valid JSON with:\n"
                "{\n"
                '  "meter_display": "extracted reading with units or null",\n'
                '  "serial_number": "detected serial/model number or null",\n'
                '  "manufacturer": "manufacturer brand or null",\n'
                '  "raw_text": ["text snippet 1", "text snippet 2"]\n'
                "}"
            )

            payload = {
                "model": settings.ai_model_vision,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    }
                ],
                "response_format": {"type": "json_object"},
                "max_tokens": 500,
            }

            async with httpx.AsyncClient(timeout=45.0) as client:
                headers = {
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                }
                resp = await client.post(
                    f"{settings.openai_base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                if resp.is_success:
                    content = resp.json()["choices"][0]["message"]["content"]
                    return json.loads(content)
        except Exception as e:
            logger.error(f"Error during OCR extraction: {e}")

    return {
        "meter_display": "240.2 V",
        "serial_number": "SN-8492-FP",
        "manufacturer": "Schneider Electric",
        "raw_text": ["240.2 V", "60 Hz", "CAT III"],
        "_stub": True,
    }


# ---------------------------------------------------------------------------
# Document fusion (REAL transcript half, stubbed vision/OCR half)
# ---------------------------------------------------------------------------

async def fuse_into_document(
    transcript: str,
    vision_results: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
    job_context: dict[str, Any],
    trade: str = "electrical",
) -> tuple[list[dict[str, Any]], float, dict | None]:
    """
    Merges transcript (via LLM extraction) and job metadata into a structured
    field list with per-field confidence, evidence, grounded flag, and status.

    Returns:
        fields          — list of field dicts ready for Document.extracted_fields
        overall_conf    — mean confidence across non-null fields
        llm_meta        — LLM call metadata dict (or None for demo fallback)

    The vision/OCR halves remain heuristic stubs (see analyze_image /
    extract_text_ocr docstrings) and are labelled future work.
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

                # Convert snake_case field name to title for display
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

    # Heuristic vision/OCR fields (STUBBED)
    equipment_val = "Main Service Panel"
    for v in vision_results:
        if v.get("equipment") and not v.get("_stub"):
            equipment_val = v["equipment"]
            break
    for v in vision_results:
        if v.get("equipment"):
            equipment_val = v["equipment"]
            break

    meter_val = None
    serial_val = None
    for o in ocr_results:
        if o.get("meter_display"):
            meter_val = o["meter_display"]
        if o.get("serial_number"):
            serial_val = o["serial_number"]

    vision_stub = all(v.get("_stub") for v in vision_results) if vision_results else True
    ocr_stub = all(o.get("_stub") for o in ocr_results) if ocr_results else True

    if vision_results:
        fields.append({
            "field": "Equipment",
            "value": equipment_val,
            "source": "Image (stub)" if vision_stub else "Image",
            "confidence": 60.0 if vision_stub else 94.0,
            "evidence": None,
            "grounded": None,
            "status": "ok",
        })

    if ocr_results:
        fields.append({
            "field": "Reading / Measurement",
            "value": meter_val or "N/A",
            "source": "OCR (stub)" if ocr_stub else "OCR (meter)",
            "confidence": 60.0 if ocr_stub else 92.0,
            "evidence": None,
            "grounded": None,
            "status": "ok" if meter_val else "missing",
        })

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
    Returns required field names that are missing, null, or invalid.

    A field is considered present when:
    - its status is 'ok' (grounded and non-null), AND
    - it has a non-empty value.

    Fields that are 'ungrounded' are NOT treated as present — they are
    forced into review even if they have a value.
    """
    # Build a set of "trusted present" field names
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
        # Allow partial/fuzzy match (e.g. "Voltage" in "Voltage Reading")
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
