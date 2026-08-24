# FieldProof — Project Overview

AI-powered multimodal documentation for field trades (electricians, plumbers,
HVAC, fire safety, solar, etc.). A technician records a voice note and takes
photos on site; the system transcribes, reads the images, runs OCR on labels
and meters, and fuses it all into a compliant, ready-to-send document.

This README covers everything built so far: the **React dashboard** (mock
data, fully clickable) and the **FastAPI backend** (real, running API with
stubbed-out AI model calls ready to be filled in).

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
owner-facing dashboard described in the project spec. **Currently runs on
hardcoded mock data** — no network calls yet. Built with Tailwind
(via CDN), lucide-react icons, and Recharts for charts.

| File | Purpose |
|---|---|
| `index.html` | HTML entry point. Loads Tailwind from CDN and mounts the React app at `#root`. |
| `src/main.jsx` | React entry point — renders `<App />` into the DOM. |
| `src/App.jsx` | The entire application: landing page, auth (login/signup), and the dashboard (overview, jobs, templates, documents, technicians, compliance, analytics, settings). Also holds all mock data (`technicians`, `initialJobs`, `templates`, `documents`, `complianceRules`, `complianceLog`, etc.) and every UI component — see breakdown below. |
| `package.json` | Dependencies (`react`, `recharts`, `lucide-react`) and scripts (`dev`, `build`, `preview`). |
| `vite.config.js` | Vite build config, wires up the React plugin. |

### What's inside `App.jsx`

Since everything currently lives in one file, here's what each section does:

- **Mock data** — `technicians`, `initialJobs`, `templates`, `templateFieldMap`, `documents`, `alerts`, `weeklyDocs`, `complianceRules`, `complianceLog`, `complianceTrend`, `docTimeTrend`, `accuracyTrend`, `plans`. These shapes are exactly what the backend's endpoints return, so swapping mock data for `fetch` calls is mechanical (see the mapping table in the backend README).
- **Shared UI atoms** — `StatusPill`, `SeverityTag`, `ConfidenceBar`, `Card`, `IconBadge`. Small reusable pieces used throughout.
- **Landing page** — `Nav`, `Hero`, `HeroMock`, `HowItWorks`, `Features`, `Industries`, `Pricing`, `CTA`, `Footer`, composed in `LandingPage`.
- **Auth page** — `AuthPage`: tabbed login/signup, two-step signup (account details → plan selection).
- **Dashboard shell** — `Sidebar` (nav between sections), `Topbar` (search, plan badge, user menu).
- **Dashboard views**, one component per sidebar tab:
  - `OverviewView` — stat cards, accuracy gauge, active job list, AI alerts, weekly doc chart.
  - `JobsView` — job table with filters, "new job" form.
  - `TemplatesView` — template gallery, AI field-mapping panel per template, upload placeholder.
  - `DocumentsView` — document table with review side panel (approve / request changes).
  - `TechniciansView` — technician cards with workload/compliance stats.
  - `ComplianceView` — required fields by trade, compliance rate chart, recent alerts log.
  - `AnalyticsView` — four charts: docs/technician, doc time trend, accuracy trend, compliance trend.
  - `SettingsView` — business profile, billing/seats, team, integration toggles.
- **`Dashboard`** — ties the sidebar + topbar + active view together.
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
| `templates.py` | `GET /templates`, `GET /templates/{id}`, `POST /templates/upload` | List company document templates; upload an existing PDF/Word form, which is stored and passed to the AI field-detection stub. |
| `documents.py` | `GET /documents`, `GET /documents/{id}`, `POST /documents/{id}/review` | List/filter generated documents by status; approve or request changes on a document (the human-in-the-loop step from the project spec). |
| `compliance.py` | `GET /compliance/rules`, `GET /compliance/events`, `GET /compliance/rate` | Required fields per trade, the compliance alert log, and an overall compliance-rate calculation. |
| `analytics.py` | `GET /analytics/summary` | Aggregates the numbers behind the dashboard's overview stat cards and weekly chart. |
| `capture.py` | `POST /capture` | The mobile app's core action: upload a voice note or photo tied to a job. Stores the file and enqueues `process_capture` on the Celery queue. |

### `app/services/` — the AI/storage seams

| File | Purpose |
|---|---|
| `ai_pipeline.py` | **Stubbed AI model layer.** Functions for `transcribe_audio` (Whisper), `analyze_image` (vision-language model), `extract_text_ocr` (PaddleOCR/Tesseract), `fuse_into_document` (LLM merges everything into scored fields), `detect_template_fields` (layout analysis on uploaded forms), and `run_compliance_check` (which required fields are missing). Every function returns clearly-fake placeholder data for now — this is the only place real model calls need to be added. |
| `storage.py` | **Stubbed object storage.** `save_upload()` currently writes to a local `uploads/` folder; swap its body for an S3 or Azure Blob client when deploying — nothing else in the app needs to change. |

---

## 3. How the pieces fit together right now

- **Frontend**: fully built and **now wired to the backend** via `frontend/src/api.js`. All dashboard views fetch live data; mock arrays are gone.
- **Backend**: fully built and tested (all 20 routes exercised end-to-end: auth, jobs, technicians, templates, documents, compliance, analytics, capture). Uses SQLite by default (swap to Postgres via `DATABASE_URL`). Every AI call is a stub with an obvious real implementation to drop in.
- **Not yet done**: real AI model calls (stubs in `backend/app/services/ai_pipeline.py`) and production file storage (stub in `backend/app/services/storage.py`).

---

## 5. Connecting the frontend to the backend

### Service layer — `frontend/src/api.js`

All network calls live in a single file. Components import named functions (`api.login`, `api.getJobs`, etc.) and never call `fetch()` directly. This makes it trivial to swap the base URL, add retry logic, or mock the API in tests — only `api.js` needs to change.

```
frontend/src/
  api.js      ← ALL network calls live here (edit this file for API changes)
  App.jsx     ← imports * as api from "./api"
```

### Authentication & token storage

The JWT returned by `POST /auth/login` (and `/auth/signup`) is kept in a **module-level in-memory variable** inside `api.js`:

```js
let _token = null;          // lives in JS module memory only
export function setToken(t) { _token = t; }
export function clearToken() { _token = null; }
```

**Why in-memory?**
- Not stored in `localStorage` or `sessionStorage` — cleared automatically on page refresh.
- Avoids token persistence on shared machines.
- Compatible with Claude artifact sandboxes where browser storage APIs may be restricted.
- The trade-off: users must log in again after a hard refresh. This is intentional for this stage of the project.

When you are ready for persistence, replace the module-level variable with a `sessionStorage` read/write in `setToken`/`clearToken` — nothing else needs to change.

### Running both servers together

```bash
# Terminal 1 — Backend (from repo root)
cd backend
uvicorn app.main:app --reload
# → http://localhost:8000  (API docs: http://localhost:8000/docs)

# Terminal 2 — Frontend (from repo root)
cd frontend
npm run dev
# → http://localhost:5173
```

Demo login (seeded by `python -m app.seed` inside `backend/`):
- **Email**: `priya@meridianfieldworks.com`
- **Password**: `demo-password-123`

CORS is pre-configured in `backend/app/config.py` to allow `http://localhost:5173`.

### Endpoint mapping

| Dashboard view | API call in `api.js` | Backend route |
|---|---|---|
| OverviewView | `getAnalyticsSummary()` | `GET /analytics/summary` |
| OverviewView | `getJobs()`, `getComplianceEvents()` | `GET /jobs`, `GET /compliance/events` |
| JobsView | `getJobs(statusFilter?)`, `createJob()` | `GET /jobs`, `POST /jobs` |
| TechniciansView | `getTechnicians()` | `GET /technicians` |
| TemplatesView | `getTemplates()`, `getTemplate(id)` | `GET /templates`, `GET /templates/{id}` |
| DocumentsView | `getDocuments()`, `reviewDocument()` | `GET /documents`, `POST /documents/{id}/review` |
| ComplianceView | `getComplianceRules()`, `getComplianceEvents()` | `GET /compliance/rules`, `GET /compliance/events` |
| AnalyticsView | `getAnalyticsSummary()`, `getTechnicians()` | `GET /analytics/summary`, `GET /technicians` |
| Auth | `login()`, `signup()`, `getMe()` | `POST /auth/login`, `POST /auth/signup`, `GET /auth/me` |
| Live updates | `connectWebSocket(onMessage)` | `WS /ws` |

## 4. Suggested next steps

1. Wire the React dashboard to the live API (replace mock arrays with `fetch` calls, store the JWT, connect to `/ws` for live updates).
2. Implement one AI stub at a time, starting with `transcribe_audio` (Whisper) since it's the simplest integration.
3. Add Alembic migrations before deploying against Postgres instead of SQLite.
4. Add role-based access control (Owner/Admin/Technician) — currently every authenticated user can do anything within their business.
5. Build the actual mobile capture screen (voice record + camera) that calls `POST /capture` — the dashboard currently only shows the *result* of that flow, not the capture UI itself.