"""
Tag sync helpers for the expert_tags normalized table (PERF-02).

Keeps the expert_tags join table in sync with Expert.tags and Expert.industry_tags
JSON columns. Called from:
  - Startup (sync_all_expert_tags) — full rebuild after FTS5 rebuild
  - Admin write paths (sync_expert_tags) — per-expert sync after tag updates
"""
import json

import structlog
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Expert, ExpertTag

log = structlog.get_logger()


def sync_expert_tags(
    db: Session,
    expert_id: int,
    tags: list[str],
    industry_tags: list[str],
) -> None:
    """
    Delete and re-insert expert_tags rows for one expert.

    Call this after any update to Expert.tags or Expert.industry_tags.
    Does NOT commit — caller handles the transaction.

    Args:
        db: SQLAlchemy Session.
        expert_id: The expert's primary key.
        tags: List of skill tags (lowercased on insert).
        industry_tags: List of industry tags (as-is — controlled vocabulary).
    """
    db.execute(delete(ExpertTag).where(ExpertTag.expert_id == expert_id))
    rows = [
        ExpertTag(expert_id=expert_id, tag=t.lower().strip(), tag_type="skill")
        for t in tags if t and t.strip()
    ] + [
        ExpertTag(expert_id=expert_id, tag=t.strip(), tag_type="industry")
        for t in industry_tags if t and t.strip()
    ]
    if rows:
        db.bulk_save_objects(rows)


def sync_all_expert_tags(db: Session) -> None:
    """
    Rebuild the entire expert_tags table from Expert.tags and Expert.industry_tags.

    Idempotent: deletes all rows, re-inserts from source columns.
    Called at startup (same pattern as FTS5 rebuild).
    Commits the transaction.
    """
    # Delete all existing rows
    db.execute(delete(ExpertTag))

    # Query all experts with tags or industry_tags
    experts = db.query(Expert).filter(
        (Expert.tags != None) | (Expert.industry_tags != None)  # noqa: E711
    ).all()

    total_rows = 0
    for expert in experts:
        rows: list[ExpertTag] = []

        # Parse skill tags from JSON array
        if expert.tags:
            try:
                skill_tags = json.loads(expert.tags)
                if isinstance(skill_tags, list):
                    rows.extend(
                        ExpertTag(
                            expert_id=expert.id,
                            tag=t.lower().strip(),
                            tag_type="skill",
                        )
                        for t in skill_tags if t and isinstance(t, str) and t.strip()
                    )
            except (json.JSONDecodeError, TypeError):
                pass  # Skip malformed JSON

        # Parse industry tags from JSON array
        if expert.industry_tags:
            try:
                ind_tags = json.loads(expert.industry_tags)
                if isinstance(ind_tags, list):
                    rows.extend(
                        ExpertTag(
                            expert_id=expert.id,
                            tag=t.strip(),
                            tag_type="industry",
                        )
                        for t in ind_tags if t and isinstance(t, str) and t.strip()
                    )
            except (json.JSONDecodeError, TypeError):
                pass  # Skip malformed JSON

        if rows:
            db.bulk_save_objects(rows)
            total_rows += len(rows)

    db.commit()
    log.info("tag_sync.rebuild_complete", expert_count=len(experts), tag_rows=total_rows)
