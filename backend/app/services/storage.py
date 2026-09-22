"""
Object storage abstraction.

For now this saves uploads to a local ./uploads directory so the API is
fully runnable without cloud credentials. Swap save_upload()'s body for a
real boto3 (S3) or azure-storage-blob client when you're ready to deploy -
the function signature used by the rest of the app won't need to change.
"""
import os
import re
import uuid

from fastapi import UploadFile

UPLOAD_DIR = "uploads"


def _slug(value: str) -> str:
    """Filesystem-safe folder segment (IDs are already safe; this guards
    against any future name-based segments)."""
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value)[:60] or "unknown"


async def save_capture_upload(
    file: UploadFile,
    kind: str,
    business_id: str,
    technician_id: str | None = None,
) -> str:
    """
    Field-capture storage with a maintained owner trail baked into the path:

        uploads/captures/<business_id>/<technician_id|"unassigned">/<voice|photo>/<uuid>.<ext>

    Every capture is therefore attributable to the company and the specific
    technician who uploaded it just by looking at the folder it lives in.
    Returns the URL form (leading "/") that the rest of the app stores.
    """
    folder = os.path.join(
        UPLOAD_DIR,
        "captures",
        _slug(business_id),
        _slug(technician_id) if technician_id else "unassigned",
        _slug(kind),
    )
    os.makedirs(folder, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, safe_name)

    contents = await file.read()
    with open(path, "wb") as f:
        f.write(contents)

    # In production this would be an S3/Blob URL instead of a local path
    return f"/{path}"


async def save_upload(file: UploadFile, prefix: str = "misc") -> str:
    folder = os.path.join(UPLOAD_DIR, prefix)
    os.makedirs(folder, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, safe_name)

    contents = await file.read()
    with open(path, "wb") as f:
        f.write(contents)

    # In production this would be an S3/Blob URL instead of a local path
    return f"/{path}"


def resolve_local_path(file_url: str) -> str:
    """
    Turns a URL previously returned by save_upload() back into a real
    filesystem path that libraries like python-docx can open directly.

    Works as-is only because save_upload() currently stores locally and
    returns f"/{path}" — this function just strips the leading "/". Once
    save_upload() is swapped for a real S3/Blob client, this needs to
    become "download the object to a temp file and return that path"
    instead, since docx_extractor/docx_writer need a local file handle.
    """
    return file_url.lstrip("/")
