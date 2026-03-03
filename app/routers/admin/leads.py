"""
Admin leads and newsletter endpoints: /leads, /newsletter-subscribers,
/export/leads.csv, /export/newsletter.csv.
"""
import csv
import io
from datetime import date, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, LeadClick, NewsletterSubscriber
from app.routers.admin._common import _is_gap

router = APIRouter()


@router.get("/leads")
def get_leads(db: Session = Depends(get_db)):
    """Return email-grouped lead analytics."""
    # Batch-count clicks per email for click_count field
    click_counts_rows = db.execute(
        select(LeadClick.email, func.count(LeadClick.id).label("click_count"))
        .group_by(LeadClick.email)
    ).all()
    click_map = {r.email: r.click_count for r in click_counts_rows}

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
            "click_count": click_map.get(lead["email"], 0),
        })

    return {"leads": result}


@router.get("/newsletter-subscribers")
def get_newsletter_subscribers(db: Session = Depends(get_db)):
    """Return all newsletter subscribers ordered by most recent first."""
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


@router.get("/export/leads.csv")
def export_leads_csv(db: Session = Depends(get_db)):
    """Download all leads as CSV with timestamped search queries."""
    rows = db.scalars(
        select(Conversation).order_by(Conversation.email, Conversation.created_at.asc())
    ).all()

    leads: dict[str, dict] = {}
    for row in rows:
        email = row.email
        if email not in leads:
            leads[email] = {"email": email, "queries": [], "last_active": row.created_at}
        leads[email]["queries"].append(
            f"{row.created_at.isoformat() if row.created_at else ''}|{row.query}"
        )
        if row.created_at and (leads[email]["last_active"] is None or row.created_at > leads[email]["last_active"]):
            leads[email]["last_active"] = row.created_at

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total leads", len(leads)])
    writer.writerow(["# Note: Card clicks not included — no session-to-email mapping in current schema (see LEAD-01 for v4.1)"])
    writer.writerow([])
    writer.writerow(["email", "last_active", "total_queries", "queries_timestamped", "card_clicks_timestamped"])
    for lead in sorted(leads.values(), key=lambda x: x["last_active"] or datetime.min, reverse=True):
        writer.writerow([
            lead["email"],
            lead["last_active"].isoformat() if lead["last_active"] else "",
            len(lead["queries"]),
            ";".join(lead["queries"]),
            "",
        ])

    filename = f"leads-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/newsletter.csv")
def export_newsletter_csv(db: Session = Depends(get_db)):
    """Download all newsletter subscribers as CSV."""
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
