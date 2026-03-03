"""
Admin CSV export endpoints: /export/searches.csv, /export/gaps.csv, /export/exposure.csv.
"""
import csv
import io
import json
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import Integer, func, select, text as _text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation
from app.routers.admin._common import GAP_THRESHOLD, _is_gap

router = APIRouter()


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
    """Download all (or filtered) conversation rows as CSV."""
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
    """Download all gap aggregates as CSV."""
    stmt = (
        select(
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


@router.get("/export/exposure.csv")
def export_exposure_csv(days: int = 30, db: Session = Depends(get_db)):
    """Download expert exposure data as CSV."""
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
