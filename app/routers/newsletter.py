"""
Newsletter subscription endpoint.

POST /api/newsletter/subscribe — stores subscriber email in newsletter_subscribers table.
Idempotent: duplicate emails are silently ignored via INSERT OR IGNORE (on_conflict_do_nothing).

Backend failure policy: this endpoint is fire-and-forget from the frontend.
The frontend updates localStorage state regardless of this call's outcome.

Import note: must use sqlalchemy.dialects.sqlite.insert (NOT sqlalchemy.insert)
for on_conflict_do_nothing support. When migrating to Postgres, switch to
sqlalchemy.dialects.postgresql.insert — API is identical.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NewsletterSubscriber

router = APIRouter()


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: str = "gate"


@router.post("/api/newsletter/subscribe", status_code=200)
def subscribe(body: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    """
    Store newsletter subscriber email. Silently ignores duplicate emails.
    Returns {"status": "ok"} on success (including duplicates).
    """
    stmt = (
        insert(NewsletterSubscriber)
        .values(email=str(body.email), source=body.source)
        .on_conflict_do_nothing(index_elements=["email"])
    )
    db.execute(stmt)
    db.commit()
    return {"status": "ok"}
