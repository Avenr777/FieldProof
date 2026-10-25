from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central app configuration. Values are loaded from environment variables
    (or a .env file) so nothing sensitive is hardcoded.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "FieldProof API"
    environment: str = "development"

    # Database
    database_url: str = "sqlite:///./fieldproof.db"

    # Auth
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # Task queue
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Storage
    storage_bucket: str = "fieldproof-uploads"
    storage_region: str = "us-east-1"

    # Browser dashboard plus Expo Web's default development origin.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ]

    # AI Model Providers
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"

    # Chat / extraction model (LLM)
    ai_model_chat: str = "gpt-4o-mini"
    # Vision-language model (stubbed until Phase 3 photos/OCR work)
    ai_model_vision: str = "gpt-4o-mini"
    # Whisper model name — "whisper-1" for the hosted API
    ai_model_whisper: str = "whisper-1"

    # STT settings
    # Domain prompt injected as Whisper initial_prompt for vocabulary priming.
    # Disable to ablate the effect: set STT_USE_DOMAIN_PROMPT=false
    stt_use_domain_prompt: bool = True
    # Default trade for field extraction when not overridden by job type
    default_trade: str = "electrical"

    # LLM extraction settings
    # Prompt version used for extraction — bump to "v2" etc. when iterating
    llm_prompt_version: str = "v1"


settings = Settings()
