"""
Evaluation harness for FieldProof Whisper + LLM extraction pipeline.

Usage
-----
    # From backend/
    python -m eval.run --config eval/config_baseline.json

    # Or with overrides:
    python -m eval.run --dataset data/electrical_gold.jsonl \
                       --prompt-version v1 \
                       --model gpt-4o-mini \
                       --output-dir eval/results

Paths are resolved relative to backend/ (the directory containing this package).

What it measures
----------------
STT metrics (when audio files are present):
    word_error_rate (WER) per sample and overall — via jiwer
    character_error_rate (CER)
    no_speech_ratio — fraction of samples where Whisper said no speech

Extraction metrics (field-level):
    precision, recall, F1 — binary presence/absence per field
    exact_match_accuracy — value string must match gold (after normalisation)
    hallucination_rate — non-null prediction where gold is null
    grounding_failure_rate — value present but evidence not in transcript
    missing_rate — null prediction where gold is non-null

Baselines:
    regex   — keyword/regex extractor (no LLM)
    llm_no_grounding — same LLM without the grounding check

Ablations (controlled by config):
    prompt_version  — v1 vs v2 etc.
    use_domain_prompt — True vs False (STT vocabulary priming)
    model           — any chat model in config

Output
------
    results/<run_id>/summary.csv   — one row per condition
    results/<run_id>/per_sample.jsonl — raw predictions + gold for each sample

The summary.csv is the source of truth for paper tables.
Every number in the paper must be regenerable with one command.
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

# Ensure backend package is on the path when run as a module
_BACKEND_DIR = Path(__file__).parent.parent  # .../backend/
sys.path.insert(0, str(_BACKEND_DIR))


def _resolve(path: str) -> str:
    """
    Resolve a path relative to the backend/ directory so the harness works
    regardless of which directory `python -m eval.run` is called from.
    If the path is already absolute, return it unchanged.
    """
    p = Path(path)
    if p.is_absolute():
        return str(p)
    # If it exists relative to CWD, prefer that (explicit override)
    if p.exists():
        return str(p)
    # Fall back to backend/-relative resolution
    return str(_BACKEND_DIR / p)

from app.config import settings

logger = logging.getLogger("fieldproof.eval")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class GoldSample:
    """One hand-labelled evaluation example."""
    id: str
    condition: str                          # "complete" | "missing_fields" | "noisy" etc.
    transcript_ref: str                     # reference transcript (for WER)
    audio_path: str | None                  # path to .wav/.mp3 if available
    gold_fields: dict[str, str | None]      # field_name -> gold value (None = absent)


@dataclass
class PredictionResult:
    sample_id: str
    condition: str
    predicted_fields: dict[str, Any]        # field_name -> {value, evidence, grounded, status}
    stt_transcript: str | None = None
    stt_wer: float | None = None
    stt_cer: float | None = None
    stt_latency_s: float | None = None
    llm_latency_s: float | None = None
    llm_tokens_in: int = 0
    llm_tokens_out: int = 0
    llm_model: str = ""
    prompt_version: str = ""
    validation_status: str = ""
    hallucination_count: int = 0
    grounding_failure_count: int = 0


@dataclass
class FieldMetrics:
    field: str
    tp: int = 0  # predicted non-null AND gold non-null
    fp: int = 0  # predicted non-null AND gold null (hallucination)
    fn: int = 0  # predicted null AND gold non-null (missing)
    tn: int = 0  # both null
    exact_matches: int = 0
    grounding_failures: int = 0
    total: int = 0

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if (self.tp + self.fp) > 0 else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if (self.tp + self.fn) > 0 else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) > 0 else 0.0

    @property
    def exact_match_accuracy(self) -> float:
        return self.exact_matches / self.tp if self.tp > 0 else 0.0

    @property
    def hallucination_rate(self) -> float:
        gold_null = self.fp + self.tn
        return self.fp / gold_null if gold_null > 0 else 0.0

    @property
    def grounding_failure_rate(self) -> float:
        return self.grounding_failures / (self.tp + self.fp) if (self.tp + self.fp) > 0 else 0.0


# ---------------------------------------------------------------------------
# Dataset loader
# ---------------------------------------------------------------------------

def load_dataset(path: str) -> list[GoldSample]:
    """
    Loads a JSONL dataset where each line is:
    {
        "id": "...",
        "condition": "complete",
        "transcript_ref": "...",
        "audio_path": null,
        "gold_fields": {"component": "MCB", "rating": "20A", ...}
    }
    """
    samples = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            d = json.loads(line)
            samples.append(GoldSample(
                id=d["id"],
                condition=d.get("condition", "unknown"),
                transcript_ref=d["transcript_ref"],
                audio_path=d.get("audio_path"),
                gold_fields=d.get("gold_fields", {}),
            ))
    logger.info("Loaded %d samples from %s", len(samples), path)
    return samples


# ---------------------------------------------------------------------------
# Baselines
# ---------------------------------------------------------------------------

def _regex_extractor(transcript: str) -> dict[str, str | None]:
    """
    Simple keyword/regex baseline. No LLM, no normalisation.
    Used as the weakest baseline for comparison.
    """
    import re

    result: dict[str, str | None] = {}

    # Rating (amperage)
    m = re.search(r"(\d+)\s*(?:amp|a\b)", transcript, re.IGNORECASE)
    result["rating"] = f"{m.group(1)}A" if m else None

    # Voltage
    m = re.search(r"(\d+)\s*(?:v(?:olt)?s?)\b", transcript, re.IGNORECASE)
    result["voltage"] = f"{m.group(1)}V" if m else None

    # Component
    for comp in ["MCB", "RCD", "RCBO", "breaker", "fuse", "isolator"]:
        if re.search(rf"\b{comp}\b", transcript, re.IGNORECASE):
            result["component"] = comp
            break
    else:
        result["component"] = None

    # Panel / board
    m = re.search(r"panel\s+(\d+|[A-Za-z]+)", transcript, re.IGNORECASE)
    result["panel"] = m.group(0) if m else None

    # Action
    for action in ["replaced", "installed", "tested", "inspected", "repaired", "removed"]:
        if action.lower() in transcript.lower():
            result["action"] = action.capitalize()
            break
    else:
        result["action"] = None

    # Remaining fields null
    for f in ["location", "technician_name", "date", "work_summary", "pass_fail"]:
        result.setdefault(f, None)

    return result


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------

def _normalise_value(v: Any) -> str | None:
    """Normalise for exact-match comparison."""
    if v is None:
        return None
    return str(v).strip().lower()


def compute_metrics(
    samples: list[GoldSample],
    predictions: list[PredictionResult],
) -> tuple[dict[str, FieldMetrics], dict]:
    """Returns per-field metrics and aggregate summary."""
    field_metrics: dict[str, FieldMetrics] = {}
    wer_values = []
    cer_values = []

    for sample, pred in zip(samples, predictions):
        if pred.stt_wer is not None:
            wer_values.append(pred.stt_wer)
        if pred.stt_cer is not None:
            cer_values.append(pred.stt_cer)

        for field_name, gold_val in sample.gold_fields.items():
            if field_name not in field_metrics:
                field_metrics[field_name] = FieldMetrics(field=field_name)

            fm = field_metrics[field_name]
            fm.total += 1

            pred_fv = pred.predicted_fields.get(field_name, {})
            if isinstance(pred_fv, dict):
                pred_val = pred_fv.get("value")
                grounded = pred_fv.get("grounded")
                status = pred_fv.get("status", "")
            else:
                pred_val = pred_fv
                grounded = None
                status = ""

            gold_norm = _normalise_value(gold_val)
            pred_norm = _normalise_value(pred_val)

            if gold_norm is not None and pred_norm is not None:
                fm.tp += 1
                if gold_norm == pred_norm:
                    fm.exact_matches += 1
                if grounded is False:
                    fm.grounding_failures += 1
            elif gold_norm is None and pred_norm is not None:
                fm.fp += 1  # hallucination
            elif gold_norm is not None and pred_norm is None:
                fm.fn += 1  # missing
            else:
                fm.tn += 1

    aggregate = {
        "mean_wer": sum(wer_values) / len(wer_values) if wer_values else None,
        "mean_cer": sum(cer_values) / len(cer_values) if cer_values else None,
        "macro_precision": _safe_mean([fm.precision for fm in field_metrics.values()]),
        "macro_recall": _safe_mean([fm.recall for fm in field_metrics.values()]),
        "macro_f1": _safe_mean([fm.f1 for fm in field_metrics.values()]),
        "macro_exact_match": _safe_mean([fm.exact_match_accuracy for fm in field_metrics.values()]),
        "macro_hallucination_rate": _safe_mean([fm.hallucination_rate for fm in field_metrics.values()]),
        "macro_grounding_failure_rate": _safe_mean([fm.grounding_failure_rate for fm in field_metrics.values()]),
    }
    return field_metrics, aggregate


def _safe_mean(vals: list[float]) -> float | None:
    filtered = [v for v in vals if v is not None]
    return sum(filtered) / len(filtered) if filtered else None


# ---------------------------------------------------------------------------
# STT evaluation helper
# ---------------------------------------------------------------------------

def _compute_wer(reference: str, hypothesis: str) -> tuple[float, float]:
    """
    Returns (WER, CER).  Requires the 'jiwer' package.
    Returns (None, None) if jiwer is not installed.
    """
    try:
        import jiwer
        transforms = jiwer.Compose([
            jiwer.ToLowerCase(),
            jiwer.RemovePunctuation(),
            jiwer.RemoveMultipleSpaces(),
            jiwer.Strip(),
        ])
        wer = jiwer.wer(reference, hypothesis, truth_transform=transforms, hypothesis_transform=transforms)
        cer = jiwer.cer(reference, hypothesis, truth_transform=transforms, hypothesis_transform=transforms)
        return wer, cer
    except ImportError:
        logger.warning("jiwer not installed — WER/CER not computed. Run: pip install jiwer")
        return None, None


# ---------------------------------------------------------------------------
# Run a single condition
# ---------------------------------------------------------------------------

def run_condition(
    samples: list[GoldSample],
    extractor_fn,      # callable(transcript) -> dict
    condition_name: str,
    stt_fn=None,       # callable(audio_path) -> (transcript_text, latency_s) or None
    llm_meta_fn=None,  # callable(transcript) -> meta dict or None
) -> list[PredictionResult]:
    results = []
    for sample in samples:
        pred = PredictionResult(
            sample_id=sample.id,
            condition=condition_name,
            predicted_fields={},
        )

        # STT phase
        transcript = sample.transcript_ref  # use reference if no audio / no STT
        if stt_fn and sample.audio_path:
            try:
                t0 = time.perf_counter()
                transcript, stt_model = stt_fn(sample.audio_path)
                pred.stt_latency_s = time.perf_counter() - t0
                pred.stt_transcript = transcript
                wer, cer = _compute_wer(sample.transcript_ref, transcript)
                pred.stt_wer = wer
                pred.stt_cer = cer
            except Exception as e:
                logger.error("STT failed for sample %s: %s", sample.id, e)
                pred.stt_transcript = sample.transcript_ref

        # Extraction phase
        try:
            t0 = time.perf_counter()
            extracted = extractor_fn(transcript)
            elapsed = time.perf_counter() - t0

            # Pull LLM meta if present
            meta = extracted.pop("_meta", None)
            if meta:
                pred.llm_latency_s = meta.get("latency_s", elapsed)
                pred.llm_tokens_in = meta.get("input_tokens", 0)
                pred.llm_tokens_out = meta.get("output_tokens", 0)
                pred.llm_model = meta.get("model", "")
                pred.prompt_version = meta.get("prompt_version", "")
                pred.validation_status = meta.get("validation_status", "")
            else:
                pred.llm_latency_s = elapsed

            pred.predicted_fields = extracted

            # Count hallucinations and grounding failures
            for fv in extracted.values():
                if isinstance(fv, dict):
                    if fv.get("value") is not None and fv.get("status") == "ungrounded":
                        pred.grounding_failure_count += 1
        except Exception as e:
            err_msg = str(e)
            logger.error("Extraction failed for sample %s: %s", sample.id, err_msg)
            if "insufficient_quota" in err_msg or "credit_balance_exhausted" in err_msg:
                logger.critical(
                    "FATAL: OpenAI credit balance exhausted (429). "
                    "Add credits at https://platform.openai.com/settings/organization/billing/ "
                    "or run with a local open-weight model (e.g. Llama-3-8B via Ollama)."
                )
                results.append(pred)
                break
            elif "401" in err_msg or "invalid_api_key" in err_msg:
                logger.critical(
                    "FATAL: OpenAI API unauthorized (401). Check that OPENAI_API_KEY is valid."
                )
                results.append(pred)
                break

        results.append(pred)

    return results


# ---------------------------------------------------------------------------
# Write outputs
# ---------------------------------------------------------------------------

def write_summary_csv(
    run_id: str,
    output_dir: Path,
    conditions: dict[str, tuple[dict[str, FieldMetrics], dict]],
):
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "summary.csv"

    rows = []
    for condition_name, (field_metrics, aggregate) in conditions.items():
        for field_name, fm in field_metrics.items():
            rows.append({
                "run_id": run_id,
                "condition": condition_name,
                "field": field_name,
                "precision": round(fm.precision, 4),
                "recall": round(fm.recall, 4),
                "f1": round(fm.f1, 4),
                "exact_match_accuracy": round(fm.exact_match_accuracy, 4),
                "hallucination_rate": round(fm.hallucination_rate, 4),
                "grounding_failure_rate": round(fm.grounding_failure_rate, 4),
                "tp": fm.tp, "fp": fm.fp, "fn": fm.fn, "tn": fm.tn,
                "mean_wer": aggregate.get("mean_wer"),
                "mean_cer": aggregate.get("mean_cer"),
                "macro_f1": aggregate.get("macro_f1"),
                "macro_hallucination_rate": aggregate.get("macro_hallucination_rate"),
            })

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    logger.info("Summary CSV written: %s", csv_path)
    return csv_path


def write_per_sample_jsonl(
    output_dir: Path,
    condition_name: str,
    samples: list[GoldSample],
    preds: list[PredictionResult],
):
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"per_sample_{condition_name}.jsonl"
    with open(path, "w", encoding="utf-8") as f:
        for sample, pred in zip(samples, preds):
            record = {
                "sample_id": pred.sample_id,
                "gold_fields": sample.gold_fields,
                "predicted_fields": pred.predicted_fields,
                "stt_transcript": pred.stt_transcript,
                "stt_wer": pred.stt_wer,
                "stt_cer": pred.stt_cer,
                "stt_latency_s": pred.stt_latency_s,
                "llm_latency_s": pred.llm_latency_s,
                "llm_tokens_in": pred.llm_tokens_in,
                "llm_tokens_out": pred.llm_tokens_out,
                "llm_model": pred.llm_model,
                "prompt_version": pred.prompt_version,
                "validation_status": pred.validation_status,
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    logger.info("Per-sample JSONL written: %s", path)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="FieldProof evaluation harness — reproducible tables for the paper"
    )
    parser.add_argument("--dataset", default="data/electrical_gold.jsonl",
                        help="Path to JSONL evaluation dataset (relative to backend/ or absolute)")
    parser.add_argument("--prompt-version", default="v1",
                        help="Prompt version to use for LLM extraction")
    parser.add_argument("--model", default=None,
                        help="Override AI_MODEL_CHAT for this run")
    parser.add_argument("--output-dir", default="eval/results",
                        help="Directory to write results to (relative to backend/ or absolute)")
    parser.add_argument("--config", default=None,
                        help="JSON config file (keys match CLI args)")
    parser.add_argument("--run-id", default=None,
                        help="Unique ID for this run (auto-generated if not set)")
    parser.add_argument("--conditions", nargs="+",
                        default=["llm", "regex", "llm_no_grounding"],
                        help="Which conditions to run")
    parser.add_argument("--use-stt", action="store_true", default=False,
                        help="Transcribe audio files using STT before extraction instead of using reference transcripts")
    args = parser.parse_args()

    # Load config file if provided
    if args.config:
        with open(args.config, encoding="utf-8") as f:
            cfg = json.load(f)
        for k, v in cfg.items():
            k_attr = k.replace("-", "_")
            if hasattr(args, k_attr):
                setattr(args, k_attr, v)

    if args.model:
        os.environ["AI_MODEL_CHAT"] = args.model

    run_id = args.run_id or f"run_{uuid.uuid4().hex[:8]}"

    logger.info("=== FieldProof eval | run_id=%s ===", run_id)
    logger.info("Dataset: %s", args.dataset)
    logger.info("Prompt version: %s", args.prompt_version)
    logger.info("Conditions: %s", args.conditions)

    samples = load_dataset(_resolve(args.dataset))
    output_dir = Path(_resolve(args.output_dir)) / run_id

    # Import services here (after path is set)
    from app.services.llm import extract_fields

    def llm_extractor(transcript: str) -> dict:
        return extract_fields(
            transcript,
            trade="electrical",
            prompt_version=args.prompt_version,
            model=args.model,
        ) or {}

    def llm_no_grounding_extractor(transcript: str) -> dict:
        """LLM without the grounding check — for ablation comparison."""
        raw = extract_fields(
            transcript,
            trade="electrical",
            prompt_version=args.prompt_version,
            model=args.model,
        ) or {}
        # Strip grounding results to simulate no-grounding baseline
        meta = raw.pop("_meta", None)
        cleaned = {}
        for k, v in raw.items():
            if isinstance(v, dict):
                cleaned[k] = {
                    "value": v.get("value"),
                    "evidence": v.get("evidence"),
                    "confidence": v.get("confidence"),
                    "grounded": None,
                    "status": "ok" if v.get("value") is not None else "missing",
                }
            else:
                cleaned[k] = v
        if meta:
            cleaned["_meta"] = meta
        return cleaned

    extractors = {
        "llm": llm_extractor,
        "regex": _regex_extractor,
        "llm_no_grounding": llm_no_grounding_extractor,
    }

    stt_fn = None
    if getattr(args, "use_stt", False):
        from app.services.stt import get_transcriber
        transcriber = get_transcriber()
        if transcriber:
            def _stt(audio_path: str):
                t = transcriber.transcribe(audio_path, trade="electrical")
                return t.text, t.model
            stt_fn = _stt
            logger.info("STT enabled using %s", getattr(transcriber, "_model", "Whisper"))
        else:
            logger.warning("No STT transcriber available (OPENAI_API_KEY not set). Falling back to reference transcripts.")

    all_conditions = {}
    for cond_name in args.conditions:
        if cond_name not in extractors:
            logger.warning("Unknown condition '%s' — skipping", cond_name)
            continue

        logger.info("Running condition: %s", cond_name)
        preds = run_condition(
            samples=samples,
            extractor_fn=extractors[cond_name],
            condition_name=cond_name,
            stt_fn=stt_fn,
        )
        write_per_sample_jsonl(output_dir, cond_name, samples, preds)
        field_metrics, aggregate = compute_metrics(samples, preds)
        all_conditions[cond_name] = (field_metrics, aggregate)

        logger.info(
            "Condition %s — macro F1: %.3f | hallucination: %.3f | grounding-fail: %.3f",
            cond_name,
            aggregate.get("macro_f1") or 0.0,
            aggregate.get("macro_hallucination_rate") or 0.0,
            aggregate.get("macro_grounding_failure_rate") or 0.0,
        )

    summary_path = write_summary_csv(run_id, output_dir, all_conditions)
    logger.info("=== Eval complete — results in %s ===", output_dir)
    print(f"\nRun complete. Summary: {summary_path}")


if __name__ == "__main__":
    main()
