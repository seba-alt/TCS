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
"""
import csv
import io
import json
import os
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import Integer, func, select, update
from sqlalchemy.orm import Session

from app.config import METADATA_PATH
from app.database import get_db
from app.models import Conversation, Feedback

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


def _serialize_expert(e: dict) -> dict:
    return {
        "username": e.get("Username", ""),
        "first_name": e.get("First Name", ""),
        "last_name": e.get("Last Name", ""),
        "job_title": e.get("Job Title", ""),
        "company": e.get("Company", ""),
        "bio": e.get("Bio", ""),
        "hourly_rate": e.get("Hourly Rate", 0),
        "profile_url": e.get("Profile URL", ""),
        "category": e.get("category"),
    }


def _load_metadata() -> list:
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_metadata(metadata: list) -> None:
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


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


# ── Experts ───────────────────────────────────────────────────────────────────

@router.get("/experts")
def get_experts(request: Request):
    """
    Return all experts from in-memory metadata (loaded at startup).

    Response shape:
        {experts: [{username, first_name, last_name, job_title, company, bio,
                    hourly_rate, profile_url, category}]}
    """
    metadata: list = request.app.state.metadata
    return {"experts": [_serialize_expert(e) for e in metadata]}


class ClassifyBody(BaseModel):
    category: str


@router.post("/experts/{username}/classify")
def classify_expert(username: str, body: ClassifyBody, request: Request):
    """
    Set the category field on a single expert in metadata.json.

    Response: {"ok": True}
    """
    metadata = _load_metadata()
    for expert in metadata:
        if expert.get("Username") == username:
            expert["category"] = body.category
            _save_metadata(metadata)
            request.app.state.metadata = metadata
            return {"ok": True}
    raise HTTPException(status_code=404, detail=f"Expert '{username}' not found")


@router.post("/experts/auto-classify")
def auto_classify_experts(request: Request):
    """
    Keyword-match job_title against CATEGORY_KEYWORDS for all experts without a category.
    Sets category only where not already set.

    Response: {"classified": int, "categories": {username: category}}
    """
    metadata = _load_metadata()
    classified = 0
    categories: dict[str, str] = {}

    for expert in metadata:
        if expert.get("category"):
            continue  # Already classified
        jt = expert.get("Job Title", "")
        cat = _auto_categorize(jt)
        if cat:
            expert["category"] = cat
            classified += 1
            categories[expert.get("Username", "")] = cat

    if classified:
        _save_metadata(metadata)
        request.app.state.metadata = metadata

    return {"classified": classified, "categories": categories}


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
def add_expert(body: AddExpertBody, request: Request):
    """
    Append a new expert to metadata.json and experts.csv.

    Response: {"ok": True, "username": str}
    """
    metadata = _load_metadata()

    if any(e.get("Username") == body.username for e in metadata):
        raise HTTPException(status_code=400, detail="Username already exists")

    profile_url = body.profile_url or f"https://tinrate.com/u/{body.username}"
    profile_url_utm = (
        f"https://tinrate.com/u/{body.username}/"
        "?utm_source=chat&utm_medium=search&utm_campaign=chat"
    )

    new_expert: dict = {
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
    }

    # Append to metadata.json and update in-memory state
    metadata.append(new_expert)
    _save_metadata(metadata)
    request.app.state.metadata = metadata

    # Append to experts.csv
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
        writer.writerow({k: new_expert.get(k, "") for k in fieldnames})

    return {"ok": True, "username": body.username}


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
