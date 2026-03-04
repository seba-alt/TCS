"""
Email lead capture endpoint.

POST /api/email-capture — stores submitted email in email_leads table.
Idempotent: duplicate emails are silently ignored via INSERT OR IGNORE.

Backend failure policy: this endpoint is fire-and-forget from the frontend.
The frontend unlocks on localStorage write regardless of this call's outcome.

Import note: must use sqlalchemy.dialects.sqlite.insert (NOT sqlalchemy.insert)
for on_conflict_do_nothing support. When migrating to Postgres, switch to
sqlalchemy.dialects.postgresql.insert — API is identical.
"""
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.loops import sync_contact_to_loops
from app.models import EmailLead

router = APIRouter()


class EmailCaptureRequest(BaseModel):
    email: EmailStr
    query: str | None = None


@router.post("/api/email-capture", status_code=200)
def capture_email(
    body: EmailCaptureRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Store email for lead capture. Silently ignores duplicate emails.
    Returns {"status": "ok"} on success (including duplicates).
    """
    stmt = (
        insert(EmailLead)
        .values(email=str(body.email))
        .on_conflict_do_nothing(index_elements=["email"])
    )
    db.execute(stmt)
    db.commit()

    background_tasks.add_task(
        sync_contact_to_loops,
        email=str(body.email),
        source="email_gate",
        first_query=body.query,
    )
    return {"status": "ok"}
