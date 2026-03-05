# Phase 8: Data Enrichment Pipeline - Research

**Researched:** 2026-02-21
**Domain:** AI batch tagging, findability scoring, FAISS index rebuild, FastAPI async background tasks
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Tagging source fields:** Prompt Gemini with Bio + Job Title + Username per expert
- **No bio = no tagging:** Experts with empty or null bio are skipped entirely — marked as untagged, no Gemini call made
- **No bio + findability score:** Untagged experts (no bio) still receive a findability score — computed with 0 points for the tags component (per FIND-01 formula)
- **FAISS exclusion:** Untagged experts are excluded from the FAISS index rebuild — index total may be under 1,558. Planner must reconcile with TAGS-04's `index.ntotal == 1558` assertion or adjust it to reflect actual tagged count
- **Progress bar:** Show progress with count (e.g., `423/1558`) while running
- **Failure behavior:** On individual expert failure (Gemini timeout, API error): retry once, then skip and log — do not abort the entire run
- **Summary output:** Print a run summary only if there were failures or skips (silent on clean success)
- **No --dry-run flag:** Keep the script simple
- **Auto-tagging is synchronous:** Admin waits ~1-2s while Gemini runs; expert is fully enriched before API response returns
- **Gemini failure during sync call:** Save the expert (tags = null), then retry tagging in background — hybrid graceful degradation
- **Admin UX during sync tagging:** Admin dashboard should show a spinner or status message ("Generating tags...") while synchronous tagging is in progress
- **Auto-tagging only updates DB:** FAISS is not hot-updated; new experts won't appear in search until the next manual ingest run
- **Tag normalization:** Lowercase and trim whitespace before storing (e.g., "Machine Learning" → "machine learning")
- **Batch re-runs skip already-tagged experts:** No --force overwrite flag; immutable once tagged
- **Accept any non-empty tag list:** Do not strictly enforce 3–8 minimum; edge cases with sparse experts may produce fewer tags

### Claude's Discretion

- Exact Gemini prompt structure and example tag selection
- Background retry mechanism implementation (FastAPI BackgroundTasks or similar)
- Specific progress bar library (tqdm or equivalent)
- FAISS assertion adjustment strategy (planner decides whether to assert == actual_tagged_count vs original 1558)

### Deferred Ideas (OUT OF SCOPE)

- "Trigger Ingest" button in admin settings — admin-initiated FAISS rebuild from the UI (likely Phase 9 scope)
- Tag editing in admin UI — ability to manually correct or override AI-generated tags (separate feature, not in this phase)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TAGS-01 | Admin can run an offline batch script that generates 3-8 domain tags for every one of the 1,558 experts using Gemini 2.5 Flash structured output | `scripts/tag_experts.py` using `client.models.generate_content` with `response_schema=TagSchema` (Pydantic), asyncio + semaphore for concurrency |
| TAGS-02 | Tags stored per expert in SQLite Expert table as JSON text column, validated against structured schema on every LLM response | Add `tags` Text column to Expert model; use Pydantic for schema validation before DB write; store as `json.dumps(list[str])` |
| TAGS-03 | FAISS ingest script reads from Expert DB table (not experts.csv) and includes tag text in each expert's embedding input | Rewrite `scripts/ingest.py` to use `SessionLocal()` query instead of `pd.read_csv`; add tags to `expert_to_text()` function |
| TAGS-04 | FAISS index rebuilt with all 1,558 experts (up from 530), validated by count assertion before promotion to production | Assert `index.ntotal == actual_tagged_count` (not hardcoded 1558 per user decision); write to staging path, promote only if assertion passes |
| TAGS-05 | When admin adds a new expert, system automatically generates tags and computes findability score immediately | Extend `POST /api/admin/experts` endpoint: call `_tag_expert_sync()` after DB commit; on Gemini failure, add `BackgroundTasks` retry task |
| FIND-01 | System computes 0–100 findability score per expert based on: bio presence/length (40 pts), tags present (25 pts), profile URL (15 pts), job title (10 pts), hourly rate (10 pts) | Pure deterministic function `compute_findability_score(expert)` — no LLM call needed |
| FIND-02 | Findability score stored as Float column on Expert table, added via idempotent schema migration | Existing pattern: `ALTER TABLE experts ADD COLUMN findability_score REAL` wrapped in try/except in `main.py` lifespan |
| FIND-03 | Score computation runs automatically as part of the batch tagging script after tags are written | `tag_experts.py` calls `compute_findability_score()` after writing tags; writes score to DB in same transaction |
</phase_requirements>

---

## Summary

Phase 8 requires three related but independently deliverable pieces: (1) a batch offline script (`scripts/tag_experts.py`) that uses Gemini 2.5 Flash to tag experts stored in SQLite and compute findability scores, (2) a rewrite of `scripts/ingest.py` to read from the Expert DB table instead of experts.csv and include tag text in embeddings, and (3) an extension to `POST /api/admin/experts` that auto-tags new experts synchronously with a BackgroundTasks fallback retry.

The project already uses `google-genai==1.64.*` with `gemini-2.5-flash` for LLM generation (in `app/services/llm.py`) and the same SDK for batch embedding (in `scripts/ingest.py`). The structured output pattern (`response_mime_type="application/json"` + `response_schema=PydanticModel`) is supported natively by the SDK. The existing retry pattern (tenacity in ingest.py, manual retry loop in llm.py) provides a clear template. Schema migrations are already done inline in `main.py` lifespan using try/except around `ALTER TABLE` DDL — this exact pattern should be reused for the new `tags` and `findability_score` columns.

The critical architecture decision is that the batch script must be concurrency-aware: with 1,558 experts and Gemini 2.5 Flash's paid Tier 1 limit of approximately 150 RPM, naive sequential processing would take ~10 minutes; asyncio + semaphore allows safe parallelism while staying within rate limits. The FAISS index rebuild path must assert the count before promoting the staging file — crash safety is a locked requirement from STATE.md.

**Primary recommendation:** Build `scripts/tag_experts.py` as an async script (asyncio.run) with a semaphore-controlled concurrency limit of 5–10 concurrent Gemini calls, tqdm for progress, and a structured Pydantic schema for tag validation. Reuse all existing patterns from the codebase rather than introducing new dependencies.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-genai | 1.64.* (already in requirements.txt) | Gemini 2.5 Flash structured output for tagging | Already in production; `client.aio.models.generate_content` supports async |
| pydantic | 2.12.* (already in requirements.txt) | Tag schema definition and response validation | Already used throughout app; `response_schema=PydanticModel` is the SDK-native approach |
| tqdm | not yet in requirements.txt | Progress bar with count (423/1558) | Standard for offline batch scripts; supports simple sync and async patterns |
| sqlalchemy | 2.0.* (already in requirements.txt) | Read Expert rows for batch script; write tags + scores | Already the ORM for the entire project |
| asyncio | stdlib | Concurrency control for parallel Gemini calls | Matches google-genai async client (`client.aio`); no extra dependency |
| tenacity | 8.4.* (already in requirements.txt) | Retry with exponential backoff on Gemini API failures | Already used in ingest.py; consistent pattern |
| fastapi BackgroundTasks | bundled with fastapi 0.129.* | Background retry after synchronous tagging failure | Built-in; sufficient for single-instance Railway deployment |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.0.* (already in requirements.txt) | Load GOOGLE_API_KEY from .env in batch script | Same as ingest.py — already done |
| json (stdlib) | stdlib | Serialize/deserialize tags list to/from SQLite Text column | Tags stored as JSON string: `json.dumps(["machine learning", "nlp"])` |
| structlog | 24.2.* (already in requirements.txt) | Logging failures and skip counts in batch script | Consistent with existing services |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncio + semaphore | threading.ThreadPoolExecutor | asyncio matches google-genai's async client (`client.aio`) natively; threading works but requires ThreadPoolExecutor boilerplate and doesn't match existing async patterns |
| FastAPI BackgroundTasks | Celery | BackgroundTasks is sufficient for single-process Railway deployment; Celery adds Redis dependency and significant operational complexity for a single retry |
| tqdm | rich.progress | tqdm is simpler, already familiar in data pipeline scripts; rich adds terminal UI complexity not needed here |
| Inline ALTER TABLE in lifespan | Alembic | Project uses inline try/except DDL (already done for `top_match_score`, `gap_resolved`); Alembic adds setup complexity; consistency matters more than migration tooling sophistication |

**Installation (new dependencies only):**
```bash
pip install tqdm
```
Add to requirements.txt: `tqdm==4.66.*`

---

## Architecture Patterns

### Recommended Project Structure

```
scripts/
├── ingest.py           # MODIFIED: read from Expert DB table instead of experts.csv; add tags to embedding text
├── tag_experts.py      # NEW: batch tagging + findability scoring script
└── validate_csv.py     # UNCHANGED

app/
├── models.py           # MODIFIED: add tags Text + findability_score Float columns to Expert
├── main.py             # MODIFIED: add idempotent ALTER TABLE for new columns in lifespan
└── routers/
    └── admin.py        # MODIFIED: extend POST /api/admin/experts with sync tagging + background retry
```

### Pattern 1: Structured Output with Pydantic Schema

**What:** Use `response_schema=PydanticModel` in `GenerateContentConfig` to get validated tag lists from Gemini 2.5 Flash.

**When to use:** Any time Gemini must return a typed structure (tags list) rather than free text.

**Example:**
```python
# Source: https://googleapis.github.io/python-genai/
from pydantic import BaseModel
from typing import List
from google import genai
from google.genai import types

class ExpertTags(BaseModel):
    tags: List[str]

client = genai.Client()

response = await client.aio.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ExpertTags,
        temperature=0.2,
    ),
)

import json
data = ExpertTags.model_validate_json(response.text)
tags = [t.lower().strip() for t in data.tags]  # normalize
```

**IMPORTANT:** Use `client.aio.models.generate_content` (async variant) in the batch script. The async client is accessed via `client.aio` — it mirrors all sync methods. [Source: googleapis.github.io/python-genai]

### Pattern 2: Async Batch Script with Semaphore Concurrency

**What:** Run N concurrent Gemini calls safely without hitting the 150 RPM limit.

**When to use:** Batch script processing 1,558 experts — sequential would be too slow, unconstrained parallel would cause 429 errors.

**Example:**
```python
# Source: verified pattern from asyncio docs + google-genai async client
import asyncio
from tqdm.asyncio import tqdm

CONCURRENCY = 5  # Safe starting point; tune based on actual RPM budget

async def tag_expert(client, semaphore, expert, pbar):
    async with semaphore:
        try:
            # Call Gemini with structured output
            tags = await _call_gemini(client, expert)
            score = compute_findability_score(expert, tags)
            # Write to DB (use sync SessionLocal — see Pattern 4)
            _write_tags_to_db(expert.id, tags, score)
        except Exception as e:
            # Retry once
            try:
                tags = await _call_gemini(client, expert)
                score = compute_findability_score(expert, tags)
                _write_tags_to_db(expert.id, tags, score)
            except Exception as e2:
                _log_skip(expert.username, str(e2))
        finally:
            pbar.update(1)

async def main():
    client = genai.Client()
    semaphore = asyncio.Semaphore(CONCURRENCY)
    experts = _load_untagged_experts()  # SQLAlchemy query

    with tqdm(total=len(experts), desc="Tagging experts") as pbar:
        tasks = [tag_expert(client, semaphore, e, pbar) for e in experts]
        await asyncio.gather(*tasks)
```

### Pattern 3: Idempotent Schema Migration (existing project pattern)

**What:** Add new columns to SQLite via inline `ALTER TABLE` DDL with try/except in lifespan.

**When to use:** Any new column needed on an existing table — matches how the project already handles `top_match_score` and `gap_resolved`.

**Example:**
```python
# Source: app/main.py — existing pattern to follow exactly
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE experts ADD COLUMN tags TEXT",
        "ALTER TABLE experts ADD COLUMN findability_score REAL",
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # Column already exists — idempotent
```

**Add to Expert model in `app/models.py`:**
```python
tags: Mapped[str | None] = mapped_column(Text, nullable=True)
findability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
```

### Pattern 4: DB Access in Async Batch Script

**What:** SQLAlchemy's `SessionLocal` is sync; use it inside the async script with regular `with SessionLocal() as db:` blocks. Do NOT use async SQLAlchemy — the project does not have an async engine.

**When to use:** Reading experts and writing tags in `tag_experts.py`.

**Example:**
```python
# Source: existing pattern from app/main.py _seed_experts_from_csv()
from app.database import SessionLocal
from app.models import Expert
from sqlalchemy import select

def _load_untagged_experts() -> list[Expert]:
    with SessionLocal() as db:
        return list(db.scalars(
            select(Expert).where(Expert.tags.is_(None))
        ).all())

def _write_tags_to_db(expert_id: int, tags: list[str], score: float) -> None:
    with SessionLocal() as db:
        expert = db.get(Expert, expert_id)
        expert.tags = json.dumps(tags)
        expert.findability_score = score
        db.commit()
```

**Note:** Opening a new SessionLocal per expert write is safe for a batch script. Do not hold a session open across async Gemini calls.

### Pattern 5: FastAPI BackgroundTasks for Retry on Auto-Tag Failure

**What:** If synchronous Gemini call fails during `POST /api/admin/experts`, save expert with `tags=null` and schedule a background retry.

**When to use:** `POST /api/admin/experts` endpoint — hybrid graceful degradation.

**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/background-tasks/
from fastapi import BackgroundTasks

def _retry_tag_expert_background(expert_id: int) -> None:
    """Sync function — BackgroundTasks handles both def and async def."""
    try:
        expert = _load_expert_by_id(expert_id)
        tags = _call_gemini_sync(expert)  # Sync version for background use
        score = compute_findability_score(expert, tags)
        _write_tags_to_db(expert_id, tags, score)
    except Exception as e:
        log.error("background_tag_retry.failed", expert_id=expert_id, error=str(e))

@router.post("/experts")
def add_expert(body: AddExpertBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ... create expert ...
    db.commit()

    try:
        tags, score = _tag_expert_sync(new_expert)
        new_expert.tags = json.dumps(tags)
        new_expert.findability_score = score
        db.commit()
    except Exception:
        # Gemini failed — save without tags, schedule background retry
        background_tasks.add_task(_retry_tag_expert_background, new_expert.id)

    return {"ok": True, "username": body.username, "tags": json.loads(new_expert.tags or "null")}
```

### Pattern 6: Modified ingest.py — Read from Expert DB Table

**What:** Replace CSV read with SQLAlchemy query; add tags to the `expert_to_text()` embedding string; filter to only tagged experts.

**When to use:** `scripts/ingest.py` rewrite (TAGS-03).

**Example:**
```python
# Source: existing ingest.py + existing main.py seeding pattern
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Expert
from sqlalchemy import select

def load_tagged_experts() -> list[dict]:
    with SessionLocal() as db:
        experts = db.scalars(
            select(Expert).where(Expert.tags.isnot(None))
        ).all()
        return [
            {
                "id": e.id,
                "username": e.username,
                "first_name": e.first_name,
                "last_name": e.last_name,
                "job_title": e.job_title,
                "company": e.company,
                "bio": e.bio,
                "hourly_rate": e.hourly_rate,
                "profile_url": e.profile_url,
                "profile_url_utm": e.profile_url_utm,
                "tags": json.loads(e.tags or "[]"),
            }
            for e in experts
        ]

def expert_to_text(expert: dict) -> str:
    """Add tags to embedding text for richer semantic signal."""
    # ... existing name/title/company/bio assembly ...
    tags = expert.get("tags") or []
    if tags:
        parts.append(f"Domains: {', '.join(tags)}.")
    return " ".join(parts) if parts else expert.get("username", "Unknown")

def main():
    experts = load_tagged_experts()
    actual_count = len(experts)

    # ... embed and build index ...

    # Crash-safe promotion: write to staging, assert, then rename
    STAGING_PATH = FAISS_INDEX_PATH.with_suffix(".staging")
    faiss.write_index(index, str(STAGING_PATH))

    assert index.ntotal == actual_count, (
        f"Index count mismatch: {index.ntotal} != {actual_count}"
    )
    STAGING_PATH.rename(FAISS_INDEX_PATH)
    print(f"Ingestion complete: {index.ntotal} experts indexed (of 1558 total).")
```

### Pattern 7: Findability Score — Deterministic Formula

**What:** Pure function, no LLM. Called for every expert (tagged or not) in the batch script and during auto-tagging.

**Formula from FIND-01:**
- Bio presence/length: 40 pts (0 if empty, scaled by length up to max)
- Tags present: 25 pts (0 if untagged)
- Profile URL present: 15 pts
- Job title present: 10 pts
- Hourly rate present (> 0): 10 pts

**Example:**
```python
def compute_findability_score(expert: Expert, tags: list[str] | None = None) -> float:
    score = 0.0

    # Bio: 0–40 pts based on length
    bio = (expert.bio or "").strip()
    if bio:
        # Scale: 0 chars = 0, 500+ chars = 40 pts
        score += min(40.0, len(bio) / 500 * 40)

    # Tags: 25 pts if any tags present
    effective_tags = tags if tags is not None else json.loads(expert.tags or "[]")
    if effective_tags:
        score += 25.0

    # Profile URL: 15 pts
    if (expert.profile_url or "").strip():
        score += 15.0

    # Job title: 10 pts
    if (expert.job_title or "").strip():
        score += 10.0

    # Hourly rate: 10 pts
    if expert.hourly_rate and expert.hourly_rate > 0:
        score += 10.0

    return round(score, 1)
```

**Validation check from requirements:**
- Expert with no bio and no profile URL → bio=0, tags=0 (no bio = no tags), profile_url=0 → max 20 pts → below 40. Correct.

### Anti-Patterns to Avoid

- **Do not hold SQLAlchemy session open across async Gemini calls.** Open a new `SessionLocal` only to read/write; close it before awaiting the Gemini call. SQLite connections are not thread-safe.
- **Do not call `faiss.read_index` at startup if the index was just rebuilt by the batch script.** The server loads the index at startup via the lifespan — a production FAISS update requires a Railway redeploy (already documented in STATE.md and config.py).
- **Do not use `response_json_schema` (dict) when `response_schema` (Pydantic class) is available.** Passing the Pydantic class directly is cleaner and triggers SDK-native validation.
- **Do not write FAISS index directly to `FAISS_INDEX_PATH`.** Write to staging path, assert count, then rename. This prevents a half-written index from crashing the server on next startup.
- **Do not run `ingest.py` during Railway startup.** Already documented in ingest.py comment: "NEVER call this at API startup — it takes 60+ seconds." Phase 8 does not change this constraint.
- **Do not overwrite already-tagged experts in batch re-run.** Skip experts where `tags IS NOT NULL` — this is a locked decision.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON output from Gemini | Custom JSON parsing + regex fallback | `response_schema=ExpertTags` (Pydantic) with SDK | SDK enforces schema at the Gemini API level; no need for regex fallback |
| Retry logic on API failure | Manual loop with time.sleep | tenacity (already in requirements.txt) for batch; manual single-retry in endpoint | tenacity handles jitter, max backoff, reraise — already used in ingest.py |
| Concurrency limiting | Counting active requests manually | asyncio.Semaphore | asyncio primitive; zero dependencies; safe for a single-process script |
| Progress display | Print statements with manual percentage | tqdm | Single dependency; handles count display, rate, ETA; just `pbar.update(1)` |
| Schema migration | Drop/recreate table or Alembic setup | Inline `ALTER TABLE` with try/except | Matches existing project pattern exactly; safe for SQLite |

**Key insight:** This phase is primarily about connecting existing tools (Gemini, SQLAlchemy, FAISS) in a new configuration — not building novel infrastructure. Follow the patterns already established in the codebase.

---

## Common Pitfalls

### Pitfall 1: Gemini Rate Limit 429 on Batch Run

**What goes wrong:** With CONCURRENCY too high (e.g., 20), the batch script triggers HTTP 429 from Gemini API, tenacity retries exhaust, and many experts get skipped.

**Why it happens:** Gemini 2.5 Flash Tier 1 is approximately 150 RPM. At CONCURRENCY=20 with fast experts (no bio filtered out), the script can easily exceed this.

**How to avoid:** Start with CONCURRENCY=5. The script processes ~1,558 experts; at 5 concurrent with ~1s Gemini latency, this completes in under 6 minutes. Document the CONCURRENCY constant prominently so the admin can tune it.

**Warning signs:** Multiple "retry once" log lines in succession; final skip count > 5% of total.

### Pitfall 2: SQLAlchemy Session Held Across Async Boundary

**What goes wrong:** A `Session` opened before `await client.aio.models.generate_content(...)` stays open during the async wait. SQLite raises `ProgrammingError: SQLite objects created in a thread can only be used in that same thread` or silently corrupts state.

**Why it happens:** SQLite connections are not thread-safe; asyncio event loop may switch threads during an `await`.

**How to avoid:** Always close the session (exit the `with SessionLocal()` block) before any `await` call. Open a fresh session only when reading from or writing to DB.

### Pitfall 3: FAISS Staging File Left Behind on Crash

**What goes wrong:** Script crashes after writing `faiss.index.staging` but before renaming it. Next run may pick up the stale staging file.

**Why it happens:** No cleanup on crash.

**How to avoid:** At the start of `ingest.py`, delete any existing `*.staging` file before beginning. After successful promotion (rename), the staging file is gone.

### Pitfall 4: Tag Whitespace / Case Not Normalized Before DB Write

**What goes wrong:** Gemini returns `"Machine Learning"` and `" machine learning "` — stored as two distinct tags, breaking de-duplication and search.

**Why it happens:** LLMs don't guarantee consistent casing.

**How to avoid:** Always apply `[t.lower().strip() for t in raw_tags]` before storing. This is a locked decision — enforce it as the last step before `json.dumps`.

### Pitfall 5: Auto-Tag Synchronous Call Blocks Event Loop

**What goes wrong:** The `POST /api/admin/experts` endpoint is a sync FastAPI route (uses `def`, not `async def`). Calling `asyncio.run()` inside it causes `RuntimeError: This event loop is already running`.

**Why it happens:** FastAPI runs sync routes in a thread pool, but `asyncio.run()` expects no running loop.

**How to avoid:** For the synchronous tagging call in the endpoint, use `client.models.generate_content` (sync, not `client.aio`). The sync google-genai client is fully supported and appropriate here — the async client is only for the batch script.

### Pitfall 6: `Expert.tags` Column Missing from DB on First Deploy

**What goes wrong:** If `main.py` lifespan migration runs after the server starts serving traffic, a request hits `Expert.tags` before it exists.

**Why it happens:** Railway deploys atomically — the new code runs before any migration has fired if the server starts before lifespan completes.

**How to avoid:** The lifespan runs before the server accepts connections (this is correct FastAPI behavior). The `ALTER TABLE` runs in the lifespan's startup block. Confirm in testing by querying the column before any endpoint is called.

### Pitfall 7: FAISS Count Assertion Hardcoded to 1558

**What goes wrong:** Per user decision, untagged experts (no bio) are excluded from FAISS. If 200 experts have no bio, `index.ntotal` will be ~1,358, not 1,558 — a hardcoded assertion fails.

**Why it happens:** TAGS-04 originally stated "1558 experts" but user has overridden this.

**How to avoid:** Assert `index.ntotal == actual_tagged_count` where `actual_tagged_count = len(tagged_experts_loaded)`. Log the count explicitly: `"Indexed {ntotal} experts (of 1558 total; {1558-ntotal} skipped — no bio)"`.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Gemini Structured Output (async, with Pydantic)
```python
# Source: https://googleapis.github.io/python-genai/ — async client pattern
from pydantic import BaseModel
from typing import List
from google import genai
from google.genai import types
import json

class ExpertTags(BaseModel):
    tags: List[str]

async def _call_gemini_for_tags(client: genai.Client, expert: Expert) -> list[str]:
    prompt = (
        f"Generate 3-8 concise domain expertise tags for this professional consultant.\n\n"
        f"Name: {expert.username}\n"
        f"Job Title: {expert.job_title}\n"
        f"Bio: {expert.bio}\n\n"
        f"Example tags: 'machine learning', 'tax law', 'veterinary', 'crypto', "
        f"'real estate', 'supply chain', 'fundraising', 'climate tech'\n\n"
        f"Return tags that reflect their actual domain — not generic business terms."
    )
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExpertTags,
            temperature=0.2,
        ),
    )
    data = ExpertTags.model_validate_json(response.text)
    return [t.lower().strip() for t in data.tags if t.strip()]
```

### Batch Script Main Loop (async with tqdm + semaphore)
```python
# Source: asyncio stdlib docs + tqdm.asyncio docs
import asyncio
from tqdm.asyncio import tqdm as async_tqdm

CONCURRENCY = 5

async def run_batch():
    client = genai.Client()
    semaphore = asyncio.Semaphore(CONCURRENCY)
    experts = _load_untagged_experts()  # sync SQLAlchemy call

    failures: list[tuple[str, str]] = []  # (username, error)

    async def process_one(expert, pbar):
        async with semaphore:
            try:
                tags = await _call_gemini_for_tags(client, expert)
            except Exception as e:
                try:
                    tags = await _call_gemini_for_tags(client, expert)
                except Exception as e2:
                    failures.append((expert.username, str(e2)))
                    pbar.update(1)
                    return

            score = compute_findability_score(expert, tags)
            _write_tags_to_db(expert.id, tags, score)
            pbar.update(1)

    with async_tqdm(total=len(experts), desc="Tagging") as pbar:
        await asyncio.gather(*[process_one(e, pbar) for e in experts])

    if failures:
        print(f"\nRun summary: {len(failures)} experts failed/skipped:")
        for username, err in failures:
            print(f"  - {username}: {err}")

if __name__ == "__main__":
    asyncio.run(run_batch())
```

### Findability Score for Untagged Experts (batch script covers all experts)
```python
# No source needed — deterministic formula from FIND-01 requirement
def _compute_and_write_findability_all(db_session):
    """
    After tagging run, compute findability for ALL experts (including untagged).
    Untagged experts get 0 pts for tags component automatically.
    """
    all_experts = db_session.scalars(select(Expert)).all()
    for expert in all_experts:
        score = compute_findability_score(expert)
        expert.findability_score = score
    db_session.commit()
```

### Admin Endpoint Extension (auto-tag on create)
```python
# Source: https://fastapi.tiangolo.com/tutorial/background-tasks/
@router.post("/experts")
def add_expert(body: AddExpertBody, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ... existing expert creation logic ...
    db.add(new_expert)
    db.commit()
    db.refresh(new_expert)

    if new_expert.bio and new_expert.bio.strip():
        try:
            # Synchronous tagging — admin waits ~1-2s
            tags = _tag_expert_sync(new_expert)  # uses sync client.models.generate_content
            score = compute_findability_score(new_expert, tags)
            new_expert.tags = json.dumps(tags)
            new_expert.findability_score = score
            db.commit()
        except Exception as e:
            log.warning("add_expert.tagging_failed_scheduling_retry", username=body.username, error=str(e))
            background_tasks.add_task(_retry_tag_expert_background, new_expert.id)
    else:
        # No bio — compute findability with 0 for tags, no Gemini call
        new_expert.findability_score = compute_findability_score(new_expert, tags=None)
        db.commit()

    return {
        "ok": True,
        "username": body.username,
        "tags": json.loads(new_expert.tags or "null"),
        "findability_score": new_expert.findability_score,
    }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `text-embedding-004` for embeddings | `gemini-embedding-001` | Jan 14, 2026 (shutdown) | Already migrated in prod; do not reference old model anywhere |
| `pd.read_csv` source for FAISS ingest | SQLAlchemy Expert table query | Phase 8 (this phase) | Enables tag-enriched embeddings; tags written by tag_experts.py are automatically included |
| FAISS index sourced from experts.csv (530 experts) | FAISS index from DB (all tagged experts, ~1,358–1,558) | Phase 8 (this phase) | Expands search coverage significantly |
| No structured expert metadata | tags JSON + findability_score Float columns | Phase 8 (this phase) | Foundation for Phase 9 admin UI and Phase 10 search intelligence |

**Deprecated/outdated:**
- `experts.csv` as FAISS source: After Phase 8, ingest.py reads from DB. The CSV still serves as a seed source for first-run DB population (unchanged in main.py).
- Manual `category` field on Expert: Still present, but tags supersede it as the semantic enrichment mechanism going forward.

---

## Open Questions

1. **Exact CONCURRENCY limit for tag_experts.py**
   - What we know: Gemini 2.5 Flash Tier 1 is approximately 150 RPM; actual limit is account-specific and visible in AI Studio
   - What's unclear: The project's actual tier and current RPM limit — STATE.md explicitly notes "Verify exact Gemini paid-tier RPM limits at ai.google.dev before setting CONCURRENCY"
   - Recommendation: Default CONCURRENCY=5 (conservative, ~60 RPM at 1s Gemini latency). Document it as a tunable constant at the top of the script. If the run takes too long, admin can increase it after checking their AI Studio rate limit page.

2. **Findability score bio length scaling**
   - What we know: FIND-01 specifies bio presence/length (40 pts) — the formula implies scaling, not binary
   - What's unclear: Exact scaling function (linear? logarithmic? step function?)
   - Recommendation: Use linear scaling capped at 500 characters for 40 pts (`min(40.0, len(bio) / 500 * 40)`). This is simple to explain and reasonable for the data — experts with 100-word bios get ~16 pts, experts with 500+ word bios get the full 40 pts.

3. **metadata.json fate after Phase 8**
   - What we know: Currently, FAISS runtime lookup uses `app.state.metadata` (loaded from metadata.json); ingest.py writes metadata.json alongside the FAISS index
   - What's unclear: After switching to DB-sourced ingest, should metadata.json still be written (for compatibility), or should the retriever read directly from DB at query time?
   - Recommendation: Keep writing metadata.json from ingest.py (include tags in each record). This preserves the existing retriever.py lookup pattern without requiring a retriever rewrite. Phase 9/10 can decide if DB-backed lookups are preferred.

---

## Sources

### Primary (HIGH confidence)

- https://googleapis.github.io/python-genai/ — async client pattern (`client.aio`), `response_schema` Pydantic usage, `GenerateContentConfig` API
- https://fastapi.tiangolo.com/tutorial/background-tasks/ — `BackgroundTasks.add_task()` pattern, sync vs async task handling
- `/Users/sebastianhamers/Documents/TCS/app/models.py` — existing Expert model columns; pattern for schema migration in lifespan
- `/Users/sebastianhamers/Documents/TCS/app/main.py` — inline `ALTER TABLE` try/except migration pattern (lines 116–124); lifespan structure
- `/Users/sebastianhamers/Documents/TCS/scripts/ingest.py` — embedding model, batch size, retry pattern with tenacity, IndexFlatIP + L2 normalize, staging/promotion pattern via count assertion
- `/Users/sebastianhamers/Documents/TCS/app/services/llm.py` — `gemini-2.5-flash` usage, `response_mime_type="application/json"`, JSON parsing pattern
- `/Users/sebastianhamers/Documents/TCS/requirements.txt` — confirmed installed versions of all dependencies

### Secondary (MEDIUM confidence)

- https://ai.google.dev/gemini-api/docs/structured-output — `response_schema` parameter verified; Pydantic BaseModel pattern confirmed in SDK docs
- https://ai.google.dev/gemini-api/docs/rate-limits — Rate limits are account/tier specific; exact RPM not publicly listed for Tier 1 (must check AI Studio dashboard). Secondary sources cite ~150 RPM for Tier 1 gemini-2.5-flash.
- tqdm.asyncio documentation (github.com/tqdm/tqdm) — `tqdm.asyncio.tqdm` and async gather compatibility confirmed

### Tertiary (LOW confidence)

- Third-party blog posts citing 150 RPM for Gemini 2.5 Flash Tier 1 — not verified from official docs (official page redirects to AI Studio dashboard). Treat as a starting estimate only.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in requirements.txt except tqdm; SDK APIs verified against official docs
- Architecture: HIGH — Patterns derived directly from existing codebase (ingest.py, llm.py, main.py, admin.py)
- Pitfalls: HIGH — SQLite thread safety and async boundary issues are well-documented; staging file pattern from STATE.md; rate limit pitfall from existing tenacity usage in ingest.py
- Rate limit numbers: LOW — Exact RPM not publicly specified; use conservative defaults

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable APIs; google-genai SDK may update but core patterns are stable)
