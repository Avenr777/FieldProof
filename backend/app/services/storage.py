"""
Object storage abstraction.

Files are ALWAYS written to the local ./uploads directory first, so code
running inside the same request (docx extraction, python-docx fills,
Whisper/vision) can open them without a network round-trip.

When BLOB_READ_WRITE_TOKEN is set (Vercel Blob store attached), every
file is ALSO mirrored to Vercel Blob and the returned URL is the public
Blob URL. Serverless instances don't share a filesystem, so this is what
makes an upload from one instance visible to every other instance.
Without the token (local development) the classic relative "/uploads/..."
URL is returned and nothing changes.

resolve_local_path() accepts both forms: relative paths strip the
leading "/", absolute URLs are downloaded to a temp file so libraries
that need a local file handle (python-docx, Whisper) keep working.
"""
import logging
import mimetypes
import os
import re
import tempfile
import uuid
from urllib.parse import urlparse

import httpx
from fastapi import UploadFile

UPLOAD_DIR = "uploads"

logger = logging.getLogger("fieldproof.storage")


def _slug(value: str) -> str:
    """Filesystem-safe folder segment (IDs are already safe; this guards
    against any future name-based segments)."""
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value)[:60] or "unknown"


def _blob_enabled() -> bool:
    return bool(os.environ.get("BLOB_READ_WRITE_TOKEN"))


def _key(path: str) -> str:
    """Storage key for a local path: forward slashes, no leading slash."""
    return path.replace(os.sep, "/").lstrip("/")


def _put_blob(key: str, data: bytes) -> str | None:
    """Mirror bytes to Vercel Blob under key.

    Returns the public URL on success, or None when Blob is disabled or
    an upload fails — callers fall back to the local relative URL so a
    storage hiccup never turns into a 500.
    """
    if not _blob_enabled():
        return None
    try:
        from vercel.blob.sync import put_blob

        result = put_blob(
            key,
            data,
            access="public",
            content_type=mimetypes.guess_type(key)[0],
            # Generated documents reuse {job_id}_{template_id}.docx per job.
            allow_overwrite=True,
        )
        return result.url
    except Exception as exc:
        logger.error("Blob upload failed for %s: %s", key, exc)
        return None


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
    Returns the URL form the rest of the app stores: an absolute Blob URL
    on Vercel, or "/uploads/..." locally.
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

    return _put_blob(_key(path), contents) or f"/{path}"


async def save_upload(file: UploadFile, prefix: str = "misc") -> str:
    folder = os.path.join(UPLOAD_DIR, prefix)
    os.makedirs(folder, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, safe_name)

    contents = await file.read()
    with open(path, "wb") as f:
        f.write(contents)

    return _put_blob(_key(path), contents) or f"/{path}"


def publish_local_file(local_path: str) -> str:
    """Register a file that was written directly to disk (a generated
    document): mirror it to Blob when enabled and return the URL form the
    app should store — absolute Blob URL on Vercel, "/path" locally."""
    key = _key(local_path)
    try:
        with open(local_path, "rb") as fh:
            data = fh.read()
    except OSError:
        return f"/{key}"
    return _put_blob(key, data) or f"/{key}"


def resolve_local_path(file_url: str) -> str:
    """
    Turns a URL previously returned by save_upload()/publish_local_file()
    back into a real filesystem path that libraries like python-docx and
    Whisper can open directly.

    - Relative "/uploads/..." (local dev): strip the leading "/".
    - Absolute "https://..." (Vercel Blob): download to a temp file and
      return its path — serverless instances don't share a filesystem, so
      the original may only exist on the instance that received it.
    """
    if file_url.startswith(("http://", "https://")):
        suffix = os.path.splitext(urlparse(file_url).path)[1] or ".bin"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        with httpx.stream(
            "GET", file_url, follow_redirects=True, timeout=60.0
        ) as resp:
            resp.raise_for_status()
            with open(tmp_path, "wb") as fh:
                for chunk in resp.iter_bytes():
                    fh.write(chunk)
        return tmp_path
    return file_url.lstrip("/")
