"""
POST /api/feedback — Record thumbs up/down feedback on expert result sets.

The vote is recorded immediately on thumb click (fire-and-forget from frontend).
The same endpoint accepts optional downvote detail (reasons + comment) sent when
the user submits the DownvoteModal form.

Switching votes: frontend sends a new POST — backend inserts a new row.
Latest record per conversation_id is authoritative for analytics.
"""
import json
from typing import Literal

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Feedback

log = structlog.get_logger()
router = APIRouter()


class FeedbackRequest(BaseModel):
    conversation_id: int
    vote: Literal["up", "down"]
    email: EmailStr | None = None
    expert_ids: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)        # checkbox labels (downvote detail)
    comment: str | None = Field(None, max_length=1000)      # free-text (downvote detail)


@router.post("/api/feedback", status_code=200)
def submit_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    """
    Insert a feedback record. Returns {status: ok} for both new votes and vote switches.
    Vote switch: frontend sends another POST — new row inserted, latest row wins for analytics.
    """
    record = Feedback(
        conversation_id=body.conversation_id,
        vote=body.vote,
        email=str(body.email) if body.email else None,
        expert_ids=json.dumps(body.expert_ids),
        reasons=json.dumps(body.reasons),
        comment=body.comment,
    )
    db.add(record)
    db.commit()
    log.info("feedback.recorded", conversation_id=body.conversation_id, vote=body.vote)
    return {"status": "ok"}
