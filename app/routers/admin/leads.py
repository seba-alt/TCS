"""
Admin leads and newsletter endpoints: /leads, /newsletter-subscribers,
/lead-timeline/{email}, /export/leads.csv, /export/newsletter.csv.
"""
import csv
import io
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Expert, LeadClick, NewsletterSubscriber, UserEvent
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


@router.get("/lead-timeline/{email}")
def get_lead_timeline(email: str, limit: int = 10, offset: int = 0, db: Session = Depends(get_db)):
    """Return chronological timeline of a lead's searches and expert clicks."""
    # 1. Fetch all conversations (searches) for this email
    conv_rows = db.scalars(
        select(Conversation).where(Conversation.email == email)
    ).all()

    search_events = []
    for row in conv_rows:
        result_count = len(json.loads(row.response_experts or "[]"))
        search_events.append({
            "type": "search",
            "query": row.query,
            "result_count": result_count,
            "created_at": row.created_at.isoformat(),
        })

    # 2. Fetch all lead clicks for this email
    click_rows = db.scalars(
        select(LeadClick).where(LeadClick.email == email)
    ).all()

    # Batch-resolve expert usernames to full names
    all_usernames = {row.expert_username for row in click_rows}
    experts_map = {
        e.username: f"{e.first_name} {e.last_name}"
        for e in db.scalars(select(Expert).where(Expert.username.in_(all_usernames))).all()
    } if all_usernames else {}

    click_events = []
    for row in click_rows:
        expert_name = experts_map.get(row.expert_username, row.expert_username)
        click_events.append({
            "type": "click",
            "expert_username": row.expert_username,
            "expert_name": expert_name,
            "search_query": row.search_query,
            "created_at": row.created_at.isoformat(),
        })

    # 3. Fetch anonymous session search events (linked via session_id captured at signup)
    subscriber = db.scalar(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
    )
    if subscriber and getattr(subscriber, 'session_id', None):
        session_event_rows = db.scalars(
            select(UserEvent).where(
                UserEvent.session_id == subscriber.session_id,
                UserEvent.event_type == "search_query",
            )
        ).all()
        for row in session_event_rows:
            payload_data = json.loads(row.payload or "{}")
            search_events.append({
                "type": "search",
                "query": payload_data.get("query_text", ""),
                "result_count": payload_data.get("result_count", 0),
                "created_at": row.created_at.isoformat(),
            })

    # 4. Merge and sort newest-first
    all_events = search_events + click_events
    all_events.sort(key=lambda e: e["created_at"], reverse=True)

    # 5. Paginate
    total = len(all_events)
    paginated = all_events[offset:offset + limit]

    return {
        "email": email,
        "events": paginated,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/newsletter-subscribers")
def get_newsletter_subscribers(db: Session = Depends(get_db)):
    """Return all newsletter subscribers enriched with click counts."""
    rows = db.scalars(
        select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc())
    ).all()

    # Enrich with click counts from lead_clicks table
    click_counts_rows = db.execute(
        select(LeadClick.email, func.count(LeadClick.id).label("click_count"))
        .group_by(LeadClick.email)
    ).all()
    click_map = {r.email: r.click_count for r in click_counts_rows}

    return {
        "count": len(rows),
        "subscribers": [
            {
                "email": r.email,
                "created_at": r.created_at.isoformat(),
                "source": r.source,
                "click_count": click_map.get(r.email, 0),
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
