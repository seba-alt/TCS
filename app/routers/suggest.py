"""
GET /api/suggest — search suggestions via FTS5 prefix matching.

Returns up to 8 string suggestions from job_title prefix search.
Called by the frontend SearchInput on each keystroke (2+ chars).
"""
import asyncio
import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

router = APIRouter()


def _safe_prefix_query(q: str) -> str:
    """
    Sanitize user input for FTS5 prefix matching.
    Unlike _safe_fts_query in explorer.py, this PRESERVES the ability
    to do prefix search by appending * to the last word.
    """
    # Strip FTS5 special chars
    cleaned = re.sub(r'[()"\+\-]', ' ', q)
    # Strip boolean operators
    cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned, flags=re.IGNORECASE)
    words = cleaned.split()[:5]  # limit to 5 terms
    if not words:
        return ""
    # Append * to last word for prefix matching
    words[-1] = words[-1] + "*"
    return " ".join(words)


def _run_suggest(q: str, db: Session) -> list[str]:
    if len(q.strip()) < 2:
        return []

    prefix_q = _safe_prefix_query(q.strip())
    if not prefix_q:
        return []

    try:
        rows = db.execute(
            text(
                "SELECT DISTINCT job_title FROM experts_fts "
                "WHERE experts_fts MATCH :q "
                "ORDER BY rank "
                "LIMIT 8"
            ),
            {"q": prefix_q},
        ).fetchall()
        # Filter out None/empty values
        return [row[0] for row in rows if row[0] and row[0].strip()]
    except Exception:
        # FTS5 MATCH can raise on malformed queries — return empty list
        return []


@router.get("/api/suggest", response_model=list[str])
async def suggest(
    q: str = Query(default="", max_length=200),
    db: Session = Depends(get_db),
) -> list[str]:
    """
    Search suggestions from FTS5 prefix matching on job_title.
    Returns empty list if q is less than 2 characters.
    """
    if len(q.strip()) < 2:
        return []
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _run_suggest(q, db))
