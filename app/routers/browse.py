"""
Public Browse API endpoints for the Netflix-style Browse page.

GET /api/browse  — curated category rows + featured experts for the Browse UI
GET /api/photos/{username} — proxy expert photos with caching and HTTPS enforcement

No authentication required — these are public endpoints.
"""
import asyncio
import json
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expert

router = APIRouter()


def _serialize_browse_card(expert: Expert) -> dict:
    """Serialize an Expert ORM object into a browse card dict for the frontend."""
    return {
        "username": expert.username,
        "first_name": expert.first_name,
        "last_name": expert.last_name,
        "job_title": expert.job_title,
        "company": expert.company,
        "hourly_rate": expert.hourly_rate,
        "category": expert.category,
        "tags": json.loads(expert.tags or "[]"),
        "photo_url": f"/api/photos/{expert.username}" if expert.photo_url else None,
        "profile_url": expert.profile_url,
    }


def _slugify(text: str) -> str:
    """Convert a category name to a URL-friendly slug."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _build_browse_data(db: Session, per_row: int) -> dict:
    """
    Build the browse response data synchronously (runs in executor thread).

    Returns dict with 'featured' (top 5 experts) and 'rows' (category rows).
    """
    rows: list[dict] = []

    # 1. Category rows: categories with 3+ experts, ordered by count descending
    category_counts = db.execute(
        select(Expert.category, func.count().label("cnt"))
        .where(Expert.category.is_not(None))
        .group_by(Expert.category)
        .having(func.count() >= 3)
        .order_by(func.count().desc())
    ).all()

    for cat_row in category_counts:
        category = cat_row.category
        total = cat_row.cnt

        experts = db.scalars(
            select(Expert)
            .where(Expert.category == category)
            .order_by(Expert.findability_score.desc().nulls_last())
            .limit(per_row)
        ).all()

        rows.append({
            "title": category,
            "slug": _slugify(category),
            "experts": [_serialize_browse_card(e) for e in experts],
            "total": total,
        })

    # 2. Special cross-category row: "Recently Added"
    recently_added_total = db.scalar(
        select(func.count()).select_from(Expert)
    ) or 0

    recently_added = db.scalars(
        select(Expert)
        .order_by(Expert.created_at.desc())
        .limit(per_row)
    ).all()

    if recently_added:
        rows.append({
            "title": "Recently Added",
            "slug": "recently-added",
            "experts": [_serialize_browse_card(e) for e in recently_added],
            "total": recently_added_total,
        })

    # 3. Cold-start guard: if zero category rows qualified, return a single "All Experts" row
    has_category_rows = any(r["slug"] != "recently-added" for r in rows)
    if not has_category_rows:
        all_total = db.scalar(
            select(func.count()).select_from(Expert)
        ) or 0

        all_experts = db.scalars(
            select(Expert)
            .order_by(Expert.findability_score.desc().nulls_last())
            .limit(per_row)
        ).all()

        rows = [{
            "title": "All Experts",
            "slug": "all",
            "experts": [_serialize_browse_card(e) for e in all_experts],
            "total": all_total,
        }]

    # 4. Featured: top 5 experts overall by findability_score
    featured_experts = db.scalars(
        select(Expert)
        .order_by(Expert.findability_score.desc().nulls_last())
        .limit(5)
    ).all()

    return {
        "featured": [_serialize_browse_card(e) for e in featured_experts],
        "rows": rows,
    }


@router.get("/api/browse")
async def browse(
    db: Session = Depends(get_db),
    per_row: int = Query(default=10, ge=1, le=30),
):
    """
    Return curated Browse data: featured experts and category rows.

    Each category with 3+ experts gets a row. Includes a "Recently Added" cross-category row.
    Falls back to a single "All Experts" row when no categories meet the threshold.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: _build_browse_data(db, per_row),
    )


@router.get("/api/photos/{username}")
async def photo_proxy(
    username: str,
    db: Session = Depends(get_db),
):
    """
    Proxy an expert's photo from the stored URL.

    Returns the upstream image bytes with a 24-hour cache header.
    Enforces HTTPS on upstream URLs. Returns 404 if expert or photo not found,
    502 if upstream is unavailable.
    """
    # Look up expert in executor thread (sync SQLAlchemy)
    loop = asyncio.get_event_loop()
    expert = await loop.run_in_executor(
        None,
        lambda: db.scalar(select(Expert).where(Expert.username == username)),
    )

    if not expert or not expert.photo_url:
        raise HTTPException(status_code=404, detail="Photo not found")

    # HTTPS enforcement: rewrite http:// to https://
    upstream_url = expert.photo_url
    if upstream_url.startswith("http://"):
        upstream_url = "https://" + upstream_url[7:]

    # Fetch upstream image
    async with httpx.AsyncClient() as client:
        try:
            upstream_resp = await client.get(upstream_url, timeout=5.0)
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Upstream photo unavailable")

    if upstream_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Upstream photo unavailable")

    content_type = upstream_resp.headers.get("content-type", "image/jpeg")

    return StreamingResponse(
        iter([upstream_resp.content]),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
