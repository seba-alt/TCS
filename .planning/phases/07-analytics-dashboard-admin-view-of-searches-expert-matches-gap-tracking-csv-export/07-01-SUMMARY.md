---
phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, sqlite, csv, analytics, admin]

# Dependency graph
requires:
  - phase: 02-rag-api
    provides: Conversation model, get_db dependency, chat.py _stream_chat function
  - phase: 06-feedback
    provides: Existing models.py pattern and DB schema style (no FK, JSON Text columns)
provides:
  - top_match_score and gap_resolved columns on Conversation model
  - Idempotent ALTER TABLE migrations in lifespan for existing SQLite DBs
  - Score capture in chat.py for every new conversation
  - /api/admin/stats endpoint returning aggregate metrics
  - /api/admin/searches endpoint with pagination and filtering
  - /api/admin/gaps endpoint aggregating gap queries by frequency
  - POST /api/admin/gaps/{gap_query}/resolve toggle endpoint
  - /api/admin/export/searches.csv and /api/admin/export/gaps.csv CSV downloads
  - X-Admin-Key header auth on all /api/admin/* endpoints
affects:
  - 07-02-frontend (admin dashboard UI will consume all these endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - APIKeyHeader auth pattern with ADMIN_SECRET env var
    - GAP_THRESHOLD=0.60 constant matching SIMILARITY_THRESHOLD in retriever.py
    - StreamingResponse CSV export with metadata header rows
    - Idempotent ALTER TABLE migration catching OperationalError in lifespan

key-files:
  created:
    - app/routers/admin.py
  modified:
    - app/models.py
    - app/main.py
    - app/routers/chat.py

key-decisions:
  - "GAP_THRESHOLD=0.60 matches SIMILARITY_THRESHOLD in retriever.py — a conversation is a gap if top_match_score < 0.60 OR response_type == clarification"
  - "ALTER TABLE migrations caught via bare except in lifespan — idempotent, safe on existing DBs where columns already exist after first deploy"
  - "X-Admin-Key added to CORS allow_headers so browser preflight requests from Vercel do not fail"
  - "func.min(gap_resolved.cast(Integer)) used for resolved aggregation — resolved=True only when ALL rows in group are resolved (AND semantics via min of 0/1)"
  - "Router-level Depends(_require_admin) applies auth to all /api/admin/* endpoints without repeating the dependency per endpoint"

patterns-established:
  - "Admin auth: APIKeyHeader(name='X-Admin-Key', auto_error=False) + env var comparison in dependency"
  - "CSV export: metadata header rows (#-prefixed), blank row separator, then column headers, then data rows"

requirements-completed: [ANAL-01]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 7 Plan 01: Admin Analytics API Summary

**SQLite schema extended with top_match_score + gap_resolved, six /api/admin/* endpoints with X-Admin-Key auth delivering stats, paginated search history, gap aggregates, resolve toggle, and CSV exports**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T20:54:40Z
- **Completed:** 2026-02-20T20:57:39Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended Conversation model with top_match_score (Float nullable) and gap_resolved (Boolean default False); lifespan runs idempotent ALTER TABLE migrations so existing Railway DB is upgraded without data loss
- chat.py now captures candidates[0].score before DB commit so every new conversation records its top FAISS score for gap detection
- Built complete admin router (app/routers/admin.py) with 6 endpoints, all guarded by X-Admin-Key header validation; CORS updated to allow the header from Vercel

## Task Commits

Each task was committed atomically:

1. **Task 1: Add top_match_score and gap_resolved to Conversation model + lifespan migrations + capture score in chat.py** - `d1a9e3e` (feat)
2. **Task 2: Build /api/admin/* router with stats, searches, gaps, resolve, and CSV export endpoints** - `e24ba53` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `app/routers/admin.py` - All 6 /api/admin/* endpoints with auth, filtering, aggregation, and CSV export
- `app/models.py` - Added top_match_score and gap_resolved columns + Boolean/Float imports
- `app/main.py` - Lifespan ALTER TABLE migrations, admin router import and registration, CORS allow_headers updated
- `app/routers/chat.py` - Capture top_score = candidates[0].score before Conversation constructor

## Decisions Made
- GAP_THRESHOLD=0.60 matches SIMILARITY_THRESHOLD in retriever.py — keeps gap definition consistent with retrieval behavior
- Router-level Depends(_require_admin) on the APIRouter (not per-endpoint) — all 6 endpoints inherit auth with one declaration
- func.min(gap_resolved.cast(Integer)) for resolved aggregation — AND semantics: resolved only if every row with that query is resolved
- X-Admin-Key added to CORS allow_headers to prevent browser preflight rejection from Vercel origin
- CSV metadata header rows use # prefix and blank separator row before column headers — consistent with common export conventions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Port 8001 already in use during server test; switched to port 8099. Auth test and stats response both verified correctly.

## User Setup Required
None - no external service configuration required.
ADMIN_SECRET env var must be set on Railway for admin endpoints to function (same pattern as existing env vars).

## Next Phase Readiness
- All /api/admin/* endpoints live and verified — 401 without key, 200 JSON with correct key
- Stats endpoint returns real data (21 conversations, 15 matches, gap_count=6 from existing test data)
- Phase 07-02 frontend dashboard can immediately start consuming all endpoints
- ADMIN_SECRET must be added to Railway environment variables before dashboard goes live

---
*Phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export*
*Completed: 2026-02-20*
