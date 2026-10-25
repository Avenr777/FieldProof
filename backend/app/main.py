import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
