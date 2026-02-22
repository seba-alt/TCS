---
phase: 14-hybrid-search-backend
plan: "01"
subsystem: backend/search
tags: [hybrid-search, faiss, fts5, bm25, pipeline, pydantic, fastapi]
dependency_graph:
  requires: []
  provides: [ExpertCard, ExploreResponse, run_explore, GET /api/explore]
  affects: [14-02, phases 15-19]
tech_stack:
  added: []
  patterns:
    - Three-stage hybrid search pipeline (SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25)
    - Multiplicative findability boost (±20% based on 50–100 score range, neutral at 75)
    - IDSelectorBatch search-time filter (no index.remove_ids)
    - Integer cursor pagination (cursor=None signals end of results)
    - asyncio.run_in_executor for offloading synchronous pipeline from FastAPI event loop
key_files:
  created:
    - app/services/explorer.py
    - app/routers/explore.py
  modified: []
decisions:
  - "FAISS weight 0.7, BM25 weight 0.3 — hardcoded constants per RESEARCH.md (tuning rare)"
  - "match_reason uses tag-intersection approach (deterministic, zero latency) — Gemini deferred to Phase 18"
  - "Integer cursor offset chosen over opaque base64 — simplest for react-virtuoso scroll loading"
  - "total = pre-filter count (len(filtered_experts)) — counts what user sees as matching rate/tag filters"
  - "Findability boost: normalized from 50-100 range to ±20% multiplier (neutral at 75)"
  - "Experts with zero FAISS and BM25 signal excluded from hybrid results (pure signal requirement)"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 14 Plan 01: Hybrid Search Pipeline Service Summary

**One-liner:** Three-stage hybrid search pipeline (SQLAlchemy pre-filter + FAISS IDSelectorBatch 0.7 + FTS5 BM25 0.3) with multiplicative findability boost, paginated ExploreResponse data contract for phases 15–19.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create explorer.py hybrid search pipeline service | b0a777f | app/services/explorer.py |
| 2 | Create explore.py thin FastAPI router | c93b987 | app/routers/explore.py |

## What Was Built

### app/services/explorer.py

Full three-stage hybrid search pipeline implementing the `ExploreResponse` data contract:

**Pydantic schemas:**
- `ExpertCard` — 15 fields including faiss_score, bm25_score, final_score, match_reason (None in filter mode)
- `ExploreResponse` — experts[], total (pre-filter count), cursor (int | None), took_ms

**Pipeline stages:**
1. **SQLAlchemy pre-filter** (always runs): hourly_rate range + tag AND-logic via `Expert.tags.like(f'%"{tag.lower()}"%')`
2. **FAISS IDSelectorBatch** (text query only): builds `allowed_positions` from `username_to_faiss_pos`, guards against empty array, searches k=min(50, len(allowed_positions)) with `faiss.SearchParameters(sel=selector)`
3. **FTS5 BM25** (text query only): sanitizes query with `_safe_fts_query()`, runs `LIMIT 200` query, normalizes rank to 0.0–1.0

**Score fusion:** `(faiss * 0.7) + (bm25 * 0.3)`, then `_apply_findability_boost()` multiplicative ±20%

**Pure filter mode:** sorts by `findability_score DESC` without touching FAISS or FTS5

**Pagination:** integer cursor offset, `next_cursor = cursor + limit if has_more else None`

### app/routers/explore.py

Thin FastAPI router delegating to `run_explore()` via `asyncio.run_in_executor` to keep the event loop unblocked. Query params: query, rate_min, rate_max, tags (comma-separated), limit (default 20), cursor (default 0).

## Verification

All plan verification checks passed:

1. `python3 -c "from app.services.explorer import ExpertCard, ExploreResponse, run_explore; print('OK')"` — OK
2. `python3 -c "from app.routers.explore import router; print('OK')"` — OK
3. `allowed_positions` uses `dtype=np.int64` — confirmed (line 197)
4. FTS5 query has `LIMIT 200` — confirmed (line 225)
5. `_safe_fts_query()` called before MATCH — confirmed (line 216)
6. `len(allowed_positions) > 0` guard exists before IDSelectorBatch — confirmed (line 201)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| FAISS/BM25 weights | 0.7/0.3 hardcoded constants | Per REQUIREMENTS.md EXPL-03; tuning rare, env var overhead not justified |
| match_reason strategy | Tag-intersection label (deterministic) | Zero latency; Gemini upgrade deferred to Phase 18 co-pilot infrastructure |
| Cursor encoding | Integer offset | Simplest for react-virtuoso; stable corpus, no concurrent inserts |
| total count | Pre-filter count (len(filtered_experts)) | Matches user expectation ("N matching your filters"); hybrid scoring ranks within that set |
| Score normalization | BM25: abs(rank)/max_rank; FAISS: raw inner product | FTS5 rank is negative; FAISS IP on normalized vectors is already 0.0–1.0 |

## Self-Check: PASSED

- `/Users/sebastianhamers/Documents/TCS/app/services/explorer.py` — FOUND
- `/Users/sebastianhamers/Documents/TCS/app/routers/explore.py` — FOUND
- Commit b0a777f — FOUND
- Commit c93b987 — FOUND
