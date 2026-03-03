"""
Admin expert CRUD, tag-all, ingest, domain-map, compare, photo import, CSV import.
"""
import csv
import io
import json
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import structlog

from app.config import METADATA_PATH
from app.database import get_db, SessionLocal
from app.models import Expert, Feedback
from app.services.retriever import retrieve
from app.services.search_intelligence import (  # noqa: PLC2701
    get_settings,
    _is_weak_query,
    _generate_hypothetical_bio,
    _blend_embeddings,
    _search_with_vector,
    _merge_candidates,
    _apply_feedback_boost,
)
from app.services.tagging import compute_findability_score, tag_expert_sync
from app.services.tag_sync import sync_expert_tags, sync_all_expert_tags
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
def get_experts(db: Session = Depends(get_db)):
    """Return all experts from the experts DB table."""
    experts = db.scalars(
        select(Expert).order_by(Expert.findability_score.asc().nulls_first())
    ).all()
    return {"experts": [_serialize_expert(e) for e in experts]}


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
    """Delete a single expert from DB, metadata.json, and experts.csv."""
    expert = db.scalar(select(Expert).where(Expert.username == username))
    if not expert:
        raise HTTPException(status_code=404, detail=f"Expert '{username}' not found")

    db.delete(expert)
    db.commit()

    # Remove from metadata.json
    if METADATA_PATH.exists():
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata = [m for m in metadata if m.get("Username") != username]
        with open(METADATA_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    # Remove from experts.csv
    if EXPERTS_CSV_PATH.exists():
        with open(EXPERTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            rows = [row for row in reader if row.get("Username") != username]
        with open(EXPERTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    # Trigger FAISS rebuild in background
    rebuilding = False
    if _ingest["status"] != "running":
        _ingest["status"] = "running"
        thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
        thread.start()
        rebuilding = True

    log.info("admin.expert_deleted", username=username, rebuilding=rebuilding)
    return {"ok": True, "username": username, "rebuilding": rebuilding}


class BulkDeleteBody(BaseModel):
    usernames: list[str] = Field(..., min_length=1)


@router.post("/experts/delete-bulk")
def delete_experts_bulk(body: BulkDeleteBody, request: Request, db: Session = Depends(get_db)):
    """Delete multiple experts from DB, metadata.json, and experts.csv."""
    experts = db.scalars(
        select(Expert).where(Expert.username.in_(body.usernames))
    ).all()

    deleted_usernames = []
    for expert in experts:
        deleted_usernames.append(expert.username)
        db.delete(expert)
    db.commit()

    if not deleted_usernames:
        return {"ok": True, "deleted": 0, "rebuilding": False}

    username_set = set(deleted_usernames)

    if METADATA_PATH.exists():
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata = [m for m in metadata if m.get("Username") not in username_set]
        with open(METADATA_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    if EXPERTS_CSV_PATH.exists():
        with open(EXPERTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            rows = [row for row in reader if row.get("Username") not in username_set]
        with open(EXPERTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    rebuilding = False
    if _ingest["status"] != "running":
        _ingest["status"] = "running"
        thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
        thread.start()
        rebuilding = True

    log.info("admin.experts_bulk_deleted", count=len(deleted_usernames), usernames=deleted_usernames, rebuilding=rebuilding)
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


@router.post("/experts/preview-csv")
async def preview_csv(file: UploadFile = File(...)):
    """Parse a CSV file and return the first 5 rows as JSON for preview."""
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    headers = reader.fieldnames or []
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(dict(row))
    total_rows = content.count('\n') - 1
    return {"headers": headers, "preview_rows": rows, "total_rows": max(total_rows, len(rows))}


@router.post("/experts/import-csv")
async def import_experts_csv(file: UploadFile = File(...), column_mapping: str = Form(default=""), db: Session = Depends(get_db)):
    """Bulk-import experts from a CSV file with upsert behaviour."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    mapping = {}
    if column_mapping:
        try:
            mapping = json.loads(column_mapping)
        except (json.JSONDecodeError, TypeError):
            pass

    inserted = updated = skipped = 0

    for raw_row in reader:
        if mapping:
            row = {}
            reverse_map = {v: k for k, v in mapping.items()}
            for expected_field in ["Username", "First Name", "Last Name", "Job Title",
                                   "Company", "Bio", "Hourly Rate", "Currency",
                                   "Profile URL", "Profile URL with UTM", "Profile Image Url"]:
                csv_col = reverse_map.get(expected_field, expected_field)
                row[expected_field] = raw_row.get(csv_col, "")
        else:
            row = raw_row
        username = (row.get("Username") or "").strip()
        if not username:
            skipped += 1
            continue

        try:
            hourly_rate = float(row.get("Hourly Rate") or 0)
        except (ValueError, TypeError):
            hourly_rate = 0.0

        existing = db.scalar(select(Expert).where(Expert.username == username))

        _jt = (row.get("Job Title") or "").strip()
        _bio = (row.get("Bio") or "").strip()
        _co = (row.get("Company") or "").strip()
        _itags = _auto_industry_tags(_jt, _bio, _co)
        _itags_val = json.dumps(_itags) if _itags else None

        if existing:
            existing.first_name = (row.get("First Name") or "").strip()
            existing.last_name = (row.get("Last Name") or "").strip()
            existing.job_title = _jt
            existing.company = _co
            existing.bio = _bio
            existing.hourly_rate = hourly_rate
            existing.currency = (row.get("Currency") or "EUR").strip()
            existing.profile_url = (row.get("Profile URL") or "").strip()
            existing.profile_url_utm = (row.get("Profile URL with UTM") or "").strip()
            existing.photo_url = (row.get("Profile Image Url") or "").strip() or None
            existing.industry_tags = _itags_val
            # Phase 56: sync expert_tags for updated expert
            skill_tags = json.loads(existing.tags or "[]") if existing.tags else []
            sync_expert_tags(db, existing.id, skill_tags, _itags)
            updated += 1
        else:
            profile_url = (row.get("Profile URL") or f"https://tinrate.com/u/{username}").strip()
            profile_url_utm = (row.get("Profile URL with UTM") or "").strip()
            new_expert = Expert(
                username=username,
                first_name=(row.get("First Name") or "").strip(),
                last_name=(row.get("Last Name") or "").strip(),
                job_title=_jt,
                company=_co,
                bio=_bio,
                hourly_rate=hourly_rate,
                currency=(row.get("Currency") or "EUR").strip(),
                profile_url=profile_url,
                profile_url_utm=profile_url_utm,
                photo_url=(row.get("Profile Image Url") or "").strip() or None,
                category=_auto_categorize(_jt),
                industry_tags=_itags_val,
            )
            db.add(new_expert)
            db.flush()  # Get the new expert.id for tag sync
            # Phase 56: sync expert_tags for new expert
            sync_expert_tags(db, new_expert.id, [], _itags)
            inserted += 1

    db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


# --- Photo management endpoints ---

@router.post("/experts/photos")
async def import_expert_photos(
    file: UploadFile = File(...),
    dry_run: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    """Bulk-import expert photo URLs from a CSV file."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    fieldnames = reader.fieldnames or []
    required = {"first_name", "last_name", "photo_url"}
    missing = required - {f.strip().lower() for f in fieldnames}
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required CSV columns: {', '.join(sorted(missing))}. "
                   f"Found: {', '.join(fieldnames)}",
        )

    def _get(row: dict, key: str) -> str:
        for k, v in row.items():
            if k.strip().lower() == key:
                return (v or "").strip()
        return ""

    details: list[dict] = []
    matched_count = 0
    not_found_count = 0
    ambiguous_count = 0
    will_overwrite = 0
    experts_to_update: list[tuple] = []

    for row in reader:
        first_name = _get(row, "first_name")
        last_name = _get(row, "last_name")
        photo_url = _get(row, "photo_url")

        if not first_name or not last_name:
            details.append({"first_name": first_name, "last_name": last_name, "status": "not_found"})
            not_found_count += 1
            continue

        matches = db.scalars(
            select(Expert).where(
                func.lower(Expert.first_name) == first_name.lower(),
                func.lower(Expert.last_name) == last_name.lower(),
            )
        ).all()

        if len(matches) == 0:
            details.append({"first_name": first_name, "last_name": last_name, "status": "not_found"})
            not_found_count += 1
        elif len(matches) == 1:
            expert = matches[0]
            existing_photo = expert.photo_url if expert.photo_url else None
            if existing_photo:
                will_overwrite += 1
            details.append({
                "first_name": first_name, "last_name": last_name,
                "status": "matched", "username": expert.username, "existing_photo": existing_photo,
            })
            matched_count += 1
            experts_to_update.append((expert, photo_url))
        else:
            matching_usernames = [m.username for m in matches]
            details.append({
                "first_name": first_name, "last_name": last_name,
                "status": "ambiguous", "matches": matching_usernames,
            })
            ambiguous_count += 1

    if not dry_run:
        for expert, new_photo_url in experts_to_update:
            expert.photo_url = new_photo_url
        db.commit()

    return {
        "dry_run": dry_run,
        "summary": {
            "total": len(details), "matched": matched_count,
            "not_found": not_found_count, "ambiguous": ambiguous_count, "will_overwrite": will_overwrite,
        },
        "details": details,
    }


# ── Search Lab A/B Compare ────────────────────────────────────────────────────

_LAB_CONFIGS = {
    "explore_baseline": {"pipeline": "run_explore"},
    "explore_full":     {"pipeline": "run_explore"},
    "legacy_baseline":  {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": False},
    "legacy_hyde":      {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": False},
    "legacy_feedback":  {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": True},
    "legacy_full":      {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": True},
    "baseline": {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": False},
    "hyde":     {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": False},
    "feedback": {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": False, "FEEDBACK_LEARNING_ENABLED": True},
    "full":     {"pipeline": "legacy", "QUERY_EXPANSION_ENABLED": True,  "FEEDBACK_LEARNING_ENABLED": True},
}

_LAB_LABELS = {
    "explore_baseline": "Explore (Baseline)",
    "explore_full":     "Explore (Full)",
    "legacy_baseline":  "Legacy Baseline",
    "legacy_hyde":      "Legacy HyDE Only",
    "legacy_feedback":  "Legacy Feedback Only",
    "legacy_full":      "Legacy Full Intelligence",
    "baseline": "Legacy Baseline",
    "hyde":     "Legacy HyDE Only",
    "feedback": "Legacy Feedback Only",
    "full":     "Legacy Full Intelligence",
}


class CompareRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    configs: list[str] = Field(
        default=["explore_baseline", "explore_full", "legacy_baseline", "legacy_full"],
    )
    result_count: int = Field(default=20, ge=1, le=50)
    overrides: dict[str, bool] = Field(default_factory=dict)


def _retrieve_for_lab(query, faiss_index, metadata, db, config_flags, result_count):
    settings = get_settings(db)
    settings.update(config_flags)
    candidates = retrieve(query, faiss_index, metadata)
    intelligence = {"hyde_triggered": False, "hyde_bio": None, "feedback_applied": False}

    if settings["QUERY_EXPANSION_ENABLED"] and _is_weak_query(
        candidates, settings["STRONG_RESULT_MIN"], settings["SIMILARITY_THRESHOLD"]
    ):
        bio = _generate_hypothetical_bio(query)
        if bio is not None:
            from app.services.embedder import embed_query  # noqa: PLC0415
            original_vec = embed_query(query)
            blended_vec = _blend_embeddings(original_vec, bio)
            hyde_candidates = _search_with_vector(blended_vec, faiss_index, metadata)
            candidates = _merge_candidates(candidates, hyde_candidates)
            intelligence["hyde_triggered"] = True
            intelligence["hyde_bio"] = bio

    if settings["FEEDBACK_LEARNING_ENABLED"]:
        candidates = _apply_feedback_boost(candidates, db, settings["FEEDBACK_BOOST_CAP"])
        intelligence["feedback_applied"] = True

    return candidates[:result_count], intelligence


def _explore_for_lab(query, db, app_state, result_count):
    from app.services.explorer import run_explore as _run_explore
    result = _run_explore(
        query=query, rate_min=0.0, rate_max=10000.0, tags=[], limit=result_count,
        cursor=0, db=db, app_state=app_state, industry_tags=[],
    )
    experts = [
        {"rank": i + 1, "name": f"{e.first_name} {e.last_name}", "title": e.job_title,
         "score": round(e.final_score, 4), "profile_url": getattr(e, 'profile_url', None)}
        for i, e in enumerate(result.experts)
    ]
    intelligence = {"hyde_triggered": False, "hyde_bio": None, "feedback_applied": True, "pipeline": "run_explore"}
    return experts, intelligence


@router.post("/compare")
def compare_configs(body: CompareRequest, request: Request, db: Session = Depends(get_db)):
    """Run a query through multiple pipeline configs in parallel."""
    unknown = [c for c in body.configs if c not in _LAB_CONFIGS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown config(s): {unknown}. Valid: {list(_LAB_CONFIGS.keys())}")

    faiss_index = request.app.state.faiss_index
    metadata = request.app.state.metadata
    app_state = request.app.state

    config_flag_pairs = [(name, {**_LAB_CONFIGS[name]}) for name in body.configs]

    def _run_one(args):
        name, flags = args
        pipeline = flags.get("pipeline", "legacy")
        thread_db = SessionLocal()
        try:
            if pipeline == "run_explore":
                experts, intelligence = _explore_for_lab(body.query, thread_db, app_state, body.result_count)
                return name, experts, intelligence
            else:
                config_flags = {k: v for k, v in flags.items() if k != "pipeline"}
                config_flags.update(body.overrides)
                candidates, intelligence = _retrieve_for_lab(
                    body.query, faiss_index, metadata, thread_db, config_flags, body.result_count
                )
                intelligence["pipeline"] = "legacy"
                return name, candidates, intelligence
        finally:
            thread_db.close()

    with ThreadPoolExecutor(max_workers=len(config_flag_pairs)) as executor:
        results = list(executor.map(_run_one, config_flag_pairs))

    columns = []
    for name, result_data, intelligence in results:
        pipeline = intelligence.get("pipeline", "legacy")
        if pipeline == "run_explore":
            experts_serialized = result_data
        else:
            experts_serialized = [
                {"rank": i + 1, "name": c.name, "title": c.title, "score": round(c.score, 4), "profile_url": c.profile_url}
                for i, c in enumerate(result_data)
            ]
        columns.append({
            "config": name, "label": _LAB_LABELS.get(name, name), "pipeline": pipeline,
            "experts": experts_serialized, "intelligence": intelligence,
        })

    return {"columns": columns, "query": body.query, "overrides_applied": body.overrides}
