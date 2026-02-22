"""
/api/admin/* — Analytics dashboard endpoints for admin use.

All endpoints (except /auth) require X-Admin-Key header matching the ADMIN_SECRET env var.
Returns 401 for missing or incorrect key.

Endpoints:
    POST /api/admin/auth                        — validate admin key (no auth required)
    GET  /api/admin/stats                       — aggregate counts + top queries/feedback
    GET  /api/admin/searches                    — paginated conversation rows with gap flag
    GET  /api/admin/gaps                        — gap queries grouped by frequency
    POST /api/admin/gaps/{gap_query}/resolve    — mark all matching conversations resolved
    GET  /api/admin/leads                       — email-grouped lead analytics
    GET  /api/admin/experts                     — expert list from metadata.json
    POST /api/admin/experts/{username}/classify — set category on one expert
    POST /api/admin/experts/auto-classify       — keyword-match categories for all uncategorized
    POST /api/admin/experts                     — add new expert to metadata.json + experts.csv
    GET  /api/admin/export/searches.csv         — CSV download of conversations
    GET  /api/admin/export/gaps.csv             — CSV download of gap aggregates
    GET  /api/admin/settings                    — all 5 intelligence settings with value + source
    POST /api/admin/settings                    — write a setting to DB (immediate, no redeploy)
    POST /api/admin/compare                     — run query through up to 4 intelligence configs in parallel
"""
import asyncio as _asyncio
import csv
import io
import json
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from typing import Optional

import faiss
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, Security, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from sqlalchemy import Integer, func, select, update
from sqlalchemy.orm import Session

import structlog

from app.config import FAISS_INDEX_PATH, METADATA_PATH
from app.database import get_db, SessionLocal
from app.models import Conversation, Expert, Feedback, NewsletterSubscriber
from app.services.tagging import compute_findability_score, tag_expert_sync
from app.services.retriever import retrieve
from app.services.search_intelligence import (  # noqa: PLC2701
    get_settings,
    _is_weak_query,
    _generate_hypothetical_bio,
    _blend_embeddings,
    _search_with_vector,
    _merge_candidates,
    _apply_feedback_boost,
)

log = structlog.get_logger()

# ── Ingest job state ──────────────────────────────────────────────────────────

# admin.py lives at app/routers/admin.py → parent.parent.parent = project root
PROJECT_ROOT = METADATA_PATH.parent.parent

_ingest: dict = {
    "status": "idle",
    "log": "",
    "error": None,
    "started_at": None,
    "last_rebuild_at": None,          # Phase 24: set on successful FAISS rebuild completion
    "expert_count_at_rebuild": None,  # Phase 24 + 25: expert count at last full rebuild
}
_ingest_lock = _asyncio.Lock()


def _run_tag_job() -> None:
    """Background thread: run only tag_experts.py (tags + scores, no FAISS rebuild)."""
    global _ingest
    _ingest["log"] = ""
    _ingest["error"] = None
    _ingest["started_at"] = time.time()
    try:
        r = subprocess.run(
            [sys.executable, "scripts/tag_experts.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r.stdout + r.stderr
        if r.returncode != 0:
            raise RuntimeError(f"tag_experts.py exited {r.returncode}:\n{r.stderr}")
        _ingest["status"] = "done"
    except Exception as exc:
        _ingest["status"] = "error"
        _ingest["error"] = str(exc)


def _run_ingest_job(app) -> None:
    """Background thread: run tag_experts.py + ingest.py then hot-reload FAISS+metadata."""
    global _ingest
    _ingest["log"] = ""
    _ingest["error"] = None
    _ingest["started_at"] = time.time()
    try:
        # Step 1: tag experts with Gemini
        r1 = subprocess.run(
            [sys.executable, "scripts/tag_experts.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r1.stdout + r1.stderr
        if r1.returncode != 0:
            raise RuntimeError(f"tag_experts.py exited {r1.returncode}:\n{r1.stderr}")

        # Step 2: rebuild FAISS index
        r2 = subprocess.run(
            [sys.executable, "scripts/ingest.py"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        _ingest["log"] += r2.stdout + r2.stderr
        if r2.returncode != 0:
            raise RuntimeError(f"ingest.py exited {r2.returncode}:\n{r2.stderr}")

        # Step 3: hot-reload app.state
        app.state.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            app.state.metadata = json.load(f)

        # Phase 14: rebuild FTS5 index after bulk tag update
        from sqlalchemy import text as _fts_text  # noqa: PLC0415
        with SessionLocal() as _fts_db:
            _fts_db.execute(_fts_text("INSERT INTO experts_fts(experts_fts) VALUES('rebuild')"))
            _fts_db.commit()
        log.info("fts5.rebuild_complete")

        # Phase 14: refresh username-to-FAISS-position mapping after hot-reload
        _new_mapping: dict[str, int] = {}
        for _pos, _row in enumerate(app.state.metadata):
            _uname = _row.get("Username") or _row.get("username") or ""
            if _uname:
                _new_mapping[_uname] = _pos
        app.state.username_to_faiss_pos = _new_mapping
        log.info("fts5.username_mapping_refreshed", count=len(_new_mapping))

        _ingest["last_rebuild_at"] = time.time()
        _ingest["expert_count_at_rebuild"] = len(app.state.metadata)
        app.state.tsne_cache = []   # Phase 26: invalidate stale t-SNE projection
        _ingest["status"] = "done"
    except Exception as exc:
        _ingest["status"] = "error"
        _ingest["error"] = str(exc)


# ── Auth ─────────────────────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

GAP_THRESHOLD = 0.60  # Matches SIMILARITY_THRESHOLD in retriever.py

EXPERTS_CSV_PATH = METADATA_PATH.parent / "experts.csv"

CATEGORY_KEYWORDS = {
    "Finance": ["finance", "cfo", "accountant", "banker", "investment", "fintech", "trading"],
    "Marketing": ["marketing", "cmo", "brand", "social media", "growth", "seo", "content"],
    "Tech": ["engineer", "developer", "cto", "software", "data", "ai", "ml", "product"],
    "Sales": ["sales", "revenue", "business development", "account"],
    "HR": ["hr", "human resources", "recruiter", "talent", "coaching", "people"],
    "Legal": ["legal", "lawyer", "attorney", "compliance", "gdpr"],
    "Operations": ["operations", "coo", "supply chain", "logistics", "procurement"],
    "Sports": ["sport", "football", "fitness", "athlete", "coach"],
    "Healthcare": ["health", "medical", "doctor", "pharma", "wellness"],
    "Real Estate": ["real estate", "property", "construction", "renovation"],
    "Strategy": ["strategy", "consulting", "advisor", "entrepreneur", "founder", "ceo"],
}


def _require_admin(api_key: Optional[str] = Security(_api_key_header)) -> str:
    """Dependency: validate X-Admin-Key against ADMIN_SECRET env var."""
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or not api_key or api_key != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Key header",
        )
    return api_key


# Auth router — no authentication required (used by the login page)
auth_router = APIRouter(prefix="/api/admin")

# Main router — all endpoints require X-Admin-Key
router = APIRouter(prefix="/api/admin", dependencies=[Depends(_require_admin)])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_gap(row: Conversation) -> bool:
    """Return True if the conversation qualifies as a gap."""
    return (
        row.top_match_score is not None and row.top_match_score < GAP_THRESHOLD
    ) or row.response_type == "clarification"


def _auto_categorize(job_title: str) -> Optional[str]:
    """Return first matching category for a job title, or None."""
    jt = job_title.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in jt for kw in keywords):
            return category
    return None


def _serialize_expert(e: Expert) -> dict:
    return {
        "username": e.username,
        "first_name": e.first_name,
        "last_name": e.last_name,
        "job_title": e.job_title,
        "company": e.company,
        "bio": e.bio,
        "hourly_rate": e.hourly_rate,
        "profile_url": e.profile_url,
        "category": e.category,
        "tags": json.loads(e.tags or "[]"),
        "findability_score": e.findability_score,
    }


# ── Auth endpoint (no auth required) ─────────────────────────────────────────

class AuthBody(BaseModel):
    key: str


@auth_router.post("/auth")
def authenticate(body: AuthBody):
    """
    Validate admin key without requiring X-Admin-Key header.
    Used by the login page to exchange a password for a session key.

    Returns 200 {"ok": True} if key matches ADMIN_SECRET, else 401.
    """
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or body.key != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid key")
    return {"ok": True}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """
    Return aggregate search metrics plus top queries and feedback.

    Response shape:
        {total_searches, match_count, match_rate, gap_count,
         top_queries: [{query, count}], top_feedback: [{query, vote, count}]}
    """
    total = db.scalar(select(func.count()).select_from(Conversation)) or 0

    match_count = db.scalar(
        select(func.count()).select_from(Conversation).where(
            Conversation.response_type == "match"
        )
    ) or 0

    gap_count = db.scalar(
        select(func.count()).select_from(Conversation).where(
            (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
    ) or 0

    match_rate = round(match_count / total, 3) if total else 0.0

    # Top 10 most searched queries
    top_q_rows = db.execute(
        select(Conversation.query, func.count(Conversation.id).label("count"))
        .group_by(Conversation.query)
        .order_by(func.count(Conversation.id).desc())
        .limit(10)
    ).all()
    top_queries = [{"query": r.query, "count": r.count} for r in top_q_rows]

    # Top 10 query+vote combos
    top_fb_rows = db.execute(
        select(
            Conversation.query,
            Feedback.vote,
            func.count(Feedback.id).label("count"),
        )
        .join(Feedback, Feedback.conversation_id == Conversation.id)
        .group_by(Conversation.query, Feedback.vote)
        .order_by(func.count(Feedback.id).desc())
        .limit(10)
    ).all()
    top_feedback = [{"query": r.query, "vote": r.vote, "count": r.count} for r in top_fb_rows]

    return {
        "total_searches": total,
        "match_count": match_count,
        "match_rate": match_rate,
        "gap_count": gap_count,
        "top_queries": top_queries,
        "top_feedback": top_feedback,
    }


@router.get("/intelligence-stats")
def get_intelligence_stats(db: Session = Depends(get_db)):
    """
    Return search intelligence metrics: HyDE trigger rate, feedback re-ranking rate,
    gap rate, and daily trends for the last 30 days.
    """
    import os as _os

    # Flag status (read env vars that Railway injects)
    flags = {
        "hyde_enabled": _os.getenv("QUERY_EXPANSION_ENABLED", "false").lower() in ("true", "1", "yes"),
        "feedback_enabled": _os.getenv("FEEDBACK_LEARNING_ENABLED", "false").lower() in ("true", "1", "yes"),
    }

    # Totals
    total = db.scalar(select(func.count()).select_from(Conversation)) or 0
    hyde_count = db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.hyde_triggered == True)  # noqa: E712
    ) or 0
    feedback_count = db.scalar(
        select(func.count()).select_from(Conversation).where(Conversation.feedback_applied == True)  # noqa: E712
    ) or 0
    gap_count = db.scalar(
        select(func.count()).select_from(Conversation).where(
            (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
    ) or 0
    avg_score = db.scalar(
        select(func.avg(Conversation.top_match_score)).select_from(Conversation).where(
            Conversation.top_match_score.is_not(None)
        )
    )

    totals = {
        "conversations": total,
        "hyde_triggered": hyde_count,
        "hyde_rate": round(hyde_count / total, 3) if total else 0.0,
        "feedback_applied": feedback_count,
        "feedback_rate": round(feedback_count / total, 3) if total else 0.0,
        "gaps": gap_count,
        "gap_rate": round(gap_count / total, 3) if total else 0.0,
        "avg_score": round(float(avg_score), 3) if avg_score is not None else None,
    }

    # Daily trend — last 30 days using raw SQL (avoids SQLite cast quirks)
    cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    from sqlalchemy import text as _text  # noqa: PLC0415
    daily_rows = db.execute(_text("""
        SELECT
            strftime('%Y-%m-%d', created_at) AS day,
            COUNT(*) AS conversations,
            SUM(CASE WHEN hyde_triggered = 1 THEN 1 ELSE 0 END) AS hyde_triggered,
            SUM(CASE WHEN feedback_applied = 1 THEN 1 ELSE 0 END) AS feedback_applied,
            SUM(CASE WHEN top_match_score < :threshold OR response_type = 'clarification' THEN 1 ELSE 0 END) AS gaps,
            AVG(top_match_score) AS avg_score
        FROM conversations
        WHERE date(created_at) >= :cutoff
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY day
    """), {"threshold": GAP_THRESHOLD, "cutoff": cutoff}).all()

    daily = [
        {
            "date": r.day,
            "conversations": r.conversations,
            "hyde_triggered": r.hyde_triggered or 0,
            "feedback_applied": r.feedback_applied or 0,
            "gaps": r.gaps or 0,
            "avg_score": round(float(r.avg_score), 3) if r.avg_score is not None else None,
        }
        for r in daily_rows
    ]

    return {"flags": flags, "totals": totals, "daily": daily}


@router.get("/intelligence")
def get_intelligence_metrics(request: Request, db: Session = Depends(get_db)):
    """OTR@K 7-day rolling average + Index Drift from _ingest dict."""
    from sqlalchemy import text as _text  # noqa: PLC0415

    cutoff = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    row = db.execute(_text("""
        SELECT AVG(otr_at_k) AS rolling_avg, COUNT(*) AS query_count
        FROM conversations
        WHERE otr_at_k IS NOT NULL
          AND date(created_at) >= :cutoff
    """), {"cutoff": cutoff}).one_or_none()

    otr_rolling_avg = round(float(row.rolling_avg), 4) if row and row.rolling_avg is not None else None
    otr_query_count = int(row.query_count) if row else 0

    # Index Drift — reads from Phase 24 _ingest dict (in-memory, resets on deploy)
    current_expert_count = len(request.app.state.metadata)
    last_rebuild_at = _ingest.get("last_rebuild_at")
    expert_count_at_rebuild = _ingest.get("expert_count_at_rebuild")

    return {
        "otr": {
            "rolling_avg_7d": otr_rolling_avg,
            "query_count_7d": otr_query_count,
        },
        "index_drift": {
            "last_rebuild_at": last_rebuild_at,
            "expert_count_at_rebuild": expert_count_at_rebuild,
            "current_expert_count": current_expert_count,
            "expert_delta": (
                current_expert_count - expert_count_at_rebuild
                if expert_count_at_rebuild is not None else None
            ),
        },
    }


# ── Embedding map ─────────────────────────────────────────────────────────────

@router.get("/embedding-map")
def get_embedding_map(request: Request):
    """
    Return t-SNE 2D projection of all expert embeddings.
    Returns HTTP 202 with {status: computing} while background task runs (up to ~30s post-startup).
    Returns HTTP 200 with {status: ready, points: [...], count: N} when ready.
    Each point: {x: float, y: float, name: str, category: str, username: str}
    """
    if not getattr(request.app.state, "tsne_ready", False):
        return JSONResponse({"status": "computing"}, status_code=202)
    return {
        "status": "ready",
        "points": request.app.state.embedding_map,
        "count": len(request.app.state.embedding_map),
    }


# ── Searches ──────────────────────────────────────────────────────────────────

@router.get("/searches")
def get_searches(
    page: int = 0,
    page_size: int = 25,
    email: Optional[str] = None,
    gap_flag: Optional[bool] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Return paginated conversation rows with gap metadata.

    Query params:
        page        — zero-based page index (default 0)
        page_size   — rows per page, typically 25 or 50 (default 25)
        email       — filter by exact email address
        gap_flag    — filter to only gaps (true) or non-gaps (false)
        score_min   — filter by minimum top_match_score
        score_max   — filter by maximum top_match_score
        date_from   — ISO date string, inclusive lower bound on created_at
        date_to     — ISO date string, inclusive upper bound on created_at

    Response shape:
        {rows: [...], total: int, page: int, page_size: int}
    """
    stmt = select(Conversation).order_by(Conversation.created_at.desc())

    if email is not None:
        stmt = stmt.where(Conversation.email == email)
    if score_min is not None:
        stmt = stmt.where(Conversation.top_match_score >= score_min)
    if score_max is not None:
        stmt = stmt.where(Conversation.top_match_score <= score_max)
    if date_from is not None:
        stmt = stmt.where(Conversation.created_at >= datetime.fromisoformat(date_from))
    if date_to is not None:
        stmt = stmt.where(Conversation.created_at <= datetime.fromisoformat(date_to))

    if gap_flag is True:
        stmt = stmt.where(
            (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
    elif gap_flag is False:
        stmt = stmt.where(
            (Conversation.top_match_score >= GAP_THRESHOLD)
            & (Conversation.response_type != "clarification")
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.scalar(count_stmt) or 0

    stmt = stmt.offset(page * page_size).limit(page_size)
    rows = db.scalars(stmt).all()

    def _serialize(row: Conversation) -> dict:
        try:
            experts = json.loads(row.response_experts or "[]")
        except Exception:
            experts = []
        return {
            "id": row.id,
            "email": row.email,
            "query": row.query,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "response_type": row.response_type,
            "match_count": len(experts),
            "top_match_score": row.top_match_score,
            "is_gap": _is_gap(row),
            "gap_resolved": row.gap_resolved,
            "response_experts": row.response_experts or "[]",
        }

    return {
        "rows": [_serialize(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ── Gaps ──────────────────────────────────────────────────────────────────────

@router.get("/gaps")
def get_gaps(db: Session = Depends(get_db)):
    """
    Return gap queries aggregated by exact query text.

    A conversation is a gap if top_match_score < GAP_THRESHOLD or response_type == 'clarification'.
    Resolved = True only when ALL conversations with that query text are resolved.

    Response shape:
        {gaps: [{id, query, frequency, best_score, resolved}]}
    """
    stmt = (
        select(
            func.min(Conversation.id).label("id"),
            Conversation.query,
            func.count(Conversation.id).label("frequency"),
            func.max(Conversation.top_match_score).label("best_score"),
            func.min(Conversation.gap_resolved.cast(Integer)).label("resolved"),
        )
        .where(
            (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
        .group_by(Conversation.query)
        .order_by(func.count(Conversation.id).desc())
    )

    rows = db.execute(stmt).all()

    gaps = [
        {
            "id": row.id,
            "query": row.query,
            "frequency": row.frequency,
            "best_score": row.best_score,
            "resolved": bool(row.resolved),
        }
        for row in rows
    ]

    return {"gaps": gaps}


class ResolveBody(BaseModel):
    resolved: bool = True


@router.post("/gaps/{gap_query}/resolve")
def resolve_gap(
    gap_query: str,
    body: ResolveBody,
    db: Session = Depends(get_db),
):
    """
    Toggle gap_resolved on all conversations matching the given query text.

    URL: POST /api/admin/gaps/{gap_query}/resolve
    Body: {resolved: bool}  (default True)

    Response: {updated: N} where N is the number of rows updated.
    """
    result = db.execute(
        update(Conversation)
        .where(Conversation.query == gap_query)
        .values(gap_resolved=body.resolved)
    )
    db.commit()
    return {"updated": result.rowcount}


# ── Leads ─────────────────────────────────────────────────────────────────────

@router.get("/leads")
def get_leads(db: Session = Depends(get_db)):
    """
    Return email-grouped lead analytics.

    Response shape:
        {leads: [{email, total_searches, last_search_at, gap_count, recent_queries}]}
    """
    rows = db.scalars(
        select(Conversation).order_by(Conversation.created_at.desc())
    ).all()

    # Group by email — rows are already sorted desc so first seen is most recent
    leads: dict[str, dict] = {}
    for row in rows:
        email = row.email
        if email not in leads:
            leads[email] = {
                "email": email,
                "total_searches": 0,
                "last_search_at": row.created_at,
                "gap_count": 0,
                "queries": [],
            }
        leads[email]["total_searches"] += 1
        if _is_gap(row):
            leads[email]["gap_count"] += 1
        leads[email]["queries"].append(row.query)

    result = []
    for lead in leads.values():
        # Collect last 3 distinct queries (list is already desc order)
        seen: list[str] = []
        for q in lead["queries"]:
            if q not in seen:
                seen.append(q)
            if len(seen) >= 3:
                break

        ts = lead["last_search_at"]
        result.append({
            "email": lead["email"],
            "total_searches": lead["total_searches"],
            "last_search_at": ts.isoformat() if ts else None,
            "gap_count": lead["gap_count"],
            "recent_queries": seen,
        })

    # Already sorted by first-seen (most recent) due to desc ordering above
    return {"leads": result}


# ── Newsletter Subscribers ────────────────────────────────────────────────────

@router.get("/newsletter-subscribers")
def get_newsletter_subscribers(db: Session = Depends(get_db)):
    """
    Return all newsletter subscribers ordered by most recent first.

    Response shape:
        {count: int, subscribers: [{email, created_at, source}]}
    """
    rows = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    ).all()
    return {
        "count": len(rows),
        "subscribers": [
            {
                "email": r.email,
                "created_at": r.created_at.isoformat(),
                "source": r.source,
            }
            for r in rows
        ],
    }


@router.get("/export/newsletter.csv")
def export_newsletter_csv(db: Session = Depends(get_db)):
    """
    Download all newsletter subscribers as CSV.

    CSV format:
        Metadata header rows (# lines)
        Blank row
        Column header row
        Data rows (ordered by most recent first)
    """
    rows = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    ).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total subscribers", len(rows)])
    writer.writerow([])
    writer.writerow(["email", "created_at", "source"])
    for r in rows:
        writer.writerow([r.email, r.created_at.isoformat(), r.source])
    filename = f"newsletter-subscribers-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Experts ───────────────────────────────────────────────────────────────────

@router.get("/experts")
def get_experts(db: Session = Depends(get_db)):
    """
    Return all experts from the experts DB table.

    Response shape:
        {experts: [{username, first_name, last_name, job_title, company, bio,
                    hourly_rate, profile_url, category}]}
    """
    experts = db.scalars(
        select(Expert).order_by(Expert.findability_score.asc().nulls_first())
    ).all()
    return {"experts": [_serialize_expert(e) for e in experts]}


@router.post("/experts/tag-all")
def tag_all(request: Request):
    """
    Run tag_experts.py in a background thread (tags + findability scores only, no FAISS rebuild).
    Returns 409 if a job is already running.
    """
    global _ingest
    if _ingest["status"] == "running":
        raise HTTPException(status_code=409, detail="Job already running")
    _ingest["status"] = "running"
    thread = threading.Thread(target=_run_tag_job, daemon=True)
    thread.start()
    return {"status": "started"}


@router.post("/ingest/run")
async def ingest_run(request: Request):
    """
    Trigger tag_experts.py + ingest.py in a background thread, then hot-reload FAISS.
    Returns 409 if a job is already running.
    asyncio.Lock prevents concurrent invocations causing OOM on Railway.
    """
    global _ingest
    async with _ingest_lock:
        if _ingest["status"] == "running":
            raise HTTPException(status_code=409, detail="Ingest job already running")
        _ingest["status"] = "running"
    thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
    thread.start()
    return {"status": "started"}


@router.get("/ingest/status")
def ingest_status():
    """Return the current ingest job state."""
    return _ingest


@router.get("/domain-map")
def get_domain_map(db: Session = Depends(get_db)):
    """
    Return top-10 expert tag domains by frequency in downvoted results.
    Joins downvoted Feedback rows to Expert tags via profile_url lookup.
    Response: {"domains": [{"domain": str, "count": int}]}
    """
    from collections import Counter

    # Fetch only expert_ids column from downvoted feedback rows
    downvote_expert_ids = db.scalars(
        select(Feedback.expert_ids).where(Feedback.vote == "down")
    ).all()

    # Parse URLs/names from each row's JSON list
    url_set: set[str] = set()
    for raw in downvote_expert_ids:
        for entry in json.loads(raw or "[]"):
            url_set.add(entry)

    if not url_set:
        return {"domains": []}

    # Look up experts by profile_url — name-only fallback entries will not match (acceptable)
    experts = db.scalars(
        select(Expert).where(Expert.profile_url.in_(list(url_set)))
    ).all()

    # Count tag frequency across all matched experts
    tag_counter: Counter = Counter()
    for expert in experts:
        for tag in json.loads(expert.tags or "[]"):
            tag_counter[tag.lower().strip()] += 1

    return {
        "domains": [
            {"domain": d, "count": c}
            for d, c in tag_counter.most_common(10)
        ]
    }


class ClassifyBody(BaseModel):
    category: str


@router.post("/experts/{username}/classify")
def classify_expert(username: str, body: ClassifyBody, db: Session = Depends(get_db)):
    """
    Set the category on a single expert in the DB.

    Response: {"ok": True}
    """
    expert = db.scalar(select(Expert).where(Expert.username == username))
    if not expert:
        raise HTTPException(status_code=404, detail=f"Expert '{username}' not found")
    expert.category = body.category
    db.commit()
    return {"ok": True}


@router.post("/experts/auto-classify")
def auto_classify_experts(db: Session = Depends(get_db)):
    """
    Keyword-match job_title against CATEGORY_KEYWORDS for all unclassified experts.
    Sets category only where not already set.

    Response: {"classified": int, "categories": {username: category}}
    """
    unclassified = db.scalars(
        select(Expert).where(Expert.category.is_(None))
    ).all()

    classified = 0
    categories: dict[str, str] = {}

    for expert in unclassified:
        cat = _auto_categorize(expert.job_title)
        if cat:
            expert.category = cat
            classified += 1
            categories[expert.username] = cat

    if classified:
        db.commit()

    return {"classified": classified, "categories": categories}


def _retry_tag_expert_background(expert_id: int) -> None:
    """
    Background retry for auto-tagging when synchronous Gemini call fails.
    Called by BackgroundTasks — runs after response is sent.
    Uses sync tagging (tag_expert_sync) which uses the sync google-genai client.
    """
    from app.database import SessionLocal  # noqa: PLC0415 — local import avoids circular at module load

    try:
        with SessionLocal() as db:
            from sqlalchemy import select  # noqa: PLC0415
            from app.models import Expert  # noqa: PLC0415
            expert = db.scalar(select(Expert).where(Expert.id == expert_id))
            if not expert or not (expert.bio or "").strip():
                return  # No bio — skip tagging, findability already computed
            tags = tag_expert_sync(expert)
            score = compute_findability_score(expert, tags)
            expert.tags = json.dumps(tags)
            expert.findability_score = score
            db.commit()
    except Exception as e:
        log.error("background_tag_retry.failed", expert_id=expert_id, error=str(e))


class AddExpertBody(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    bio: str
    hourly_rate: float
    profile_url: Optional[str] = None


@router.post("/experts")
def add_expert(body: AddExpertBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Add a new expert to the DB and append to experts.csv for FAISS ingestion.

    Response: {"ok": True, "username": str}
    """
    existing = db.scalar(select(Expert).where(Expert.username == body.username))
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    profile_url = body.profile_url or f"https://tinrate.com/u/{body.username}"
    profile_url_utm = (
        f"https://tinrate.com/u/{body.username}/"
        "?utm_source=chat&utm_medium=search&utm_campaign=chat"
    )

    new_expert = Expert(
        username=body.username,
        email="",
        first_name=body.first_name,
        last_name=body.last_name,
        job_title=body.job_title,
        company=body.company,
        bio=body.bio,
        hourly_rate=body.hourly_rate,
        currency="EUR",
        profile_url=profile_url,
        profile_url_utm=profile_url_utm,
        category=_auto_categorize(body.job_title),
    )
    db.add(new_expert)
    db.commit()
    db.refresh(new_expert)

    # Auto-tag: synchronous Gemini call if expert has a bio
    if (new_expert.bio or "").strip():
        try:
            tags = tag_expert_sync(new_expert)
            score = compute_findability_score(new_expert, tags)
            new_expert.tags = json.dumps(tags)
            new_expert.findability_score = score
            db.commit()
        except Exception as e:
            log.warning(
                "add_expert.tagging_failed_scheduling_retry",
                username=body.username,
                error=str(e),
            )
            # Save expert with tags=null; schedule background retry
            background_tasks.add_task(_retry_tag_expert_background, new_expert.id)
    else:
        # No bio — compute findability score only (0 pts for bio + tags components)
        new_expert.findability_score = compute_findability_score(new_expert, tags=None)
        db.commit()

    # Also append to experts.csv so the FAISS pipeline can pick it up
    csv_exists = EXPERTS_CSV_PATH.exists()
    with open(EXPERTS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        fieldnames = [
            "Email", "Username", "First Name", "Last Name", "Job Title",
            "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
            "Profile URL with UTM", "Created At",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not csv_exists:
            writer.writeheader()
        writer.writerow({
            "Email": "",
            "Username": body.username,
            "First Name": body.first_name,
            "Last Name": body.last_name,
            "Job Title": body.job_title,
            "Company": body.company,
            "Bio": body.bio,
            "Hourly Rate": body.hourly_rate,
            "Currency": "EUR",
            "Profile URL": profile_url,
            "Profile URL with UTM": profile_url_utm,
            "Created At": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        })

    return {
        "ok": True,
        "username": body.username,
        "tags": json.loads(new_expert.tags or "null"),
        "findability_score": new_expert.findability_score,
    }


@router.post("/experts/import-csv")
async def import_experts_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Bulk-import experts from a CSV file with upsert behaviour.

    Accepts the same column layout as data/experts.csv:
        Email, Username, First Name, Last Name, Job Title, Company, Bio,
        Hourly Rate, Currency, Profile URL, Profile URL with UTM

    For existing usernames: updates basic fields, preserves tags + findability_score.
    For new usernames: inserts new Expert row.
    Rows with no Username are skipped.

    Response: {"inserted": N, "updated": N, "skipped": N}
    """
    content = await file.read()
    text = content.decode("utf-8-sig")  # handles UTF-8 BOM from Excel exports
    reader = csv.DictReader(io.StringIO(text))

    inserted = updated = skipped = 0

    for row in reader:
        username = (row.get("Username") or "").strip()
        if not username:
            skipped += 1
            continue

        try:
            hourly_rate = float(row.get("Hourly Rate") or 0)
        except (ValueError, TypeError):
            hourly_rate = 0.0

        existing = db.scalar(select(Expert).where(Expert.username == username))

        if existing:
            existing.email = (row.get("Email") or "").strip()
            existing.first_name = (row.get("First Name") or "").strip()
            existing.last_name = (row.get("Last Name") or "").strip()
            existing.job_title = (row.get("Job Title") or "").strip()
            existing.company = (row.get("Company") or "").strip()
            existing.bio = (row.get("Bio") or "").strip()
            existing.hourly_rate = hourly_rate
            existing.currency = (row.get("Currency") or "EUR").strip()
            existing.profile_url = (row.get("Profile URL") or "").strip()
            existing.profile_url_utm = (row.get("Profile URL with UTM") or "").strip()
            # Intentionally preserve existing.tags and existing.findability_score
            updated += 1
        else:
            profile_url = (row.get("Profile URL") or f"https://tinrate.com/u/{username}").strip()
            profile_url_utm = (row.get("Profile URL with UTM") or "").strip()
            db.add(Expert(
                username=username,
                email=(row.get("Email") or "").strip(),
                first_name=(row.get("First Name") or "").strip(),
                last_name=(row.get("Last Name") or "").strip(),
                job_title=(row.get("Job Title") or "").strip(),
                company=(row.get("Company") or "").strip(),
                bio=(row.get("Bio") or "").strip(),
                hourly_rate=hourly_rate,
                currency=(row.get("Currency") or "EUR").strip(),
                profile_url=profile_url,
                profile_url_utm=profile_url_utm,
                category=_auto_categorize((row.get("Job Title") or "").strip()),
            ))
            inserted += 1

    db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


# ── CSV Exports ───────────────────────────────────────────────────────────────

@router.get("/export/searches.csv")
def export_searches_csv(
    filtered: bool = False,
    page: int = 0,
    page_size: int = 25,
    email: Optional[str] = None,
    gap_flag: Optional[bool] = None,
    score_min: Optional[float] = None,
    score_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Download all (or filtered) conversation rows as CSV.

    Query params:
        filtered — if True, apply filter params; if False, export all rows
        (other params same as /searches)

    CSV format:
        Metadata header rows (# lines)
        Blank row
        Column header row
        Data rows
    """
    stmt = select(Conversation).order_by(Conversation.created_at.desc())

    if filtered:
        if email is not None:
            stmt = stmt.where(Conversation.email == email)
        if score_min is not None:
            stmt = stmt.where(Conversation.top_match_score >= score_min)
        if score_max is not None:
            stmt = stmt.where(Conversation.top_match_score <= score_max)
        if date_from is not None:
            stmt = stmt.where(Conversation.created_at >= datetime.fromisoformat(date_from))
        if date_to is not None:
            stmt = stmt.where(Conversation.created_at <= datetime.fromisoformat(date_to))
        if gap_flag is True:
            stmt = stmt.where(
                (Conversation.top_match_score < GAP_THRESHOLD)
                | (Conversation.response_type == "clarification")
            )
        elif gap_flag is False:
            stmt = stmt.where(
                (Conversation.top_match_score >= GAP_THRESHOLD)
                & (Conversation.response_type != "clarification")
            )

    rows = db.scalars(stmt).all()

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Filter applied", "yes" if filtered else "all"])
    writer.writerow(["# Total rows", len(rows)])
    writer.writerow([])

    writer.writerow(
        ["id", "email", "query", "created_at", "response_type", "match_count",
         "top_match_score", "is_gap", "gap_resolved"]
    )

    for row in rows:
        try:
            experts = json.loads(row.response_experts or "[]")
        except Exception:
            experts = []
        writer.writerow([
            row.id,
            row.email,
            row.query,
            row.created_at.isoformat() if row.created_at else "",
            row.response_type,
            len(experts),
            row.top_match_score,
            _is_gap(row),
            row.gap_resolved,
        ])

    filename = f"searches-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Settings ──────────────────────────────────────────────────────────────────

SETTINGS_SCHEMA: dict[str, dict] = {
    "QUERY_EXPANSION_ENABLED": {
        "type": "bool",
        "description": "Enable HyDE query expansion for weak queries",
        "env_default": "false",
    },
    "FEEDBACK_LEARNING_ENABLED": {
        "type": "bool",
        "description": "Enable feedback-weighted re-ranking of search results",
        "env_default": "false",
    },
    "SIMILARITY_THRESHOLD": {
        "type": "float",
        "description": "Minimum FAISS score to consider a result strong (0.0–1.0)",
        "env_default": "0.60",
        "min": 0.0,
        "max": 1.0,
    },
    "STRONG_RESULT_MIN": {
        "type": "int",
        "description": "Minimum strong results before HyDE expansion fires (1–10)",
        "env_default": "3",
        "min": 1,
        "max": 10,
    },
    "FEEDBACK_BOOST_CAP": {
        "type": "float",
        "description": "Maximum feedback score multiplier offset (0.0–0.50)",
        "env_default": "0.20",
        "min": 0.0,
        "max": 0.50,
    },
}


class SettingUpdate(BaseModel):
    key: str
    value: str  # Always accepted as string; validation converts to native type


def _validate_setting(key: str, value: str) -> None:
    """Raise HTTPException 400 if key is unknown or value is out of range."""
    if key not in SETTINGS_SCHEMA:
        valid_keys = ", ".join(SETTINGS_SCHEMA.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting key '{key}'. Valid keys: {valid_keys}",
        )
    schema = SETTINGS_SCHEMA[key]
    stype = schema["type"]
    try:
        if stype == "bool":
            if value.lower().strip() not in ("true", "false", "1", "0"):
                raise ValueError(f"must be true/false/1/0, got '{value}'")
        elif stype == "float":
            fval = float(value)
            if "min" in schema and fval < schema["min"]:
                raise ValueError(f"must be >= {schema['min']}, got {fval}")
            if "max" in schema and fval > schema["max"]:
                raise ValueError(f"must be <= {schema['max']}, got {fval}")
        elif stype == "int":
            ival = int(value)
            if "min" in schema and ival < schema["min"]:
                raise ValueError(f"must be >= {schema['min']}, got {ival}")
            if "max" in schema and ival > schema["max"]:
                raise ValueError(f"must be <= {schema['max']}, got {ival}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid value for '{key}': {exc}") from exc


def _coerce_value(key: str, raw: str):
    """Convert raw string DB value to native Python type for the response."""
    stype = SETTINGS_SCHEMA[key]["type"]
    if stype == "bool":
        return raw.lower().strip() in ("true", "1", "yes")
    if stype == "float":
        return float(raw)
    if stype == "int":
        return int(raw)
    return raw


@router.get("/settings")
def get_settings_endpoint(db: Session = Depends(get_db)):
    """
    Return all 5 intelligence settings with current value and source.

    source:
        "db"      — value comes from the settings table (DB override active)
        "env"     — no DB row exists; value comes from Railway env var
        "default" — no DB row and no env var; using hardcoded default
    """
    from app.models import AppSetting  # deferred import avoids circular import at startup

    db_rows = {row.key: row.value for row in db.scalars(select(AppSetting)).all()}
    result = []
    for key, schema in SETTINGS_SCHEMA.items():
        if key in db_rows:
            raw = db_rows[key]
            source = "db"
        elif os.getenv(key) is not None:
            raw = os.environ[key]
            source = "env"
        else:
            raw = schema["env_default"]
            source = "default"
        entry: dict = {
            "key": key,
            "value": _coerce_value(key, raw),
            "raw": raw,
            "source": source,
            "type": schema["type"],
            "description": schema["description"],
        }
        if "min" in schema:
            entry["min"] = schema["min"]
        if "max" in schema:
            entry["max"] = schema["max"]
        result.append(entry)
    return {"settings": result}


@router.post("/settings")
def update_setting(body: SettingUpdate, db: Session = Depends(get_db)):
    """
    Write or overwrite a single setting in the DB.

    Accepts a single key/value pair. The value is always stored as a string.
    Returns the updated setting entry.
    POST /api/admin/settings with {"key": "QUERY_EXPANSION_ENABLED", "value": "true"}
    """
    from app.models import AppSetting  # deferred import
    import datetime as _dt

    _validate_setting(body.key, body.value)

    # db.merge() performs INSERT or UPDATE based on primary key match.
    # AppSetting.key is the primary key — merge upserts cleanly.
    setting = db.merge(AppSetting(
        key=body.key,
        value=body.value,
        updated_at=_dt.datetime.utcnow(),
    ))
    db.commit()
    db.refresh(setting)

    log.info("admin.settings.updated", key=body.key, value=body.value)
    return {
        "key": setting.key,
        "value": _coerce_value(setting.key, setting.value),
        "raw": setting.value,
        "source": "db",
        "updated_at": setting.updated_at.isoformat(),
    }


@router.get("/export/gaps.csv")
def export_gaps_csv(db: Session = Depends(get_db)):
    """
    Download all gap aggregates as CSV.

    CSV format:
        Metadata header rows (# lines)
        Blank row
        Column header row
        Data rows (aggregated by query text)
    """
    stmt = (
        select(
            Conversation.query,
            func.count(Conversation.id).label("frequency"),
            func.max(Conversation.top_match_score).label("best_score"),
            func.min(Conversation.gap_resolved.cast(Integer)).label("resolved"),
        )
        .where(
            (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
        .group_by(Conversation.query)
        .order_by(func.count(Conversation.id).desc())
    )

    rows = db.execute(stmt).all()

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total gap queries", len(rows)])
    writer.writerow([])

    writer.writerow(["query", "frequency", "best_score", "resolved"])

    for row in rows:
        writer.writerow([row.query, row.frequency, row.best_score, bool(row.resolved)])

    filename = f"gaps-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# --- Marketplace Intelligence endpoints ---

@router.get("/events/demand")
def get_demand(days: int = 30, page: int = 0, page_size: int = 25, db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    # Cold-start check
    earliest = db.execute(_text("SELECT MIN(created_at) FROM user_events")).scalar()
    data_since = earliest  # None if table empty, ISO string otherwise

    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "2000-01-01"

    total_row = db.execute(_text("""
        SELECT COUNT(DISTINCT json_extract(payload, '$.query_text')) AS cnt
        FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          AND date(created_at) >= :cutoff
    """), {"cutoff": cutoff}).scalar()
    total = total_row or 0

    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency,
            MAX(created_at) AS last_seen,
            COUNT(DISTINCT session_id) AS unique_users
        FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          AND date(created_at) >= :cutoff
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
        LIMIT :limit OFFSET :offset
    """), {"cutoff": cutoff, "limit": page_size, "offset": page * page_size}).all()

    return {
        "data_since": data_since,
        "demand": [{"query_text": r.query_text, "frequency": r.frequency, "last_seen": r.last_seen, "unique_users": r.unique_users} for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/events/exposure")
def get_exposure(days: int = 30, db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    earliest = db.execute(_text("SELECT MIN(created_at) FROM user_events")).scalar()
    data_since = earliest

    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "2000-01-01"

    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.expert_id') AS expert_id,
            COUNT(*) AS total_clicks,
            SUM(CASE WHEN json_extract(payload, '$.context') = 'grid' THEN 1 ELSE 0 END) AS grid_clicks,
            SUM(CASE WHEN json_extract(payload, '$.context') = 'sage_panel' THEN 1 ELSE 0 END) AS sage_clicks
        FROM user_events
        WHERE event_type = 'card_click'
          AND date(created_at) >= :cutoff
        GROUP BY json_extract(payload, '$.expert_id')
        HAVING total_clicks > 0
        ORDER BY total_clicks DESC
    """), {"cutoff": cutoff}).all()

    return {
        "data_since": data_since,
        "exposure": [{"expert_id": r.expert_id, "total_clicks": r.total_clicks, "grid_clicks": r.grid_clicks, "sage_clicks": r.sage_clicks} for r in rows],
    }


@router.get("/events/trend")
def get_trend(db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    earliest = db.execute(_text("SELECT MIN(created_at) FROM user_events")).scalar()
    data_since = earliest

    cutoff_14d = (datetime.utcnow() - timedelta(days=14)).strftime("%Y-%m-%d")
    cutoff_28d = (datetime.utcnow() - timedelta(days=28)).strftime("%Y-%m-%d")

    daily_rows = db.execute(_text("""
        SELECT
            strftime('%Y-%m-%d', created_at) AS day,
            COUNT(*) AS total,
            SUM(CASE WHEN json_extract(payload, '$.zero_results') = 1 THEN 1 ELSE 0 END) AS zero_results,
            SUM(CASE WHEN json_extract(payload, '$.zero_results') = 0 THEN 1 ELSE 0 END) AS hits
        FROM user_events
        WHERE event_type = 'sage_query'
          AND date(created_at) >= :cutoff
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY day
    """), {"cutoff": cutoff_14d}).all()

    current_total = db.execute(_text("""
        SELECT COUNT(*) FROM user_events
        WHERE event_type = 'sage_query' AND date(created_at) >= :cutoff
    """), {"cutoff": cutoff_14d}).scalar() or 0

    current_zero = db.execute(_text("""
        SELECT COUNT(*) FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          AND date(created_at) >= :cutoff
    """), {"cutoff": cutoff_14d}).scalar() or 0

    prior_total = db.execute(_text("""
        SELECT COUNT(*) FROM user_events
        WHERE event_type = 'sage_query'
          AND date(created_at) >= :prior AND date(created_at) < :cutoff
    """), {"prior": cutoff_28d, "cutoff": cutoff_14d}).scalar() or 0

    zero_result_rate = round(current_zero / current_total * 100, 1) if current_total > 0 else 0.0

    return {
        "data_since": data_since,
        "daily": [{"day": r.day, "total": r.total, "hits": r.hits, "zero_results": r.zero_results} for r in daily_rows],
        "kpis": {
            "total_queries": current_total,
            "zero_result_rate": zero_result_rate,
            "prior_period_total": prior_total,
        },
    }


@router.get("/export/demand.csv")
def export_demand_csv(days: int = 30, db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "2000-01-01"
    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency,
            MAX(created_at) AS last_seen,
            COUNT(DISTINCT session_id) AS unique_users
        FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          AND date(created_at) >= :cutoff
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
    """), {"cutoff": cutoff}).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Days window", days])
    writer.writerow([])
    writer.writerow(["query_text", "frequency", "last_seen", "unique_users"])
    for r in rows:
        writer.writerow([r.query_text or "", r.frequency, r.last_seen or "", r.unique_users])

    filename = f"demand-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/exposure.csv")
def export_exposure_csv(days: int = 30, db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "2000-01-01"
    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.expert_id') AS expert_id,
            COUNT(*) AS total_clicks,
            SUM(CASE WHEN json_extract(payload, '$.context') = 'grid' THEN 1 ELSE 0 END) AS grid_clicks,
            SUM(CASE WHEN json_extract(payload, '$.context') = 'sage_panel' THEN 1 ELSE 0 END) AS sage_clicks
        FROM user_events
        WHERE event_type = 'card_click'
          AND date(created_at) >= :cutoff
        GROUP BY json_extract(payload, '$.expert_id')
        HAVING total_clicks > 0
        ORDER BY total_clicks DESC
    """), {"cutoff": cutoff}).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Days window", days])
    writer.writerow([])
    writer.writerow(["expert_id", "total_clicks", "grid_clicks", "sage_clicks"])
    for r in rows:
        writer.writerow([r.expert_id or "", r.total_clicks, r.grid_clicks, r.sage_clicks])

    filename = f"exposure-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Search Lab A/B Compare ────────────────────────────────────────────────────

_LAB_CONFIGS = {
    "baseline": {"QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": False},
    "hyde":     {"QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": False},
    "feedback": {"QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": True},
    "full":     {"QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": True},
}

_LAB_LABELS = {
    "baseline": "Baseline",
    "hyde":     "HyDE Only",
    "feedback": "Feedback Only",
    "full":     "Full Intelligence",
}


class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    configs: list[str] = Field(
        default=["baseline", "hyde", "feedback", "full"],
        description="Which preset configs to run. Valid values: baseline, hyde, feedback, full.",
    )
    result_count: int = Field(default=20, ge=1, le=50)
    overrides: dict[str, bool] = Field(
        default_factory=dict,
        description=(
            "Per-run flag overrides applied on top of DB settings. "
            "Keys: QUERY_EXPANSION_ENABLED, FEEDBACK_LEARNING_ENABLED."
        ),
    )


def _retrieve_for_lab(
    query: str,
    faiss_index,
    metadata: list[dict],
    db,
    config_flags: dict,
    result_count: int,
) -> tuple[list, dict]:
    """
    Run retrieval for a single lab config without writing to the DB.

    1. Reads current DB settings via get_settings(db).
    2. Merges config_flags on top (preset + per-run overrides). DB is NOT written.
    3. Runs the same logic as retrieve_with_intelligence() but uses the merged
       settings dict directly instead of reading the DB a second time.
    4. Returns (candidates[:result_count], intelligence_meta).
    """
    settings = get_settings(db)
    settings.update(config_flags)

    # Step 1: Initial FAISS retrieval
    candidates = retrieve(query, faiss_index, metadata)
    intelligence: dict = {
        "hyde_triggered": False,
        "hyde_bio": None,
        "feedback_applied": False,
    }

    # Step 2: HyDE expansion — only when enabled and query is weak
    if settings["QUERY_EXPANSION_ENABLED"] and _is_weak_query(  # noqa: PLC2701
        candidates, settings["STRONG_RESULT_MIN"], settings["SIMILARITY_THRESHOLD"]
    ):
        bio = _generate_hypothetical_bio(query)  # noqa: PLC2701
        if bio is not None:
            from app.services.embedder import embed_query  # noqa: PLC0415
            original_vec = embed_query(query)
            blended_vec = _blend_embeddings(original_vec, bio)  # noqa: PLC2701
            hyde_candidates = _search_with_vector(blended_vec, faiss_index, metadata)  # noqa: PLC2701
            candidates = _merge_candidates(candidates, hyde_candidates)  # noqa: PLC2701
            intelligence["hyde_triggered"] = True
            intelligence["hyde_bio"] = bio

    # Step 3: Feedback re-ranking — only when enabled
    if settings["FEEDBACK_LEARNING_ENABLED"]:
        candidates = _apply_feedback_boost(candidates, db, settings["FEEDBACK_BOOST_CAP"])  # noqa: PLC2701
        intelligence["feedback_applied"] = True

    return candidates[:result_count], intelligence


@router.post("/compare")
def compare_configs(
    body: CompareRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Run a query through up to 4 intelligence configs in parallel and return
    ranked expert results for each config without writing to the DB.

    Request body:
        query        — natural language query (1-2000 chars)
        configs      — list of preset names (default: all 4)
        result_count — max experts to return per config (1-50, default 20)
        overrides    — per-run flag overrides (applied on top of each preset)

    Response shape:
        {"columns": [...], "query": str, "overrides_applied": {}}

    Each column:
        {"config": str, "label": str, "experts": [...], "intelligence": {...}}
    """
    # Validate config names
    unknown = [c for c in body.configs if c not in _LAB_CONFIGS]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown config(s): {unknown}. Valid values: {list(_LAB_CONFIGS.keys())}",
        )

    faiss_index = request.app.state.faiss_index
    metadata = request.app.state.metadata

    # Build per-config flag dicts: preset merged with per-run overrides
    config_flag_pairs = [
        (name, {**_LAB_CONFIGS[name], **body.overrides})
        for name in body.configs
    ]

    # Run all configs in parallel using ThreadPoolExecutor.
    # Each thread gets its own Session — SQLAlchemy Sessions are not thread-safe.
    def _run_one(args):
        name, flags = args
        thread_db = SessionLocal()
        try:
            candidates, intelligence = _retrieve_for_lab(
                body.query, faiss_index, metadata, thread_db, flags, body.result_count
            )
        finally:
            thread_db.close()
        return name, candidates, intelligence

    with ThreadPoolExecutor(max_workers=len(config_flag_pairs)) as executor:
        results = list(executor.map(_run_one, config_flag_pairs))

    # Serialize columns
    columns = []
    for name, candidates, intelligence in results:
        columns.append({
            "config": name,
            "label": _LAB_LABELS[name],
            "experts": [
                {
                    "rank": i + 1,
                    "name": c.name,
                    "title": c.title,
                    "score": round(c.score, 4),
                    "profile_url": c.profile_url,
                }
                for i, c in enumerate(candidates)
            ],
            "intelligence": intelligence,
        })

    return {"columns": columns, "query": body.query, "overrides_applied": body.overrides}
