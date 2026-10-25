# FieldProof

FieldProof helps field-service teams capture job evidence and turn it into
reviewable service documentation. Technicians use the mobile app to view jobs,
complete assigned templates, and submit photos and voice notes. Owners and
admins use the web dashboard to manage jobs, technicians, templates,
assignments, compliance, and submitted work.

## Project structure

| Directory/file | Description |
|---|---|
| `backend/` | FastAPI REST API, WebSocket updates, database models, document processing, and optional Celery tasks. |
| `frontend/` | Vite + React owner/admin dashboard. |
| `mobile/` | Expo + React Native technician app; supports Android, iOS, and web. |
| `test/` | Project-level test scripts and sample documents. |
| `uploads/` | Local uploaded/generated files in the repository root. The backend also has its own `uploads/` directory when run from `backend/`. |
| `start-dev.ps1` | Windows helper that starts the backend, dashboard, and Expo Web in separate PowerShell windows. |

## Features

- JWT-based signup and login, with data scoped to a business.
- Job and technician management, plus one-time and recurring template assignments.
- Technician workflows for viewing jobs, capturing photo/voice evidence, and filling assigned forms.
- Owner/admin review of capture submissions, with suggested template field values.
- `.docx` template upload, field extraction, form filling, document download, and review/approval.
- Compliance rules and events, analytics, and dashboard updates over WebSocket.
- SQLite by default, with a configurable SQLAlchemy database URL.

## AI pipeline: what is real vs stubbed

This section is kept accurate so the research methodology section of the paper
is honest about implementation status.

| Stage | Status | Notes |
|---|---|---|
| **Speech-to-text (Whisper)** | ✅ **Real** | `app/services/stt.py` — OpenAI Whisper hosted API, domain vocabulary prompt, segment-level logprob stored for eval |
| **LLM structured extraction** | ✅ **Real** | `app/services/llm.py` — GPT-4o-mini, JSON mode, Pydantic validation, retry-on-failure |
| **Grounding check** | ✅ **Real** | Deterministic evidence-span verification; ungrounded fields forced to reviewer |
| **Unit normalisation** | ✅ **Real** | `app/services/normalize.py` — spoken numbers → digits, "twenty amp" → "20A", date normalisation |
| **Compliance check** | ✅ **Real** | Required-field check using compliance rules; ungrounded fields not counted as present |
| **Vision-language photo analysis** | 🔲 **Stubbed** | `analyze_image()` returns heuristic placeholder; VLM integration is future work |
| **OCR meter reading** | 🔲 **Stubbed** | `extract_text_ocr()` returns placeholder; cross-modal fusion is future work |
| **Evaluation harness** | ✅ **Real** | `backend/eval/run.py` — WER via jiwer, field-level P/R/F1, hallucination rate, regex baseline |

When `OPENAI_API_KEY` is not set, all AI paths fall back to demo strings so
the rest of the pipeline continues to function (upload → document → review
→ `.docx` download).

## Running tests

```powershell
cd backend
pytest tests/ -v
```

46 unit tests cover normalisation helpers, grounding check, schema validation,
LLM retry/fallback, STT file validation, and the compliance check — all with
mocked API calls.

## Running the evaluation harness

```powershell
cd backend
python -m eval.run --config eval/config_baseline.json
```

Results are written to `backend/eval/results/<run_id>/`:
- `summary.csv` — one row per condition and field (source of paper tables)
- `per_sample_<condition>.jsonl` — raw predictions + gold for error analysis

The dataset lives in `backend/data/electrical_gold.jsonl` (8 seed samples).
Expand it to 50–100 samples before reporting final numbers.


## Requirements

- Python 3.10 or later and pip
- Node.js 20 LTS or later and npm
- Redis only if you want background capture processing
- Expo Go for device testing, or Android Studio/Xcode for native emulators

## Run locally on Windows

### 1. Start the backend

In PowerShell:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.seed
uvicorn app.main:app --reload
```

The API is available at <http://127.0.0.1:8000>; interactive API
documentation is at <http://127.0.0.1:8000/docs>. The default configuration
uses `backend/fieldproof.db`. Update `backend/.env` before deployment,
especially `SECRET_KEY` and `DATABASE_URL`.

Seeded demo accounts (password for both: `demo-password-123`):

- Owner: `priya@meridianfieldworks.com`
- Technician: `marcus@meridianfieldworks.com`

### 2. Start the dashboard

In another PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The dashboard uses
`http://127.0.0.1:8000` by default. Set `VITE_API_URL` before starting Vite
if the API is hosted elsewhere.

### 3. Start the mobile app (optional)

In another PowerShell window:

```powershell
cd mobile
npm install
npx expo start
```

Use `npm run android` or `npm run ios` to launch a native app, or `npm run web`
for the browser version. When the default is not suitable, create `mobile/.env`, set
`EXPO_PUBLIC_API_URL` there, and start or restart Expo:

| Where the app runs | API URL |
|---|---|
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator or same computer | `http://127.0.0.1:8000` |
| Physical phone on the same Wi-Fi | `http://YOUR_COMPUTER_LAN_IP:8000` |

For a physical phone, start the API listening on the network:

```powershell
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Allow port 8000 through the computer firewall if required. Restart Expo after
changing `EXPO_PUBLIC_API_URL`. The app uses Expo SecureStore for native token
storage; Expo Web uses session storage.

### Optional: start all development clients

After setting up the Python environment and installing frontend/mobile
dependencies, run this from the repository root:

```powershell
.\start-dev.ps1
```

The script starts the API, dashboard, and Expo Web in separate windows. Its
backend command expects the virtual environment at `backend\venv`.

## Background capture processing (optional)

Start Redis, then run a worker in a separate terminal:

```powershell
cd backend
celery -A app.celery_app worker --loglevel=info
```

Without Redis and the worker, uploaded evidence is still stored and queued,
but background processing will not complete.

## API areas

The FastAPI app exposes authentication, jobs, technicians, templates,
documents, compliance, analytics, capture uploads, integrations, assignments,
submission review, and `/ws` live updates. See [backend/README.md](backend/README.md)
for the backend architecture, detailed endpoint notes, and processing status.
See [mobile/README.md](mobile/README.md) for the technician app's setup and
capture workflow.
