"""
GET /api/suggest — search suggestions via FTS5 prefix matching.

Returns up to 5 string suggestions from multi-field FTS5 prefix search
across tags, job_title and company columns. Tags are queried first so
they appear before job title/company suggestions.
Called by the frontend search bar on each keystroke (2+ chars) to
populate the autocomplete dropdown.
"""
import asyncio
import json
import re

import structlog
from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import SessionLocal

log = structlog.get_logger()

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
    Query tags, job_title and company FTS5 columns for prefix matches.
    Tags are queried first (with a higher per-column limit) so they appear
    before job title/company results in the merged suggestions list.
    Individual tag values are parsed out of the JSON array stored in the
    tags column rather than returning raw JSON strings.
    Deduplicates results preserving order, returns up to 5 suggestions.
    """
    if len(q.strip()) < 2:
        return []

    prefix_q = _safe_prefix_query(q.strip())
    if not prefix_q:
        return []

    results: list[str] = []
    q_lower = q.strip().lower()

    for column, col_limit in [('tags', 5), ('job_title', 3), ('company', 3)]:
        try:
            rows = db.execute(
                text(
                    f"SELECT DISTINCT {column} FROM experts_fts "
                    "WHERE experts_fts MATCH :q "
                    "ORDER BY rank "
                    f"LIMIT {col_limit}"
                ),
                {"q": prefix_q},
            ).fetchall()

            if column == 'tags':
                # Parse individual tags from JSON array strings returned by FTS5.
                # The tags column stores values like '["seo","marketing"]', so we
                # extract each tag and match it against the query substring.
                for row in rows:
                    raw = row[0]
                    if not raw:
                        continue
                    try:
                        tag_list = json.loads(raw) if raw.startswith('[') else [raw]
                    except (json.JSONDecodeError, TypeError):
                        tag_list = [raw]
                    for tag in tag_list:
                        tag = tag.strip()
                        if tag and q_lower in tag.lower():
                            results.append(tag)
                continue  # skip the normal col_results.extend path

            # For job_title and company: use raw FTS5 results
            col_results = [row[0] for row in rows if row[0] and row[0].strip()]
            results.extend(col_results)
        except Exception as exc:
            log.warning("suggest.fts5_match_failed", column=column, error=str(exc))
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
) -> list[str]:
    """
    Search suggestions from FTS5 prefix matching on job_title and company fields.
    Returns up to 5 deduplicated suggestions. Returns empty list if q < 2 chars.
    """
    if len(q.strip()) < 2:
        return []
    loop = asyncio.get_event_loop()

    def _run():
        db = SessionLocal()
        try:
            return _run_suggest_multi(q, db)
        finally:
            db.close()

    return await loop.run_in_executor(None, _run)
