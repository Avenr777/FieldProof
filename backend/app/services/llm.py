"""
LLM structured-extraction service.

Reads the versioned prompt from app/prompts/extract_v1.md, sends the
transcript to the configured LLM, validates the JSON against the
ElectricalJobExtraction schema, and runs a deterministic grounding check
to flag hallucinated evidence spans.

Design decisions
----------------
- Temperature 0 for reproducibility.
- JSON mode (response_format=json_object) + Pydantic validation.
- On validation failure: retry once with error message, then fall back to
  all-null with a flag — never crashes the Celery task.
- Grounding check: verify that evidence actually appears in the transcript.
  Fields failing the check are marked status="ungrounded" and forced into
  reviewer attention.
- All raw API responses, token counts, prompt versions, and latency are
  logged so every call is traceable for evaluation.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, field_validator

from app.config import settings
from app.services.normalize import normalise_field_value

logger = logging.getLogger("fieldproof.llm")

# ---------------------------------------------------------------------------
# Prompt loading
# ---------------------------------------------------------------------------

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(version: str = "v1") -> tuple[str, str]:
    """
    Returns (system_prompt, user_template) from the versioned markdown file.
    Sections are delimited by '## System message' and '## User message template'.
    """
    path = _PROMPTS_DIR / f"extract_{version}.md"
    text = path.read_text(encoding="utf-8")

    system = _extract_section(text, "## System message", "## User message template")
    user_tmpl = _extract_section(text, "## User message template", None)

    # Strip the markdown code fences from the user template
    user_tmpl = re.sub(r"^```\w*\n?", "", user_tmpl.strip(), flags=re.MULTILINE)
    user_tmpl = re.sub(r"```$", "", user_tmpl.strip(), flags=re.MULTILINE)

    return system.strip(), user_tmpl.strip()


def _extract_section(text: str, start_heading: str, end_heading: str | None) -> str:
    start = text.find(start_heading)
    if start == -1:
        return ""
    start += len(start_heading)
    if end_heading:
        end = text.find(end_heading, start)
        return text[start:end].strip() if end != -1 else text[start:].strip()
    return text[start:].strip()


# ---------------------------------------------------------------------------
# Pydantic schema for extracted fields
# ---------------------------------------------------------------------------

class FieldValue(BaseModel):
    value: str | float | bool | None = None
    evidence: str | None = None
    confidence: float | None = None

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v):
        if v is None:
            return v
        return max(0.0, min(1.0, float(v)))


class ElectricalJobExtraction(BaseModel):
    component: FieldValue = FieldValue()
    rating: FieldValue = FieldValue()
    panel: FieldValue = FieldValue()
    action: FieldValue = FieldValue()
    voltage: FieldValue = FieldValue()
    location: FieldValue = FieldValue()
    technician_name: FieldValue = FieldValue()
    date: FieldValue = FieldValue()
    work_summary: FieldValue = FieldValue()
    pass_fail: FieldValue = FieldValue()


# Map of trade → extraction schema class (extend as trades are added)
_TRADE_SCHEMAS: dict[str, type[BaseModel]] = {
    "electrical": ElectricalJobExtraction,
}


def _get_schema_class(trade: str) -> type[BaseModel]:
    return _TRADE_SCHEMAS.get(trade.lower(), ElectricalJobExtraction)


# ---------------------------------------------------------------------------
# Grounding check
# ---------------------------------------------------------------------------

def _normalise_for_grounding(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def run_grounding_check(extracted: dict, transcript: str) -> dict:
    """
    For every non-null field, verify that the evidence substring actually
    appears in the transcript (case and whitespace insensitive).

    Returns the same dict with an added 'grounded' boolean and 'status' key
    for each field.

    Status values:
        ok          — value present and evidence grounded
        ungrounded  — value present but evidence not found in transcript
        missing     — value is null
    """
    t_norm = _normalise_for_grounding(transcript)
    result = {}

    for field_name, fv in extracted.items():
        if not isinstance(fv, dict):
            result[field_name] = fv
            continue

        value = fv.get("value")
        evidence = fv.get("evidence")
        conf = fv.get("confidence")

        if value is None:
            result[field_name] = {**fv, "grounded": None, "status": "missing"}
            continue

        if evidence:
            e_norm = _normalise_for_grounding(str(evidence))
            grounded = e_norm in t_norm
        else:
            # No evidence provided for a non-null value — treat as ungrounded
            grounded = False

        status = "ok" if grounded else "ungrounded"
        result[field_name] = {**fv, "grounded": grounded, "status": status}

        if not grounded:
            logger.warning(
                "Grounding check FAILED | field=%s value=%r evidence=%r",
                field_name, value, evidence,
            )

    return result


# ---------------------------------------------------------------------------
# OpenAI LLM extractor
# ---------------------------------------------------------------------------

class OpenAILLMExtractor:
    """Calls OpenAI chat-completions with JSON mode and validates the schema."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str = "gpt-4o-mini",
        prompt_version: str = "v1",
    ):
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._prompt_version = prompt_version
        self._system_prompt, self._user_template = _load_prompt(prompt_version)

    def extract(self, transcript: str, trade: str = "electrical") -> dict[str, Any]:
        """
        Extract structured fields from a transcript.

        Returns a dict keyed by field name, each value being a dict with:
            value, evidence, confidence, grounded, status
        Also returns top-level metadata keys:
            _meta: {prompt_version, model, input_tokens, output_tokens,
                    latency_s, transcript_hash, validation_status}
        """
        user_message = self._user_template.format(
            trade=trade.capitalize(),
            transcript=transcript,
        )

        schema_class = _get_schema_class(trade)

        raw_response, tokens_in, tokens_out, latency_s, validation_status = (
            self._call_with_retry(user_message, schema_class)
        )

        # Apply normalisation to all field values
        for field_name, fv in raw_response.items():
            if isinstance(fv, dict) and fv.get("value") is not None:
                raw_response[field_name]["value"] = normalise_field_value(
                    field_name, fv["value"]
                )

        # Grounding check
        grounded_response = run_grounding_check(raw_response, transcript)

        t_hash = hashlib.sha256(transcript.encode()).hexdigest()[:16]
        logger.info(
            "LLM extract | model=%s version=%s trade=%s tokens=%d+%d latency=%.2fs hash=%s validation=%s",
            self._model, self._prompt_version, trade,
            tokens_in, tokens_out, latency_s, t_hash, validation_status,
        )

        grounded_response["_meta"] = {
            "prompt_version": self._prompt_version,
            "model": self._model,
            "input_tokens": tokens_in,
            "output_tokens": tokens_out,
            "latency_s": latency_s,
            "transcript_hash": t_hash,
            "validation_status": validation_status,
        }
        return grounded_response

    def _call_with_retry(
        self,
        user_message: str,
        schema_class: type[BaseModel],
        max_retries: int = 1,
    ) -> tuple[dict, int, int, float, str]:
        """
        Call the API, validate, and retry once with the error message if
        validation fails. Returns (parsed_dict, in_tokens, out_tokens,
        latency_s, validation_status).
        """
        t0 = time.perf_counter()

        for attempt in range(max_retries + 1):
            payload = {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            }
            if attempt > 0:
                # Add error context to the conversation so the model can self-correct
                payload["messages"].append(
                    {"role": "assistant", "content": self._last_raw},
                )
                payload["messages"].append({
                    "role": "user",
                    "content": (
                        f"Your previous response failed JSON schema validation: "
                        f"{self._last_error}\n"
                        f"Please fix the response and return valid JSON only."
                    ),
                })

            resp = httpx.post(
                f"{self._base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60.0,
            )
            latency_s = time.perf_counter() - t0

            if not resp.is_success:
                raise RuntimeError(f"LLM API {resp.status_code}: {resp.text[:400]}")

            resp_json = resp.json()
            tokens_in = resp_json.get("usage", {}).get("prompt_tokens", 0)
            tokens_out = resp_json.get("usage", {}).get("completion_tokens", 0)
            raw_content = resp_json["choices"][0]["message"]["content"]

            try:
                parsed_dict = json.loads(raw_content)
                validated = schema_class(**parsed_dict)
                out = validated.model_dump()
                # Convert FieldValue models to plain dicts
                result = {k: (v if isinstance(v, dict) else v) for k, v in out.items()}
                return result, tokens_in, tokens_out, latency_s, "ok"
            except Exception as e:
                self._last_raw = raw_content
                self._last_error = str(e)
                logger.warning(
                    "LLM response validation failed (attempt %d): %s", attempt + 1, e
                )
                if attempt >= max_retries:
                    # Fall back: all-null with flag
                    logger.error(
                        "LLM extraction failed after %d attempts; returning null fallback",
                        max_retries + 1,
                    )
                    null_obj = schema_class()
                    result = null_obj.model_dump()
                    return result, tokens_in, tokens_out, latency_s, "validation_failed"

        # Should never reach here
        return {}, 0, 0, 0.0, "error"


class Llama3LLMExtractor(OpenAILLMExtractor):
    """
    Open-weight LLM extractor targeting Llama-3-8B.
    Connects to any OpenAI-compatible local server (Ollama, vLLM, llama.cpp).
    Default base URL: http://localhost:11434/v1
    Default model: llama3:8b (or llama-3-8b)
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str = "llama3:8b",
        api_key: str = "ollama",
        prompt_version: str = "v1",
    ):
        target_base_url = (
            base_url
            or os.getenv("LLAMA_BASE_URL")
            or os.getenv("OLLAMA_BASE_URL")
            or "http://localhost:11434/v1"
        )
        target_model = os.getenv("AI_MODEL_CHAT_OPEN_WEIGHT") or model
        super().__init__(
            api_key=api_key or "ollama",
            base_url=target_base_url,
            model=target_model,
            prompt_version=prompt_version,
        )


# ---------------------------------------------------------------------------
# Factory / convenience function
# ---------------------------------------------------------------------------

def get_extractor(
    prompt_version: str = "v1",
    model: str | None = None,
) -> OpenAILLMExtractor | None:
    target_model = model or settings.ai_model_chat
    if target_model and ("llama" in target_model.lower() or os.getenv("USE_OPEN_WEIGHT", "").lower() in ("true", "1")):
        return Llama3LLMExtractor(
            model=target_model if "llama" in target_model.lower() else "llama3:8b",
            prompt_version=prompt_version,
        )

    if settings.openai_api_key:
        return OpenAILLMExtractor(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=target_model or settings.ai_model_chat,
            prompt_version=prompt_version,
        )
    return None


def extract_fields(
    transcript: str,
    trade: str = "electrical",
    prompt_version: str = "v1",
    model: str | None = None,
) -> dict[str, Any] | None:
    """
    Convenience wrapper: extracts structured fields from a transcript.
    Returns None if no LLM is configured.

    The returned dict contains field-name keys (each with value/evidence/
    confidence/grounded/status) plus a '_meta' key for logging.
    """
    extractor = get_extractor(prompt_version=prompt_version, model=model)
    if extractor is None:
        logger.warning("No LLM provider configured; skipping extraction")
        return None
    return extractor.extract(transcript, trade=trade)
