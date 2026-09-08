# FieldProof — Project Overview

AI-powered multimodal documentation for field trades (electricians, plumbers,
HVAC, fire safety, solar, etc.). A technician records a voice note and takes
photos on site; the system transcribes, reads the images, runs OCR on labels
and meters, and fuses it all into a compliant, ready-to-send document.

This README covers everything built so far: the **React dashboard** (now
wired to the live API — landing page still static, everything past login is
real data) and the **FastAPI backend** (real, running API; the Whisper/
vision/OCR/LLM calls are stubbed, but document *template* extraction and
fill — the .docx upload flow — is fully real, no model required).

```
Mobile app (voice + photo capture)   Admin dashboard (owner web console)
                 │                              │
                 └────────────┬─────────────────┘
                               ▼
                    FastAPI backend (REST + WebSocket)
                               │
                    Task queue (Redis + Celery)
                               │
                    AI model layer (Whisper, vision, OCR, LLM)
                               │
                    Database + storage
```

---

## 1. Frontend — React dashboard (`fieldproof-frontend/`)

A Vite + React app implementing the landing page, auth screens, and the full
owner-facing dashboard described in the project spec. **Wired to the live
FastAPI backend** — login/signup call real endpoints, and every dashboard
view (jobs, templates, documents, technicians, compliance, analytics)
fetches and mutates real data, with loading and error states. The landing
page itself stays static marketing content. Built with Tailwind (via CDN),
lucide-react icons, and Recharts for charts.

| File | Purpose |
|---|---|
| `index.html` | HTML entry point. Loads Tailwind from CDN and mounts the React app at `#root`. |
| `src/main.jsx` | React entry point — renders `<App />` into the DOM. |
| `src/api.js` | **API service layer.** All communication with the FastAPI backend goes through this file — components call named functions (`login`, `getJobs`, `uploadTemplate`, `fillTemplate`, `connectWebSocket`, etc.) instead of calling `fetch()` directly. Keeps the JWT in an in-memory variable (not `localStorage`/`sessionStorage`) for security and Claude-artifact-sandbox compatibility — logging in again is required after a page refresh. Exports `API_BASE_URL` too, used to build download links for generated documents. |
| `src/App.jsx` | The entire application — see breakdown below. |
| `package.json` | Dependencies (`react`, `recharts`, `lucide-react`) and scripts (`dev`, `build`, `preview`). |
| `vite.config.js` | Vite build config, wires up the React plugin. |

### What's inside `App.jsx`

- **Static reference data** — `TRADE_ICON` (icon lookup by trade string), `plans` (pricing card copy), `FIELD_TYPE_INPUT` (maps a docx-extracted field's `field_type` to the right HTML input: `date` picker, `checkbox`, `textarea` for `multiline_text`, etc). Nothing else is hardcoded — everything the dashboard displays comes from the API.
- **Shared UI atoms** — `StatusPill`, `SeverityTag`, `ConfidenceBar`, `Card`, `IconBadge`, plus new `Spinner` and `ErrorBanner` for loading/error states every view uses.
- **Landing page** — unchanged, static marketing content (`Nav`, `Hero`, `HowItWorks`, `Features`, `Industries`, `Pricing`, `CTA`, `Footer`).
- **`AuthPage`** — login and two-step signup both call the real `api.login()` / `api.signup()`, store the returned JWT via `api.setToken()`, and show real error messages (wrong password, duplicate email, etc). Login is pre-filled with the seeded demo account.
- **Dashboard shell** — `Sidebar`, `Topbar` (now shows the real logged-in user's name/initials via `GET /auth/me`).
- **Dashboard views**, each now fetching/mutating real data via props passed down from `Dashboard`:
  - `OverviewView` — stat cards and weekly chart from `GET /analytics/summary`, active jobs from `GET /jobs`, alerts derived from `GET /compliance/events`.
  - `JobsView` — real job list/create via `GET`/`POST /jobs`.
  - `TemplatesView` — **the main new piece.** Upload a `.docx` (`UploadTemplateForm` → `api.uploadTemplate`), browse templates fetched from `GET /templates`, click one to open `TemplateFillPanel`, which loads the real extracted field list (`api.getTemplateFields`), renders one type-appropriate input per field via `FieldInput`, and on submit calls `api.fillTemplate` to generate a real filled `.docx` with a download link.
  - `DocumentsView` — real document list/review/approve via `GET /documents` and `POST /documents/{id}/review`, with a download link for template-filled documents.
  - `TechniciansView` — real technician list/invite via `GET`/`POST /technicians`.
  - `ComplianceView` — real rules, event log, and compliance rate via `GET /compliance/*`.
  - `AnalyticsView` — real summary + per-technician chart; the three trend charts (documentation time, accuracy, compliance) show an empty state until the backend has enough history to trend on (the API returns `[]` for these today — see backend README).
  - `SettingsView` — still mostly static UI; only the profile fields pull from the real logged-in user.
- **`Dashboard`** — the root data-fetching component. Loads all sections on mount (`loadAll`), subscribes to `api.connectWebSocket()` and refetches the relevant slice on `job_created`/`job_updated`/`document_reviewed` events, and passes per-section `loading`/`error`/refetch props down to each view.
- **`App`** (default export) — top-level screen switcher: `landing` → `auth` → `dashboard`.

---

## 2. Backend — FastAPI API (`fieldproof-backend/`)

A working REST + WebSocket API implementing every layer of the architecture
diagram except the AI models themselves, which are stubbed behind a clear
interface so real models can be dropped in without touching anything else.

### Root files

| File | Purpose |
|---|---|
| `requirements.txt` | Python dependencies: FastAPI, Uvicorn, SQLAlchemy, Pydantic, JWT/passlib for auth, Celery/Redis for the task queue. |
| `.env.example` | Template for environment config — database URL, secret key, Redis URLs, storage bucket, AI provider keys. Copy to `.env` and fill in. |
| `README.md` | Backend-specific setup instructions, endpoint-to-frontend mapping table, and what's real vs. stubbed. |

### `app/` — application package

| File | Purpose |
|---|---|
| `main.py` | FastAPI app entrypoint. Registers all routers, sets up CORS (allowing the Vite dev server origin), creates DB tables on startup, and defines the `/ws` WebSocket route for live dashboard updates. |
| `config.py` | `Settings` class (pydantic-settings) — loads all configuration from environment variables / `.env`, with sane dev defaults. |
| `database.py` | SQLAlchemy engine + session setup, and the `get_db()` FastAPI dependency used by every route that touches the database. |
| `models.py` | SQLAlchemy ORM models: `Business`, `User`, `Technician`, `Job`, `Capture` (raw voice/photo upload), `Template`, `Document`, `ComplianceRule`, `ComplianceEvent`. Also defines the status enums (`JobStatus`, `DocStatus`, `TechStatus`, `Severity`, `Role`). |
| `schemas.py` | Pydantic request/response models for every endpoint — signup/login payloads, job create/update, document fields, analytics summary shape, etc. Keeps the API's public contract separate from the DB models. |
| `auth.py` | Password hashing (bcrypt via passlib), JWT creation/verification, and the `get_current_user` dependency that protects routes and scopes data to the caller's business. |
| `celery_app.py` | Celery application configuration — connects to Redis as the task broker/result backend. This is the "Task queue" box in the architecture diagram. |
| `tasks.py` | The `process_capture` Celery task: runs after a voice note or photo is uploaded, calls the AI pipeline stubs to transcribe/analyze it, and once all captures for a job are processed, fuses them into a draft `Document` and runs the compliance check (flagging the job if required fields are missing). |
| `websocket.py` | `ConnectionManager` — tracks open WebSocket connections and broadcasts JSON events (`job_created`, `job_updated`, `document_reviewed`) to all connected dashboards in real time. |
| `seed.py` | Populates the database with demo data shaped exactly like the frontend's mock data (same technician names, same compliance rules, one sample job + document), so the dashboard has something realistic to render immediately. Run with `python -m app.seed`. |

### `app/routers/` — one file per resource, each a FastAPI `APIRouter`

| File | Endpoints | Purpose |
|---|---|---|
| `auth.py` | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` | Account creation (creates a `Business` + owner `User`), login (issues JWT), current-user lookup. |
| `jobs.py` | `GET/POST /jobs`, `GET/PATCH /jobs/{id}` | Job creation, listing/filtering by status or technician, status updates. Broadcasts WebSocket events on create/update. |
| `technicians.py` | `GET/POST /technicians`, `GET /technicians/{id}` | List technicians with computed active-job and docs-this-week counts; invite a new technician. |
| `templates.py` | `GET /templates`, `GET /templates/{id}`, `POST /templates/upload`, `GET /templates/{id}/fields`, `POST /templates/{id}/fill` | Upload a company `.docx` form (runs real field extraction via `docx_extractor.py`), review the extracted fields, and fill/generate a completed document for a job via `docx_writer.py`. |
| `documents.py` | `GET /documents`, `GET /documents/{id}`, `POST /documents/{id}/review` | List/filter generated documents by status; approve or request changes on a document (the human-in-the-loop step from the project spec). |
| `compliance.py` | `GET /compliance/rules`, `GET /compliance/events`, `GET /compliance/rate` | Required fields per trade, the compliance alert log, and an overall compliance-rate calculation. |
| `analytics.py` | `GET /analytics/summary` | Aggregates the numbers behind the dashboard's overview stat cards and weekly chart. |
| `capture.py` | `POST /capture` | The mobile app's core action: upload a voice note or photo tied to a job. Stores the file and enqueues `process_capture` on the Celery queue. |

### `app/services/` — the AI/storage seams

| File | Purpose |
|---|---|
| `ai_pipeline.py` | **Stubbed AI model layer.** Functions for `transcribe_audio` (Whisper), `analyze_image` (vision-language model), `extract_text_ocr` (PaddleOCR/Tesseract), `fuse_into_document` (LLM merges everything into scored fields), and `run_compliance_check` (which required fields are missing). `detect_template_fields` is now only used as a fallback for non-`.docx` template uploads — see `docx_extractor.py` below for the real path. |
| `docx_extractor.py` | **Real, working** `.docx` form-field extraction — no AI model, offline regex/heuristic rules. Finds every blank (underline- or bracket-style), checkbox, and empty table cell in an uploaded Word form, infers a label and field type for each (date, email, currency, multiline text, etc.), and gives every field a stable, deterministic locator so `docx_writer.py` can edit it later without disturbing formatting. Powers `POST /templates/upload` and `GET /templates/{id}/fields`. |
| `docx_writer.py` | **Real, working** `.docx` write-back. Takes `{field_id: value}` pairs and edits the actual Word XML runs in place — never a naive text search/replace — so bold/color/font formatting around each filled field survives untouched. Powers `POST /templates/{id}/fill`. |
| `storage.py` | **Stubbed object storage.** `save_upload()` currently writes to a local `uploads/` folder; swap its body for an S3 or Azure Blob client when deploying. Also provides `resolve_local_path()`, which `docx_extractor`/`docx_writer` use to turn a stored file's URL back into a real filesystem path. |

---

## 3. How the pieces fit together right now

- **Frontend**: fully wired to the live backend. `App.jsx` imports `api.js` and every dashboard view fetches/mutates real data — no mock arrays left except static marketing copy on the landing page. Verified with `npm run build` (clean) and an end-to-end Node script that imports the actual `src/api.js` module and drives it against the real backend exactly as the browser would: login → upload `.docx` → review extracted fields → create job → fill template → download the generated file → verify its contents → approve it.
- **Backend**: fully built and tested (all 22 routes exercised end-to-end, including the full `.docx` upload → extract → fill → generate → **download over real HTTP** cycle — `/uploads` is now mounted as a static route so generated files are actually fetchable, not just written to disk). Uses SQLite by default (swap to Postgres via `DATABASE_URL`). The Whisper/vision/OCR/LLM calls in `ai_pipeline.py` are still stubs; document *template* extraction and fill are real, not stubbed — `docx_extractor.py` / `docx_writer.py` handle that with offline heuristics, no model needed.
- **What this means in practice**: an admin can log in, upload a real company `.docx` form, get every blank/checkbox/table-field detected automatically with an inferred type, fill them in through generated inputs, generate a completed document tied to a job, and download it — today, with no AI model required for any of it. The only pieces still stubbed are the *AI-driven* document generation path (voice transcription, photo analysis, OCR fusion) — the template-based path is fully real.

## 4. Running the whole stack locally

```bash
# Terminal 1 — backend
cd fieldproof-backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed          # creates demo data + demo login
uvicorn app.main:app --reload

# Terminal 2 — frontend
cd fieldproof-frontend
npm install
npm run dev                 # http://localhost:5173
```

Log in with the seeded demo account (`priya@meridianfieldworks.com` /
`demo-password-123`, pre-filled on the login form), then go to
**Templates → Upload template**, pick a `.docx` file with some blanks in
it, and the whole flow — extraction, review, fill, generate, download — is
live.

## 5. Suggested next steps

1. Implement one AI stub at a time, starting with `transcribe_audio` (Whisper) since it's the simplest integration — this is what powers the *other* document-generation path (voice + photo capture) described in the original project spec, separate from the template-fill flow which is already done.
2. Build the actual mobile capture screen (voice record + camera) that calls `api.uploadCapture()` — the dashboard currently only shows the *result* of that flow (a Document with confidence scores), not the capture UI itself.
3. Add Alembic migrations before deploying against Postgres instead of SQLite.
5. Add role-based access control (Owner/Admin/Technician) — currently every authenticated user can do anything within their business.
