import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.websocket import manager
from app.routers import auth, jobs, technicians, templates, documents, compliance, analytics, capture

# Creates tables on first run if they don't exist yet (fine for dev/SQLite;
# use Alembic migrations once this is backed by Postgres in production).
Base.metadata.create_all(bind=engine)

os.makedirs("uploads", exist_ok=True)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves everything storage.save_upload() writes (template source files,
# generated filled documents) at the same path returned as file_url, e.g.
# a Document.file_url of "/uploads/documents/JOB-x_TPL-y.docx" is fetchable
# at http://localhost:8000/uploads/documents/JOB-x_TPL-y.docx. Swap this out
# entirely once storage.py is backed by S3/Blob (files would be fetched
# from the cloud provider's own URL instead).
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(technicians.router)
app.include_router(templates.router)
app.include_router(documents.router)
app.include_router(compliance.router)
app.include_router(analytics.router)
app.include_router(capture.router)


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
            await websocket.receive_text()  # keep the connection open
    except WebSocketDisconnect:
        manager.disconnect(websocket)
