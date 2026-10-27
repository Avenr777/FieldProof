"""
Inter-annotator agreement calculator (Cohen's Kappa).

Computes Cohen's Kappa (kappa) between two annotators on the gold evaluation dataset
to validate reference quality for the FieldProof research paper.

Usage:
    # Generate second-annotator blank template:
    python backend/data/calc_kappa.py --create-template --sample-ratio 0.20

    # Calculate agreement between original gold and second annotator:
    python backend/data/calc_kappa.py --gold backend/data/electrical_gold.jsonl \
                                      --annotator2 backend/data/annotator2_sample.jsonl
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def cohen_kappa(p_o: float, p_e: float) -> float:
    """Computes Cohen's kappa given observed agreement p_o and chance agreement p_e."""
    if p_e >= 1.0:
        return 1.0 if p_o >= 1.0 else 0.0
    return (p_o - p_e) / (1.0 - p_e)


def compute_field_kappa(
    annotations1: list[dict[str, str | None]],
    annotations2: list[dict[str, str | None]],
    field_names: list[str],
) -> dict[str, dict[str, float]]:
    """
    Computes presence agreement (binary: present vs null) and
    value exact-match agreement for each field.
    """
    results = {}
    n = len(annotations1)
    if n == 0:
        return results

    for f_name in field_names:
        # 1. Binary presence agreement (is field non-null?)
        # Contingency table: [[a, b], [c, d]]
        # a: both present, b: 1 present & 2 null, c: 1 null & 2 present, d: both null
        a = sum(1 for i in range(n) if annotations1[i].get(f_name) is not None and annotations2[i].get(f_name) is not None)
        b = sum(1 for i in range(n) if annotations1[i].get(f_name) is not None and annotations2[i].get(f_name) is None)
        c = sum(1 for i in range(n) if annotations1[i].get(f_name) is None and annotations2[i].get(f_name) is not None)
        d = sum(1 for i in range(n) if annotations1[i].get(f_name) is None and annotations2[i].get(f_name) is None)

        p_o_presence = (a + d) / n
        p_yes_1 = (a + b) / n
        p_yes_2 = (a + c) / n
        p_no_1 = (c + d) / n
        p_no_2 = (b + d) / n
        p_e_presence = (p_yes_1 * p_yes_2) + (p_no_1 * p_no_2)
        kappa_presence = cohen_kappa(p_o_presence, p_e_presence)

        # 2. Value exact-match agreement
        both_present = a
        if both_present > 0:
            val_matches = sum(
                1 for i in range(n)
                if annotations1[i].get(f_name) is not None
                and annotations2[i].get(f_name) is not None
                and str(annotations1[i].get(f_name)).strip().lower() == str(annotations2[i].get(f_name)).strip().lower()
            )
            val_agreement = val_matches / both_present
        else:
            val_agreement = 1.0

        results[f_name] = {
            "p_o_presence": round(p_o_presence, 4),
            "kappa_presence": round(kappa_presence, 4),
            "val_agreement": round(val_agreement, 4),
            "count_both_present": both_present,
            "count_both_null": d,
        }

    return results


def create_template(gold_path: Path, out_path: Path, ratio: float = 0.2) -> None:
    samples = []
    for line in gold_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("//"):
            samples.append(json.loads(line))

    # Pick systematic sample (every k-th item)
    step = max(1, int(1.0 / ratio))
    subset = samples[::step]

    template_rows = []
    for s in subset:
        blank_fields = {k: None for k in s.get("gold_fields", {})}
        template_rows.append({
            "id": s["id"],
            "condition": s.get("condition"),
            "transcript_ref": s["transcript_ref"],
            "gold_fields": blank_fields,
            "instructions": "Fill in gold_fields values exactly as mentioned in transcript_ref. Leave null if absent.",
        })

    out_path.write_text("\n".join(json.dumps(r) for r in template_rows) + "\n", encoding="utf-8")
    print(f"Created second annotator template with {len(template_rows)} samples at: {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Calculate Cohen's Kappa for FieldProof dataset")
    parser.add_argument("--gold", default="backend/data/electrical_gold.jsonl", help="Original gold JSONL")
    parser.add_argument("--annotator2", default="backend/data/annotator2_sample.jsonl", help="Second annotator JSONL")
    parser.add_argument("--create-template", action="store_true", help="Generate blank template for annotator 2")
    parser.add_argument("--sample-ratio", type=float, default=0.20, help="Ratio of dataset to sample (default 0.20 = 20 percent)")
    args = parser.parse_args()

    gold_p = Path(args.gold)
    ann2_p = Path(args.annotator2)

    if args.create_template:
        create_template(gold_p, ann2_p, args.sample_ratio)
        return

    if not ann2_p.exists():
        print(f"Second annotator file not found: {ann2_p}")
        print("Run with --create-template first to create the template for Annotator 2.")
        return

    gold_map = {}
    for line in gold_p.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("//"):
            row = json.loads(line)
            gold_map[row["id"]] = row.get("gold_fields", {})

    ann2_map = {}
    for line in ann2_p.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("//"):
            row = json.loads(line)
            ann2_map[row["id"]] = row.get("gold_fields", {})

    common_ids = [sid for sid in ann2_map if sid in gold_map]
    if not common_ids:
        print("No matching sample IDs between gold and annotator 2.")
        return

    a1 = [gold_map[sid] for sid in common_ids]
    a2 = [ann2_map[sid] for sid in common_ids]
    field_names = list(a1[0].keys())

    metrics = compute_field_kappa(a1, a2, field_names)

    print(f"\n=== Inter-Annotator Agreement on {len(common_ids)} Samples ===")
    print(f"{'Field':<18} | {'P_obs':<6} | {'Kappa':<6} | {'Val Match':<10} | {'Both Present':<12}")
    print("-" * 62)
    kappas = []
    for fn, res in metrics.items():
        k = res["kappa_presence"]
        kappas.append(k)
        print(f"{fn:<18} | {res['p_o_presence']:<6.3f} | {k:<6.3f} | {res['val_agreement']:<10.3f} | {res['count_both_present']:<12}")

    mean_k = sum(kappas) / len(kappas) if kappas else 0.0
    print("-" * 62)
    print(f"Mean Cohen's Kappa across all fields: {mean_k:.3f}")
    if mean_k >= 0.81:
        print("Interpretation: Almost Perfect Agreement (0.81 - 1.00)")
    elif mean_k >= 0.61:
        print("Interpretation: Substantial Agreement (0.61 - 0.80)")
    elif mean_k >= 0.41:
        print("Interpretation: Moderate Agreement (0.41 - 0.60)")
    else:
        print("Interpretation: Fair / Slight Agreement (< 0.40)")


if __name__ == "__main__":
    main()
