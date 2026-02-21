"""
Thin FastAPI router for GET /api/explore.

Delegates all search logic to app.services.explorer.run_explore().
Offloads the synchronous pipeline (SQLAlchemy + FAISS + FTS5 + numpy)
to a thread pool via run_in_executor, keeping the FastAPI event loop unblocked.
"""

import asyncio

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.explorer import ExploreResponse, run_explore

router = APIRouter()


@router.get("/api/explore", response_model=ExploreResponse)
async def explore(
    request: Request,
    db: Session = Depends(get_db),
    query: str = Query(default="", max_length=500),
    rate_min: float = Query(default=0.0, ge=0),
    rate_max: float = Query(default=10000.0, le=10000),
    tags: str = Query(default=""),    # comma-separated, e.g. "seo,blockchain"
    limit: int = Query(default=20, ge=1, le=100),
    cursor: int = Query(default=0, ge=0),
) -> ExploreResponse:
    """
    Hybrid search: SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused rank.
    When query is empty, returns experts sorted by findability_score (pure filter mode).
    Rate range: inclusive on both ends. Tags: comma-separated, AND logic (expert must have ALL).
    """
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: run_explore(
            query=query,
            rate_min=rate_min,
            rate_max=rate_max,
            tags=tag_list,
            limit=limit,
            cursor=cursor,
            db=db,
            app_state=request.app.state,
        ),
    )
