"""
SQLAlchemy database setup.

Uses SQLite for v1 (file-based, zero-config).
Railway note: SQLite writes to ephemeral container storage — data survives restarts
but not redeployments. Replace DATABASE_URL with a managed Postgres URL for
production durability (Phase 4 concern).

get_db() is the FastAPI dependency that provides a DB session per request.

Phase 71.02: Explicit QueuePool config + extended PRAGMA tuning for write throughput.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import QueuePool

from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite with FastAPI threads
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Set SQLite PRAGMAs on every new connection for WAL mode and performance tuning.

    WAL persists at the file level once set, but all other PRAGMAs are per-connection.
    Phase 71.02: Added synchronous=NORMAL, cache_size, temp_store, mmap_size,
    wal_autocheckpoint for improved write throughput under concurrent load.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-32000")       # 32 MB page cache
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=134217728")     # 128 MB memory-mapped I/O
    cursor.execute("PRAGMA wal_autocheckpoint=1000")
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
