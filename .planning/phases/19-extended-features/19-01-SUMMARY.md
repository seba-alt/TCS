---
phase: 19-extended-features
plan: "01"
status: complete
completed: 2026-02-21
---

# Summary: Plan 19-01 — Backend GET /api/suggest

## What was built

Created `app/routers/suggest.py` with a `GET /api/suggest` endpoint using FTS5 prefix matching, and registered it in `app/main.py`.

## Tasks completed

### Task 1: Create suggest.py router
- Created `app/routers/suggest.py`
- `_safe_prefix_query(q)`: sanitizes input (strips FTS5 specials, boolean operators), appends `*` to last word for prefix matching
- `_run_suggest(q, db)`: queries `experts_fts` MATCH with prefix query, returns up to 8 distinct `job_title` strings
- `GET /api/suggest`: FastAPI route with `run_in_executor` async wrapper, 2-char minimum enforced
- Imports verified: `python3 -c "from app.routers.suggest import router; print('OK')"` — OK

### Task 2: Register in main.py
- Added `suggest` to router import line
- Added `app.include_router(suggest.router)` after pilot router

## Key decisions

- `_safe_prefix_query` is separate from `_safe_fts_query` in explorer.py — explorer's version strips `*`, this one appends it
- FTS5 queries `DISTINCT job_title` only — job titles are the most useful suggestion type for users
- `except Exception: return []` — FTS5 MATCH can raise on edge-case inputs; suggestions are non-critical

## Files modified

- `app/routers/suggest.py` (created)
- `app/main.py` (suggest added to import + include_router)

## Verification

- `grep -n "api/suggest|_safe_prefix_query|_run_suggest" app/routers/suggest.py` — all present
- `grep -n "suggest" app/main.py` — import line 34, include_router line 272
- `python3 -c "from app.routers.suggest import router"` — imports OK
