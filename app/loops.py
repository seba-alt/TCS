"""
Loops.so contact sync — fire-and-forget.

Creates or updates a contact in Loops when a lead submits their email.
Skips silently if LOOPS_API_KEY is not set (local dev / staging).
"""
import logging
import os

import httpx

logger = logging.getLogger(__name__)

LOOPS_API_KEY = os.getenv("LOOPS_API_KEY", "")
LOOPS_API_URL = "https://app.loops.so/api/v1/contacts/create"


def sync_contact_to_loops(
    email: str,
    source: str = "email_gate",
    first_query: str | None = None,
) -> None:
    """Push a contact to Loops. Safe to call from FastAPI BackgroundTasks."""
    if not LOOPS_API_KEY:
        return

    payload: dict = {
        "email": email,
        "source": source,
        "userGroup": "search",
    }
    if first_query:
        payload["firstSearchQuery"] = first_query

    try:
        resp = httpx.post(
            LOOPS_API_URL,
            headers={
                "Authorization": f"Bearer {LOOPS_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
    except Exception:
        logger.warning("Loops sync failed for %s", email, exc_info=True)
