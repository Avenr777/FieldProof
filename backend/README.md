# FieldProof API

FastAPI backend for the FieldProof dashboard, matching the architecture in
the project diagram:

```
Mobile app / Admin dashboard
        │
   FastAPI backend (REST + WebSocket)   <- this repo
        │
   Task queue (Redis + Celery)
        │
   AI model layer (Whisper, vision, OCR, LLM)
        │
   Database + storage
```

## What's real vs. stubbed

**Fully working:** auth (signup/login/JWT), jobs CRUD, technicians,
templates, documents + review/approve flow, compliance rules/events,
analytics summary, capture upload endpoint, Celery task wiring, WebSocket
broadcast for live dashboard updates, SQLite/Postgres-ready database layer.

**Stubbed, ready for you to wire up real models** (all isolated in
`app/services/ai_pipeline.py` and `app/services/storage.py`):
- `transcribe_audio` → plug in Whisper
- `analyze_image` → plug in a vision-language model
- `extract_text_ocr` → plug in PaddleOCR/Tesseract
- `fuse_into_document` → plug in an LLM to merge signals into a document
- `detect_template_fields` → plug in layout analysis for uploaded forms
- `save_upload` → plug in S3/Azure Blob instead of local disk

Nothing else in the app needs to change when you fill these in — routers
and Celery tasks already call them and store whatever they return.

## Run locally

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then edit SECRET_KEY at minimum

python -m app.seed              # creates fieldproof.db with demo data
uvicorn app.main:app --reload   # http://localhost:8000
```

Demo login (created by the seed script):
- email: `priya@meridianfieldworks.com`
- password: `demo-password-123`

Interactive API docs: http://localhost:8000/docs

## Run the background worker (for voice/photo processing)

Requires Redis running locally (`redis-server`, or `docker run -p 6379:6379 redis`):

```bash
celery -A app.celery_app worker --loglevel=info
```

Without the worker running, `POST /capture` still stores the file and
creates a `Capture` row, but the file will stay in "processed=false" state
until a worker picks up the queued task.

## Connecting the React dashboard

The frontend currently uses hardcoded mock data in `App.jsx`. To point it
at this API:
1. Set `cors_origins` in `.env` (or `app/config.py`) to your Vite dev URL — `http://localhost:5173` is already included by default.
2. Replace the mock arrays (`technicians`, `initialJobs`, `templates`, `documents`, `complianceRules`, `complianceLog`) with `fetch`/`axios` calls to the matching endpoints below.
3. Store the JWT from `/auth/login` (e.g. in memory or `sessionStorage`, not `localStorage` if this ever runs inside a Claude artifact) and send it as `Authorization: Bearer <token>` on every request.

| Frontend data | Endpoint |
|---|---|
| `technicians` | `GET /technicians` |
| `initialJobs` | `GET /jobs`, `POST /jobs` |
| `templates` / `templateFieldMap` | `GET /templates`, `POST /templates/upload` |
| `documents` | `GET /documents`, `POST /documents/{id}/review` |
| `complianceRules` | `GET /compliance/rules` |
| `complianceLog` | `GET /compliance/events` |
| overview stat cards | `GET /analytics/summary` |
| voice/photo capture | `POST /capture` (multipart: `job_id`, `kind`, `file`) |
| live updates | `WS /ws` |

## Project layout

```
app/
  main.py           FastAPI app, router registration, WebSocket route
  config.py         Settings loaded from .env
  database.py       SQLAlchemy engine/session
  models.py         ORM models (Business, User, Technician, Job, Capture,
                     Template, Document, ComplianceRule, ComplianceEvent)
  schemas.py        Pydantic request/response models
  auth.py           Password hashing, JWT issuance/verification
  celery_app.py     Celery app config
  tasks.py          Background task: process_capture -> builds Document
  websocket.py       Connection manager for live dashboard events
  seed.py           Demo data matching the frontend's mock dataset
  routers/          One router per resource (auth, jobs, technicians,
                     templates, documents, compliance, analytics, capture)
  services/
    ai_pipeline.py  Whisper/vision/OCR/LLM seams (stubbed)
    storage.py      File storage seam (stubbed to local disk)
```

## Next steps

1. Wire real model calls into `app/services/ai_pipeline.py`.
2. Swap `app/services/storage.py` for S3/Azure Blob.
3. Add Alembic migrations before deploying against Postgres.
4. Add role-based checks (Owner/Admin/Technician) to endpoints that should
   be restricted, currently everything is scoped to "your business" only.
5. Update the React app to fetch from this API instead of its mock data.
