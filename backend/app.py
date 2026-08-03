from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from enum import Enum
import os
import httpx

app = FastAPI(title="FieldProof API")

class Provider(str, Enum):
    openai = "openai"
    azure = "azure"

class LLMRequest(BaseModel):
    provider: Provider
    prompt: str
    model: str | None = None
    max_tokens: int | None = 512

class LLMResponse(BaseModel):
    provider: Provider
    model: str
    text: str

@app.get("/")
async def root():
    return {"message": "FieldProof backend is running"}

@app.post("/llm", response_model=LLMResponse)
async def query_llm(request: LLMRequest):
    if request.provider == Provider.openai:
        return await query_openai(request)
    if request.provider == Provider.azure:
        return await query_azure(request)
    raise HTTPException(status_code=400, detail="Provider not supported")

async def query_openai(request: LLMRequest) -> LLMResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    model = request.model or "gpt-4.1-mini"
    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "input": request.prompt,
        "max_output_tokens": request.max_tokens,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    text = "".join([choice.get("output_text", "") for choice in data.get("output", [])])
    return LLMResponse(provider=request.provider, model=model, text=text)

async def query_azure(request: LLMRequest) -> LLMResponse:
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    if not api_key or not endpoint:
        raise HTTPException(status_code=500, detail="Azure OpenAI not configured")

    model = request.model or "gpt-4.1-mini"
    url = f"{endpoint.rstrip('/')}/openai/deployments/{model}/responses?api-version=2024-12-01"
    headers = {"api-key": api_key, "Content-Type": "application/json"}
    payload = {"input": request.prompt, "max_output_tokens": request.max_tokens}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    text = "".join([choice.get("output_text", "") for choice in data.get("output", [])])
    return LLMResponse(provider=request.provider, model=model, text=text)
