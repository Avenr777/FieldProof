"""
Grounding false-alarm analyser.

Reads per_sample_*.jsonl from the eval harness and prints every field where
grounded=False, with its context, so you can classify it as:
  T = true hallucination   (model invented a value)
  F = false alarm          (correct value, wrong/missing evidence span)
  U = uncertain

Usage:
    python data/analyse_grounding.py --file eval/results/paper_llm_v1/per_sample_llm.jsonl

Output:
    eval/results/paper_llm_v1/grounding_analysis.csv
    (one row per ungrounded field, with manual_label column left blank)
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to per_sample_*.jsonl")
    args = parser.parse_args()

    src = Path(args.file)
    if not src.exists():
        raise FileNotFoundError(src)

    out_path = src.parent / "grounding_analysis.csv"

    ungrounded_rows = []
    total_fields = 0
    total_ungrounded = 0

    with src.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            sample = json.loads(line)
            sample_id = sample.get("sample_id", "?")
            transcript = sample.get("stt_transcript") or ""
            gold = sample.get("gold_fields", {})
            preds = sample.get("predicted_fields", {})

            for field_name, fv in preds.items():
                if not isinstance(fv, dict):
                    continue
                total_fields += 1
                if fv.get("grounded") is False:
                    total_ungrounded += 1
                    gold_val = gold.get(field_name)
                    pred_val = fv.get("value")
                    evidence = fv.get("evidence", "")
                    ungrounded_rows.append({
                        "sample_id": sample_id,
                        "field": field_name,
                        "gold_value": gold_val,
                        "predicted_value": pred_val,
                        "evidence_span": evidence,
                        "transcript_snippet": transcript[:200] if transcript else "",
                        # T=true hallucination, F=false alarm, U=uncertain
                        "manual_label": "",
                        "notes": "",
                    })

    if not ungrounded_rows:
        print("No ungrounded fields found — grounding check passed on all predictions.")
        return

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(ungrounded_rows[0].keys()))
        writer.writeheader()
        writer.writerows(ungrounded_rows)

    print(f"\nTotal predicted fields : {total_fields}")
    print(f"Ungrounded fields      : {total_ungrounded} ({100*total_ungrounded/max(total_fields,1):.1f}%)")
    print(f"\nAnalysis CSV written   : {out_path}")
    print("\nOpen the CSV, fill in 'manual_label' column (T/F/U) for each row.")
    print("T = true hallucination | F = false alarm | U = uncertain")
    print("\nFirst 5 ungrounded cases:")
    for r in ungrounded_rows[:5]:
        print(f"  sample={r['sample_id']} field={r['field']}")
        print(f"    gold={r['gold_value']} | predicted={r['predicted_value']}")
        print(f"    evidence='{r['evidence_span']}'")
        print()


if __name__ == "__main__":
    main()
