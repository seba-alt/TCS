"""
Thin FastAPI router for GET /api/explore.

Delegates all search logic to app.services.explorer.run_explore().
Offloads the synchronous pipeline (SQLAlchemy + FAISS + FTS5 + numpy)
to a thread pool via run_in_executor, keeping the FastAPI event loop unblocked.

Phase 71.02: Results cached for 5 minutes (300s TTL, max 200 entries).
Seeded queries (seed > 0) bypass the cache — they are randomized per request.
Cache is invalidated on expert add, delete, bulk delete, and ingest completion.
"""

import asyncio

from fastapi import APIRouter, Query, Request

from app.database import SessionLocal
from app.services.explore_cache import get_cached, set_cached
from app.services.explorer import ExploreResponse, run_explore

router = APIRouter()


@router.get("/api/explore", response_model=ExploreResponse)
async def explore(
    request: Request,
    query: str = Query(default="", max_length=500),
    rate_min: float = Query(default=0.0, ge=0),
    rate_max: float = Query(default=10000.0, le=10000),
    tags: str = Query(default=""),    # comma-separated, e.g. "seo,blockchain"
    industry_tags: str = Query(default=""),  # comma-separated, e.g. "Finance,Healthcare"
    limit: int = Query(default=20, ge=1, le=100),
    usernames: str = Query(default=""),  # comma-separated; returns only these experts (saved view)
    cursor: int = Query(default=0, ge=0),
    seed: int = Query(default=0, ge=0),  # 0 = deterministic findability sort; >0 = seeded random
) -> ExploreResponse:
    """
    Hybrid search: SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused rank.
    When query is empty, returns experts sorted by findability_score (pure filter mode).
    Rate range: inclusive on both ends. Tags: comma-separated, AND logic (expert must have ALL).

    Results are cached for 5 minutes for deterministic (seed=0) queries. Seeded queries
    are randomized and always bypass the cache.
    """
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    industry_tag_list = [t.strip() for t in industry_tags.split(",") if t.strip()]
    username_list = [u.strip() for u in usernames.split(",") if u.strip()]

    # Only cache deterministic (non-seeded) results
    if seed == 0:
        cache_key = (
            f"{query}|{rate_min}|{rate_max}|{sorted(tag_list)}"
            f"|{sorted(industry_tag_list)}|{limit}|{cursor}|{seed}"
            f"|{sorted(username_list) if username_list else ''}"
        )
        cached = get_cached(cache_key)
        if cached is not None:
            return cached

    app_state = request.app.state
    loop = asyncio.get_event_loop()

    def _run():
        db = SessionLocal()
        try:
            return run_explore(
                query=query,
                rate_min=rate_min,
                rate_max=rate_max,
                tags=tag_list,
                industry_tags=industry_tag_list,
                limit=limit,
                cursor=cursor,
                db=db,
                app_state=app_state,
                seed=seed if seed > 0 else None,
                usernames=username_list if username_list else None,
            )
        finally:
            db.close()

    result = await loop.run_in_executor(None, _run)

    # Cache only deterministic results
    if seed == 0:
        set_cached(cache_key, result)

    return result
