"""
FastAPI application entry point.

Startup sequence (lifespan):
1. Load FAISS index from disk → app.state.faiss_index
2. Load metadata JSON → app.state.metadata
3. Yield (server is ready)
4. Shutdown: nothing to clean up for in-memory FAISS

CORS: configured before route registration.
Uses ALLOWED_ORIGINS env var (comma-separated).
Default: localhost:5173 (Vite dev server).
Production: Railway injects the actual Vercel URL.
"""
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

from app.config import FAISS_INDEX_PATH, METADATA_PATH
from app.database import Base, engine
from app.routers import chat, email_capture, health

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load FAISS index and metadata at startup; nothing to release at shutdown.
    Using lifespan (NOT @app.on_event — that pattern is deprecated in FastAPI 0.90+).
    """
    # Create database tables if they don't exist (idempotent — safe to call on every startup)
    Base.metadata.create_all(bind=engine)
    log.info("startup: database tables created/verified")

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
    allow_headers=["Content-Type"],
)

# --- Routes ---
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(email_capture.router)
