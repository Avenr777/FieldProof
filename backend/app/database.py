from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

database_url = settings.database_url
# Hosted providers (Vercel Marketplace / Neon) hand out postgresql:// URLs;
# SQLAlchemy 2 needs the explicit psycopg3 driver suffix to match
# requirements.txt (psycopg[binary]). SQLite URLs pass through untouched.
if database_url.startswith("postgres://"):
    database_url = "postgresql+psycopg://" + database_url[len("postgres://") :]
elif database_url.startswith("postgresql://"):
    database_url = "postgresql+psycopg://" + database_url[len("postgresql://") :]

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

# pool_pre_ping: hosted Postgres suspends idle compute (e.g. Neon free tier),
# so a warm function instance may hold a dead connection — ping before reuse.
engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_columns() -> None:
    """Dev-only lightweight migration: SQLite's CREATE TABLE IF NOT EXISTS
    doesn't add columns to existing tables, so add the ones introduced since
    this database was first created. Remove once Alembic is in place."""
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import text
    needed = {
        "technicians": [("user_id", "STRING")],
        "templates": [
            ("source_file_url", "STRING"),
            ("extraction", "JSON"),
            ("technician_id", "STRING"),
            ("assigned_at", "DATETIME"),
        ],
        "captures": [("technician_id", "STRING"), ("template_id", "STRING")],
        "template_assignments": [
            ("assignment_type", "STRING"),
            ("frequency", "STRING"),
            ("frequency_details", "JSON"),
            ("due_date", "DATETIME"),
            ("start_date", "DATETIME"),
            ("end_date", "DATETIME"),
            ("status", "STRING"),
            ("notes", "TEXT"),
        ],
    }
    with engine.connect() as conn:
        for table, columns in needed.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if not existing:
                continue  # table doesn't exist yet; create_all creates it fresh
            for column, col_type in columns:
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        conn.commit()
