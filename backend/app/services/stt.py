"""
Speech-to-Text (STT) service.

Provides a Transcriber interface and an OpenAI Whisper backend.
Each call returns a rich Transcript dataclass capturing segments,
model, language, duration, and latency — stored on the Capture row
for later error analysis and evaluation.
"""
from __future__ import annotations

import logging
import mimetypes
import os
import time
from dataclasses import dataclass, field, asdict
from typing import Protocol, runtime_checkable

import httpx

from app.config import settings
from app.services import storage

logger = logging.getLogger("fieldproof.stt")

# ---------------------------------------------------------------------------
# Domain prompt fed to Whisper as initial_prompt.
# Helps the model handle trade vocabulary, reducing word-error rate.
# This is an ablation variable — see eval/run.py.
# ---------------------------------------------------------------------------
_ELECTRICAL_DOMAIN_PROMPT = (
    "Electrical inspection voice note. "
    "Terms: MCB, RCD, RCBO, MCCB, busbar, earthing, CPC, TPN, SPN, "
    "breaker, switchboard, distribution board, panel, consumer unit, "
    "isolator, fuseway, ampere, volt, kilowatt, kVA, three-phase, "
    "single-phase, neutral, live, earth, bonding, cable, conduit, "
    "trunking, tray, junction box, socket outlet, ring final, radial, "
    "residual current, overcurrent, fault, trip, reset, torque, "
    "continuity, insulation resistance, polarity, earth fault loop."
)

_DOMAIN_PROMPTS: dict[str, str] = {
    "electrical": _ELECTRICAL_DOMAIN_PROMPT,
    "hvac": "HVAC inspection voice note. Terms: compressor, condenser, evaporator, refrigerant, R410A, R32, BTU, SEER, EER, tonnage, ductwork, plenum, damper, VAV, AHU, FCU, thermostat, heat pump, chiller.",
    "plumbing": "Plumbing inspection voice note. Terms: stopcock, ballvalve, pressure relief valve, PRV, pipework, solvent weld, push-fit, PTFE, compression fitting, boiler, cylinder, header, manifold, flux, solder.",
}


@dataclass
class Transcript:
    """Rich output of a single transcription call."""
    text: str
    language: str | None
    segments: list[dict]          # start, end, text, avg_logprob, no_speech_prob
    model: str
    duration_s: float
    latency_s: float

    def to_dict(self) -> dict:
        return asdict(self)


@runtime_checkable
class Transcriber(Protocol):
    def transcribe(self, local_path: str, trade: str | None = None) -> Transcript:
        ...


# ---------------------------------------------------------------------------
# OpenAI hosted Whisper backend
# ---------------------------------------------------------------------------

class OpenAIWhisperTranscriber:
    """
    Uses the OpenAI /audio/transcriptions endpoint with verbose_json output
    so we get segment-level data (start, end, avg_logprob, no_speech_prob).
    """

    def __init__(self, api_key: str, base_url: str, model: str = "whisper-1"):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    def transcribe(self, local_path: str, trade: str | None = None) -> Transcript:
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Audio file not found: {local_path}")

        size = os.path.getsize(local_path)
        if size < 100:
            raise ValueError(f"Audio file too small ({size} bytes) — likely empty or corrupt")

        domain_prompt = _DOMAIN_PROMPTS.get((trade or "electrical").lower(), _ELECTRICAL_DOMAIN_PROMPT)

        mime_type, _ = mimetypes.guess_type(local_path)
        t0 = time.perf_counter()

        with open(local_path, "rb") as f:
            files = {"file": (os.path.basename(local_path), f, mime_type or "audio/webm")}
            data = {
                "model": self._model,
                "response_format": "verbose_json",
                "temperature": "0",
                "initial_prompt": domain_prompt,
            }
            headers = {"Authorization": f"Bearer {self._api_key}"}

            resp = httpx.post(
                f"{self._base_url}/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=90.0,
            )

        latency_s = time.perf_counter() - t0

        if not resp.is_success:
            raise RuntimeError(f"Whisper API {resp.status_code}: {resp.text[:400]}")

        result = resp.json()
        text = (result.get("text") or "").strip()
        language = result.get("language")
        duration_s = float(result.get("duration") or 0.0)

        raw_segments = result.get("segments") or []
        segments = []
        for seg in raw_segments:
            segments.append({
                "start": seg.get("start"),
                "end": seg.get("end"),
                "text": seg.get("text", "").strip(),
                "avg_logprob": seg.get("avg_logprob"),
                "no_speech_prob": seg.get("no_speech_prob"),
            })

        logger.info(
            "STT complete | model=%s trade=%s lang=%s duration=%.1fs latency=%.2fs text_len=%d",
            self._model, trade, language, duration_s, latency_s, len(text),
        )
        return Transcript(
            text=text,
            language=language,
            segments=segments,
            model=self._model,
            duration_s=duration_s,
            latency_s=latency_s,
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_transcriber() -> Transcriber | None:
    """
    Returns the configured Transcriber, or None if no API key is available.
    Call sites should fall back to demo data when this returns None.
    """
    if settings.openai_api_key:
        return OpenAIWhisperTranscriber(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.ai_model_whisper,
        )
    return None


def transcribe_file(file_url: str, trade: str | None = None) -> Transcript | None:
    """
    Convenience wrapper used by process_capture.
    Resolves the storage URL to a local path, runs transcription, and returns
    a Transcript (or None if no transcriber is configured).

    Raises on file-not-found or API errors so the Celery task can retry.
    """
    local_path = storage.resolve_local_path(file_url)
    transcriber = get_transcriber()
    if transcriber is None:
        logger.warning("No STT provider configured (OPENAI_API_KEY not set); skipping transcription")
        return None
    return transcriber.transcribe(local_path, trade=trade)
