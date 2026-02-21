#!/usr/bin/env python3
"""
Offline batch script: AI-tag all experts using Gemini 2.5 Flash structured output.

Usage:
  python scripts/tag_experts.py

Prerequisites:
  1. GOOGLE_API_KEY set in environment (or .env file)
  2. scripts/tag_experts.py run AFTER scripts/ingest.py has populated the Expert DB table
  3. Run from repo root: python scripts/tag_experts.py

Behavior:
  - Skips experts where tags IS NOT NULL (idempotent — safe to re-run)
  - Skips experts with no bio — marks them in the skip log (no Gemini call)
  - On Gemini failure: retry once, then skip and log (does not abort the run)
  - After tagging run: computes findability scores for ALL experts (including no-bio ones)
  - Shows tqdm progress bar: "Tagging 423/1558"
  - Prints run summary only if failures/skips occurred

CONCURRENCY: default 5 concurrent Gemini calls. Tune upward after checking your
Gemini paid-tier RPM limit at https://ai.google.dev/gemini-api/docs/rate-limits
(Tier 1 is approximately 150 RPM for gemini-2.5-flash).
"""
import asyncio
import json
import sys
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from tqdm.asyncio import tqdm as async_tqdm

# Load .env for local development — no-op in production
load_dotenv()

# Allow importing from app/ when run from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models import Expert  # noqa: E402
from app.services.tagging import compute_findability_score  # noqa: E402
from sqlalchemy import select  # noqa: E402

# ── Config ─────────────────────────────────────────────────────────────────────

CONCURRENCY = 5  # Concurrent Gemini calls. Tune after checking AI Studio RPM limit.
MODEL = "gemini-2.5-flash"


# ── Pydantic schema for structured output ──────────────────────────────────────

class ExpertTags(BaseModel):
    tags: List[str]


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _load_untagged_experts() -> list[Expert]:
    """Load all Expert rows where tags IS NULL (not yet tagged)."""
    with SessionLocal() as db:
        return list(db.scalars(
            select(Expert).where(Expert.tags.is_(None))
        ).all())


def _load_all_experts() -> list[Expert]:
    """Load all Expert rows for findability score computation."""
    with SessionLocal() as db:
        return list(db.scalars(select(Expert)).all())


def _write_tags_to_db(expert_id: int, tags: list[str], score: float) -> None:
    """Write tags and findability score for one expert. Opens a fresh session."""
    with SessionLocal() as db:
        expert = db.get(Expert, expert_id)
        if expert:
            expert.tags = json.dumps(tags)
            expert.findability_score = score
            db.commit()


def _write_score_to_db(expert_id: int, score: float) -> None:
    """Write findability score only (for no-bio experts that were skipped)."""
    with SessionLocal() as db:
        expert = db.get(Expert, expert_id)
        if expert:
            expert.findability_score = score
            db.commit()


# ── Gemini async call ──────────────────────────────────────────────────────────

async def _call_gemini_for_tags(client: genai.Client, expert: Expert) -> list[str]:
    """
    Async Gemini call returning normalized domain tags.
    Uses client.aio (async variant) — correct for asyncio context.
    NEVER call this from a sync FastAPI route handler.
    """
    prompt = (
        f"Generate 3-8 concise domain expertise tags for this professional consultant.\n\n"
        f"Name: {expert.username}\n"
        f"Job Title: {expert.job_title or 'N/A'}\n"
        f"Bio: {expert.bio}\n\n"
        f"Example tags: 'machine learning', 'tax law', 'veterinary', 'crypto', "
        f"'real estate', 'supply chain', 'fundraising', 'climate tech'\n\n"
        f"Return tags that reflect their actual domain — not generic business terms."
    )
    response = await client.aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExpertTags,
            temperature=0.2,
        ),
    )
    data = ExpertTags.model_validate_json(response.text)
    # Normalize: lowercase + strip. Locked decision from CONTEXT.md.
    return [t.lower().strip() for t in data.tags if t.strip()]


# ── Batch runner ───────────────────────────────────────────────────────────────

async def run_batch() -> None:
    client = genai.Client()
    semaphore = asyncio.Semaphore(CONCURRENCY)

    untagged = _load_untagged_experts()

    if not untagged:
        print("All experts already tagged. Nothing to do.")
        return

    # Separate experts with bio (can be tagged) from those without (skip Gemini)
    with_bio = [e for e in untagged if (e.bio or "").strip()]
    no_bio = [e for e in untagged if not (e.bio or "").strip()]

    failures: list[tuple[str, str]] = []  # (username, error_message)

    async def process_one(expert: Expert, pbar: async_tqdm) -> None:
        async with semaphore:
            try:
                tags = await _call_gemini_for_tags(client, expert)
            except Exception:
                # Retry once on failure
                try:
                    tags = await _call_gemini_for_tags(client, expert)
                except Exception as e2:
                    failures.append((expert.username, str(e2)))
                    pbar.update(1)
                    return

            score = compute_findability_score(expert, tags)
            _write_tags_to_db(expert.id, tags, score)
            pbar.update(1)

    # Tag experts with bio
    if with_bio:
        # total shows all untagged including no-bio for accurate count display
        with async_tqdm(total=len(untagged), desc="Tagging") as pbar:
            await asyncio.gather(*[process_one(e, pbar) for e in with_bio])
            # Advance bar for no-bio experts (skipped, not tagged)
            for _ in no_bio:
                pbar.update(1)

    # Compute findability scores for no-bio experts (tags=None → 0 pts for tags component)
    for expert in no_bio:
        score = compute_findability_score(expert, tags=None)
        _write_score_to_db(expert.id, score)

    # Print summary only if there were failures or skips
    if failures or no_bio:
        print()
        if no_bio:
            print(f"Skipped {len(no_bio)} experts with no bio (findability score computed, no tags generated)")
        if failures:
            print(f"Failed {len(failures)} experts after retry:")
            for username, err in failures:
                print(f"  - {username}: {err}")


if __name__ == "__main__":
    asyncio.run(run_batch())
