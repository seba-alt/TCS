---
phase: 14-hybrid-search-backend
plan: "02"
subsystem: backend/search
tags: [hybrid-search, fts5, bm25, fastapi, startup, routing]
dependency_graph:
  requires: [14-01]
  provides: [GET /api/explore reachable, experts_fts populated, username_to_faiss_pos on app.state, category auto-classification]
  affects: [phases 15-19]
tech_stack:
  added: []
  patterns:
    - FTS5 virtual table with content table + content_rowid pointing to experts
    - FTS5 INSERT trigger for automatic sync on new expert inserts (SQLite level)
    - FTS5 rebuild command after bulk ingest (INSERT INTO experts_fts(experts_fts) VALUES('rebuild'))
    - username_to_faiss_pos mapping built at startup from metadata.json "Username" keys
    - Category auto-classification on startup for uncategorized experts
key_files:
  created: []
  modified:
    - app/main.py
    - app/routers/admin.py
decisions:
  - "FTS5 INSERT trigger used for automatic sync of new expert inserts (SQLite-level, belt-and-suspenders with explicit insert in add_expert path is avoided to prevent duplicate rowids)"
  - "Explicit FTS5 rebuild in _run_ingest_job (not trigger) — batch update path requires full rebuild after tag changes"
  - "username_to_faiss_pos built from metadata.json 'Username' (capital U) key — confirmed by RESEARCH.md Data Facts"
  - "Category auto-classification runs at startup only for uncategorized experts (one-time idempotent migration)"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 14 Plan 02: Hybrid Search Wiring Summary

**One-liner:** Wired GET /api/explore endpoint into the running app with FTS5 startup migration, username_to_faiss_pos mapping, category auto-classification, and ingest-job FTS5 rebuild in app/main.py and app/routers/admin.py.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add FTS5 startup migration, username_to_faiss_pos mapping, category classification, and explore router registration to main.py | 5c797d2 | app/main.py |
| 2 | Add FTS5 sync in admin.py write paths (add_expert and _run_ingest_job) | 5103bcb | app/routers/admin.py |

## What Was Built

### app/main.py (67 lines added)

Five targeted additions to the lifespan startup handler and route registration:

1. **Import**: `explore` added to routers import line
2. **FTS5 virtual table** (after expert enrichment migration): `CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(first_name, last_name, job_title, company, bio, tags, content='experts', content_rowid='id')` — idempotent, populates from experts table if empty
3. **FTS5 INSERT trigger**: `CREATE TRIGGER IF NOT EXISTS experts_fts_ai AFTER INSERT ON experts` — SQLite-level automatic sync for any new expert row insertions
4. **username_to_faiss_pos mapping**: Iterates `app.state.metadata` using `_row.get("Username")` (capital U), stores position dict on `app.state.username_to_faiss_pos` — required by `run_explore()` IDSelectorBatch filter
5. **Category auto-classification**: Fetches uncategorized experts, calls `_auto_categorize(job_title)`, commits — idempotent (0 count on subsequent restarts)
6. **Router registration**: `app.include_router(explore.router)` added after admin.router

### app/routers/admin.py (16 lines added)

Two additions inside `_run_ingest_job()` after the hot-reload block:

1. **FTS5 rebuild**: `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` — rebuilds FTS5 content-table index after bulk tag updates change expert records
2. **username_to_faiss_pos refresh**: Rebuilds the position mapping after metadata hot-reload so FAISS searches see the updated expert set

## Verification

All verification checks passed:

1. `python3 -c "import app.main; print('main.py imports OK')"` — OK
2. `python3 -c "import app.routers.admin; print('admin.py imports OK')"` — OK
3. `python3 -c "from app.routers.explore import router; print('explore.router OK')"` — OK
4. `grep "explore"` in main.py — appears in import line (line 34) and include_router call (line 270)
5. `grep "experts_fts"` in admin.py — FTS5 rebuild present in `_run_ingest_job` (line 130)
6. `grep "username_to_faiss_pos"` in admin.py — refresh present in `_run_ingest_job` (line 140)

## Deviations from Plan

### Auto-resolved during execution

**Plan note clarification — add_expert FTS5 sync**

The plan's Task 2 "Addition 1" went through several revisions in its action block before settling on the "SIMPLEST correct approach": use the SQLite INSERT trigger (created in main.py Task 1) for add_expert coverage, and explicit FTS5 rebuild only in `_run_ingest_job`. This final approach was implemented exactly: no explicit FTS5 INSERT was added to add_expert (trigger handles it), and `_run_ingest_job` gets the rebuild. The plan's final stated approach was followed precisely.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| FTS5 sync for add_expert | INSERT trigger (SQLite level) | Avoids duplicate rowid conflict with explicit INSERT; trigger fires at DB commit time automatically |
| FTS5 sync for _run_ingest_job | Explicit rebuild command | Bulk updates change existing rows — trigger only fires on INSERT, not UPDATE; rebuild refreshes all content |
| username key case | `_row.get("Username")` (capital U) | metadata.json uses "Username" — confirmed in RESEARCH.md Data Facts and existing main.py CSV seeding code |
| Category classification scope | Only uncategorized experts at startup | Idempotent migration; manual classifications from admin UI must not be overwritten |

## Self-Check: PASSED

- `/Users/sebastianhamers/Documents/TCS/app/main.py` — FOUND (modified)
- `/Users/sebastianhamers/Documents/TCS/app/routers/admin.py` — FOUND (modified)
- Commit 5c797d2 — FOUND
- Commit 5103bcb — FOUND
