"""
Admin event analytics endpoints: /events/demand, /events/exposure,
/lead-clicks, /lead-clicks/by-expert/{username}.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, text as _text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expert, LeadClick

router = APIRouter()


@router.get("/events/trend")
def get_trend(days: int = 14, db: Session = Depends(get_db)):
    earliest = db.execute(_text("SELECT MIN(created_at) FROM user_events")).scalar()
    data_since = earliest

    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    prior_cutoff = (datetime.utcnow() - timedelta(days=days * 2)).strftime("%Y-%m-%d")

    # Daily breakdown
    rows = db.execute(_text("""
        SELECT
            date(created_at) AS day,
            COUNT(*) AS total,
            SUM(CASE WHEN CAST(json_extract(payload, '$.result_count') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS hits,
            SUM(CASE WHEN CAST(json_extract(payload, '$.result_count') AS INTEGER) = 0 THEN 1 ELSE 0 END) AS zero_results
        FROM user_events
        WHERE event_type = 'search_query'
          AND date(created_at) >= :cutoff
        GROUP BY date(created_at)
        ORDER BY day
    """), {"cutoff": cutoff}).all()

    total_queries = sum(r.total for r in rows)
    total_zero = sum(r.zero_results for r in rows)
    zero_result_rate = (total_zero / total_queries * 100) if total_queries > 0 else 0.0

    # Prior period total for comparison
    prior_total = db.execute(_text("""
        SELECT COUNT(*) FROM user_events
        WHERE event_type = 'search_query'
          AND date(created_at) >= :prior_cutoff
          AND date(created_at) < :cutoff
    """), {"prior_cutoff": prior_cutoff, "cutoff": cutoff}).scalar() or 0

    return {
        "data_since": data_since,
        "daily": [{"day": r.day, "total": r.total, "hits": r.hits, "zero_results": r.zero_results} for r in rows],
        "kpis": {
            "total_queries": total_queries,
            "zero_result_rate": zero_result_rate,
            "prior_period_total": prior_total,
        },
    }


@router.get("/events/demand")
def get_demand(days: int = 30, page: int = 0, page_size: int = 25, db: Session = Depends(get_db)):
    # Cold-start check
    earliest = db.execute(_text("SELECT MIN(created_at) FROM user_events")).scalar()
    data_since = earliest  # None if table empty, ISO string otherwise

    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "2000-01-01"

    total_row = db.execute(_text("""
        SELECT COUNT(DISTINCT json_extract(payload, '$.query_text')) AS cnt
        FROM user_events
        WHERE event_type = 'search_query'
          AND CAST(json_extract(payload, '$.result_count') AS INTEGER) = 0
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
        WHERE event_type = 'search_query'
          AND CAST(json_extract(payload, '$.result_count') AS INTEGER) = 0
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

    # Batch-resolve expert full names to avoid N+1 queries
    all_ids = {r.expert_id for r in rows if r.expert_id}
    name_map = {
        e.username: f"{e.first_name} {e.last_name}"
        for e in db.scalars(select(Expert).where(Expert.username.in_(all_ids))).all()
    } if all_ids else {}

    return {
        "data_since": data_since,
        "exposure": [
            {
                "expert_id": r.expert_id,
                "expert_name": name_map.get(r.expert_id),
                "total_clicks": r.total_clicks,
                "grid_clicks": r.grid_clicks,
                "sage_clicks": r.sage_clicks,
            }
            for r in rows
        ],
    }


# ── Lead Click Admin Endpoints ────────────────────────────────────────────────

@router.get("/lead-clicks")
def get_lead_clicks(db: Session = Depends(get_db)):
    """
    Return all lead clicks grouped by email, with expert full names resolved.
    Batch lookups expert names to avoid N+1 queries.
    """
    rows = db.scalars(
        select(LeadClick).order_by(LeadClick.created_at.desc())
    ).all()

    # Batch lookup expert names to avoid N+1
    all_usernames = {row.expert_username for row in rows}
    experts_map = {
        e.username: f"{e.first_name} {e.last_name}"
        for e in db.scalars(select(Expert).where(Expert.username.in_(all_usernames))).all()
    } if all_usernames else {}

    leads: dict = {}
    for row in rows:
        expert_name = experts_map.get(row.expert_username, row.expert_username)
        if row.email not in leads:
            leads[row.email] = []
        leads[row.email].append({
            "expert_username": row.expert_username,
            "expert_name": expert_name,
            "search_query": row.search_query,
            "created_at": row.created_at.isoformat(),
        })

    return {"leads": [{"email": email, "clicks": clicks} for email, clicks in leads.items()]}


@router.get("/lead-clicks/by-expert/{username}")
def get_lead_clicks_by_expert(username: str, db: Session = Depends(get_db)):
    """Return all lead clicks for a specific expert, ordered newest-first."""
    rows = db.scalars(
        select(LeadClick)
        .where(LeadClick.expert_username == username)
        .order_by(LeadClick.created_at.desc())
    ).all()
    return {
        "expert_username": username,
        "clicks": [
            {"email": r.email, "search_query": r.search_query, "created_at": r.created_at.isoformat()}
            for r in rows
        ],
    }
