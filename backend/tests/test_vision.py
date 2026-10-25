"""
Tests for:
  - vision.ImageAnalysisResult / OcrResult dataclasses
  - vision.fuse_ocr_into_fields cross-modal fusion algorithm
  - ai_pipeline.analyze_image / extract_text_ocr stub fallback
  - ai_pipeline.fuse_into_document with OCR results
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


# ---------------------------------------------------------------------------
# ImageAnalysisResult dataclass
# ---------------------------------------------------------------------------

class TestImageAnalysisResult:

    def test_to_dict_real(self):
        from app.services.vision import ImageAnalysisResult
        r = ImageAnalysisResult(
            equipment="MCB Panel",
            ppe_detected=True,
            warning_label_present=False,
            observations=["Clear clearance"],
            is_stub=False,
        )
        d = r.to_dict()
        assert d["equipment"] == "MCB Panel"
        assert d["ppe_detected"] is True
        assert "_stub" not in d

    def test_to_dict_stub(self):
        from app.services.vision import ImageAnalysisResult
        r = ImageAnalysisResult(is_stub=True)
        d = r.to_dict()
        assert d["_stub"] is True

    def test_defaults(self):
        from app.services.vision import ImageAnalysisResult
        r = ImageAnalysisResult()
        assert r.equipment is None
        assert r.ppe_detected is False
        assert r.observations == []


# ---------------------------------------------------------------------------
# OcrResult dataclass
# ---------------------------------------------------------------------------

class TestOcrResult:

    def test_to_dict_real(self):
        from app.services.vision import OcrResult
        r = OcrResult(
            meter_display="230V",
            serial_number="SN-001",
            manufacturer="Schneider",
            raw_text=["230V", "60Hz"],
            is_stub=False,
        )
        d = r.to_dict()
        assert d["meter_display"] == "230V"
        assert "_stub" not in d

    def test_to_dict_stub(self):
        from app.services.vision import OcrResult
        r = OcrResult(is_stub=True)
        d = r.to_dict()
        assert d["_stub"] is True

    def test_defaults(self):
        from app.services.vision import OcrResult
        r = OcrResult()
        assert r.meter_display is None
        assert r.raw_text == []


# ---------------------------------------------------------------------------
# fuse_ocr_into_fields — cross-modal fusion
# ---------------------------------------------------------------------------

class TestFuseOcrIntoFields:

    def _voice_fields(self):
        return [
            {"field": "Voltage", "value": None, "source": "Voice note (LLM extraction)",
             "confidence": 0.0, "evidence": None, "grounded": None, "status": "missing"},
            {"field": "Rating", "value": None, "source": "Voice note (LLM extraction)",
             "confidence": 0.0, "evidence": None, "grounded": None, "status": "missing"},
            {"field": "Component", "value": None, "source": "Voice note (LLM extraction)",
             "confidence": 0.0, "evidence": None, "grounded": None, "status": "missing"},
            {"field": "Work Summary", "value": "Routine inspection done",
             "source": "Voice note (LLM extraction)",
             "confidence": 90.0, "evidence": "Routine inspection done",
             "grounded": True, "status": "ok"},
        ]

    def _ocr_real(self, meter="230V", amp="20A", serial="SN-001"):
        return [{
            "meter_display": f"{meter} {amp}",
            "serial_number": serial,
            "manufacturer": "Schneider Electric",
            "raw_text": [meter, amp, "CAT III"],
            # no _stub key → real OCR
        }]

    def _ocr_stub(self):
        return [{
            "meter_display": "240.2 V",
            "serial_number": "SN-8492-FP",
            "manufacturer": "Schneider Electric",
            "raw_text": ["240.2 V", "60 Hz", "CAT III"],
            "_stub": True,
        }]

    def test_fills_null_voltage_from_ocr(self):
        from app.services.vision import fuse_ocr_into_fields
        fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        v = next(f for f in fields if "voltage" in f["field"].lower())
        assert v["value"] is not None
        assert "V" in v["value"]
        assert v["status"] == "ok"

    def test_fills_null_rating_from_ocr(self):
        from app.services.vision import fuse_ocr_into_fields
        fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        r = next(f for f in fields if "rating" in f["field"].lower())
        assert r["value"] is not None
        assert "A" in r["value"]

    def test_fills_null_component_from_serial(self):
        from app.services.vision import fuse_ocr_into_fields
        fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        c = next((f for f in fields if "component" in f["field"].lower()), None)
        assert c is not None
        assert c["value"] is not None

    def test_real_ocr_gives_higher_confidence_than_stub(self):
        from app.services.vision import fuse_ocr_into_fields
        real_fields  = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        stub_fields  = fuse_ocr_into_fields(self._voice_fields(), self._ocr_stub())
        real_voltage = next(f for f in real_fields  if "voltage" in f["field"].lower())
        stub_voltage = next(f for f in stub_fields  if "voltage" in f["field"].lower())
        assert real_voltage["confidence"] > stub_voltage["confidence"]

    def test_source_label_real_vs_stub(self):
        from app.services.vision import fuse_ocr_into_fields
        real_fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        stub_fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_stub())
        real_v = next(f for f in real_fields if "voltage" in f["field"].lower())
        stub_v = next(f for f in stub_fields if "voltage" in f["field"].lower())
        assert "stub" not in real_v["source"]
        assert "stub" in stub_v["source"]

    def test_ocr_corroboration_bumps_confidence(self):
        """Voice says 230V, OCR also reads 230V → corroborated, conf ≥ original."""
        from app.services.vision import fuse_ocr_into_fields
        voice = [
            {"field": "Voltage", "value": "230V", "source": "Voice note (LLM extraction)",
             "confidence": 85.0, "evidence": "230 volts", "grounded": True, "status": "ok"},
        ]
        ocr = [{"meter_display": "230V", "raw_text": ["230V"], "serial_number": None}]
        fields = fuse_ocr_into_fields(voice, ocr)
        v = next(f for f in fields if "voltage" in f["field"].lower())
        assert v.get("ocr_corroborated") is True
        assert v["confidence"] >= 85.0

    def test_no_ocr_returns_unchanged(self):
        from app.services.vision import fuse_ocr_into_fields
        original = self._voice_fields()
        result = fuse_ocr_into_fields(original, [])
        assert len(result) == len(original)

    def test_unmatched_tokens_appended_as_ocr_readings(self):
        from app.services.vision import fuse_ocr_into_fields
        ocr = [{"meter_display": None, "raw_text": ["CAT III", "60 Hz"], "_stub": True,
                "serial_number": None}]
        fields = fuse_ocr_into_fields(self._voice_fields(), ocr)
        ocr_field = next((f for f in fields if f["field"] == "OCR Readings"), None)
        assert ocr_field is not None
        assert "CAT III" in ocr_field["value"] or "60 Hz" in ocr_field["value"]

    def test_preserves_unrelated_fields(self):
        from app.services.vision import fuse_ocr_into_fields
        fields = fuse_ocr_into_fields(self._voice_fields(), self._ocr_real())
        ws = next(f for f in fields if "work summary" in f["field"].lower())
        assert ws["value"] == "Routine inspection done"

    def test_does_not_overwrite_good_voice_with_different_ocr(self):
        """Voice says 240V (high confidence ok), OCR says 230V — don't overwrite."""
        from app.services.vision import fuse_ocr_into_fields
        voice = [
            {"field": "Voltage", "value": "240V", "source": "Voice note (LLM extraction)",
             "confidence": 90.0, "evidence": "240 volts", "grounded": True, "status": "ok"},
        ]
        ocr = [{"meter_display": "230V", "raw_text": ["230V"], "serial_number": None}]
        fields = fuse_ocr_into_fields(voice, ocr)
        v = next(f for f in fields if "voltage" in f["field"].lower())
        # Should NOT overwrite (only corroborate-or-fill, not overwrite high-conf ok)
        assert v["value"] == "240V"


# ---------------------------------------------------------------------------
# ai_pipeline delegating to vision.py — stub fallback
# ---------------------------------------------------------------------------

class TestAiPipelineVisionDelegation:
    """Verifies ai_pipeline.analyze_image / extract_text_ocr return correct shape."""

    @pytest.mark.asyncio
    async def test_analyze_image_stub_returns_dict(self):
        """No API key → stub fallback with _stub=True."""
        import asyncio
        from unittest.mock import patch
        from app.services import ai_pipeline
        from app.config import settings

        original = settings.openai_api_key
        settings.openai_api_key = None
        try:
            result = await ai_pipeline.analyze_image("uploads/nonexistent.jpg")
        finally:
            settings.openai_api_key = original

        assert isinstance(result, dict)
        assert result.get("_stub") is True
        assert "equipment" in result

    @pytest.mark.asyncio
    async def test_extract_text_ocr_stub_returns_dict(self):
        """No API key → stub fallback with _stub=True."""
        from app.services import ai_pipeline
        from app.config import settings

        original = settings.openai_api_key
        settings.openai_api_key = None
        try:
            result = await ai_pipeline.extract_text_ocr("uploads/nonexistent.jpg")
        finally:
            settings.openai_api_key = original

        assert isinstance(result, dict)
        assert result.get("_stub") is True
        assert "meter_display" in result

    @pytest.mark.asyncio
    async def test_fuse_into_document_no_transcript_no_crash(self):
        """Empty transcript + stub OCR should still return valid fields list."""
        from app.services import ai_pipeline
        fields, confidence, llm_meta = await ai_pipeline.fuse_into_document(
            transcript="",
            vision_results=[],
            ocr_results=[],
            job_context={"customer": "Test Co", "job_type": "Electrical"},
            trade="electrical",
        )
        assert isinstance(fields, list)
        assert len(fields) >= 2  # at minimum: Customer Name + Trade Type
        assert isinstance(confidence, float)

    @pytest.mark.asyncio
    async def test_fuse_with_ocr_stub_adds_ocr_readings_or_fills_fields(self):
        """Stub OCR results should be processed by fuse_ocr_into_fields."""
        from app.services import ai_pipeline
        stub_ocr = [{
            "meter_display": "240.2 V",
            "serial_number": "SN-001",
            "manufacturer": "Schneider",
            "raw_text": ["240.2 V", "60 Hz"],
            "_stub": True,
        }]
        fields, confidence, _ = await ai_pipeline.fuse_into_document(
            transcript="",
            vision_results=[],
            ocr_results=stub_ocr,
            job_context={"customer": "Test Co", "job_type": "Electrical"},
            trade="electrical",
        )
        field_names = [f["field"] for f in fields]
        # OCR should have added something (Voltage fill or OCR Readings catch-all)
        assert any("voltage" in n.lower() or "ocr" in n.lower() for n in field_names)


# ---------------------------------------------------------------------------
# _normalise_ocr helper
# ---------------------------------------------------------------------------

class TestNormaliseOcr:
    def test_strips_spaces(self):
        from app.services.vision import _normalise_ocr
        assert _normalise_ocr("230 V") == "230v"

    def test_lowercases(self):
        from app.services.vision import _normalise_ocr
        assert _normalise_ocr("230V") == "230v"
