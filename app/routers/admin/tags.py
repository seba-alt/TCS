"""Tag management endpoints — catalog CRUD + expert tag assignment (Phase 69.2)."""
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expert, ExpertTag, TagCatalog
from app.services.tag_sync import sync_expert_tags

router = APIRouter()


# ── Tag Catalog ──────────────────────────────────────────────────────────────


@router.get("/tags/catalog")
def get_tag_catalog(db: Session = Depends(get_db)):
    """List all predefined tags. Lazy-seed from AI skill tags if catalog is empty."""
    count = db.scalar(select(func.count()).select_from(TagCatalog))
    if count == 0:
        # Lazy seed from existing AI skill tags (unique)
        existing = db.scalars(
            select(ExpertTag.tag).where(ExpertTag.tag_type == "skill").distinct()
        ).all()
        if existing:
            for tag in existing:
                db.add(TagCatalog(tag=tag))
            db.commit()
    tags = db.scalars(select(TagCatalog).order_by(TagCatalog.tag)).all()
    return {"tags": [{"id": t.id, "tag": t.tag} for t in tags]}


class AddTagBody(BaseModel):
    tag: str = Field(..., min_length=1, max_length=200)


@router.post("/tags/catalog")
def add_tag_to_catalog(body: AddTagBody, db: Session = Depends(get_db)):
    """Add a new tag to the catalog."""
    normalized = body.tag.lower().strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Tag cannot be empty")
    exists = db.scalar(select(TagCatalog).where(TagCatalog.tag == normalized))
    if exists:
        raise HTTPException(status_code=409, detail="Tag already exists in catalog")
    entry = TagCatalog(tag=normalized)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "tag": entry.tag}


@router.delete("/tags/catalog/{tag_id}")
def delete_tag_from_catalog(tag_id: int, db: Session = Depends(get_db)):
    """Remove a tag from the catalog. Does NOT remove from already-assigned experts."""
    entry = db.get(TagCatalog, tag_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Tag not found in catalog")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# ── Tag Assignments ──────────────────────────────────────────────────────────


class BulkAssignBody(BaseModel):
    usernames: list[str] = Field(..., min_length=1)
    tags: list[str] = Field(..., min_length=1)


@router.post("/tags/assign")
def bulk_assign_tags(body: BulkAssignBody, db: Session = Depends(get_db)):
    """Bulk-assign tags to one or many experts. Additive only — never removes existing tags."""
    experts = db.scalars(
        select(Expert).where(Expert.username.in_(body.usernames))
    ).all()
    if not experts:
        raise HTTPException(status_code=404, detail="No matching experts found")

    tags_to_add = [t.lower().strip() for t in body.tags if t.strip()]
    if not tags_to_add:
        raise HTTPException(status_code=400, detail="No valid tags provided")

    updated = 0
    for expert in experts:
        existing = json.loads(expert.manual_tags or "[]")
        # Additive: add new tags, skip duplicates (case-insensitive)
        existing_lower = {t.lower() for t in existing}
        new_tags = [t for t in tags_to_add if t not in existing_lower]
        if not new_tags:
            continue
        merged = existing + new_tags
        expert.manual_tags = json.dumps(merged)
        # Sync ExpertTag rows
        ai_tags = json.loads(expert.tags or "[]")
        industry_tags = json.loads(expert.industry_tags or "[]")
        sync_expert_tags(db, expert.id, ai_tags, industry_tags, merged)
        updated += 1

    db.commit()
    return {"ok": True, "updated": updated, "total_experts": len(experts)}


@router.delete("/tags/assign/{username}/{tag}")
def remove_manual_tag(username: str, tag: str, db: Session = Depends(get_db)):
    """Remove a specific manual tag from one expert."""
    expert = db.scalar(select(Expert).where(Expert.username == username))
    if not expert:
        raise HTTPException(status_code=404, detail="Expert not found")

    existing = json.loads(expert.manual_tags or "[]")
    tag_lower = tag.lower().strip()
    new_list = [t for t in existing if t.lower() != tag_lower]

    if len(new_list) == len(existing):
        raise HTTPException(status_code=404, detail="Tag not found on this expert")

    expert.manual_tags = json.dumps(new_list) if new_list else None
    # Sync ExpertTag rows
    ai_tags = json.loads(expert.tags or "[]")
    industry_tags = json.loads(expert.industry_tags or "[]")
    sync_expert_tags(db, expert.id, ai_tags, industry_tags, new_list)
    db.commit()
    return {"ok": True}


@router.get("/tags/assignments")
def get_tag_assignments(db: Session = Depends(get_db)):
    """List all experts with their manual tags (for the tag manager UI)."""
    experts = db.scalars(
        select(Expert).where(
            Expert.manual_tags.isnot(None),
            Expert.is_active == True,
        )
    ).all()
    return {
        "assignments": [
            {
                "username": e.username,
                "first_name": e.first_name,
                "last_name": e.last_name,
                "manual_tags": json.loads(e.manual_tags or "[]"),
            }
            for e in experts
        ]
    }
