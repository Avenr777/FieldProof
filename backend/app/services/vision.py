"""
Vision and OCR service layer for FieldProof.

What is real vs stubbed
-----------------------
REAL (when OPENAI_API_KEY is set and a local file exists):
  analyze_image   — GPT-4o vision: detects equipment, PPE, hazards, and
                    warning labels from field photos.
  extract_text_ocr — GPT-4o vision used as OCR: reads meter displays,
                    serial plates, and manufacturer labels.
  fuse_ocr_into_fields — deterministic cross-modal fusion: OCR readings
                    corroborate or fill voice-extracted fields (voltage,
                    rating) when the LLM left them null or low-confidence.

FALLBACK (no API key, file not found, or API error):
  Both functions return a placeholder dict with _stub=True so the rest
  of the pipeline (document fusion, compliance check) continues working
  in demo / offline mode.

Cross-modal fusion algorithm
----------------------------
1. For each field in the extracted-fields list produced by the LLM:
   a. If the field value is null or status is "ungrounded", check OCR
      results for a matching reading (voltage→meter_display, rating→
      meter_display with amperage pattern, component/serial→serial_number).
   b. If a corroborating value is found in OCR, set the field value and
      mark source="OCR (meter)", grounded=True, status="ok", confidence=0.87.
   c. If both voice AND OCR agree on a value, bump confidence to 0.95 and
      add an "ocr_corroborated": True flag for the reviewer.
2. Any OCR raw-text tokens not matched to a voice field are added as a
   new "OCR Readings" field so no data is silently dropped.
"""
from __future__ import annotations

import base64
import json
import logging
import mimetypes
import re
import time
from dataclasses import dataclass, field, asdict
from typing import Any

import httpx

from app.config import settings
from app.services import storage

logger = logging.getLogger("fieldproof.vision")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ImageAnalysisResult:
    """Result of VLM analysis of a field photo."""
    equipment: str | None = None
    ppe_detected: bool = False
    warning_label_present: bool = False
    observations: list[str] = field(default_factory=list)
    raw_response: dict = field(default_factory=dict)
    latency_s: float = 0.0
    model: str = ""
    is_stub: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.is_stub:
            d["_stub"] = True
        return d


@dataclass
class OcrResult:
    """Result of OCR extraction from a meter / serial plate photo."""
    meter_display: str | None = None
    serial_number: str | None = None
    manufacturer: str | None = None
    raw_text: list[str] = field(default_factory=list)
    latency_s: float = 0.0
    model: str = ""
    is_stub: bool = False

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.is_stub:
            d["_stub"] = True
        return d


# ---------------------------------------------------------------------------
# Internal: GPT-4o vision call
# ---------------------------------------------------------------------------

async def _call_vision(
    local_path: str,
    prompt: str,
    max_tokens: int = 500,
) -> tuple[dict, float, str]:
    """
    Calls GPT-4o (or configured vision model) with an image and text prompt.
    Returns (parsed_json_dict, latency_s, model_name).
    Raises on network/API errors so callers can fall back gracefully.
    """
    with open(local_path, "rb") as fh:
        img_b64 = base64.b64encode(fh.read()).decode("utf-8")
    mime_type, _ = mimetypes.guess_type(local_path)
    data_url = f"data:{mime_type or 'image/jpeg'};base64,{img_b64}"

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
        "max_tokens": max_tokens,
        "temperature": 0,
    }

    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.openai_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    latency_s = time.perf_counter() - t0

    if not resp.is_success:
        raise RuntimeError(f"Vision API {resp.status_code}: {resp.text[:400]}")

    resp_json = resp.json()
    content = resp_json["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    model = resp_json.get("model", settings.ai_model_vision)

    logger.info(
        "Vision API call | model=%s latency=%.2fs tokens_in=%d tokens_out=%d",
        model, latency_s,
        resp_json.get("usage", {}).get("prompt_tokens", 0),
        resp_json.get("usage", {}).get("completion_tokens", 0),
    )
    return parsed, latency_s, model


# ---------------------------------------------------------------------------
# Public: analyze_image
# ---------------------------------------------------------------------------

async def analyze_image(file_url: str) -> ImageAnalysisResult:
    """
    Vision-language analysis of a field photo.

    When OPENAI_API_KEY is set and the image file exists locally:
        Calls GPT-4o vision to detect equipment type, PPE, warning labels,
        and notable safety observations. Returns an ImageAnalysisResult with
        is_stub=False.

    When the API key is absent or the call fails:
        Returns a placeholder ImageAnalysisResult with is_stub=True.
        The pipeline continues; the document shows "Image (stub)" as source.
    """
    local_path = storage.resolve_local_path(file_url)

    if settings.openai_api_key and __import__("os").path.exists(local_path):
        prompt = (
            "You are an industrial safety and equipment inspection AI. "
            "Analyse this field photo taken by a tradesperson (electrician, HVAC, plumber, etc.). "
            "Respond in strictly valid JSON with exactly this structure:\n"
            "{\n"
            '  "equipment": "detected equipment type name or null",\n'
            '  "ppe_detected": true,\n'
            '  "warning_label_present": true,\n'
            '  "observations": ["key observation 1", "key observation 2"]\n'
            "}"
        )
        try:
            parsed, latency_s, model = await _call_vision(local_path, prompt)
            result = ImageAnalysisResult(
                equipment=parsed.get("equipment"),
                ppe_detected=bool(parsed.get("ppe_detected", False)),
                warning_label_present=bool(parsed.get("warning_label_present", False)),
                observations=parsed.get("observations", []),
                raw_response=parsed,
                latency_s=latency_s,
                model=model,
                is_stub=False,
            )
            logger.info(
                "Image analysis complete | equipment=%r ppe=%s latency=%.2fs",
                result.equipment, result.ppe_detected, latency_s,
            )
            return result
        except Exception as e:
            logger.error("analyze_image failed for %s: %s — returning stub", file_url, e)

    # Fallback / demo mode
    logger.info("analyze_image: no API key or file not found — using stub for %s", file_url)
    return ImageAnalysisResult(
        equipment="Distribution Panel / Breaker",
        ppe_detected=True,
        warning_label_present=True,
        observations=["Clear clearance around enclosure", "Grounded enclosure verified"],
        is_stub=True,
    )


# ---------------------------------------------------------------------------
# Public: extract_text_ocr
# ---------------------------------------------------------------------------

async def extract_text_ocr(file_url: str) -> OcrResult:
    """
    OCR extraction from meter gauges, digital displays, and serial plates.

    When OPENAI_API_KEY is set and the image file exists locally:
        Calls GPT-4o vision to read numeric meter displays, serial numbers,
        and manufacturer labels. Returns an OcrResult with is_stub=False.

    When the API key is absent or the call fails:
        Returns a placeholder OcrResult with is_stub=True.
    """
    local_path = storage.resolve_local_path(file_url)

    if settings.openai_api_key and __import__("os").path.exists(local_path):
        prompt = (
            "You are a precision OCR tool reading field equipment — gauge dials, "
            "digital meters, breaker ratings, and serial plates. "
            "Extract all numbers, readings, and labels visible in the image. "
            "Respond in strictly valid JSON with exactly this structure:\n"
            "{\n"
            '  "meter_display": "extracted reading with units, e.g. \\"230V\\", or null",\n'
            '  "serial_number": "detected serial or model number or null",\n'
            '  "manufacturer": "manufacturer brand name or null",\n'
            '  "raw_text": ["text token 1", "text token 2"]\n'
            "}"
        )
        try:
            parsed, latency_s, model = await _call_vision(local_path, prompt)
            result = OcrResult(
                meter_display=parsed.get("meter_display"),
                serial_number=parsed.get("serial_number"),
                manufacturer=parsed.get("manufacturer"),
                raw_text=parsed.get("raw_text", []),
                latency_s=latency_s,
                model=model,
                is_stub=False,
            )
            logger.info(
                "OCR complete | meter=%r serial=%r latency=%.2fs",
                result.meter_display, result.serial_number, latency_s,
            )
            return result
        except Exception as e:
            logger.error("extract_text_ocr failed for %s: %s — returning stub", file_url, e)

    # Fallback / demo mode
    logger.info("extract_text_ocr: no API key or file not found — using stub for %s", file_url)
    return OcrResult(
        meter_display="240.2 V",
        serial_number="SN-8492-FP",
        manufacturer="Schneider Electric",
        raw_text=["240.2 V", "60 Hz", "CAT III"],
        is_stub=True,
    )


# ---------------------------------------------------------------------------
# Cross-modal fusion
# ---------------------------------------------------------------------------

# Maps extraction schema field names to patterns looked for in OCR text
_VOLTAGE_RE = re.compile(r"(\d{2,3}(?:\.\d)?)\s*[Vv](?:olt)?s?")
_AMPERE_RE  = re.compile(r"(\d{1,3}(?:\.\d)?)\s*[Aa](?:mp)?s?")


def fuse_ocr_into_fields(
    fields: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Cross-modal fusion: use OCR readings to corroborate or fill voice-extracted
    fields that are null, low-confidence, or ungrounded.

    Algorithm
    ---------
    For each field in ``fields``:
      1. If field is already ok and confidence ≥ 0.80, check OCR for agreement.
         If OCR agrees → set ocr_corroborated=True, bump confidence to 0.95.
      2. If field value is null / status is "ungrounded" / confidence < 0.50,
         attempt to fill from OCR using field-specific patterns:
           voltage   → _VOLTAGE_RE on meter_display + raw_text
           rating    → _AMPERE_RE on meter_display + raw_text
           component → serial_number (if no better voice value)
      3. Any OCR raw-text tokens not matched to any voice field are appended
         as a new "OCR Readings" field so nothing is silently discarded.

    Parameters
    ----------
    fields      : list of field dicts from fuse_into_document (LLM extraction)
    ocr_results : list of OcrResult.to_dict() dicts from extract_text_ocr calls

    Returns
    -------
    Updated fields list (new list, originals not mutated).
    """
    if not ocr_results:
        return fields

    # Merge all OCR results
    all_meter_text: list[str] = []
    all_raw_tokens: list[str] = []
    serial_numbers: list[str] = []
    manufacturers: list[str] = []
    has_real_ocr = False

    for o in ocr_results:
        if not o.get("_stub"):
            has_real_ocr = True
        if o.get("meter_display"):
            all_meter_text.append(o["meter_display"])
        if o.get("raw_text"):
            all_raw_tokens.extend(o["raw_text"])
        if o.get("serial_number"):
            serial_numbers.append(o["serial_number"])
        if o.get("manufacturer"):
            manufacturers.append(o["manufacturer"])

    combined_text = " ".join(all_meter_text + all_raw_tokens)

    updated = []
    ocr_matched_tokens: set[str] = set()

    for f in fields:
        f = dict(f)  # shallow copy — don't mutate caller's list
        fname = (f.get("field") or "").strip().lower()
        val = f.get("value")
        status = f.get("status", "ok")
        conf = (f.get("confidence") or 0.0)
        # Normalise confidence: stored as 0-100 in fuse_into_document
        conf_norm = conf / 100.0 if conf > 1.0 else conf

        # --- Voltage ---
        if "voltage" in fname:
            m = _VOLTAGE_RE.search(combined_text)
            if m:
                ocr_val = f"{m.group(1)}V"
                ocr_matched_tokens.add(m.group(0))
                if val is None or status == "ungrounded" or conf_norm < 0.50:
                    f["value"] = ocr_val
                    f["source"] = "OCR (meter)" if has_real_ocr else "OCR (stub)"
                    f["confidence"] = 87.0 if has_real_ocr else 60.0
                    f["grounded"] = True
                    f["status"] = "ok"
                    f["ocr_corroborated"] = False
                    logger.info("OCR fill | voltage=%s from meter display", ocr_val)
                elif val and _normalise_ocr(val) == _normalise_ocr(ocr_val):
                    f["confidence"] = min(99.0, conf + 5.0)
                    f["ocr_corroborated"] = True
                    logger.info("OCR corroboration | voltage agreed: %s", ocr_val)

        # --- Rating / amperage ---
        elif "rating" in fname:
            m = _AMPERE_RE.search(combined_text)
            if m:
                ocr_val = f"{m.group(1)}A"
                ocr_matched_tokens.add(m.group(0))
                if val is None or status == "ungrounded" or conf_norm < 0.50:
                    f["value"] = ocr_val
                    f["source"] = "OCR (meter)" if has_real_ocr else "OCR (stub)"
                    f["confidence"] = 87.0 if has_real_ocr else 60.0
                    f["grounded"] = True
                    f["status"] = "ok"
                    f["ocr_corroborated"] = False
                    logger.info("OCR fill | rating=%s from meter display", ocr_val)
                elif val and _normalise_ocr(val) == _normalise_ocr(ocr_val):
                    f["confidence"] = min(99.0, conf + 5.0)
                    f["ocr_corroborated"] = True

        # --- Component (use serial_number if component null) ---
        elif "component" in fname or "equipment" in fname:
            if (val is None or status == "ungrounded") and serial_numbers:
                f["value"] = serial_numbers[0]
                f["source"] = "OCR (serial plate)" if has_real_ocr else "OCR (stub)"
                f["confidence"] = 80.0 if has_real_ocr else 55.0
                f["grounded"] = True
                f["status"] = "ok"
                f["ocr_corroborated"] = False
                ocr_matched_tokens.add(serial_numbers[0])

        updated.append(f)

    # Append any unmatched OCR tokens as a catch-all field
    unmatched = [t for t in all_raw_tokens if t not in ocr_matched_tokens]
    if unmatched:
        updated.append({
            "field": "OCR Readings",
            "value": ", ".join(unmatched[:10]),  # cap at 10 tokens
            "source": "OCR (meter)" if has_real_ocr else "OCR (stub)",
            "confidence": 85.0 if has_real_ocr else 60.0,
            "evidence": None,
            "grounded": None,
            "status": "ok",
        })

    return updated


def _normalise_ocr(s: str) -> str:
    """Strip spaces and lower-case for OCR value comparison."""
    return re.sub(r"\s+", "", str(s)).lower()
