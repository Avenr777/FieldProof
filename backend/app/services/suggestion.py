"""
suggestion.py — Auto-fill suggestion engine for the admin review screen.

A technician's capture session (one Job) produces raw evidence: voice-note
transcripts, photo vision labels, and OCR readings from meters/labels.
This module maps that evidence onto a template's extracted fields so the
admin starts from pre-suggested values instead of an empty form. Every
suggestion carries a value (when one is found), a human-readable source,
and a confidence score the UI can visualize.
"""

from __future__ import annotations

import re
from typing import Any


def _norm(label: str) -> str:
    return (label or "").strip().lower()


def _flatten_ocr(ocr_results: list[dict[str, Any]]) -> dict[str, Any]:
    """Merge multiple OCR results into one dict, first non-null wins."""
    merged: dict[str, Any] = {}
    for o in ocr_results:
        if not isinstance(o, dict):
            continue
        for key in ("meter_display", "serial_number", "manufacturer", "raw_text"):
            val = o.get(key)
            if val and not merged.get(key):
                merged[key] = val
    return merged


def _flatten_vision(vision_results: list[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for v in vision_results:
        if not isinstance(v, dict):
            continue
        for key in ("equipment", "ppe_detected", "warning_label_present", "observations"):
            val = v.get(key)
            if val not in (None, [], False) and not merged.get(key):
                merged[key] = val
    return merged


def _first_number(text: str, unit_pattern: str) -> str | None:
    m = re.search(rf"(\d+(?:\.\d+)?)\s*{unit_pattern}", text, flags=re.IGNORECASE)
    if m:
        return f"{m.group(1)} {m.group(2) if len(m.groups()) > 1 else ''}".strip()
    return None


def _suggest_for_label(
    label: str,
    field: dict[str, Any],
    *,
    job: Any,
    tech: Any,
    transcript: str,
    vision: dict[str, Any],
    ocr: dict[str, Any],
    today_str: str,
) -> dict[str, Any] | None:
    """Try to produce a suggested value for one template field from evidence."""
    label_l = _norm(label)
    kind = field.get("kind", "blank")
    template_hint = _norm(str(field.get("hint") or ""))

    # --- Job metadata (always high confidence) -----------------------------
    if "customer" in label_l or "client" in label_l:
        return {"value": job.customer, "source": "Job record", "confidence": 100.0}
    if any(k in label_l for k in ("site", "address", "location", "facility")):
        if job.site_address:
            return {"value": job.site_address, "source": "Job record", "confidence": 100.0}
    if ("technician" in label_l or "engineer" in label_l or template_hint == "technician name") and "customer" not in label_l:
        return {"value": tech.name, "source": "Job record", "confidence": 100.0}
    if "date" in label_l and "update" not in label_l:
        return {"value": today_str, "source": "Capture date", "confidence": 99.0}
    if ("trade" in label_l or "type of service" in label_l or "service type" in label_l):
        return {"value": job.job_type, "source": "Job record", "confidence": 96.0}

    # --- OCR evidence -------------------------------------------------------
    if any(k in label_l for k in ("voltage", "volt")):
        val = ocr.get("meter_display") or _first_number(transcript, r"volts?|v\b")
        if val:
            return {"value": val, "source": "Meter OCR", "confidence": 97.0}
    if any(k in label_l for k in ("pressure", "psi")):
        val = _first_number(transcript, r"psi|bar|kpa") or ocr.get("meter_display")
        if val:
            return {"value": val, "source": "Gauge OCR", "confidence": 95.0}
    if "resistance" in label_l or "ohm" in template_hint:
        val = _first_number(transcript, r"ohms?|Ω|mω|kω")
        if val:
            return {"value": val, "source": "Meter OCR", "confidence": 93.0}
    if any(k in label_l for k in ("serial", "model no", "model number")):
        val = ocr.get("serial_number")
        if val:
            return {"value": val, "source": "Label OCR", "confidence": 94.0}
    if "manufacturer" in label_l or "brand" in label_l or "make" == label_l:
        val = ocr.get("manufacturer")
        if val:
            return {"value": val, "source": "Label OCR", "confidence": 93.0}

    # --- Vision evidence ----------------------------------------------------
    # Checkbox questions only ever receive boolean suggestions (from PPE /
    # warning-label detection); descriptive text like equipment names must
    # not bleed into them.
    if kind == "checkbox_option":
        return None
    if any(k in label_l for k in ("equipment", "appliance", "panel", "unit", "system inspected", "asset")):
        val = vision.get("equipment")
        if val:
            return {"value": val, "source": "Photo AI", "confidence": 92.0}
    if kind == "checkbox_option" and ("ppe" in label_l or "protect" in label_l):
        if "ppe_detected" in vision:
            return {
                "value": bool(vision["ppe_detected"]),
                "source": "Photo AI (PPE)",
                "confidence": 90.0,
            }
    if "warning" in label_l and "warning_label_present" in vision:
        return {
            "value": bool(vision["warning_label_present"]),
            "source": "Photo AI (labels)",
            "confidence": 88.0,
        }

    # --- Transcript evidence -----------------------------------------------
    if kind == "multiline_blank_group" or field.get("field_type") == "multiline_text" or any(
        k in label_l for k in ("summary", "work performed", "findings", "notes", "remarks", "observations", "description", "comment")
    ):
        if transcript:
            return {
                "value": transcript,
                "source": "Voice note transcript",
                "confidence": 95.0,
            }
    if any(k in label_l for k in ("reading", "measurement")):
        val = ocr.get("meter_display") or _first_number(transcript, r"[a-z]{0,8}\b")
        if val:
            return {"value": val, "source": "Meter/voice", "confidence": 85.0}

    # --- Text proof types (checkbox booleans from speech) --------------------
    if kind == "checkbox_option" and transcript:
        t_l = label_l
        positives = [
            ("leak", [r"no leak", r"leak.free", r"no signs? of (a )?leak"]),
            ("filter", [r"filter (was |were )?(replaced|changed)", r"new filter"]),
        ]
        for key, patterns in positives:
            if key in t_l:
                for p in patterns:
                    if re.search(p, transcript, flags=re.IGNORECASE):
                        return {"value": True, "source": "Voice note", "confidence": 82.0}
                return {"value": False, "source": "Voice note", "confidence": 70.0}

    return None


def build_suggestions(
    fields: list[dict[str, Any]],
    *,
    job: Any,
    tech: Any,
    transcript: str,
    vision_results: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """
    Returns {field_id: {value, source, confidence}} for every field a value
    could be suggested for. Fields with no evidence are absent — the UI
    leaves them blank for the admin.
    """
    vision = _flatten_vision(vision_results)
    ocr = _flatten_ocr(ocr_results)
    # Trim very long transcripts so suggestion objects stay light; the full
    # transcript is always visible in the review screen's evidence header.
    t = (transcript or "").strip()
    transcript_trim = t[:1200]
    today_str = job.created_at.strftime("%Y-%m-%d") if job and getattr(job, "created_at", None) else ""

    suggestions: dict[str, dict[str, Any]] = {}
    for field in fields:
        label = field.get("label") or field.get("field_id") or ""
        s = _suggest_for_label(
            label,
            field,
            job=job,
            tech=tech,
            transcript=transcript_trim,
            vision=vision,
            ocr=ocr,
            today_str=today_str,
        )
        if s is not None:
            suggestions[field["field_id"]] = s
    return suggestions
