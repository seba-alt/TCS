"""
FastAPI application entry point.

Startup sequence (lifespan):
1. Create/migrate DB tables
2. Seed Expert table from experts.csv if empty
3. Load FAISS index from disk → app.state.faiss_index
4. Load metadata JSON → app.state.metadata
5. Yield (server is ready)
6. Shutdown: nothing to clean up for in-memory FAISS

CORS: configured before route registration.
Uses ALLOWED_ORIGINS env var (comma-separated).
Default: localhost:5173 (Vite dev server).
Production: Railway injects the actual Vercel URL.
"""
import csv
import json
import os
from contextlib import asynccontextmanager

import app.models  # noqa: F401 — registers ORM models with Base metadata
import faiss
import sentry_sdk
import structlog
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import FAISS_INDEX_PATH, METADATA_PATH
from app.database import Base, SessionLocal, engine
from app.models import Expert
from app.routers import admin, chat, email_capture, feedback, health, explore, pilot, suggest

# Load .env for local development — no-op in production (Railway injects env vars)
load_dotenv()

# Sentry error monitoring — silently skipped when SENTRY_DSN is absent (local dev).
# Set SENTRY_DSN env var in Railway dashboard to enable production monitoring.
if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=dsn,
        traces_sample_rate=0.1,
        environment="production",
    )

log = structlog.get_logger()

EXPERTS_CSV_PATH = METADATA_PATH.parent / "experts.csv"


def _seed_experts_from_csv() -> int:
    """
    Import experts.csv into the Expert DB table on first run.
    Skips if the table already has rows.
    Returns the number of rows inserted (0 if already seeded or CSV not found).
    """
    with SessionLocal() as db:
        count = db.execute(select(func.count()).select_from(Expert)).scalar() or 0
        if count > 0:
            return 0  # Already seeded

        if not EXPERTS_CSV_PATH.exists():
            log.warning("startup: experts.csv not found, skipping expert seed", path=str(EXPERTS_CSV_PATH))
            return 0

        experts: list[Expert] = []
        with open(EXPERTS_CSV_PATH, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                username = (row.get("Username") or "").strip()
                if not username:
                    continue  # Skip rows with no username

                try:
                    hourly_rate = float(row.get("Hourly Rate") or 0)
                except (ValueError, TypeError):
                    hourly_rate = 0.0

                experts.append(Expert(
                    username=username,
                    email=(row.get("Email") or "").strip(),
                    first_name=(row.get("First Name") or "").strip(),
                    last_name=(row.get("Last Name") or "").strip(),
                    job_title=(row.get("Job Title") or "").strip(),
                    company=(row.get("Company") or "").strip(),
                    bio=(row.get("Bio") or "").strip(),
                    hourly_rate=hourly_rate,
                    currency=(row.get("Currency") or "EUR").strip(),
                    profile_url=(row.get("Profile URL") or "").strip(),
                    profile_url_utm=(row.get("Profile URL with UTM") or "").strip(),
                    category=None,
                ))

        if experts:
            db.bulk_save_objects(experts)
            db.commit()

        return len(experts)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load FAISS index and metadata at startup; nothing to release at shutdown.
    Using lifespan (NOT @app.on_event — that pattern is deprecated in FastAPI 0.90+).
    """
    # Create database tables if they don't exist (idempotent — safe to call on every startup)
    Base.metadata.create_all(bind=engine)
    log.info("startup: database tables created/verified")

    # One-time column migrations for analytics schema — safe to leave in permanently.
    # SQLite raises OperationalError if the column already exists; we catch and ignore.
    from sqlalchemy import text as _text  # noqa: PLC0415
    with engine.connect() as _conn:
        for _col_ddl in [
            "ALTER TABLE conversations ADD COLUMN top_match_score REAL",
            "ALTER TABLE conversations ADD COLUMN gap_resolved INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE conversations ADD COLUMN hyde_triggered INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE conversations ADD COLUMN feedback_applied INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE conversations ADD COLUMN hyde_bio TEXT",
        ]:
            try:
                _conn.execute(_text(_col_ddl))
                _conn.commit()
            except Exception:
                pass  # Column already exists — idempotent
    log.info("startup: analytics columns migrated/verified")

    # Phase 8: expert enrichment columns
    with engine.connect() as _conn:
        for _col_ddl in [
            "ALTER TABLE experts ADD COLUMN tags TEXT",
            "ALTER TABLE experts ADD COLUMN findability_score REAL",
        ]:
            try:
                _conn.execute(_text(_col_ddl))
                _conn.commit()
            except Exception:
                pass  # Column already exists — idempotent
    log.info("startup: expert enrichment columns migrated/verified")

    # Phase 14: FTS5 virtual table for BM25 keyword search
    with engine.connect() as _conn:
        _conn.execute(_text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(
                first_name,
                last_name,
                job_title,
                company,
                bio,
                tags,
                content='experts',
                content_rowid='id'
            )
        """))
        _conn.commit()
        # Always rebuild the FTS5 content table index at startup.
        # For content= tables, 'rebuild' re-reads from the source (experts) table and
        # rebuilds the FTS index atomically. This ensures prefix queries return live data
        # even if the index was stale from a previous run. Cost is O(n) at startup only.
        _conn.execute(_text("INSERT INTO experts_fts(experts_fts) VALUES('rebuild')"))
        _conn.commit()
    log.info("startup: FTS5 index created/rebuilt")

    # Phase 14: FTS5 INSERT trigger (sync new experts automatically)
    with engine.connect() as _conn:
        _conn.execute(_text("""
            CREATE TRIGGER IF NOT EXISTS experts_fts_ai
            AFTER INSERT ON experts BEGIN
                INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
                VALUES (new.id, new.first_name, new.last_name, new.job_title,
                        new.company, new.bio, COALESCE(new.tags, ''));
            END
        """))
        _conn.commit()
    log.info("startup: FTS5 insert trigger created/verified")

    # Phase 11: settings table — created by Base.metadata.create_all() above on fresh DBs;
    # on existing DBs create_all() adds missing tables idempotently without modifying existing ones.
    log.info("startup: settings table created/verified")

    # Seed Expert table from experts.csv on first run
    seeded = _seed_experts_from_csv()
    if seeded:
        log.info("startup: experts seeded from CSV", count=seeded)
    else:
        log.info("startup: experts table already populated or CSV not found")

    log.info("startup: loading FAISS index", path=str(FAISS_INDEX_PATH))

    if not FAISS_INDEX_PATH.exists():
        raise RuntimeError(
            f"FAISS index not found at {FAISS_INDEX_PATH}. "
            "Run scripts/ingest.py before starting the server."
        )

    app.state.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
    log.info("startup: FAISS index loaded", vectors=app.state.faiss_index.ntotal)

    if not METADATA_PATH.exists():
        raise RuntimeError(f"Metadata not found at {METADATA_PATH}.")

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        app.state.metadata = json.load(f)
    log.info("startup: metadata loaded", records=len(app.state.metadata))

    # Phase 14: username → FAISS positional index mapping (covers the 536 embedded experts)
    _username_to_pos: dict[str, int] = {}
    for _pos, _row in enumerate(app.state.metadata):
        _uname = _row.get("Username") or _row.get("username") or ""
        if _uname:
            _username_to_pos[_uname] = _pos
    app.state.username_to_faiss_pos = _username_to_pos
    log.info(
        "startup: username-to-FAISS-position mapping built",
        count=len(_username_to_pos),
    )

    # Phase 14: category auto-classification (one-time startup migration)
    from app.routers.admin import _auto_categorize as _categorize  # noqa: PLC0415
    from sqlalchemy import select as _select  # noqa: PLC0415
    with SessionLocal() as _db:
        _uncategorized = _db.scalars(
            _select(Expert).where(Expert.category == None)  # noqa: E711
        ).all()
        for _e in _uncategorized:
            _cat = _categorize(_e.job_title)
            if _cat:
                _e.category = _cat
        if _uncategorized:
            _db.commit()
            log.info("startup: category auto-classification", count=len(_uncategorized))

    yield
    # Shutdown: in-memory FAISS index is garbage-collected automatically


# --- Application ---
app = FastAPI(
    title="Tinrate AI Concierge",
    description="RAG-based expert recommendation API",
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS ---
# NEVER use ["*"] in production — use explicit Vercel domain.
# ALLOWED_ORIGINS env var is comma-separated; Railway injects the Vercel URL at deploy time.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

# --- Routes ---
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(email_capture.router)
app.include_router(feedback.router)
app.include_router(admin.auth_router)
app.include_router(admin.router)
app.include_router(explore.router)
app.include_router(pilot.router)
app.include_router(suggest.router)
