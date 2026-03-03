"""
Admin analytics endpoints: /stats, /searches, /gaps, /gaps/{id}/resolve, /analytics-summary.
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Integer, func, select, text as _text, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Expert, Feedback, LeadClick
from app.routers.admin._common import GAP_THRESHOLD, _is_gap

router = APIRouter()


@router.get("/stats")
def get_stats(days: int = 0, db: Session = Depends(get_db)):
    """
    Return aggregate search metrics plus top queries and feedback.
    When days > 0, scope aggregate counts to that time window.
    """
    date_filter = None
    if days > 0:
        date_filter = datetime.utcnow() - timedelta(days=days)

    total_stmt = select(func.count()).select_from(Conversation)
    if date_filter:
        total_stmt = total_stmt.where(Conversation.created_at >= date_filter)
    total = db.scalar(total_stmt) or 0

    match_stmt = select(func.count()).select_from(Conversation).where(
        Conversation.response_type == "match"
    )
    if date_filter:
        match_stmt = match_stmt.where(Conversation.created_at >= date_filter)
    match_count = db.scalar(match_stmt) or 0

    gap_stmt = select(func.count()).select_from(Conversation).where(
        (Conversation.top_match_score.is_(None))
        | (Conversation.top_match_score < GAP_THRESHOLD)
        | (Conversation.response_type == "clarification")
    )
    if date_filter:
        gap_stmt = gap_stmt.where(Conversation.created_at >= date_filter)
    gap_count = db.scalar(gap_stmt) or 0

    match_rate = round(match_count / total, 3) if total else 0.0

    # Top 10 most searched queries
    top_q_stmt = (
        select(Conversation.query, func.count(Conversation.id).label("count"))
        .group_by(Conversation.query)
        .order_by(func.count(Conversation.id).desc())
        .limit(10)
    )
    if date_filter:
        top_q_stmt = top_q_stmt.where(Conversation.created_at >= date_filter)
    top_q_rows = db.execute(top_q_stmt).all()
    top_queries = [{"query": r.query, "count": r.count} for r in top_q_rows]

    # Top 10 query+vote combos
    top_fb_stmt = (
        select(
            Conversation.query,
            Feedback.vote,
            func.count(Feedback.id).label("count"),
        )
        .join(Feedback, Feedback.conversation_id == Conversation.id)
        .group_by(Conversation.query, Feedback.vote)
        .order_by(func.count(Feedback.id).desc())
        .limit(10)
    )
    if date_filter:
        top_fb_stmt = top_fb_stmt.where(Conversation.created_at >= date_filter)
    top_fb_rows = db.execute(top_fb_stmt).all()
    top_feedback = [{"query": r.query, "vote": r.vote, "count": r.count} for r in top_fb_rows]

    # Phase 48: Total leads (distinct emails), expert pool, 7-day trends
    leads_stmt = (
        select(func.count(func.distinct(Conversation.email)))
        .select_from(Conversation)
        .where(Conversation.email != "")
        .where(Conversation.email.is_not(None))
    )
    if date_filter:
        leads_stmt = leads_stmt.where(Conversation.created_at >= date_filter)
    total_leads = db.scalar(leads_stmt) or 0

    expert_pool = db.scalar(
        select(func.count()).select_from(Expert).where(Expert.first_name != "")
    ) or 0

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    fourteen_days_ago = datetime.utcnow() - timedelta(days=14)

    leads_7d = db.scalar(
        select(func.count(func.distinct(Conversation.email)))
        .select_from(Conversation)
        .where(Conversation.email != "")
        .where(Conversation.email.is_not(None))
        .where(Conversation.created_at >= seven_days_ago)
    ) or 0

    leads_prior_7d = db.scalar(
        select(func.count(func.distinct(Conversation.email)))
        .select_from(Conversation)
        .where(Conversation.email != "")
        .where(Conversation.email.is_not(None))
        .where(Conversation.created_at >= fourteen_days_ago)
        .where(Conversation.created_at < seven_days_ago)
    ) or 0

    expert_pool_7d = 0

    lead_rate = round(total_leads / max(total, 1), 3)

    return {
        "total_searches": total,
        "match_count": match_count,
        "match_rate": match_rate,
        "gap_count": gap_count,
        "top_queries": top_queries,
        "top_feedback": top_feedback,
        "total_leads": total_leads,
        "expert_pool": expert_pool,
        "leads_7d": leads_7d,
        "leads_prior_7d": leads_prior_7d,
        "expert_pool_7d": expert_pool_7d,
        "lead_rate": lead_rate,
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
    """Return paginated conversation rows with gap metadata."""
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
            (Conversation.top_match_score.is_(None))
            | (Conversation.top_match_score < GAP_THRESHOLD)
            | (Conversation.response_type == "clarification")
        )
    elif gap_flag is False:
        stmt = stmt.where(
            Conversation.top_match_score.is_not(None)
            & (Conversation.top_match_score >= GAP_THRESHOLD)
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
            "source": getattr(row, "source", None) or "chat",
        }

    return {
        "rows": [_serialize(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/gaps")
def get_gaps(db: Session = Depends(get_db)):
    """Return gap queries aggregated by exact query text."""
    stmt = (
        select(
            func.min(Conversation.id).label("id"),
            Conversation.query,
            func.count(Conversation.id).label("frequency"),
            func.max(Conversation.top_match_score).label("best_score"),
            func.min(Conversation.gap_resolved.cast(Integer)).label("resolved"),
        )
        .where(
            (Conversation.top_match_score.is_(None))
            | (Conversation.top_match_score < GAP_THRESHOLD)
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
    """Toggle gap_resolved on all conversations matching the given query text."""
    result = db.execute(
        update(Conversation)
        .where(Conversation.query == gap_query)
        .values(gap_resolved=body.resolved)
    )
    db.commit()
    return {"updated": result.rowcount}


@router.get("/analytics-summary")
def get_analytics_summary(days: int = 0, db: Session = Depends(get_db)):
    """
    Return aggregated analytics for the admin overview dashboard.
    When days > 0, scope aggregate counts to that time window.
    """
    date_clause = ""
    if days > 0:
        cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
        date_clause = f" AND created_at >= '{cutoff}'"

    total_card_clicks = db.execute(
        _text(f"SELECT COUNT(*) FROM user_events WHERE event_type = 'card_click'{date_clause}")
    ).scalar() or 0

    total_search_queries = db.execute(
        _text(f"SELECT COUNT(*) FROM user_events WHERE event_type = 'search_query'{date_clause}")
    ).scalar() or 0

    total_lead_clicks = db.execute(
        _text(f"SELECT COUNT(*) FROM lead_clicks WHERE 1=1{date_clause}")
    ).scalar() or 0

    # Recent searches — last 10 search_query events
    recent_search_rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            json_extract(payload, '$.result_count') AS result_count,
            json_extract(payload, '$.active_tags') AS active_tags,
            created_at
        FROM user_events
        WHERE event_type = 'search_query'
        ORDER BY created_at DESC
        LIMIT 10
    """)).all()

    recent_searches = [
        {
            "query_text": r.query_text or "",
            "result_count": int(r.result_count) if r.result_count is not None else 0,
            "active_tags": json.loads(r.active_tags) if r.active_tags else [],
            "created_at": r.created_at or "",
        }
        for r in recent_search_rows
    ]

    # Recent clicks — last 10 card_click events with expert name resolution
    recent_click_rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.expert_id') AS expert_id,
            json_extract(payload, '$.context') AS source,
            created_at
        FROM user_events
        WHERE event_type = 'card_click'
        ORDER BY created_at DESC
        LIMIT 10
    """)).all()

    # Batch-resolve expert names
    click_expert_ids = {r.expert_id for r in recent_click_rows if r.expert_id}
    click_name_map = {
        e.username: f"{e.first_name} {e.last_name}"
        for e in db.scalars(select(Expert).where(Expert.username.in_(list(click_expert_ids)))).all()
    } if click_expert_ids else {}

    recent_clicks = [
        {
            "expert_id": r.expert_id or "",
            "expert_name": click_name_map.get(r.expert_id),
            "source": r.source or "grid",
            "created_at": r.created_at or "",
        }
        for r in recent_click_rows
    ]

    return {
        "total_card_clicks": total_card_clicks,
        "total_search_queries": total_search_queries,
        "total_lead_clicks": total_lead_clicks,
        "recent_searches": recent_searches,
        "recent_clicks": recent_clicks,
    }
