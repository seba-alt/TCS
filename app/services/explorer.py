"""
Hybrid search pipeline service for GET /api/explore.

Three-stage pipeline:
  1. SQLAlchemy pre-filter — hourly_rate range + tag AND-logic filter
  2. FAISS IDSelectorBatch — semantic vector search on pre-filtered subset
  3. FTS5 BM25 — keyword scoring, fused with FAISS at 0.7/0.3 weights

Pure filter mode (no text query): sorts by findability_score DESC only —
  FAISS and FTS5 stages are skipped entirely.

Output: ExploreResponse — the stable data contract all downstream phases build against.
"""

import json
import re
import time
from typing import Optional

import faiss
import numpy as np
import structlog
from pydantic import BaseModel
from sqlalchemy import and_, select, text
from sqlalchemy.orm import Session

from app.models import Expert, Feedback
from app.services.embedder import embed_query

log = structlog.get_logger()

# --- Constants (hardcoded — no env vars; tuning is rare at this scale) ---
FAISS_WEIGHT = 0.7
BM25_WEIGHT = 0.3
ITEMS_PER_PAGE = 20


# --- Response schemas (stable data contract for phases 15–19) ---

class ExpertCard(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    hourly_rate: float
    currency: str
    profile_url: str          # profile_url_utm preferred; fallback to profile_url
    photo_url: str | None     # /api/photos/{username} or None
    tags: list[str]
    findability_score: float | None
    category: str | None
    faiss_score: float | None   # None in pure filter mode
    bm25_score: float | None    # None in pure filter mode
    final_score: float          # findability-boosted fused score (or findability_score in filter mode)
    match_reason: str | None    # None when query is empty


class ExploreResponse(BaseModel):
    experts: list[ExpertCard]
    total: int          # pre-filter count (before pagination) — for "N experts found" display
    cursor: int | None  # next offset; None = no more pages
    took_ms: int


# --- FTS5 query sanitizer ---

def _safe_fts_query(query: str) -> str:
    """
    Strip FTS5 special characters and boolean operators from a user query.
    Returns a simple space-separated word query safe for FTS5 MATCH.
    Returns empty string if no valid words remain.
    """
    cleaned = re.sub(r'[()"\*\+]', ' ', query)
    cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned, flags=re.IGNORECASE)
    words = cleaned.split()[:10]  # limit to 10 terms
    return " ".join(words) if words else ""


# --- Scoring helpers ---

def _apply_findability_boost(fused_score: float, findability_score: float | None) -> float:
    """
    Multiplicative findability boost: ±20% max based on findability_score (50–100 range).
    Experts at findability=100 get +20% boost; at 50 get -20% penalty.
    Neutral at findability=75 (midpoint of 50–100 range).
    Returns fused_score unchanged when findability_score is None.
    """
    if findability_score is None:
        return fused_score
    # Normalize 50–100 range to -1.0 to +1.0
    normalized = (findability_score - 75.0) / 25.0  # -1 at 50, 0 at 75, +1 at 100
    multiplier = 1.0 + (normalized * 0.20)           # range: 0.8 to 1.2
    return fused_score * multiplier


def _build_match_reason(expert: Expert, tags: list[str], query: str) -> Optional[str]:
    """
    Construct a match_reason label from tag intersection — deterministic, zero latency.
    Returns None when the query is empty.
    Falls back to job_title when no tags match the query text.
    """
    if not query.strip():
        return None
    query_lower = query.lower()
    matched_tags = [t for t in tags if t.lower() in query_lower][:3]
    if matched_tags:
        return "Strong match: " + ", ".join(matched_tags)
    if expert.job_title:
        return f"Match via: {expert.job_title}"
    return None


def _build_card(
    expert: Expert,
    faiss_score: Optional[float],
    bm25_score: Optional[float],
    final_score: float,
    query: str,
) -> ExpertCard:
    """Build an ExpertCard from an Expert ORM object and computed scores."""
    tags = json.loads(expert.tags or "[]")
    match_reason = _build_match_reason(expert, tags, query) if query.strip() else None
    # Build photo proxy URL if expert has a photo stored
    photo_url = f"/api/photos/{expert.username}" if expert.photo_url else None

    return ExpertCard(
        username=expert.username,
        first_name=expert.first_name,
        last_name=expert.last_name,
        job_title=expert.job_title,
        company=expert.company,
        hourly_rate=expert.hourly_rate,
        currency=expert.currency,
        profile_url=expert.profile_url_utm or expert.profile_url,
        photo_url=photo_url,
        tags=tags,
        findability_score=expert.findability_score,
        category=expert.category,
        faiss_score=faiss_score,
        bm25_score=bm25_score,
        final_score=round(final_score, 4),
        match_reason=match_reason,
    )


# --- Main pipeline ---

def run_explore(
    query: str,
    rate_min: float,
    rate_max: float,
    tags: list[str],
    limit: int,
    cursor: int,
    db: Session,
    app_state,
) -> ExploreResponse:
    """
    Three-stage hybrid search pipeline.

    Stage 1 (always): SQLAlchemy pre-filter by rate range + tags (AND logic).
    Stage 2 (text query only): FAISS IDSelectorBatch semantic search.
    Stage 3 (text query only): FTS5 BM25 keyword scoring.
    Fusion: FAISS * 0.7 + BM25 * 0.3, then findability boost (±20%).
    Pure filter mode: sorted by findability_score DESC, skips FAISS and FTS5.
    """
    start = time.time()

    # --- Stage 1: SQLAlchemy pre-filter (always runs) ---
    stmt = select(Expert).where(
        and_(
            Expert.hourly_rate >= rate_min,
            Expert.hourly_rate <= rate_max,
        )
    )
    # AND logic: expert must have ALL selected tags; normalize to lowercase
    for tag in tags:
        stmt = stmt.where(Expert.tags.like(f'%"{tag.lower()}"%'))

    filtered_experts: list[Expert] = list(db.scalars(stmt).all())

    if not filtered_experts:
        return ExploreResponse(
            experts=[],
            total=0,
            cursor=None,
            took_ms=int((time.time() - start) * 1000),
        )

    is_text_query = bool(query.strip())

    if is_text_query:
        # --- Stage 2: FAISS IDSelectorBatch ---
        username_to_pos: dict[str, int] = app_state.username_to_faiss_pos
        faiss_index = app_state.faiss_index

        allowed_positions = np.array(
            [username_to_pos[e.username] for e in filtered_experts
             if e.username in username_to_pos],
            dtype=np.int64,
        )

        faiss_scores: dict[str, float] = {}
        if len(allowed_positions) > 0:
            query_vec = np.array(embed_query(query), dtype=np.float32).reshape(1, -1)
            selector = faiss.IDSelectorBatch(allowed_positions)
            params = faiss.SearchParameters(sel=selector)
            k = min(50, len(allowed_positions))
            scores, indices = faiss_index.search(query_vec, k, params=params)
            for score, pos in zip(scores[0], indices[0]):
                if pos < 0:
                    continue
                username = app_state.metadata[pos].get("Username", "")
                if username:
                    faiss_scores[username] = float(score)

        # --- Stage 3: FTS5 BM25 ---
        filtered_ids = {e.id for e in filtered_experts}
        safe_q = _safe_fts_query(query)

        bm25_scores: dict[int, float] = {}
        if safe_q:
            try:
                fts_rows = db.execute(
                    text(
                        "SELECT rowid, rank FROM experts_fts "
                        "WHERE experts_fts MATCH :q "
                        "ORDER BY rank "
                        "LIMIT 200"
                    ),
                    {"q": safe_q},
                ).fetchall()

                # Filter to pre-filtered experts only
                relevant_fts = [
                    (row.rowid, abs(row.rank))
                    for row in fts_rows
                    if row.rowid in filtered_ids
                ]
                if relevant_fts:
                    max_rank = max(v for _, v in relevant_fts) or 1.0
                    bm25_scores = {rid: v / max_rank for rid, v in relevant_fts}
            except Exception as exc:
                log.warning("explore.fts5_match_failed", error=str(exc), query=safe_q)
                # Continue without BM25 scores — FAISS results still valid

        # --- Score fusion + findability boost ---
        scored: list[tuple[float, float, float, Expert]] = []  # (final, faiss, bm25, expert)
        for expert in filtered_experts:
            fs = faiss_scores.get(expert.username, 0.0)
            bs = bm25_scores.get(expert.id, 0.0)
            if fs == 0.0 and bs == 0.0:
                continue  # no signal in either index — exclude from hybrid results
            fused = (fs * FAISS_WEIGHT) + (bs * BM25_WEIGHT)
            final = _apply_findability_boost(fused, expert.findability_score)
            scored.append((final, fs, bs, expert))

        # --- Feedback boost (inline — type-compatible with scored list) ---
        # Mirrors the formula in search_intelligence._apply_feedback_boost().
        # Graceful degradation: any DB error logs a warning and returns scored unchanged.
        try:
            url_set = {
                e.profile_url_utm or e.profile_url
                for _, _, _, e in scored
                if e.profile_url_utm or e.profile_url
            }
            if url_set:
                feedback_rows = db.scalars(
                    select(Feedback).where(Feedback.vote.in_(["up", "down"]))
                ).all()

                counts: dict[str, dict[str, int]] = {u: {"up": 0, "down": 0} for u in url_set}
                for row in feedback_rows:
                    expert_ids = json.loads(row.expert_ids or "[]")
                    for eid in expert_ids:
                        if eid in url_set:
                            counts[eid][row.vote] = counts[eid].get(row.vote, 0) + 1

                FEEDBACK_BOOST_CAP = 0.20
                boost_factor = FEEDBACK_BOOST_CAP * 2  # 0.40 — mirrors search_intelligence formula

                multipliers: dict[str, float] = {}
                for url in url_set:
                    up = counts[url]["up"]
                    down = counts[url]["down"]
                    total_votes = up + down
                    if total_votes < 10:
                        continue  # cold-start guard — skip sparse feedback
                    ratio = up / total_votes
                    if ratio > 0.5:
                        multipliers[url] = 1.0 + (ratio - 0.5) * boost_factor
                    elif ratio < 0.5:
                        multipliers[url] = 1.0 - (0.5 - ratio) * boost_factor

                if multipliers:
                    scored = [
                        (
                            final_s * multipliers.get(
                                e.profile_url_utm or e.profile_url, 1.0
                            ),
                            faiss_s,
                            bm25_s,
                            e,
                        )
                        for final_s, faiss_s, bm25_s, e in scored
                    ]
        except Exception as exc:
            log.warning("explore.feedback_boost_failed", error=str(exc))
            # scored unchanged — degrade gracefully, never raise

        scored.sort(key=lambda x: x[0], reverse=True)

        # total = semantically-matched experts (those with FAISS or BM25 signal)
        # This is what the user sees as the result count — reflects actual search quality,
        # not the raw pre-filter pool which can be the full DB when no rate/tag filters are set.
        total = len(scored)

        # --- Pagination ---
        page = scored[cursor: cursor + limit + 1]
        has_more = len(page) > limit
        page = page[:limit]
        next_cursor: Optional[int] = cursor + limit if has_more else None

        cards = [
            _build_card(expert, faiss_s, bm25_s, final_s, query)
            for final_s, faiss_s, bm25_s, expert in page
        ]

    else:
        # --- Pure filter mode: sort by findability_score DESC, skip FAISS/FTS5 ---
        sorted_experts = sorted(
            filtered_experts,
            key=lambda e: (e.findability_score or 0.0),
            reverse=True,
        )

        # In pure filter mode, total = all experts that pass rate/tag filters
        total = len(filtered_experts)

        page_experts = sorted_experts[cursor: cursor + limit + 1]
        has_more = len(page_experts) > limit
        page_experts = page_experts[:limit]
        next_cursor = cursor + limit if has_more else None

        cards = [
            _build_card(e, None, None, e.findability_score or 0.0, "")
            for e in page_experts
        ]

    log.info(
        "explore.pipeline_complete",
        query_len=len(query),
        total=total,
        returned=len(cards),
        took_ms=int((time.time() - start) * 1000),
    )

    return ExploreResponse(
        experts=cards,
        total=total,
        cursor=next_cursor,
        took_ms=int((time.time() - start) * 1000),
    )
