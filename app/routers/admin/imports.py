"""
Admin bulk import endpoints: preview-csv, import-csv, sync-preview, sync-apply, photos.
"""
import csv
import io
import json
import threading

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expert, Conversation
from app.services.tag_sync import sync_expert_tags
from app.routers.admin._common import _auto_categorize, _auto_industry_tags, _ingest, _run_ingest_job

router = APIRouter()


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


# ── Shared helper ──────────────────────────────────────────────────────────────

def _parse_csv_with_mapping(content: str, column_mapping_str: str) -> dict[str, dict]:
    """
    Parse a CSV (already decoded to str) using an optional column_mapping JSON string.
    Returns a dict keyed by username (stripped) mapping to the normalised row dict.
    Rows with an empty username are skipped.
    """
    mapping: dict = {}
    if column_mapping_str:
        try:
            mapping = json.loads(column_mapping_str)
        except (json.JSONDecodeError, TypeError):
            pass

    reader = csv.DictReader(io.StringIO(content))
    result: dict[str, dict] = {}

    for raw_row in reader:
        if mapping:
            reverse_map = {v: k for k, v in mapping.items()}
            row: dict = {}
            for expected_field in [
                "Username", "First Name", "Last Name", "Job Title",
                "Company", "Bio", "Hourly Rate", "Currency",
                "Profile URL", "Profile URL with UTM", "Profile Image Url",
            ]:
                csv_col = reverse_map.get(expected_field, expected_field)
                row[expected_field] = raw_row.get(csv_col, "")
        else:
            row = dict(raw_row)

        username = (row.get("Username") or "").strip()
        if not username:
            continue
        result[username] = row

    return result


# ── Sync endpoints ─────────────────────────────────────────────────────────────

# Field map: CSV header -> Expert attribute name
_SYNC_FIELDS: list[tuple[str, str]] = [
    ("First Name",          "first_name"),
    ("Last Name",           "last_name"),
    ("Job Title",           "job_title"),
    ("Company",             "company"),
    ("Bio",                 "bio"),
    ("Currency",            "currency"),
    ("Profile URL",         "profile_url"),
    ("Profile URL with UTM","profile_url_utm"),
    ("Profile Image Url",   "photo_url"),
]


@router.post("/experts/sync-preview")
async def sync_preview(
    file: UploadFile = File(...),
    column_mapping: str = Form(default=""),
    db: Session = Depends(get_db),
):
    """
    Analyse a CSV against the current DB and return a sync plan categorising
    experts into to_add, to_update (with per-field diffs), and to_delete.
    No data is written — this is a read-only preview step.
    """
    content = (await file.read()).decode("utf-8-sig")
    csv_rows = _parse_csv_with_mapping(content, column_mapping)
    csv_usernames = set(csv_rows.keys())

    # Fetch ALL experts (active and inactive) from DB
    all_db_experts: list[Expert] = list(db.scalars(select(Expert)).all())
    db_experts: dict[str, Expert] = {e.username: e for e in all_db_experts}
    db_usernames = set(db_experts.keys())
    active_db_usernames = {e.username for e in all_db_experts if e.is_active}

    # ── to_add: in CSV but not in DB at all ───────────────────────────────────
    to_add = []
    for u in csv_usernames - db_usernames:
        row = csv_rows[u]
        to_add.append({
            "username": u,
            "first_name": (row.get("First Name") or "").strip(),
            "last_name": (row.get("Last Name") or "").strip(),
            "job_title": (row.get("Job Title") or "").strip(),
        })

    # ── to_update: in both CSV and DB (active or inactive) ───────────────────
    to_update = []
    for u in csv_usernames & db_usernames:
        expert = db_experts[u]
        row = csv_rows[u]
        changes: dict[str, dict] = {}

        for csv_field, attr in _SYNC_FIELDS:
            csv_val = (row.get(csv_field) or "").strip()
            if not csv_val:
                continue  # empty CSV fields never overwrite
            db_val = getattr(expert, attr) or ""
            # For photo_url None becomes ""
            if isinstance(db_val, float):
                # handled separately below
                continue
            if str(csv_val) != str(db_val):
                changes[attr] = {"old": db_val, "new": csv_val}

        # Hourly Rate comparison (float)
        csv_rate_str = (row.get("Hourly Rate") or "").strip()
        if csv_rate_str:
            try:
                csv_rate = float(csv_rate_str)
                db_rate = expert.hourly_rate or 0.0
                if csv_rate != db_rate:
                    changes["hourly_rate"] = {"old": db_rate, "new": csv_rate}
            except (ValueError, TypeError):
                pass

        reactivate = not expert.is_active

        if changes or reactivate:
            to_update.append({
                "username": u,
                "first_name": expert.first_name,
                "last_name": expert.last_name,
                "changes": changes,
                "reactivate": reactivate,
            })

    # ── to_delete: currently active in DB but not in CSV ─────────────────────
    to_delete = []
    for u in active_db_usernames - csv_usernames:
        expert = db_experts[u]
        to_delete.append({
            "username": u,
            "first_name": expert.first_name,
            "last_name": expert.last_name,
            "job_title": expert.job_title,
        })

    return {
        "to_add": to_add,
        "to_update": to_update,
        "to_delete": to_delete,
        "summary": {
            "total_csv_rows": len(csv_rows),
            "total_db_experts": len(db_experts),
            "adds": len(to_add),
            "updates": len(to_update),
            "deletes": len(to_delete),
            "reactivations": sum(1 for u in to_update if u.get("reactivate")),
        },
    }


@router.post("/experts/sync-apply")
async def sync_apply(
    file: UploadFile = File(...),
    column_mapping: str = Form(default=""),
    skip_deletes: str = Form(default="[]"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Apply a full CSV sync: add new experts, update existing ones (empty fields skipped),
    soft-delete active experts missing from the CSV (unless in skip_deletes), and
    reactivate previously soft-deleted experts whose username appears in the CSV.
    Triggers a FAISS rebuild after commit.
    """
    content = (await file.read()).decode("utf-8-sig")
    csv_rows = _parse_csv_with_mapping(content, column_mapping)
    csv_usernames = set(csv_rows.keys())

    # Parse skip_deletes (JSON list of usernames the admin chose to keep)
    try:
        skip_set: set[str] = set(json.loads(skip_deletes))
    except (json.JSONDecodeError, TypeError, ValueError):
        skip_set = set()

    # Fetch ALL experts
    all_db_experts: list[Expert] = list(db.scalars(select(Expert)).all())
    db_experts: dict[str, Expert] = {e.username: e for e in all_db_experts}
    db_usernames = set(db_experts.keys())
    active_db_usernames = {e.username for e in all_db_experts if e.is_active}

    inserted = updated = deleted = reactivated = skipped = 0

    # ── Apply additions ───────────────────────────────────────────────────────
    for u in csv_usernames - db_usernames:
        row = csv_rows[u]
        _jt = (row.get("Job Title") or "").strip()
        _bio = (row.get("Bio") or "").strip()
        _co = (row.get("Company") or "").strip()
        _itags = _auto_industry_tags(_jt, _bio, _co)
        _itags_val = json.dumps(_itags) if _itags else None

        try:
            hourly_rate = float(row.get("Hourly Rate") or 0)
        except (ValueError, TypeError):
            hourly_rate = 0.0

        profile_url = (row.get("Profile URL") or f"https://tinrate.com/u/{u}").strip()
        profile_url_utm = (row.get("Profile URL with UTM") or "").strip()

        new_expert = Expert(
            username=u,
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
        db.flush()  # get the new expert.id for tag sync
        sync_expert_tags(db, new_expert.id, [], _itags)
        inserted += 1

    # ── Apply updates (and reactivations) ─────────────────────────────────────
    for u in csv_usernames & db_usernames:
        expert = db_experts[u]
        row = csv_rows[u]
        changed = False

        # Reactivate if soft-deleted
        if not expert.is_active:
            expert.is_active = True
            reactivated += 1
            changed = True

        # Update each field only if CSV value is non-empty
        for csv_field, attr in _SYNC_FIELDS:
            csv_val = (row.get(csv_field) or "").strip()
            if csv_val:
                setattr(expert, attr, csv_val)
                changed = True

        # Hourly Rate (float)
        csv_rate_str = (row.get("Hourly Rate") or "").strip()
        if csv_rate_str:
            try:
                expert.hourly_rate = float(csv_rate_str)
                changed = True
            except (ValueError, TypeError):
                pass

        # Recalculate industry tags from updated job_title / bio / company
        _itags = _auto_industry_tags(
            expert.job_title or "",
            expert.bio or "",
            expert.company or "",
        )
        expert.industry_tags = json.dumps(_itags) if _itags else None

        # Re-sync expert_tags junction table
        skill_tags = json.loads(expert.tags or "[]") if expert.tags else []
        sync_expert_tags(db, expert.id, skill_tags, _itags)

        if changed:
            updated += 1

    # ── Apply soft-deletions ──────────────────────────────────────────────────
    for u in (active_db_usernames - csv_usernames) - skip_set:
        expert = db_experts[u]
        expert.is_active = False
        deleted += 1

    # Track skipped deletions
    skipped = len(active_db_usernames - csv_usernames) - deleted

    db.commit()

    # ── Trigger FAISS rebuild ─────────────────────────────────────────────────
    rebuilding = False
    if request is not None and _ingest["status"] != "running":
        _ingest["status"] = "running"
        thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
        thread.start()
        rebuilding = True

    return {
        "inserted": inserted,
        "updated": updated,
        "deleted": deleted,
        "reactivated": reactivated,
        "skipped": skipped,
        "rebuilding": rebuilding,
    }


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
