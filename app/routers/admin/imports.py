"""
Admin bulk import endpoints: preview-csv, import-csv, photos.
"""
import csv
import io
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expert
from app.services.tag_sync import sync_expert_tags
from app.routers.admin._common import _auto_categorize, _auto_industry_tags

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
