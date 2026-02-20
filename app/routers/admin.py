"""
/api/admin/* — Analytics dashboard endpoints for admin use.

All endpoints require X-Admin-Key header matching the ADMIN_SECRET env var.
Returns 401 for missing or incorrect key.

Endpoints:
    GET  /api/admin/stats                   — aggregate counts (total, match, gap)
    GET  /api/admin/searches                — paginated conversation rows with gap flag
    GET  /api/admin/gaps                    — gap queries grouped by frequency
    POST /api/admin/gaps/{gap_query}/resolve — mark all matching conversations resolved
    GET  /api/admin/export/searches.csv     — CSV download of conversations
    GET  /api/admin/export/gaps.csv         — CSV download of gap aggregates
"""
import csv
import io
import json
import os
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import Integer, func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation

# ── Auth ─────────────────────────────────────────────────────────────────────

_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

GAP_THRESHOLD = 0.60  # Matches SIMILARITY_THRESHOLD in retriever.py


def _require_admin(api_key: Optional[str] = Security(_api_key_header)) -> str:
    """Dependency: validate X-Admin-Key against ADMIN_SECRET env var."""
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or not api_key or api_key != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-Key header",
        )
    return api_key


router = APIRouter(prefix="/api/admin", dependencies=[Depends(_require_admin)])


# ── Helper ────────────────────────────────────────────────────────────────────

def _is_gap(row: Conversation) -> bool:
    """Return True if the conversation qualifies as a gap."""
    return (
        row.top_match_score is not None and row.top_match_score < GAP_THRESHOLD
    ) or row.response_type == "clarification"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """
    Return aggregate search metrics.

    Response shape:
        {total_searches, match_count, match_rate, gap_count}
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

    return {
        "total_searches": total,
        "match_count": match_count,
        "match_rate": match_rate,
        "gap_count": gap_count,
    }


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

    # For gap_flag filter we need to compute is_gap inline
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

    # Count total before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.scalar(count_stmt) or 0

    # Apply pagination
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
        }

    return {
        "rows": [_serialize(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


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

    # Metadata header rows
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Filter applied", "yes" if filtered else "all"])
    writer.writerow(["# Total rows", len(rows)])
    writer.writerow([])  # blank separator

    # Column headers
    writer.writerow(
        ["id", "email", "query", "created_at", "response_type", "match_count",
         "top_match_score", "is_gap", "gap_resolved"]
    )

    # Data rows
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

    # Metadata header rows
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total gap queries", len(rows)])
    writer.writerow([])  # blank separator

    # Column headers
    writer.writerow(["query", "frequency", "best_score", "resolved"])

    # Data rows
    for row in rows:
        writer.writerow([row.query, row.frequency, row.best_score, bool(row.resolved)])

    filename = f"gaps-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
