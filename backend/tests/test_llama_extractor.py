"""
Tests for Llama3LLMExtractor and open-weight model integration.
Covers:
  - Default initialization and configuration of Llama3LLMExtractor
  - URL and model configuration via env vars (LLAMA_BASE_URL, OLLAMA_BASE_URL)
  - Factory selection in get_extractor() for open-weight vs hosted models
  - End-to-end extraction mock test verifying schema parsing and grounding
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from app.services.llm import (
    Llama3LLMExtractor,
    OpenAILLMExtractor,
    get_extractor,
    extract_fields,
)


class TestLlama3LLMExtractor:
    def test_default_config(self):
        extractor = Llama3LLMExtractor()
        assert extractor._model == "llama3:8b"
        assert extractor._base_url == "http://localhost:11434/v1"
        assert extractor._api_key == "ollama"

    def test_custom_config(self):
        extractor = Llama3LLMExtractor(
            base_url="http://custom-host:8000/v1",
            model="llama-3-8b",
            api_key="custom-key",
            prompt_version="v2",
        )
        assert extractor._model == "llama-3-8b"
        assert extractor._base_url == "http://custom-host:8000/v1"
        assert extractor._api_key == "custom-key"
        assert extractor._prompt_version == "v2"

    def test_env_var_overrides(self, monkeypatch):
        monkeypatch.setenv("LLAMA_BASE_URL", "http://vllm-server:8000/v1")
        monkeypatch.setenv("AI_MODEL_CHAT_OPEN_WEIGHT", "meta-llama/Meta-Llama-3-8B-Instruct")

        extractor = Llama3LLMExtractor()
        assert extractor._base_url == "http://vllm-server:8000/v1"
        assert extractor._model == "meta-llama/Meta-Llama-3-8B-Instruct"

    def test_ollama_base_url_env_var(self, monkeypatch):
        monkeypatch.delenv("LLAMA_BASE_URL", raising=False)
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://ollama-remote:11434/v1")

        extractor = Llama3LLMExtractor()
        assert extractor._base_url == "http://ollama-remote:11434/v1"


class TestExtractorFactory:
    def test_get_extractor_llama_model_name(self):
        extractor = get_extractor(model="llama-3-8b")
        assert isinstance(extractor, Llama3LLMExtractor)
        assert extractor._model == "llama-3-8b"

    def test_get_extractor_llama3_variant(self):
        extractor = get_extractor(model="llama3:8b-instruct")
        assert isinstance(extractor, Llama3LLMExtractor)
        assert extractor._model == "llama3:8b-instruct"

    def test_get_extractor_use_open_weight_env(self, monkeypatch):
        monkeypatch.setenv("USE_OPEN_WEIGHT", "true")
        extractor = get_extractor(model="gpt-4o-mini")
        assert isinstance(extractor, Llama3LLMExtractor)

    def test_get_extractor_hosted_openai(self, monkeypatch):
        monkeypatch.delenv("USE_OPEN_WEIGHT", raising=False)
        with patch("app.services.llm.settings") as mock_settings:
            mock_settings.openai_api_key = "test-key"
            mock_settings.openai_base_url = "https://api.openai.com/v1"
            mock_settings.ai_model_chat = "gpt-4o-mini"

            extractor = get_extractor(model="gpt-4o-mini")
            assert isinstance(extractor, OpenAILLMExtractor)
            assert not isinstance(extractor, Llama3LLMExtractor)
            assert extractor._model == "gpt-4o-mini"


class TestLlama3ExtractionExecution:
    @patch("httpx.post")
    def test_llama3_successful_extraction_and_grounding(self, mock_post):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps({
                            "component": {"value": "MCB", "evidence": "MCB", "confidence": 0.95},
                            "rating": {"value": "20A", "evidence": "20 amp", "confidence": 0.9},
                            "panel": {"value": "panel 2", "evidence": "panel 2", "confidence": 0.9},
                            "action": {"value": "Replaced", "evidence": "replaced", "confidence": 0.95},
                            "voltage": {"value": "230V", "evidence": "230V", "confidence": 0.9},
                        })
                    }
                }
            ],
            "usage": {"prompt_tokens": 120, "completion_tokens": 45},
        }
        mock_post.return_value = mock_response

        transcript = "Replaced the 20 amp MCB on panel 2 with 230V rating."
        result = extract_fields(transcript, trade="electrical", model="llama-3-8b")

        assert result is not None
        assert result["component"]["value"] == "MCB"
        assert result["component"]["grounded"] is True
        assert result["component"]["status"] == "ok"
        assert result["rating"]["value"] == "20A"
        assert result["_meta"]["model"] == "llama-3-8b"
        assert mock_post.called
