"""
GET /api/suggest — search suggestions via FTS5 prefix matching.

Returns up to 5 string suggestions from multi-field FTS5 prefix search
across job_title and company columns. Called by the frontend search bar
on each keystroke (2+ chars) to populate the autocomplete dropdown.
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


def _run_suggest_multi(q: str, db: Session) -> list[str]:
    """
    Query both job_title and company FTS5 columns for prefix matches.
    Deduplicates results preserving order, returns up to 5 suggestions.
    """
    if len(q.strip()) < 2:
        return []

    prefix_q = _safe_prefix_query(q.strip())
    if not prefix_q:
        return []

    results: list[str] = []

    for column in ('job_title', 'company'):
        try:
            rows = db.execute(
                text(
                    f"SELECT DISTINCT {column} FROM experts_fts "
                    "WHERE experts_fts MATCH :q "
                    "ORDER BY rank "
                    "LIMIT 3"
                ),
                {"q": prefix_q},
            ).fetchall()
            # Filter out None/empty values
            col_results = [row[0] for row in rows if row[0] and row[0].strip()]
            results.extend(col_results)
        except Exception:
            # FTS5 MATCH can raise on malformed queries — continue to next column
            continue

    # Deduplicate preserving insertion order, limit to 5 total
    seen: set[str] = set()
    deduped: list[str] = []
    for item in results:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
        if len(deduped) >= 5:
            break

    return deduped


@router.get("/api/suggest", response_model=list[str])
async def suggest(
    q: str = Query(default="", max_length=200),
    db: Session = Depends(get_db),
) -> list[str]:
    """
    Search suggestions from FTS5 prefix matching on job_title and company fields.
    Returns up to 5 deduplicated suggestions. Returns empty list if q < 2 chars.
    """
    if len(q.strip()) < 2:
        return []
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _run_suggest_multi(q, db))
