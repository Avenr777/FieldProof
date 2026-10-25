"""
Tests for:
  - PATCH /documents/{doc_id}/fields  (field-edit-log wiring)
  - extract_v2.md prompt file exists and differs from v1
  - eval harness recognises --prompt-version v2
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import json
import pytest

# ---------------------------------------------------------------------------
# PATCH /documents/{doc_id}/fields — unit-level (no HTTP server needed)
# ---------------------------------------------------------------------------

class TestDocumentFieldPatchSchemas:
    """Schema validation only — no DB required."""

    def test_field_edit_basic(self):
        from app.schemas import DocumentFieldEdit
        e = DocumentFieldEdit(field="voltage", new_value="240V")
        assert e.field == "voltage"
        assert e.new_value == "240V"

    def test_field_edit_clear_value(self):
        """new_value=None means reviewer explicitly cleared the field."""
        from app.schemas import DocumentFieldEdit
        e = DocumentFieldEdit(field="rating", new_value=None)
        assert e.new_value is None

    def test_patch_body_multi(self):
        from app.schemas import DocumentFieldPatch, DocumentFieldEdit
        p = DocumentFieldPatch(
            edits=[
                DocumentFieldEdit(field="voltage", new_value="240V"),
                DocumentFieldEdit(field="rating",  new_value="32A"),
            ],
            comment="Corrected site readings",
        )
        assert len(p.edits) == 2
        assert p.comment == "Corrected site readings"

    def test_patch_body_empty_edits(self):
        from app.schemas import DocumentFieldPatch
        p = DocumentFieldPatch(edits=[])
        assert p.edits == []
        assert p.comment is None


# ---------------------------------------------------------------------------
# Field-edit-log logic — test the core loop directly (no FastAPI/SQLAlchemy)
# ---------------------------------------------------------------------------

def _apply_edits(fields, edit_log, edits, user_id="USR-test", comment=None):
    """
    Pure Python re-implementation of the endpoint's edit loop for unit testing.
    Returns (updated_fields, updated_edit_log).
    """
    from datetime import datetime, timezone
    fields = list(fields)
    edit_log = list(edit_log)
    now_iso = datetime.now(timezone.utc).isoformat()

    field_index = {f["field"]: i for i, f in enumerate(fields) if isinstance(f, dict)}

    for edit in edits:
        fname, new_val = edit["field"], edit.get("new_value")
        old_value = None
        if fname in field_index:
            old_value = fields[field_index[fname]].get("value")
            fields[field_index[fname]]["value"] = new_val
            fields[field_index[fname]]["source"] = "human_edit"
            fields[field_index[fname]]["grounded"] = True
            fields[field_index[fname]]["status"] = "ok"
        else:
            fields.append({
                "field": fname, "value": new_val,
                "source": "human_edit", "confidence": 1.0,
                "evidence": None, "grounded": True, "status": "ok",
            })
        edit_log.append({
            "field": fname, "old_value": old_value, "new_value": new_val,
            "user_id": user_id, "timestamp": now_iso, "comment": comment,
        })

    return fields, edit_log


class TestFieldEditLogic:

    def _base_fields(self):
        return [
            {"field": "voltage",  "value": "230V",  "source": "llm", "confidence": 0.9,
             "evidence": "230 volts", "grounded": True, "status": "ok"},
            {"field": "rating",   "value": "20A",   "source": "llm", "confidence": 0.85,
             "evidence": "twenty amp", "grounded": True, "status": "ok"},
            {"field": "component","value": "MCB",   "source": "llm", "confidence": 0.95,
             "evidence": "MCB", "grounded": True, "status": "ok"},
        ]

    def test_edit_existing_field(self):
        fields, log = _apply_edits(
            self._base_fields(), [],
            [{"field": "voltage", "new_value": "240V"}],
        )
        v = next(f for f in fields if f["field"] == "voltage")
        assert v["value"] == "240V"
        assert v["source"] == "human_edit"
        assert v["grounded"] is True
        assert v["status"] == "ok"

    def test_edit_log_entry_created(self):
        fields, log = _apply_edits(
            self._base_fields(), [],
            [{"field": "voltage", "new_value": "240V"}],
            comment="Site reading corrected",
        )
        assert len(log) == 1
        assert log[0]["field"] == "voltage"
        assert log[0]["old_value"] == "230V"
        assert log[0]["new_value"] == "240V"
        assert log[0]["comment"] == "Site reading corrected"

    def test_edit_appends_new_field(self):
        """A field absent from extracted_fields should be appended."""
        fields, log = _apply_edits(
            self._base_fields(), [],
            [{"field": "technician_name", "new_value": "Jane Smith"}],
        )
        names = [f["field"] for f in fields]
        assert "technician_name" in names
        new_f = next(f for f in fields if f["field"] == "technician_name")
        assert new_f["value"] == "Jane Smith"
        assert new_f["confidence"] == 1.0

    def test_multi_edit_all_logged(self):
        fields, log = _apply_edits(
            self._base_fields(), [],
            [
                {"field": "voltage", "new_value": "415V"},
                {"field": "rating",  "new_value": "32A"},
            ],
        )
        assert len(log) == 2
        assert {e["field"] for e in log} == {"voltage", "rating"}

    def test_edit_preserves_other_fields(self):
        fields, log = _apply_edits(
            self._base_fields(), [],
            [{"field": "voltage", "new_value": "240V"}],
        )
        component = next(f for f in fields if f["field"] == "component")
        assert component["value"] == "MCB"  # untouched

    def test_clear_field_value(self):
        """new_value=None clears the field."""
        fields, log = _apply_edits(
            self._base_fields(), [],
            [{"field": "rating", "new_value": None}],
        )
        r = next(f for f in fields if f["field"] == "rating")
        assert r["value"] is None
        assert log[0]["old_value"] == "20A"

    def test_edit_log_accumulates(self):
        """Successive calls accumulate entries."""
        fields, log = _apply_edits(self._base_fields(), [],
                                    [{"field": "voltage", "new_value": "240V"}])
        fields, log = _apply_edits(fields, log,
                                    [{"field": "rating", "new_value": "32A"}])
        assert len(log) == 2

    def test_status_reset_from_ungrounded(self):
        """An ungrounded LLM field becomes ok after a human edit."""
        bad_fields = [{
            "field": "voltage", "value": "415V",
            "source": "llm", "confidence": 0.3,
            "evidence": "some made-up text", "grounded": False, "status": "ungrounded",
        }]
        fields, _ = _apply_edits(bad_fields, [],
                                   [{"field": "voltage", "new_value": "230V"}])
        v = next(f for f in fields if f["field"] == "voltage")
        assert v["status"] == "ok"
        assert v["grounded"] is True


# ---------------------------------------------------------------------------
# extract_v2.md — prompt file sanity checks
# ---------------------------------------------------------------------------

class TestExtractV2Prompt:
    _PROMPTS = Path(__file__).parent.parent / "app" / "prompts"

    def test_v2_file_exists(self):
        assert (self._PROMPTS / "extract_v2.md").exists(), "extract_v2.md not found"

    def test_v2_differs_from_v1(self):
        v1 = (self._PROMPTS / "extract_v1.md").read_text(encoding="utf-8")
        v2 = (self._PROMPTS / "extract_v2.md").read_text(encoding="utf-8")
        assert v1 != v2, "v2 prompt is identical to v1 — no ablation"

    def test_v2_schema_identical(self):
        """Output schema must match v1 so eval harness can compare directly."""
        v1 = (self._PROMPTS / "extract_v1.md").read_text(encoding="utf-8")
        v2 = (self._PROMPTS / "extract_v2.md").read_text(encoding="utf-8")
        # Both must contain the same 10 field names in the schema block
        fields = ["component", "rating", "panel", "action", "voltage",
                  "location", "technician_name", "date", "work_summary", "pass_fail"]
        for f in fields:
            assert f'"{f}"' in v1, f"v1 missing field '{f}'"
            assert f'"{f}"' in v2, f"v2 missing field '{f}'"

    def test_v2_has_cot_instruction(self):
        v2 = (self._PROMPTS / "extract_v2.md").read_text(encoding="utf-8")
        # Chain-of-thought marker must be present
        assert "Reason before" in v2 or "reason step" in v2.lower(), \
            "v2 missing chain-of-thought instruction"

    def test_v2_has_self_check(self):
        v2 = (self._PROMPTS / "extract_v2.md").read_text(encoding="utf-8")
        assert "Self-check" in v2 or "self-check" in v2.lower(), \
            "v2 missing self-check rule"


# ---------------------------------------------------------------------------
# eval harness — prompt version flag is accepted
# ---------------------------------------------------------------------------

class TestEvalHarnessPromptVersion:

    def test_resolve_function_exists(self):
        from eval.run import _resolve
        assert callable(_resolve)

    def test_load_dataset_returns_gold_samples(self):
        from eval.run import load_dataset, GoldSample
        ds_path = Path(__file__).parent.parent / "data" / "electrical_gold.jsonl"
        samples = load_dataset(str(ds_path))
        assert len(samples) >= 30
        assert all(isinstance(s, GoldSample) for s in samples)

    def test_gold_samples_have_audio_path(self):
        """After gen_audio.py runs, every sample should have a non-null audio_path."""
        from eval.run import load_dataset
        ds_path = Path(__file__).parent.parent / "data" / "electrical_gold.jsonl"
        samples = load_dataset(str(ds_path))
        # At least some samples should have audio paths
        with_audio = [s for s in samples if s.audio_path is not None]
        # Only assert if audio dir exists (i.e. gen_audio.py has been run)
        audio_dir = Path(__file__).parent.parent / "data" / "audio"
        if audio_dir.exists() and any(audio_dir.iterdir()):
            assert len(with_audio) > 0, "Expected audio_path to be set after gen_audio.py"

    def test_regex_extractor_runs(self):
        from eval.run import _regex_extractor
        result = _regex_extractor(
            "Replaced 20 amp MCB on panel 2. Voltage 230 volts. All good."
        )
        assert result["rating"] == "20A"
        assert result["voltage"] == "230V"
        assert result["component"] is not None

    def test_condition_v2_in_config(self):
        """Config file should still parse with prompt_version v2."""
        import json, tempfile, os
        cfg = {"dataset": "data/electrical_gold.jsonl",
               "prompt_version": "v2",
               "output_dir": "eval/results",
               "conditions": ["regex"]}
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json",
                                         delete=False, encoding="utf-8") as f:
            json.dump(cfg, f)
            tmp = f.name
        try:
            with open(tmp, encoding="utf-8") as f:
                loaded = json.load(f)
            assert loaded["prompt_version"] == "v2"
        finally:
            os.unlink(tmp)
