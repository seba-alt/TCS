"""
Health check endpoints.

GET /api/health       → {"status": "ok", "index_size": <int>}
                        Fast, unauthenticated — used by Railway healthcheck.
                        A non-zero index_size confirms the FAISS index loaded.

GET /api/admin/health → {"status", "db", "expert_count", "db_latency_ms",
                          "faiss_vectors", "uptime_s", "version"}
                        Requires admin JWT — full diagnostics for admin UI.
"""
import time

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text

from app.database import SessionLocal
from app.routers.admin._common import _require_admin

router = APIRouter()

# Record module load time as the process start approximation.
# (More accurate than tracking app startup; close enough for uptime display.)
_start_time = time.time()


@router.get("/api/health")
async def health(request: Request) -> dict:
    """Public — Railway healthcheck. Fast, no auth."""
    index = request.app.state.faiss_index
    return {
        "status": "ok",
        "index_size": index.ntotal,
    }


@router.get("/api/admin/health")
async def admin_health(
    request: Request,
    _: str = Depends(_require_admin),
) -> dict:
    """Authenticated — full diagnostics for admin UI."""
    t0 = time.monotonic()
    db_status = "ok"
    db_latency_ms = None
    expert_count = None

    try:
        with SessionLocal() as db:
            expert_count = db.execute(text("SELECT COUNT(*) FROM experts")).scalar()
        db_latency_ms = round((time.monotonic() - t0) * 1000, 1)
    except Exception as exc:
        db_status = f"error: {exc}"

    index = request.app.state.faiss_index
    uptime_s = round(time.time() - _start_time)

    return {
        "status": "ok",
        "db": db_status,
        "expert_count": expert_count,
        "db_latency_ms": db_latency_ms,
        "faiss_vectors": index.ntotal,
        "uptime_s": uptime_s,
        "version": "v5.4",
    }
