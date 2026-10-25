"""
Unit tests for normalisation, grounding check, schema validation, and
STT/LLM retry behaviour (with mocked API calls).

Run with:
    pytest backend/tests/ -v

Install test deps first:
    pip install pytest pytest-mock httpx
"""
import sys
from pathlib import Path

# Add backend to path so imports work without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# Normalisation tests
# ---------------------------------------------------------------------------

class TestNormaliseUnit:
    def setup_method(self):
        from app.services.normalize import normalise_unit
        self.normalise_unit = normalise_unit

    def test_twenty_amp(self):
        assert self.normalise_unit("twenty amp") == "20A"

    def test_twenty_amps(self):
        assert self.normalise_unit("twenty amps") == "20A"

    def test_digit_volt(self):
        assert self.normalise_unit("230 volts") == "230V"

    def test_digit_volt_short(self):
        assert self.normalise_unit("230V") == "230V"

    def test_kw(self):
        assert self.normalise_unit("3.5 kW") == "3.5kW"

    def test_watts(self):
        assert self.normalise_unit("100 watts") == "100W"

    def test_ohm(self):
        assert self.normalise_unit("5 ohms") == "5Ω"

    def test_no_match_passthrough(self):
        assert self.normalise_unit("hello world") == "hello world"

    def test_empty(self):
        assert self.normalise_unit("") == ""

    def test_float_volt(self):
        # 240.2 V should be preserved as 240.2V (we don't truncate meaningful decimals)
        assert self.normalise_unit("240.2 V") == "240.2V"


class TestWordsToNumber:
    def setup_method(self):
        from app.services.normalize import words_to_number
        self.words_to_number = words_to_number

    def test_zero(self):
        assert self.words_to_number("zero") == 0

    def test_ten(self):
        assert self.words_to_number("ten") == 10

    def test_twenty(self):
        assert self.words_to_number("twenty") == 20

    def test_thirty_two(self):
        assert self.words_to_number("thirty two") == 32

    def test_two_hundred(self):
        assert self.words_to_number("two hundred") == 200

    def test_already_int(self):
        assert self.words_to_number("32") == 32

    def test_already_float(self):
        assert self.words_to_number("3.5") == 3.5

    def test_not_a_number(self):
        assert self.words_to_number("hello") is None

    def test_mixed(self):
        # "twenty amp" — "amp" stops matching → None
        assert self.words_to_number("twenty amp") is None


class TestNormaliseDate:
    def setup_method(self):
        from app.services.normalize import normalise_date
        self.normalise_date = normalise_date

    def test_slash_dmy(self):
        assert self.normalise_date("25/10/2026") == "2026-10-25"

    def test_dash_dmy(self):
        assert self.normalise_date("25-10-2026") == "2026-10-25"

    def test_verbal(self):
        assert self.normalise_date("25th October 2026") == "2026-10-25"

    def test_verbal_no_suffix(self):
        assert self.normalise_date("25 October 2026") == "2026-10-25"

    def test_unknown_passthrough(self):
        assert self.normalise_date("tomorrow") == "tomorrow"

    def test_empty(self):
        assert self.normalise_date("") == ""


# ---------------------------------------------------------------------------
# Grounding check tests
# ---------------------------------------------------------------------------

class TestGroundingCheck:
    def setup_method(self):
        from app.services.llm import run_grounding_check
        self.run_grounding_check = run_grounding_check

    def _fv(self, value, evidence):
        return {"value": value, "evidence": evidence, "confidence": 0.9}

    def test_grounded_exact(self):
        transcript = "Replaced the 20A MCB on panel 2."
        extracted = {"component": self._fv("MCB", "20A MCB on panel 2")}
        result = self.run_grounding_check(extracted, transcript)
        assert result["component"]["grounded"] is True
        assert result["component"]["status"] == "ok"

    def test_ungrounded_hallucination(self):
        transcript = "Checked the panel."
        extracted = {"component": self._fv("MCB", "20A MCB replaced")}
        result = self.run_grounding_check(extracted, transcript)
        assert result["component"]["grounded"] is False
        assert result["component"]["status"] == "ungrounded"

    def test_null_value_missing(self):
        transcript = "Checked the panel."
        extracted = {"voltage": {"value": None, "evidence": None, "confidence": 0.0}}
        result = self.run_grounding_check(extracted, transcript)
        assert result["voltage"]["status"] == "missing"
        assert result["voltage"]["grounded"] is None

    def test_case_insensitive(self):
        transcript = "Replaced the 20A MCB."
        extracted = {"component": self._fv("MCB", "20a mcb")}
        result = self.run_grounding_check(extracted, transcript)
        assert result["component"]["grounded"] is True

    def test_no_evidence_for_non_null(self):
        """Non-null value with no evidence span should be marked ungrounded."""
        transcript = "Replaced the MCB."
        extracted = {"component": self._fv("MCB", None)}
        result = self.run_grounding_check(extracted, transcript)
        assert result["component"]["grounded"] is False
        assert result["component"]["status"] == "ungrounded"


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------

class TestElectricalJobExtraction:
    def setup_method(self):
        from app.services.llm import ElectricalJobExtraction, FieldValue
        self.schema = ElectricalJobExtraction
        self.fv = FieldValue

    def test_all_null_ok(self):
        obj = self.schema()
        assert obj.component.value is None

    def test_valid_field_value(self):
        obj = self.schema(component=self.fv(value="MCB", evidence="MCB on panel", confidence=0.95))
        assert obj.component.value == "MCB"
        assert obj.component.confidence == 0.95

    def test_confidence_clamped_above(self):
        fv = self.fv(confidence=1.5)
        assert fv.confidence == 1.0

    def test_confidence_clamped_below(self):
        fv = self.fv(confidence=-0.3)
        assert fv.confidence == 0.0

    def test_extra_fields_ignored(self):
        """Schema should not crash on extra fields from LLM response."""
        obj = self.schema(**{"component": {"value": "MCB", "evidence": "test", "confidence": 0.9}, "unknown_field": "whatever"})
        assert obj.component.value == "MCB"


# ---------------------------------------------------------------------------
# LLM extractor retry / fallback tests (mocked)
# ---------------------------------------------------------------------------

class TestOpenAILLMExtractorRetry:
    """Test the retry logic without making real API calls."""

    def _make_extractor(self, responses):
        """
        Create an extractor with a mocked _call_api that returns responses
        in sequence.
        """
        import json
        from unittest.mock import patch, MagicMock
        from app.services.llm import OpenAILLMExtractor

        extractor = OpenAILLMExtractor(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            prompt_version="v1",
        )
        return extractor

    def test_valid_response_no_retry(self):
        """Valid JSON response on first try — no retry needed."""
        import json
        from unittest.mock import patch, MagicMock
        from app.services.llm import OpenAILLMExtractor

        valid_response = json.dumps({
            "component": {"value": "MCB", "evidence": "MCB on panel 2", "confidence": 0.95},
            "rating": {"value": "20A", "evidence": "20 amp", "confidence": 0.9},
            "panel": {"value": "panel 2", "evidence": "panel 2", "confidence": 0.88},
            "action": {"value": None, "evidence": None, "confidence": 0.0},
            "voltage": {"value": "230V", "evidence": "230 volts", "confidence": 0.92},
            "location": {"value": None, "evidence": None, "confidence": 0.0},
            "technician_name": {"value": None, "evidence": None, "confidence": 0.0},
            "date": {"value": None, "evidence": None, "confidence": 0.0},
            "work_summary": {"value": None, "evidence": None, "confidence": 0.0},
            "pass_fail": {"value": None, "evidence": None, "confidence": 0.0},
        })

        mock_resp = MagicMock()
        mock_resp.is_success = True
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": valid_response}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        }

        extractor = OpenAILLMExtractor(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            prompt_version="v1",
        )

        with patch("httpx.post", return_value=mock_resp):
            result = extractor.extract(
                "Replaced the 20 amp MCB on panel 2. Voltage 230 volts.",
                trade="electrical",
            )

        assert result["component"]["value"] == "MCB"
        assert result["rating"]["value"] == "20A"
        assert result["_meta"]["validation_status"] == "ok"

    def test_malformed_response_falls_back_to_null(self):
        """Malformed JSON after max retries → all-null fallback."""
        from unittest.mock import patch, MagicMock
        from app.services.llm import OpenAILLMExtractor

        mock_resp = MagicMock()
        mock_resp.is_success = True
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "this is not json {"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

        extractor = OpenAILLMExtractor(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            prompt_version="v1",
        )

        with patch("httpx.post", return_value=mock_resp):
            result = extractor.extract("Some transcript.", trade="electrical")

        assert result["_meta"]["validation_status"] == "validation_failed"
        assert result["component"]["value"] is None

    def test_api_error_raises(self):
        """HTTP 500 from API raises RuntimeError so Celery can retry."""
        from unittest.mock import patch, MagicMock
        from app.services.llm import OpenAILLMExtractor
        import pytest

        mock_resp = MagicMock()
        mock_resp.is_success = False
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"

        extractor = OpenAILLMExtractor(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            prompt_version="v1",
        )

        with patch("httpx.post", return_value=mock_resp):
            with pytest.raises(RuntimeError, match="LLM API 500"):
                from app.services.llm import ElectricalJobExtraction
                extractor._call_with_retry("user message", ElectricalJobExtraction)

    def _get_schema_class_for_test(self):
        from app.services.llm import ElectricalJobExtraction
        return ElectricalJobExtraction


# ---------------------------------------------------------------------------
# STT tests (mocked)
# ---------------------------------------------------------------------------

class TestOpenAIWhisperTranscriber:
    def test_small_file_rejected(self, tmp_path):
        """Files under 100 bytes should raise ValueError, not call the API."""
        from app.services.stt import OpenAIWhisperTranscriber

        tiny_file = tmp_path / "tiny.wav"
        tiny_file.write_bytes(b"x" * 50)

        transcriber = OpenAIWhisperTranscriber(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="whisper-1",
        )

        import pytest
        with pytest.raises(ValueError, match="too small"):
            transcriber.transcribe(str(tiny_file))

    def test_missing_file_raises(self, tmp_path):
        from app.services.stt import OpenAIWhisperTranscriber
        import pytest

        transcriber = OpenAIWhisperTranscriber(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="whisper-1",
        )
        with pytest.raises(FileNotFoundError):
            transcriber.transcribe(str(tmp_path / "nonexistent.wav"))

    def test_successful_transcription(self, tmp_path):
        """Happy path: API returns verbose_json, we get a Transcript back."""
        from unittest.mock import patch, MagicMock
        from app.services.stt import OpenAIWhisperTranscriber

        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"RIFF" + b"\x00" * 500)  # Fake WAV > 100 bytes

        mock_resp = MagicMock()
        mock_resp.is_success = True
        mock_resp.json.return_value = {
            "text": "Replaced the 20 amp MCB.",
            "language": "en",
            "duration": 5.0,
            "segments": [
                {
                    "start": 0.0, "end": 2.5,
                    "text": "Replaced the 20 amp MCB.",
                    "avg_logprob": -0.25,
                    "no_speech_prob": 0.02,
                }
            ],
        }

        transcriber = OpenAIWhisperTranscriber(
            api_key="test-key",
            base_url="https://api.openai.com/v1",
            model="whisper-1",
        )

        with patch("httpx.post", return_value=mock_resp):
            result = transcriber.transcribe(str(audio_file), trade="electrical")

        assert result.text == "Replaced the 20 amp MCB."
        assert result.language == "en"
        assert result.duration_s == 5.0
        assert len(result.segments) == 1
        assert result.model == "whisper-1"
        assert result.latency_s >= 0


# ---------------------------------------------------------------------------
# Compliance check tests
# ---------------------------------------------------------------------------

class TestRunComplianceCheck:
    def setup_method(self):
        import asyncio
        from app.services.ai_pipeline import run_compliance_check
        self.check = lambda trade, fields, required: asyncio.run(
            run_compliance_check(trade, fields, required)
        )

    def _field(self, name, value, status="ok"):
        return {"field": name, "value": value, "status": status, "confidence": 90.0}

    def test_all_present(self):
        fields = [
            self._field("Component", "MCB"),
            self._field("Voltage", "230V"),
        ]
        missing = self.check("Electrical", fields, ["Component", "Voltage"])
        assert missing == []

    def test_missing_field(self):
        fields = [self._field("Component", "MCB")]
        missing = self.check("Electrical", fields, ["Component", "Voltage"])
        assert "Voltage" in missing

    def test_ungrounded_field_not_trusted(self):
        """An 'ungrounded' field should not count as present."""
        fields = [
            self._field("Component", "MCB"),
            self._field("Voltage", "230V", status="ungrounded"),
        ]
        missing = self.check("Electrical", fields, ["Component", "Voltage"])
        assert "Voltage" in missing

    def test_null_value_missing(self):
        fields = [self._field("Component", None)]
        missing = self.check("Electrical", fields, ["Component"])
        assert "Component" in missing

    def test_partial_match(self):
        """'Voltage' requirement should match 'Voltage Reading' field."""
        fields = [self._field("Voltage Reading", "230V")]
        missing = self.check("Electrical", fields, ["Voltage"])
        assert missing == []
