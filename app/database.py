"""
SQLAlchemy database setup.

Uses SQLite for v1 (file-based, zero-config).
Railway note: SQLite writes to ephemeral container storage — data survives restarts
but not redeployments. Replace DATABASE_URL with a managed Postgres URL for
production durability (Phase 4 concern).

get_db() is the FastAPI dependency that provides a DB session per request.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite with FastAPI threads
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
