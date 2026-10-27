"""
Expand electrical_gold.jsonl from 30 rows to 480 rows by pairing each sample
with every generated voice + noise-condition combination from output/data/audio/.

Output: backend/data/electrical_gold_multivoice.jsonl

Row schema (adds to existing fields):
  voice_id:   str   — e.g. "en_GB-alan-medium"
  noise_snr:  int | null — null = clean, 5 / 10 / 20 = SNR in dB
  audio_path: str   — absolute path to the matching WAV file

Run from any directory:
    python backend/data/expand_gold_multivoice.py
"""
from __future__ import annotations

import json
from pathlib import Path

# Absolute paths — robust regardless of CWD
HERE          = Path(__file__).parent                          # backend/data/
PROJECT_ROOT  = HERE.parent.parent                             # FieldProof/
AUDIO_TTS     = PROJECT_ROOT / "output" / "data" / "audio" / "tts"
AUDIO_NOISY   = PROJECT_ROOT / "output" / "data" / "audio" / "noisy"
GOLD_SRC      = HERE / "electrical_gold.jsonl"
GOLD_OUT      = HERE / "electrical_gold_multivoice.jsonl"

# Naming convention:  tts_<voice>_R<NN>.wav  /  tts_<voice>_R<NN>_snr<N>.wav
# where <NN> is 1-indexed sample number matching order in the JSONL.


def _load_base(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text("utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("//"):
            rows.append(json.loads(line))
    return rows


def _discover_voices() -> list[str]:
    """Return sorted list of unique voice IDs found in output/data/audio/tts/."""
    voices = set()
    for wav in AUDIO_TTS.glob("*.wav"):
        # tts_en_GB-alan-medium_R01.wav  →  en_GB-alan-medium
        stem = wav.stem  # tts_en_GB-alan-medium_R01
        # strip leading "tts_" and trailing "_R<NN>"
        name = stem[4:]                    # en_GB-alan-medium_R01
        voice = "_".join(name.split("_")[:-1])   # en_GB-alan-medium
        voices.add(voice)
    return sorted(voices)


def main() -> None:
    base_samples = _load_base(GOLD_SRC)
    voices = _discover_voices()

    print(f"Base samples : {len(base_samples)}")
    print(f"Voices found : {len(voices)} — {voices}")

    noise_conditions: list[int | None] = [None, 5, 10, 20]
    rows: list[dict] = []
    missing: list[str] = []

    for voice in voices:
        for snr in noise_conditions:
            condition_label = "clean" if snr is None else f"snr{snr}"
            for idx, sample in enumerate(base_samples, start=1):
                rnum = f"R{idx:02d}"
                if snr is None:
                    fname = f"tts_{voice}_{rnum}.wav"
                    wav = AUDIO_TTS / fname
                else:
                    fname = f"tts_{voice}_{rnum}_snr{snr}.wav"
                    wav = AUDIO_NOISY / fname

                if not wav.exists():
                    missing.append(str(wav))
                    continue

                row = dict(sample)   # shallow copy
                # Build a unique composite ID
                row["id"] = f"{sample['id']}_{voice}_{condition_label}"
                row["voice_id"] = voice
                row["noise_snr"] = snr
                row["audio_path"] = str(wav.as_posix())
                # Keep transcript_ref and gold_fields from original sample
                rows.append(row)

    if missing:
        print(f"\n⚠  {len(missing)} expected audio files were NOT found:")
        for m in missing[:10]:
            print(f"   {m}")
        if len(missing) > 10:
            print(f"   ... and {len(missing) - 10} more")

    GOLD_OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )

    print(f"\nOK Written {len(rows)} rows to {GOLD_OUT}")
    print(f"   Breakdown: {len(voices)} voices x {len(noise_conditions)} conditions x {len(base_samples)} samples")
    print(f"   Missing audio: {len(missing)}")


if __name__ == "__main__":
    main()
