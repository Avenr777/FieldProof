# FieldProof Monorepo

This workspace is split into two main parts:

- `frontend/` — React + Vite UI
- `backend/` — FastAPI server with LLM connectors

## Frontend

1. Open PowerShell in `c:\Users\Rishik\Desktop\FieldProof\frontend`
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Run the dev server:
   ```powershell
   npm run dev
   ```

The app entry point is now `frontend/src/App.jsx`.

## Backend

1. Activate the Python virtual environment from the repo root:
   ```powershell
   cd c:\Users\Rishik\Desktop\FieldProof
   .\venv\Scripts\Activate.ps1
   ```
2. Install backend dependencies:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```powershell
   uvicorn app:app --reload --port 8000
   ```

## LLM integration

The backend exposes a POST `/llm` route for provider-agnostic LLM calls. It supports:

- `openai`
- `azure`

Configure credentials by copying `backend/.env.example` to `backend/.env`.
