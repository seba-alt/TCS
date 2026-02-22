"""
POST /api/events — Record user behavior events (card clicks, Sage queries, filter changes).

Fire-and-forget from frontend (fetch + keepalive: true, no await).
Returns 202 Accepted. No authentication required.
event_type is validated via Pydantic Literal — unknown values return 422.
"""
import json
from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserEvent

log = structlog.get_logger()
router = APIRouter()

EVENT_TYPES = Literal["card_click", "sage_query", "filter_change"]


class EventRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_type: EVENT_TYPES
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post("/api/events", status_code=202)
def record_event(body: EventRequest, db: Session = Depends(get_db)):
    """
    Insert a user behavior event. Returns 202 Accepted.
    Unknown event_type values are rejected with 422 by Pydantic validation.
    """
    record = UserEvent(
        session_id=body.session_id,
        event_type=body.event_type,
        payload=json.dumps(body.payload),
    )
    db.add(record)
    db.commit()
    log.info("event.recorded", event_type=body.event_type, session_id=body.session_id)
    return {"status": "accepted"}
