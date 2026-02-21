# Phase 14: Hybrid Search Backend - Research

**Researched:** 2026-02-21
**Domain:** FastAPI hybrid search pipeline — SQLAlchemy pre-filter + FAISS IDSelectorBatch + SQLite FTS5 BM25 + score fusion
**Confidence:** HIGH — all technical decisions verified against existing codebase (ground truth), prior architecture research (ARCHITECTURE.md, STACK.md, PITFALLS.md), and SQLite/FAISS official documentation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Expert response contract**
- Raw scores always included: `faiss_score`, `bm25_score`, `final_score`
- Phase 17 card fields lean: username, first_name, last_name, job_title, company, hourly_rate, tags, findability_score, category + computed match_reason and scores

**Pagination**
- Default page size: **20 per page**

**Tag filter semantics**
- Multi-tag selection uses **AND logic** — expert must have ALL selected tags
- Tag filtering uses the existing `tags` field from metadata.json
- Category field used for grouping/display only; tags used for filter matching

**Scoring**
- FAISS weight: 0.7, FTS5 BM25 weight: 0.3 (from ARCHITECTURE.md pattern, confirmed in requirements EXPL-03)

### Claude's Discretion

- Response field selection (lean vs full) — recommendation: lean; see ExpertCard schema below
- match_reason generation strategy — recommendation: generated only when text query is present (avoids Gemini latency on pure filter requests)
- Cursor encoding — recommendation: integer offset (simplest for react-virtuoso, no benefit to opaque string at this scale)
- total count method — recommendation: exact COUNT(*) on pre-filtered set (accurate for "N experts found" display)
- End-of-results signal — recommendation: `cursor: null` when no more pages (clean, avoids boolean+cursor redundancy)
- Category derivation approach — recommendation: run `_auto_categorize()` at startup as a one-pass migration writing to DB (not metadata.json)
- Findability boost formula — recommendation: multiplicative, capped at ±20% as in existing feedback boost
- Feedback boost formula — recommendation: same ratio formula as `_apply_feedback_boost()` already in search_intelligence.py; cold-start guard at 10 interactions retained
- Weight configurability — recommendation: hardcoded constants in explorer.py (tuning is rare; env var overhead not justified at this stage)
- Filter-only sort — recommendation: findability_score DESC NULLS LAST as primary; feedback net score as secondary

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPL-01 | System provides `/api/explore` endpoint returning paginated expert results (cursor, total, took_ms) | ExploreResponse Pydantic schema defined; cursor = integer offset; total = exact COUNT(*); took_ms via time.time() |
| EXPL-02 | System pre-filters experts by rate range and domain tags via SQLAlchemy → FAISS IDSelectorBatch before vector search | SQLAlchemy WHERE clause on hourly_rate + JSON LIKE for tags → IDSelectorBatch(allowed_positions); username_to_faiss_pos mapping at startup |
| EXPL-03 | System fuses FAISS semantic score (0.7) + FTS5 BM25 keyword score (0.3) into a single weighted rank | Fusion formula verified; FTS5 rank normalization pattern documented |
| EXPL-04 | System applies findability score and feedback boosts to fused rankings | Multiplicative boost pattern; existing `_apply_feedback_boost` logic reusable (same cold-start guard, same cap) |
| EXPL-05 | SQLite FTS5 virtual table is created at startup and synced with experts table on writes | External content table DDL; idempotent `IF NOT EXISTS`; initial population from existing 1,558 expert rows; explicit sync in admin.py write paths |
</phase_requirements>

---

## Summary

Phase 14 implements a pure backend phase: the `GET /api/explore` endpoint with a three-stage hybrid search pipeline (SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 fusion). No frontend code changes. The output is a validated JSON data contract (`ExploreResponse`) that downstream marketplace phases (15–19) build against.

The codebase is thoroughly understood from ground-truth inspection. The existing production system is solid: FastAPI lifespan pattern, SQLAlchemy ORM on SQLite, faiss-cpu IndexFlatIP with 768-dim normalized vectors, and an existing `_apply_feedback_boost` in `search_intelligence.py` that can be directly reused. Prior architecture research (ARCHITECTURE.md, STACK.md, PITFALLS.md — all 2026-02-21) has already resolved all seven key integration questions with HIGH confidence.

**Critical data fact verified from codebase:** The SQLite DB has **1,558 experts** but only **536 have bios, tags, and FAISS embeddings** (the others were seeded from CSV without bios). The FAISS index has 536 vectors, and `metadata.json` has 536 records. The `username_to_faiss_pos` mapping therefore covers only 536 of the 1,558 DB experts. The pre-filter may return up to 1,558 experts; the FAISS and FTS5 stages will silently skip the 1,022 experts with no embeddings. This is correct behavior — pure-filter mode (no text query) will include all 1,558 experts sorted by findability_score; hybrid mode only scores the 536 indexed experts.

**Primary recommendation:** Follow the ARCHITECTURE.md plan exactly. Create `app/services/explorer.py` (pipeline) and `app/routers/explore.py` (thin router), add FTS5 migration + `username_to_faiss_pos` to `main.py` lifespan, and register `explore.router`. Nothing else changes.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi[standard]` | 0.129.* | HTTP router, Pydantic serialization | Already in production |
| `sqlalchemy` | 2.0.* | Expert pre-filter queries, ORM session | Already in production |
| `faiss-cpu` | 1.13.* | IDSelectorBatch + IndexFlatIP search | Already in production |
| SQLite FTS5 | Built-in CPython | BM25 keyword scoring | Verified available on local DB and Railway (standard CPython wheel) |
| `numpy` | 2.2.* | Vector manipulation for FAISS | Already in production |
| `pydantic` | 2.12.* | Request/response schema validation | Already in production |
| `structlog` | 24.2.* | Structured logging (`took_ms`, stage counts) | Already in production |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `google-genai` | 1.64.* | match_reason generation (optional, when query present) | Only if match_reason uses Gemini; may use tag-inspection instead |
| `time` (stdlib) | — | `took_ms` measurement | `start = time.time(); took_ms = int((time.time() - start) * 1000)` |

### No New Installation Required

```bash
# No pip install needed — all packages already in requirements.txt
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 14 scope only)

```
app/
├── routers/
│   ├── explore.py        NEW — GET /api/explore (thin router, delegates to explorer service)
│   └── [all others]      UNCHANGED
├── services/
│   └── explorer.py       NEW — hybrid search pipeline (SQLAlchemy + FAISS + FTS5)
└── main.py               MODIFIED — FTS5 migration block, username_to_faiss_pos mapping,
                                     register explore.router
```

Files NOT touched: `models.py`, `database.py`, `config.py`, `admin.py`, `chat.py`, `feedback.py`, `email_capture.py`, `health.py`, `retriever.py`, `search_intelligence.py`, `embedder.py`, `llm.py`, `tagging.py`, anything in `frontend/`.

### Pattern 1: FTS5 External Content Table Migration (startup, idempotent)

**What:** Create `experts_fts` virtual table linked to `experts`, populate from existing rows, add explicit sync triggers.

**When to use:** In `main.py` lifespan handler, after existing Phase 8 enrichment column migrations.

```python
# In app/main.py lifespan handler — after "startup: expert enrichment columns migrated/verified"
from sqlalchemy import text as _text

with engine.connect() as _conn:
    # Step 1: Create FTS5 external content virtual table (idempotent)
    _conn.execute(_text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(
            first_name,
            last_name,
            job_title,
            company,
            bio,
            tags,
            content='experts',
            content_rowid='id'
        )
    """))
    _conn.commit()

    # Step 2: Initial population — only if FTS table is empty
    # (guards against re-populating on every restart)
    fts_count = _conn.execute(_text("SELECT COUNT(*) FROM experts_fts")).scalar()
    if fts_count == 0:
        _conn.execute(_text("""
            INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
            SELECT id, first_name, last_name, job_title, company, bio, COALESCE(tags, '')
            FROM experts
        """))
        _conn.commit()

log.info("startup: FTS5 index created/verified")

# Step 3: Insert trigger (sync on new expert add)
with engine.connect() as _conn:
    _conn.execute(_text("""
        CREATE TRIGGER IF NOT EXISTS experts_fts_ai
        AFTER INSERT ON experts BEGIN
            INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
            VALUES (new.id, new.first_name, new.last_name, new.job_title, new.company, new.bio, COALESCE(new.tags, ''));
        END
    """))
    _conn.commit()
log.info("startup: FTS5 triggers created/verified")
```

**Why explicit triggers NOT SQLAlchemy ORM events:** SQLAlchemy after_insert events fire at ORM flush time; FTS5 sync requires raw SQL `text()` — transaction ordering is not guaranteed. Triggers execute atomically within the same SQLite transaction. For bulk updates (tag_experts.py), use `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` at end of batch.

**Why `IF NOT EXISTS` for CREATE VIRTUAL TABLE:** Same idempotency pattern already used for `ALTER TABLE` guards in the existing lifespan handler. Restarts do not re-create or break the index.

### Pattern 2: username_to_faiss_pos Startup Mapping

**What:** Build a `{username: int}` dict mapping metadata.json usernames to their positional index in the FAISS index.

**When to use:** In `main.py` lifespan handler, immediately after loading `app.state.metadata`.

```python
# In app/main.py lifespan handler — after loading metadata
username_to_pos: dict[str, int] = {}
for pos, row in enumerate(app.state.metadata):
    username = row.get("Username") or row.get("username") or ""
    if username:
        username_to_pos[username] = pos
app.state.username_to_faiss_pos = username_to_pos
log.info(
    "startup: username-to-FAISS-position mapping built",
    count=len(username_to_pos),
    # Expected: 536 (only experts with embeddings in metadata.json)
)
```

**Critical:** The FAISS index is `IndexFlatIP` with sequential positional indices 0–535. These are NOT `Expert.id` values. Passing DB IDs to IDSelectorBatch would return wrong experts. The mapping is position-based.

### Pattern 3: Three-Stage Hybrid Search Pipeline (explorer.py)

**What:** The `run_explore()` function implementing the full pipeline.

```python
# app/services/explorer.py
import time
import json
from typing import Optional
import numpy as np
import faiss
from sqlalchemy import select, and_, text
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models import Expert
from app.services.embedder import embed_query

FAISS_WEIGHT = 0.7
BM25_WEIGHT = 0.3
ITEMS_PER_PAGE = 20


class ExpertCard(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    hourly_rate: float
    currency: str
    profile_url: str
    tags: list[str]
    findability_score: float | None
    category: str | None
    faiss_score: float | None      # None in pure filter mode
    bm25_score: float | None       # None in pure filter mode
    final_score: float             # findability-boosted fused score (or findability_score in filter mode)
    match_reason: str | None       # None when query is empty


class ExploreResponse(BaseModel):
    experts: list[ExpertCard]
    total: int                     # pre-pagination count (for "N experts found")
    cursor: int | None             # next offset; None = no more pages
    took_ms: int


def run_explore(
    query: str,
    rate_min: float,
    rate_max: float,
    tags: list[str],
    limit: int,
    cursor: int,
    db: Session,
    app_state,
) -> ExploreResponse:
    start = time.time()

    # Stage 1: SQLAlchemy pre-filter (always runs)
    q = select(Expert).where(
        and_(
            Expert.hourly_rate >= rate_min,
            Expert.hourly_rate <= rate_max,
        )
    )
    # AND logic: expert must have ALL selected tags
    for tag in tags:
        q = q.where(Expert.tags.like(f'%"{tag}"%'))

    filtered_experts: list[Expert] = list(db.scalars(q).all())
    total = len(filtered_experts)

    if not filtered_experts:
        return ExploreResponse(experts=[], total=0, cursor=None,
                               took_ms=int((time.time() - start) * 1000))

    is_text_query = bool(query.strip())

    if is_text_query:
        # Stage 2: FAISS IDSelectorBatch (only experts with FAISS embeddings)
        username_to_pos = app_state.username_to_faiss_pos
        faiss_index = app_state.faiss_index

        allowed_positions = np.array(
            [username_to_pos[e.username] for e in filtered_experts
             if e.username in username_to_pos],
            dtype=np.int64
        )

        faiss_scores: dict[str, float] = {}
        if len(allowed_positions) > 0:
            query_vec = np.array(embed_query(query), dtype=np.float32).reshape(1, -1)
            selector = faiss.IDSelectorBatch(allowed_positions)
            params = faiss.SearchParameters(sel=selector)
            k = min(50, len(allowed_positions))
            scores, indices = faiss_index.search(query_vec, k, params=params)
            for score, pos in zip(scores[0], indices[0]):
                if pos < 0:
                    continue
                username = app_state.metadata[pos].get("Username", "")
                if username:
                    faiss_scores[username] = float(score)

        # Stage 3: FTS5 BM25 (filter to only pre-filtered experts)
        filtered_ids = {e.id for e in filtered_experts}
        fts_rows = db.execute(text("""
            SELECT rowid, rank FROM experts_fts
            WHERE experts_fts MATCH :q
            ORDER BY rank
            LIMIT 200
        """), {"q": query}).fetchall()

        # Normalize BM25: rank is negative, lower = better; flip and normalize 0.0-1.0
        relevant_fts = [(r.rowid, abs(r.rank)) for r in fts_rows if r.rowid in filtered_ids]
        max_rank = max((v for _, v in relevant_fts), default=1.0)
        bm25_scores: dict[int, float] = {
            rid: 1.0 - (v / max_rank) for rid, v in relevant_fts
        }

        # Fusion + findability boost
        id_to_expert = {e.id: e for e in filtered_experts}
        scored: list[tuple[float, float, float, Expert]] = []  # (final, faiss, bm25, expert)
        for expert in filtered_experts:
            fs = faiss_scores.get(expert.username, 0.0)
            bs = bm25_scores.get(expert.id, 0.0)
            if fs == 0.0 and bs == 0.0:
                continue  # no signal in either index — exclude from hybrid results
            fused = (fs * FAISS_WEIGHT) + (bs * BM25_WEIGHT)
            final = _apply_findability_boost(fused, expert.findability_score)
            scored.append((final, fs, bs, expert))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Pagination
        page = scored[cursor: cursor + limit + 1]
        has_more = len(page) > limit
        page = page[:limit]
        next_cursor = cursor + limit if has_more else None

        cards = [
            _build_card(expert, faiss_s, bm25_s, final_s, query)
            for final_s, faiss_s, bm25_s, expert in page
        ]

    else:
        # Pure filter mode: sort by findability_score DESC, no FAISS/FTS5
        sorted_experts = sorted(
            filtered_experts,
            key=lambda e: (e.findability_score or 0.0),
            reverse=True
        )
        page = sorted_experts[cursor: cursor + limit + 1]
        has_more = len(page) > limit
        page = page[:limit]
        next_cursor = cursor + limit if has_more else None

        cards = [_build_card(e, None, None, e.findability_score or 0.0, "") for e in page]

    return ExploreResponse(
        experts=cards,
        total=total,
        cursor=next_cursor,
        took_ms=int((time.time() - start) * 1000),
    )


def _apply_findability_boost(fused_score: float, findability_score: float | None) -> float:
    """
    Multiplicative findability boost: ±20% max based on findability_score (50-100 range).
    Experts at findability=100 get +20% boost; at 50 get -20% penalty.
    Neutral at findability=75 (midpoint of 50-100 range).
    """
    if findability_score is None:
        return fused_score
    # Normalize 50-100 range to -1.0 to +1.0
    normalized = (findability_score - 75.0) / 25.0  # -1 at 50, 0 at 75, +1 at 100
    multiplier = 1.0 + (normalized * 0.20)           # 0.8 to 1.2
    return fused_score * multiplier


def _build_card(
    expert: Expert,
    faiss_score: float | None,
    bm25_score: float | None,
    final_score: float,
    query: str,
) -> ExpertCard:
    tags = json.loads(expert.tags or "[]")
    match_reason = _build_match_reason(expert, tags, query) if query.strip() else None
    return ExpertCard(
        username=expert.username,
        first_name=expert.first_name,
        last_name=expert.last_name,
        job_title=expert.job_title,
        company=expert.company,
        hourly_rate=expert.hourly_rate,
        currency=expert.currency,
        profile_url=expert.profile_url_utm or expert.profile_url,
        tags=tags,
        findability_score=expert.findability_score,
        category=expert.category,
        faiss_score=faiss_score,
        bm25_score=bm25_score,
        final_score=round(final_score, 4),
        match_reason=match_reason,
    )


def _build_match_reason(expert: Expert, tags: list[str], query: str) -> str | None:
    """
    Construct match_reason from tag intersection without Gemini call.
    Finds tags that appear in the query text and formats them as a label.
    Falls back to job_title if no tag matches found.
    """
    if not query.strip():
        return None
    query_lower = query.lower()
    matched_tags = [t for t in tags if t.lower() in query_lower][:3]
    if matched_tags:
        return "Strong match: " + ", ".join(matched_tags)
    if expert.job_title:
        return f"Match via: {expert.job_title}"
    return None
```

### Pattern 4: Thin Router (explore.py)

```python
# app/routers/explore.py
import asyncio
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.explorer import run_explore, ExploreResponse

router = APIRouter()


@router.get("/api/explore", response_model=ExploreResponse)
async def explore(
    request: Request,
    db: Session = Depends(get_db),
    query: str = Query(default="", max_length=500),
    rate_min: float = Query(default=0.0, ge=0),
    rate_max: float = Query(default=10000.0, le=10000),
    tags: str = Query(default=""),        # comma-separated, e.g. "seo,blockchain"
    limit: int = Query(default=20, ge=1, le=100),
    cursor: int = Query(default=0, ge=0),
) -> ExploreResponse:
    """
    Hybrid search: SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused rank.
    When query is empty, returns experts sorted by findability_score (pure filter mode).
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
        )
    )
```

### Pattern 5: Router Registration in main.py

```python
# app/main.py — add to import
from app.routers import admin, chat, email_capture, feedback, health, explore

# app/main.py — add to routes section
app.include_router(explore.router)
```

### Pattern 6: FTS5 Sync in admin.py Write Paths (EXPL-05)

Two write paths in `admin.py` must explicitly sync FTS5:

**After `add_expert()` db.commit():**
```python
# After the final db.commit() in add_expert() (after tags/findability_score set)
db.execute(text("""
    INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
    VALUES (:id, :fn, :ln, :jt, :co, :bio, :tags)
"""), {
    "id": new_expert.id,
    "fn": new_expert.first_name,
    "ln": new_expert.last_name,
    "jt": new_expert.job_title,
    "co": new_expert.company,
    "bio": new_expert.bio,
    "tags": new_expert.tags or "",
})
db.commit()
```

**After `_run_ingest_job()` completes (bulk tag update):**
```python
# At end of _run_ingest_job in admin.py, after hot-reloading FAISS:
with SessionLocal() as db:
    db.execute(text("INSERT INTO experts_fts(experts_fts) VALUES('rebuild')"))
    db.commit()
log.info("fts5.rebuild_complete")
```

### Pattern 7: Category Derivation at Startup

The `category` column is NULL for all 1,558 experts in the DB. Run `_auto_categorize()` as a startup migration — write back to DB once, idempotently.

```python
# In main.py lifespan handler — after FTS5 setup
from app.routers.admin import _auto_categorize  # or duplicate the logic

with SessionLocal() as _db:
    uncategorized = _db.scalars(
        select(Expert).where(Expert.category == None)
    ).all()
    for expert in uncategorized:
        cat = _auto_categorize(expert.job_title)
        if cat:
            expert.category = cat
    if uncategorized:
        _db.commit()
        log.info("startup: category auto-classification run", count=len(uncategorized))
```

**Why startup, not pre-phase script:** Consistent with the existing lifespan pattern for one-time data migrations (the `ALTER TABLE` guard blocks). Railway cold starts trigger this automatically on deploy.

### Anti-Patterns to Avoid

- **Passing `Expert.id` to IDSelectorBatch:** The FAISS index uses positional indices (0–535), not Expert.id (1–1558). Expert.id=1 is NOT at FAISS position 0 necessarily. Always use `username_to_faiss_pos[expert.username]` for the position lookup.
- **Calling `index.remove_ids()`:** Permanently shifts all sequential FAISS IDs for every vector above the removed one. Never called at runtime. The index is READ-ONLY after startup.
- **Using SQLAlchemy ORM events for FTS5 sync:** ORM events fire at flush time; the FTS5 INSERT happens in a separate raw SQL transaction. Use explicit `db.execute(text(...))` after the ORM commit instead.
- **Streaming `/api/explore` as SSE:** The grid renders all 20 experts at once. Partial results cause layout shift. The pipeline completes in <50ms — SSE overhead exceeds computation time. Use synchronous JSON.
- **FTS5 query without LIMIT:** Always append `LIMIT 200` to FTS5 queries. At 1,558 rows it is fast; at 10k+ it becomes a full-table scan returning all rows to Python.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-filtered vector search | Custom Python loop filtering FAISS results post-search | `faiss.IDSelectorBatch` + `faiss.SearchParameters(sel=)` | Built-in FAISS mechanism; correct semantics; no index mutation |
| BM25 keyword scoring | Custom TF-IDF implementation | SQLite FTS5 `rank` column | FTS5 BM25 is battle-tested; zero dependencies; already in SQLite |
| Feedback boost re-ranking | New formula | Reuse `_apply_feedback_boost()` logic from `search_intelligence.py` | Already implemented, tested, and cold-start guarded in production |
| Category assignment | New categorization system | Reuse `_auto_categorize()` from `admin.py` | `CATEGORY_KEYWORDS` dict already defined and used in 3 places |
| Pagination | Cursor encoding/decoding | Integer offset: `cursor = offset` | No concurrent inserts; stable corpus; no benefit to opaque cursor |

**Key insight:** The entire pipeline reuses existing production code. The new code is glue — wiring FAISS, FTS5, and SQLAlchemy together in one service function.

---

## Common Pitfalls

### Pitfall 1: IDSelectorBatch Confuses Search-Time Filter With Destructive remove_ids

**What goes wrong:** Copying FAISS wiki examples that use `IDSelectorBatch` with `index.remove_ids()`, which permanently shifts all sequential positional IDs. Searches return wrong experts with no error.

**Why it happens:** FAISS documentation primarily documents `IDSelectorBatch` in `remove_ids` context. Search-time filtering uses a different API: `faiss.SearchParameters(sel=selector)`.

**How to avoid:** Never call `index.remove_ids()`. Use only:
```python
selector = faiss.IDSelectorBatch(allowed_positions)
params = faiss.SearchParameters(sel=selector)
scores, indices = faiss_index.search(query_vec, k, params=params)
```

**Warning signs:** `index.ntotal` decreases over time (must stay 536 forever).

### Pitfall 2: FTS5 Table Created Without Initial Population

**What goes wrong:** `CREATE VIRTUAL TABLE IF NOT EXISTS` creates an empty FTS index. The triggers only capture future writes. All 1,558 existing experts are invisible to FTS queries — returns zero results.

**Why it happens:** SQLite triggers don't backfill existing data. The table must be explicitly populated after creation.

**How to avoid:** After creating the virtual table, always check `COUNT(*) FROM experts_fts == 0` and run the INSERT SELECT or `VALUES('rebuild')` to populate from the content table.

**Warning signs:** FTS5 search returns zero results for queries that should match (e.g., "marketing" returns nothing when 200 experts have "marketing" in their bio).

### Pitfall 3: Expert.id Passed to IDSelectorBatch Instead of FAISS Position

**What goes wrong:** SQLAlchemy returns `Expert` objects with `.id` values (1–1558). Passing these directly to `IDSelectorBatch` gives positional indices that point to completely wrong experts. Silent data corruption — wrong experts returned.

**How to avoid:** Always look up position via `username_to_faiss_pos[expert.username]`, skip experts not in the mapping (they have no FAISS embedding).

### Pitfall 4: FTS5 MATCH Errors on Special Characters in User Queries

**What goes wrong:** User types `"blockchain & legal"` → FTS5 MATCH syntax error because `&` is not a valid FTS5 operator. Unhandled exception.

**How to avoid:** Sanitize the query before passing to FTS5 MATCH. Replace or strip FTS5 special characters: `AND`, `OR`, `NOT`, `*`, `"`, `(`, `)`. Simplest approach: split on whitespace, take first 10 words, join with spaces. FTS5 treats space-separated words as implicit AND.

```python
def _safe_fts_query(query: str) -> str:
    """Strip FTS5 special chars; return simple multi-word query."""
    import re
    # Remove FTS5 operators and special chars
    cleaned = re.sub(r'[()"\*\+]', ' ', query)
    cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned, flags=re.IGNORECASE)
    words = cleaned.split()[:10]  # limit to 10 terms
    return " ".join(words) if words else ""
```

### Pitfall 5: Empty `allowed_positions` Array Crashes IDSelectorBatch

**What goes wrong:** All pre-filtered experts have no FAISS embedding (e.g., filtering by tags in a rate range where only untagged experts exist). `allowed_positions` is an empty array. `IDSelectorBatch([])` may raise or return all vectors.

**How to avoid:** Guard before constructing the selector:
```python
if len(allowed_positions) == 0:
    # No indexed experts match the pre-filter — fall back to pure filter mode
    faiss_scores = {}
```

### Pitfall 6: Tags LIKE Query Case Sensitivity

**What goes wrong:** Tag in DB stored as `"Blockchain"` (capital B); user filter passes `"blockchain"` (lowercase). SQLite LIKE is case-insensitive for ASCII but case-sensitive for non-ASCII. Tags with non-ASCII characters (e.g., accented letters) may fail.

**How to avoid:** Tags in the DB are stored lowercase (confirmed: `["marketplace strategy", "e-commerce marketplaces"]`). Normalize incoming tag filter values to lowercase before the LIKE query:
```python
for tag in tags:
    q = q.where(Expert.tags.like(f'%"{tag.lower()}"%'))
```

---

## Code Examples

### Full Startup Sequence Addition (main.py)

```python
# Source: verified against existing lifespan pattern in app/main.py
# Add after "startup: expert enrichment columns migrated/verified"

# Phase 14: FTS5 virtual table
with engine.connect() as _conn:
    _conn.execute(_text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(
            first_name, last_name, job_title, company, bio, tags,
            content='experts', content_rowid='id'
        )
    """))
    _conn.commit()
    fts_count = _conn.execute(_text("SELECT COUNT(*) FROM experts_fts")).scalar()
    if fts_count == 0:
        _conn.execute(_text("""
            INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
            SELECT id, first_name, last_name, job_title, company, bio, COALESCE(tags, '')
            FROM experts
        """))
        _conn.commit()
log.info("startup: FTS5 index created/verified")

# Phase 14: FTS5 sync trigger (INSERT only — no UPDATE/DELETE needed for v2.0)
with engine.connect() as _conn:
    _conn.execute(_text("""
        CREATE TRIGGER IF NOT EXISTS experts_fts_ai
        AFTER INSERT ON experts BEGIN
            INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
            VALUES (new.id, new.first_name, new.last_name, new.job_title,
                    new.company, new.bio, COALESCE(new.tags, ''));
        END
    """))
    _conn.commit()

# Phase 14: username → FAISS position mapping
username_to_pos: dict[str, int] = {}
for pos, row in enumerate(app.state.metadata):
    username = row.get("Username") or row.get("username") or ""
    if username:
        username_to_pos[username] = pos
app.state.username_to_faiss_pos = username_to_pos
log.info("startup: username-to-FAISS-position mapping built", count=len(username_to_pos))

# Phase 14: category auto-classification (one-time migration)
from app.routers.admin import _auto_categorize as _categorize
with SessionLocal() as _db:
    from sqlalchemy import select as _select
    _uncategorized = _db.scalars(
        _select(Expert).where(Expert.category == None)
    ).all()
    for _e in _uncategorized:
        _cat = _categorize(_e.job_title)
        if _cat:
            _e.category = _cat
    if _uncategorized:
        _db.commit()
        log.info("startup: category auto-classification", count=len(_uncategorized))
```

### FAISS IDSelectorBatch Search

```python
# Source: FAISS wiki (Setting search parameters for one query) + ARCHITECTURE.md
import faiss, numpy as np

allowed_positions = np.array(
    [username_to_pos[e.username] for e in filtered_experts
     if e.username in username_to_pos],
    dtype=np.int64
)

if len(allowed_positions) > 0:
    selector = faiss.IDSelectorBatch(allowed_positions)
    params = faiss.SearchParameters(sel=selector)
    query_vec = np.array(embed_query(query), dtype=np.float32).reshape(1, -1)
    k = min(50, int(len(allowed_positions)))
    scores, indices = faiss_index.search(query_vec, k, params=params)
    for score, pos in zip(scores[0], indices[0]):
        if pos >= 0:
            username = app_state.metadata[pos].get("Username", "")
            if username:
                faiss_scores[username] = float(score)
```

### FTS5 BM25 Query

```python
# Source: SQLite FTS5 official docs (sqlite.org/fts5.html)
fts_rows = db.execute(text("""
    SELECT rowid, rank FROM experts_fts
    WHERE experts_fts MATCH :q
    ORDER BY rank
    LIMIT 200
"""), {"q": _safe_fts_query(query)}).fetchall()
# rank is negative (BM25): lower = more relevant → abs() and flip to 0.0-1.0
```

### Score Fusion

```python
# Source: REQUIREMENTS.md EXPL-03 (0.7 FAISS, 0.3 BM25) + ARCHITECTURE.md
FAISS_WEIGHT = 0.7
BM25_WEIGHT = 0.3

fused = (faiss_scores.get(expert.username, 0.0) * FAISS_WEIGHT) + \
        (bm25_scores.get(expert.id, 0.0) * BM25_WEIGHT)

# Exclude experts with zero signal in both indexes
if fused == 0.0:
    continue
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pure FAISS cosine similarity (v1.x) | FAISS + FTS5 BM25 fusion (v2.0) | Phase 14 | Keyword-aware results for exact-match queries; avoids semantic drift on literal searches |
| retrieve_with_intelligence() (HyDE + feedback in chat) | run_explore() (pre-filter + fusion + findability boost) | Phase 14 | Purpose-built for paginated browse; no SSE, no LLM generation per request |
| No category field populated | _auto_categorize() run at startup | Phase 14 | Enables sidebar section headers in Phase 16 |

**Deprecated/outdated:**
- `app.state.metadata` lookups in explore: the explore service reads from SQLAlchemy DB (authoritative), only using metadata for the FAISS position mapping. This avoids inconsistency between DB and metadata.json.

---

## Data Contract (ExploreResponse)

This is the schema all downstream phases (15–19) build against. It must not change after Phase 14 ships.

```python
# Pydantic models — define in app/services/explorer.py
class ExpertCard(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    hourly_rate: float
    currency: str
    profile_url: str             # profile_url_utm preferred; fallback to profile_url
    tags: list[str]              # parsed from JSON text; may be [] for 1,022 untagged experts
    findability_score: float | None
    category: str | None         # populated after Phase 14 startup classification
    faiss_score: float | None    # None in pure filter mode (no text query)
    bm25_score: float | None     # None in pure filter mode (no text query)
    final_score: float           # findability-boosted fused score
    match_reason: str | None     # tag-intersection label; None when query empty

class ExploreResponse(BaseModel):
    experts: list[ExpertCard]
    total: int                   # count BEFORE pagination (for "N experts found" display)
    cursor: int | None           # next page offset; None = end of results
    took_ms: int                 # server latency in ms (for admin debugging)
```

**TypeScript equivalent (for downstream phases):**
```typescript
export interface ExpertCard {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  currency: string
  profile_url: string
  tags: string[]
  findability_score: number | null
  category: string | null
  faiss_score: number | null
  bm25_score: number | null
  final_score: number
  match_reason: string | null
}

export interface ExploreResponse {
  experts: ExpertCard[]
  total: number
  cursor: number | null
  took_ms: number
}
```

---

## Data Facts (Verified from Codebase)

| Fact | Value | Source | Impact |
|------|-------|--------|--------|
| Total experts in DB | 1,558 | `SELECT COUNT(*) FROM experts` | Pre-filter returns up to 1,558 |
| Experts with FAISS embeddings | 536 | `faiss_index.ntotal` = 536 | `username_to_faiss_pos` covers 536 only |
| Experts with bio + tags | 536 | DB query confirmed | Only 536 usable in hybrid search |
| Experts without bio | 1,022 | DB query | Visible in pure filter mode; invisible to hybrid |
| Tags stored as | JSON text array | `'["seo", "content"]'` | LIKE filter: `tags LIKE '%"seo"%'` |
| Tags field case | lowercase | Sample confirmed | Normalize incoming filter tags to lowercase |
| Findability score range | 50.1–100.0 | DB min/max | Midpoint 75; use as neutral in boost formula |
| Category field | NULL for all | DB confirmed | Startup classification migration needed |
| FAISS index type | IndexFlatIP | `type(idx).__name__` | Cosine similarity via inner product on L2-normalized vectors |
| FAISS dimensions | 768 | `idx.d` | Matches `gemini-embedding-001` OUTPUT_DIM |
| metadata.json keys | Capital + spaced | `"First Name"`, `"Hourly Rate"`, `"Username"` | Use `row.get("Username")` (capital U) for pos mapping |

**The 536 vs 1558 discrepancy explained:** The DB was seeded from `experts.csv` at startup on Railway (which had 1,558 rows). The FAISS index and `metadata.json` were built by `scripts/ingest.py` which only processes experts with bios (536 at time of last ingest). The 1,022 without bios are in the DB but have no embeddings. Phase 14 handles this correctly: pure filter mode includes all 1,558; hybrid mode scores the 536 with signal.

---

## Open Questions

1. **match_reason quality without Gemini**
   - What we know: Tag-intersection label ("Strong match: seo, content marketing") is implementable without LLM
   - What's unclear: Whether Phase 17 UX requires richer AI-generated text (CONTEXT.md left this to Claude's discretion)
   - Recommendation: Start with tag-intersection (deterministic, zero latency). Upgrade to Gemini-generated reason in Phase 18 when the co-pilot infrastructure exists and can be reused.

2. **FTS5 on Railway SQLite — confirmed locally but not in production**
   - What we know: FTS5 confirmed available on local DB via `conn.execute("SELECT fts5('test')")`
   - What's unclear: Railway's CPython wheel version — though standard CPython ships with FTS5
   - Recommendation: Add startup FTS5 availability check (already in STATE.md pending todos): `conn.execute(text("SELECT fts5('test')"))`; raise `RuntimeError` with clear message if unavailable.

3. **total count strategy: pre-filter count vs post-fusion count**
   - What we know: `total = len(filtered_experts)` (pre-filter) is fast (Python list len) but counts experts that may be excluded from hybrid results (those with no FAISS or FTS5 signal)
   - What's unclear: Whether "243 experts found" should mean pre-filter count or hybrid-eligible count
   - Recommendation: Use pre-filter count for `total`. It matches what users expect ("experts matching your rate/tag filters"). The hybrid scoring further ranks within that set.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `app/main.py`, `app/models.py`, `app/routers/admin.py`, `app/services/retriever.py`, `app/services/search_intelligence.py`, `app/database.py`, `app/config.py` — ground truth
- `data/conversations.db` — live DB inspection (1,558 experts, 536 with bios, FTS5 confirmed available)
- `data/metadata.json` — 536 records, field names verified ("Username", "First Name", etc.)
- `data/faiss.index` — 536 vectors, 768 dimensions, IndexFlatIP confirmed
- `.planning/research/ARCHITECTURE.md` — HIGH confidence, 2026-02-21, all 7 integration questions resolved
- `.planning/research/STACK.md` — HIGH confidence, 2026-02-21, package versions confirmed
- `.planning/research/PITFALLS.md` — HIGH confidence, 2026-02-21, 9 critical pitfalls documented
- [SQLite FTS5 official docs](https://sqlite.org/fts5.html) — external content tables, `IF NOT EXISTS`, `rebuild` command

### Secondary (MEDIUM confidence)
- [FAISS: Setting search parameters for one query](https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query) — IDSelectorBatch + SearchParameters Python API
- [FAISS IDSelectorBatch C++ API](https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions verified in requirements.txt
- Architecture: HIGH — prior ARCHITECTURE.md research verified against actual codebase; pipeline patterns confirmed
- Data facts: HIGH — verified directly from SQLite DB and FAISS index
- Pitfalls: HIGH — prior PITFALLS.md research + codebase-specific confirmation
- match_reason: MEDIUM — tag-intersection approach is deterministic; Gemini-generated text deferred to Phase 18

**Research date:** 2026-02-21
**Valid until:** 2026-04-21 (30 days — stable stack, no fast-moving dependencies)
