"""
Admin expert CRUD, tag-all, ingest, domain-map, add-expert, deletion endpoints.
"""
import csv
import json
import math
import threading
from collections import Counter
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session


from app.database import get_db, SessionLocal
from app.models import Expert, Feedback
from app.services.explore_cache import invalidate_explore_cache
from app.services.tagging import compute_findability_score, tag_expert_sync
from app.services.tag_sync import sync_expert_tags
from app.routers.admin._common import (
    _auto_categorize,
    _auto_industry_tags,
    _ingest,
    _ingest_lock,
    _run_ingest_job,
    _run_tag_job,
    _serialize_expert,
    EXPERTS_CSV_PATH,
    log,
)

router = APIRouter()


@router.get("/experts")
def get_experts(
    db: Session = Depends(get_db),
    active_only: bool = Query(default=False),
    page: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    search: str = Query(default=""),
):
    """Return paginated experts from the DB. Supports search by name, page/limit params."""
    stmt = select(Expert)
    if active_only:
        stmt = stmt.where(Expert.is_active.is_(True))
    if search:
        search_lower = search.lower()
        stmt = stmt.where(
            func.lower(Expert.first_name + " " + Expert.last_name).contains(search_lower)
        )
    # Alphabetical A-Z, letters first, specials (non-letter starts) last
    letters_first = case(
        (func.substr(func.upper(Expert.first_name), 1, 1).between('A', 'Z'), 0),
        else_=1,
    )
    stmt = stmt.order_by(letters_first, Expert.first_name.asc(), Expert.last_name.asc())

    # Count total matching rows before pagination
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    total = total or 0

    # Apply pagination
    experts = db.scalars(stmt.offset(page * limit).limit(limit)).all()

    return {
        "experts": [_serialize_expert(e) for e in experts],
        "total": total,
        "page": page,
        "total_pages": math.ceil(total / limit) if total else 0,
    }


@router.post("/experts/tag-all")
def tag_all(request: Request):
    """
    Run tag_experts.py in a background thread (tags + findability scores only, no FAISS rebuild).
    Returns 409 if a job is already running.
    """
    global _ingest
    if _ingest["status"] == "running":
        raise HTTPException(status_code=409, detail="Job already running")
    _ingest["status"] = "running"
    thread = threading.Thread(target=_run_tag_job, daemon=True)
    thread.start()
    return {"status": "started"}


@router.post("/ingest/run")
async def ingest_run(request: Request):
    """
    Trigger tag_experts.py + ingest.py in a background thread, then hot-reload FAISS.
    Returns 409 if a job is already running.
    """
    global _ingest
    async with _ingest_lock:
        if _ingest["status"] == "running":
            raise HTTPException(status_code=409, detail="Ingest job already running")
        _ingest["status"] = "running"
    thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
    thread.start()
    return {"status": "started"}


@router.get("/ingest/status")
def ingest_status():
    """Return the current ingest job state."""
    return _ingest


@router.get("/domain-map")
def get_domain_map(db: Session = Depends(get_db)):
    """Return top-10 expert tag domains by frequency in downvoted results."""
    downvote_expert_ids = db.scalars(
        select(Feedback.expert_ids).where(Feedback.vote == "down")
    ).all()

    url_set: set[str] = set()
    for raw in downvote_expert_ids:
        for entry in json.loads(raw or "[]"):
            url_set.add(entry)

    if not url_set:
        return {"domains": []}

    experts = db.scalars(
        select(Expert).where(Expert.profile_url.in_(list(url_set)))
    ).all()

    tag_counter: Counter = Counter()
    for expert in experts:
        for tag in json.loads(expert.tags or "[]"):
            tag_counter[tag.lower().strip()] += 1

    return {
        "domains": [
            {"domain": d, "count": c}
            for d, c in tag_counter.most_common(10)
        ]
    }


class ClassifyBody(BaseModel):
    category: str


@router.post("/experts/{username}/classify")
def classify_expert(username: str, body: ClassifyBody, db: Session = Depends(get_db)):
    """Set the category on a single expert in the DB."""
    expert = db.scalar(select(Expert).where(Expert.username == username))
    if not expert:
        raise HTTPException(status_code=404, detail=f"Expert '{username}' not found")
    expert.category = body.category
    db.commit()
    return {"ok": True}


@router.post("/experts/auto-classify")
def auto_classify_experts(db: Session = Depends(get_db)):
    """Keyword-match job_title against CATEGORY_KEYWORDS for all unclassified experts."""
    unclassified = db.scalars(
        select(Expert).where(Expert.category.is_(None))
    ).all()

    classified = 0
    categories: dict[str, str] = {}

    for expert in unclassified:
        cat = _auto_categorize(expert.job_title)
        if cat:
            expert.category = cat
            classified += 1
            categories[expert.username] = cat

    if classified:
        db.commit()

    return {"classified": classified, "categories": categories}


@router.post("/experts/assign-industry-tags")
def assign_industry_tags(db: Session = Depends(get_db)):
    """Batch-assign industry tags to ALL existing experts based on keyword matching."""
    all_experts = db.scalars(select(Expert)).all()
    updated = 0
    for expert in all_experts:
        itags = _auto_industry_tags(expert.job_title or "", expert.bio or "", expert.company or "")
        new_val = json.dumps(itags) if itags else None
        if expert.industry_tags != new_val:
            expert.industry_tags = new_val
            updated += 1
    if updated:
        db.commit()
    return {"updated": updated}


# ── Expert Deletion ──────────────────────────────────────────────────────────

@router.delete("/experts/{username}")
def delete_expert(username: str, request: Request, db: Session = Depends(get_db)):
    """Soft-delete a single expert (sets is_active=False). Triggers FAISS rebuild to exclude them."""
    expert = db.scalar(select(Expert).where(Expert.username == username))
    if not expert:
        raise HTTPException(status_code=404, detail=f"Expert '{username}' not found")

    expert.is_active = False
    db.commit()
    invalidate_explore_cache()

    # Trigger FAISS rebuild in background (ingest.py filters is_active=False automatically)
    rebuilding = False
    if _ingest["status"] != "running":
        _ingest["status"] = "running"
        thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
        thread.start()
        rebuilding = True

    log.info("admin.expert_soft_deleted", username=username, rebuilding=rebuilding)
    return {"ok": True, "username": username, "rebuilding": rebuilding}


class BulkDeleteBody(BaseModel):
    usernames: list[str] = Field(..., min_length=1)


@router.post("/experts/delete-bulk")
def delete_experts_bulk(body: BulkDeleteBody, request: Request, db: Session = Depends(get_db)):
    """Soft-delete multiple experts (sets is_active=False). Triggers FAISS rebuild to exclude them."""
    experts = db.scalars(
        select(Expert).where(Expert.username.in_(body.usernames))
    ).all()

    deleted_usernames = []
    for expert in experts:
        deleted_usernames.append(expert.username)
        expert.is_active = False
    db.commit()

    if not deleted_usernames:
        return {"ok": True, "deleted": 0, "rebuilding": False}

    invalidate_explore_cache()

    rebuilding = False
    if _ingest["status"] != "running":
        _ingest["status"] = "running"
        thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
        thread.start()
        rebuilding = True

    log.info("admin.experts_bulk_soft_deleted", count=len(deleted_usernames), usernames=deleted_usernames, rebuilding=rebuilding)
    return {"ok": True, "deleted": len(deleted_usernames), "rebuilding": rebuilding}


def _retry_tag_expert_background(expert_id: int) -> None:
    """Background retry for auto-tagging when synchronous Gemini call fails."""
    try:
        with SessionLocal() as db:
            expert = db.scalar(select(Expert).where(Expert.id == expert_id))
            if not expert or not (expert.bio or "").strip():
                return
            tags = tag_expert_sync(expert)
            score = compute_findability_score(expert, tags)
            expert.tags = json.dumps(tags)
            expert.findability_score = score
            # Phase 56: sync expert_tags after tagging
            sync_expert_tags(db, expert.id, tags, json.loads(expert.industry_tags or "[]"))
            db.commit()
    except Exception as e:
        log.error("background_tag_retry.failed", expert_id=expert_id, error=str(e))


class AddExpertBody(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    bio: str
    hourly_rate: float
    profile_url: Optional[str] = None
    photo_url: Optional[str] = None


@router.post("/experts")
def add_expert(body: AddExpertBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Add a new expert to the DB and append to experts.csv for FAISS ingestion."""
    existing = db.scalar(select(Expert).where(Expert.username == body.username))
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    profile_url = body.profile_url or f"https://tinrate.com/u/{body.username}"
    profile_url_utm = (
        f"https://tinrate.com/u/{body.username}/"
        "?utm_source=chat&utm_medium=search&utm_campaign=chat"
    )

    _itags = _auto_industry_tags(body.job_title, body.bio, body.company)
    new_expert = Expert(
        username=body.username,
        email="",
        first_name=body.first_name,
        last_name=body.last_name,
        job_title=body.job_title,
        company=body.company,
        bio=body.bio,
        hourly_rate=body.hourly_rate,
        currency="EUR",
        profile_url=profile_url,
        profile_url_utm=profile_url_utm,
        category=_auto_categorize(body.job_title),
        industry_tags=json.dumps(_itags) if _itags else None,
    )
    db.add(new_expert)
    db.commit()
    db.refresh(new_expert)

    # Auto-tag: synchronous Gemini call if expert has a bio
    if (new_expert.bio or "").strip():
        try:
            tags = tag_expert_sync(new_expert)
            score = compute_findability_score(new_expert, tags)
            new_expert.tags = json.dumps(tags)
            new_expert.findability_score = score
            # Phase 56: sync expert_tags after tagging
            sync_expert_tags(db, new_expert.id, tags, _itags)
            db.commit()
        except Exception as e:
            log.warning(
                "add_expert.tagging_failed_scheduling_retry",
                username=body.username,
                error=str(e),
            )
            background_tasks.add_task(_retry_tag_expert_background, new_expert.id)
    else:
        new_expert.findability_score = compute_findability_score(new_expert, tags=None)
        # Phase 56: sync expert_tags (no skill tags, only industry tags)
        sync_expert_tags(db, new_expert.id, [], _itags)
        db.commit()

    invalidate_explore_cache()

    # Append to experts.csv
    csv_exists = EXPERTS_CSV_PATH.exists()
    with open(EXPERTS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        fieldnames = [
            "Username", "First Name", "Last Name", "Job Title",
            "Company", "Bio", "Hourly Rate", "Currency", "Profile URL",
            "Profile URL with UTM", "Profile Image Url", "Created At",
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not csv_exists:
            writer.writeheader()
        writer.writerow({
            "Username": body.username,
            "First Name": body.first_name,
            "Last Name": body.last_name,
            "Job Title": body.job_title,
            "Company": body.company,
            "Bio": body.bio,
            "Hourly Rate": body.hourly_rate,
            "Currency": "EUR",
            "Profile URL": profile_url,
            "Profile URL with UTM": profile_url_utm,
            "Profile Image Url": body.photo_url or "",
            "Created At": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        })

    return {
        "ok": True,
        "username": body.username,
        "tags": json.loads(new_expert.tags or "null"),
        "findability_score": new_expert.findability_score,
    }

