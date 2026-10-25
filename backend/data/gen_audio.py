"""
Generate synthetic MP3 audio files for every sample in electrical_gold.jsonl
that does not already have an audio file, using Google Text-to-Speech (gTTS).

Audio files are saved to data/audio/<sample_id>.mp3
The JSONL dataset is updated in-place with the audio_path field.

Usage (from backend/):
    python data/gen_audio.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

JSONL_PATH = Path(__file__).parent / "electrical_gold.jsonl"
AUDIO_DIR  = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

def main() -> None:
    try:
        from gtts import gTTS
    except ImportError:
        sys.exit("gTTS not installed — run: pip install gtts")

    lines = JSONL_PATH.read_text(encoding="utf-8").splitlines()
    updated: list[str] = []
    generated = 0
    skipped   = 0

    for raw in lines:
        raw = raw.strip()
        if not raw:
            updated.append(raw)
            continue

        sample = json.loads(raw)
        audio_path = AUDIO_DIR / f"{sample['id']}.mp3"

        if audio_path.exists():
            # Already generated; just make sure the path is recorded
            sample["audio_path"] = str(audio_path.as_posix())
            skipped += 1
        else:
            transcript = sample.get("transcript_ref", "")
            if not transcript:
                updated.append(json.dumps(sample, ensure_ascii=False))
                continue

            print(f"  Generating {sample['id']} …", end=" ", flush=True)
            tts = gTTS(text=transcript, lang="en", slow=False)
            tts.save(str(audio_path))
            sample["audio_path"] = str(audio_path.as_posix())
            generated += 1
            print("done")
            time.sleep(0.5)   # be polite to Google TTS API

        updated.append(json.dumps(sample, ensure_ascii=False))

    JSONL_PATH.write_text("\n".join(updated) + "\n", encoding="utf-8")
    print(f"\nDone. Generated={generated}, already existed={skipped}")
    print(f"Audio files: {AUDIO_DIR}")


if __name__ == "__main__":
    main()
