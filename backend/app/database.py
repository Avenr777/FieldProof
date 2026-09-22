from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
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
