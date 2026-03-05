"""
POST /api/events — Record user behavior events (card clicks, Sage queries, filter changes).

Fire-and-forget from frontend (fetch + keepalive: true, no await).
Returns 202 Accepted. No authentication required.
event_type is validated via Pydantic Literal — unknown values return 422.

Phase 71.02: Enqueues events for background batch write instead of writing synchronously.
Queue caps at 1000 items; when full, oldest event is dropped.
"""
import asyncio
import json
from typing import Any, Literal

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.event_queue import _event_queue

log = structlog.get_logger()
router = APIRouter()

EVENT_TYPES = Literal["card_click", "sage_query", "filter_change", "search_query", "save"]


class EventRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)
    event_type: EVENT_TYPES
    payload: dict[str, Any] = Field(default_factory=dict)
    email: str | None = None  # Phase 63: optional, validated in handler


def _validate_email(email: str | None) -> str | None:
    """Basic check: must contain @ and a dot. Returns None if invalid."""
    if not email:
        return None
    email = email.strip()
    if "@" not in email or "." not in email:
        return None
    return email.lower()


@router.post("/api/events", status_code=202)
async def record_event(body: EventRequest):
    """
    Enqueue a user behavior event for background batch write. Returns 202 Accepted.
    Unknown event_type values are rejected with 422 by Pydantic validation.
    Invalid emails are silently stored as null — never reject/lose a tracking event.
    The event is written to the DB within ~2 seconds by the background flush worker.
    """
    validated_email = _validate_email(body.email)
    item = {
        "session_id": body.session_id,
        "event_type": body.event_type,
        "payload": json.dumps(body.payload),
        "email": validated_email,
    }
    try:
        _event_queue.put_nowait(item)
    except asyncio.QueueFull:
        # Drop oldest event to make room, then enqueue the new one
        try:
            _event_queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        _event_queue.put_nowait(item)
        log.warning("event.queue_full_drop_oldest", event_type=body.event_type)
    return {"status": "accepted"}
