"""
SQLAlchemy database setup.

Uses SQLite for v1 (file-based, zero-config).
Railway note: SQLite writes to ephemeral container storage — data survives restarts
but not redeployments. Replace DATABASE_URL with a managed Postgres URL for
production durability (Phase 4 concern).

get_db() is the FastAPI dependency that provides a DB session per request.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite with FastAPI threads
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and set busy_timeout on every new connection.
    WAL persists at the file level once set, but busy_timeout is per-connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

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
