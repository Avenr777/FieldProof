# FieldProof Backend

This backend contains a FastAPI server for FieldProof and an API endpoint for querying LLM providers.

## Quick start

1. Create and activate a Python virtual environment in the project root:
   ```powershell
   cd C:\Users\Rishik\Desktop\FieldProof
   .\venv\Scripts\Activate.ps1
   ```

2. Install backend dependencies:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

3. Run the server:
   ```powershell
   uvicorn app:app --reload --port 8000
   ```

## LLM endpoint

POST `/llm`

Body:
```json
{
  "provider": "openai",
  "prompt": "Write a short summary of FieldProof.",
  "model": "gpt-4.1-mini",
  "max_tokens": 256
}
```
