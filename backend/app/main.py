import os

# ── Serverless (Vercel) bootstrap ─────────────────────────────────────────────
# Vercel's function bundle is read-only: only /tmp is writable, and it is
# ephemeral scratch space that is not shared between function instances. Every
# relative path this app uses (./fieldproof.db, ./uploads) is made to land in
# /tmp *before* settings, the SQLAlchemy engine and the static mounts are
# created. Local development is untouched because VERCEL is unset there.
if os.environ.get("VERCEL"):
    os.chdir("/tmp")
    os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/fieldproof.db")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.database import Base, engine, ensure_sqlite_columns
from app.websocket import manager
from app.routers import auth, jobs, technicians, templates, documents, compliance, analytics, capture, integrations, assignments, review

# Creates tables on first run if they don't exist yet (fine for dev/SQLite;
# use Alembic migrations once this is backed by Postgres in production).
Base.metadata.create_all(bind=engine)
ensure_sqlite_columns()

os.makedirs("uploads", exist_ok=True)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(technicians.router)
app.include_router(templates.router)
app.include_router(documents.router)
app.include_router(compliance.router)
app.include_router(analytics.router)
app.include_router(capture.router)
app.include_router(integrations.router)
app.include_router(assignments.router)
app.include_router(review.router)



@app.get("/")
def root():
    return {"status": "ok", "service": settings.app_name}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Dashboard connects here to receive live events (job_created, job_updated,
    document_reviewed, ...) pushed by app.websocket.manager.broadcast().
    """
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  
    except WebSocketDisconnect:
        manager.disconnect(websocket)


class _ApiPrefix:
    """ASGI wrapper that serves the app under /api.

    Vercel Services routes /api/* to the entrypoint below with the original
    public path (e.g. /api/auth/login), while the FastAPI routes are declared
    without that prefix. Strip it before routing; requests that already arrive
    unprefixed (local runs, proxies that rewrite) pass through untouched, and
    scope["root_path"] is left alone so Starlette's get_route_path() stays
    consistent in either case.
    """

    def __init__(self, app: ASGIApp, prefix: str = "/api") -> None:
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path == self.prefix or path.startswith(self.prefix + "/"):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix) :] or "/"
        await self.app(scope, receive, send)


# Entrypoint used by vercel.json ("entrypoint": "app.main:api").
# `app` stays the plain FastAPI instance for uvicorn and the test suite.
api = _ApiPrefix(app)
