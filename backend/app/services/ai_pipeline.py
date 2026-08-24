"""
AI model layer - the "Speech, vision, OCR, LLM" box in the architecture
diagram. Each function here is the seam where a real model call goes.
They're stubbed with clearly-fake output so the rest of the app (routers,
DB writes, WebSocket events) is fully testable before any model is wired in.

Suggested real implementations:
  - transcribe_audio      -> OpenAI Whisper API or local whisper.cpp
  - analyze_image         -> GPT-4 Vision / Gemini Vision / Llama Vision
  - extract_text_ocr      -> PaddleOCR or Tesseract
  - fuse_into_document     -> an LLM call that merges transcript + vision +
                              OCR + job metadata into the structured field
                              list your Document model stores
  - detect_template_fields -> layout-analysis model over an uploaded
                              PDF/Word form to infer field names + likely
                              data source per field
  - run_compliance_check   -> rules engine (can start as plain Python
                              rules keyed by trade before any ML is needed)
"""

from typing import Any


async def transcribe_audio(file_url: str) -> str:
    # TODO: call Whisper here
    return "[stub transcript] Replaced damaged breaker. Voltage reading taken. Terminals tightened."


async def analyze_image(file_url: str) -> dict[str, Any]:
    # TODO: call a vision-language model here
    return {
        "equipment": "Circuit Breaker",
        "ppe_detected": True,
        "warning_label_present": True,
    }


async def extract_text_ocr(file_url: str) -> dict[str, Any]:
    # TODO: call PaddleOCR / Tesseract here
    return {"meter_display": None, "serial_number": None, "manufacturer": None}


async def fuse_into_document(
    transcript: str,
    vision_results: list[dict[str, Any]],
    ocr_results: list[dict[str, Any]],
    job_context: dict[str, Any],
) -> tuple[list[dict[str, Any]], float]:
    """
    Merges all extracted signals into the field list a Document stores, each
    field carrying a confidence score. Returns (fields, overall_confidence).
    TODO: replace with an LLM call that reasons over all the raw signals.
    """
    fields = [
        {"field": "Customer Name", "value": job_context.get("customer"), "source": "Job record", "confidence": 99.0},
        {"field": "Equipment", "value": "Circuit Breaker", "source": "Image", "confidence": 94.0},
        {"field": "Voltage Reading", "value": None, "source": "OCR (meter)", "confidence": 60.0},
        {"field": "Work Summary", "value": transcript, "source": "Voice note", "confidence": 90.0},
    ]
    overall = round(sum(f["confidence"] for f in fields) / len(fields), 1)
    return fields, overall


async def detect_template_fields(file_url: str) -> list[dict[str, Any]]:
    # TODO: call a document layout-analysis model here
    return [
        {"field": "Customer Name", "source": "Job record", "confidence": 99.0},
        {"field": "Technician Signature", "source": "Image", "confidence": 100.0},
        {"field": "Customer Signature", "source": "Image", "confidence": 100.0},
    ]


async def run_compliance_check(trade: str, extracted_fields: list[dict[str, Any]], required_fields: list[str]) -> list[str]:
    """Returns the list of required field names that are missing or empty."""
    present = {f["field"] for f in extracted_fields if f.get("value")}
    return [rf for rf in required_fields if rf not in present]
