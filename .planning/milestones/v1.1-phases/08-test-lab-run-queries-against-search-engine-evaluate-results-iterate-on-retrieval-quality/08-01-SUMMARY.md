---
phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality
plan: "01"
subsystem: database
tags: [sqlalchemy, sqlite, gemini, fastapi, migrations]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export
    provides: Expert ORM model and admin API foundation that this phase enriches
provides:
  - Expert model with tags (Text, nullable) and findability_score (Float, nullable) columns
  - Idempotent ALTER TABLE migrations for expert enrichment columns in lifespan
  - app/services/tagging.py with compute_findability_score() and tag_expert_sync() shared functions
affects: [08-02, 08-03, 08-04, scripts/tag_experts.py, app/routers/admin.py]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent DDL migrations via try/except in FastAPI lifespan (same pattern as conversations columns)"
    - "Deferred imports inside function body to avoid module-load issues (tag_expert_sync)"
    - "TYPE_CHECKING guard for ORM type hints in service modules to prevent circular imports"
    - "Sync Gemini client (genai.Client) for sync FastAPI routes; async pattern reserved for batch scripts"

key-files:
  created:
    - app/services/tagging.py
  modified:
    - app/models.py
    - app/main.py

key-decisions:
  - "Use TYPE_CHECKING guard for Expert import in tagging.py to avoid circular imports at runtime"
  - "Defer google-genai and pydantic imports inside tag_expert_sync() to avoid failures when module loaded without API key"
  - "Sync Gemini client in tag_expert_sync — asyncio.run() inside running event loop raises RuntimeError; sync route handlers require sync client"
  - "compute_findability_score accepts optional tags parameter to support batch processing where tags computed but not yet committed to DB"

patterns-established:
  - "Service modules in app/services/ use TYPE_CHECKING for ORM model imports"
  - "Per-call genai.Client() instantiation inside functions rather than module-level singleton"

requirements-completed: [TAGS-02, FIND-01, FIND-02]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 8 Plan 01: Expert Enrichment Schema Foundation Summary

**Expert model extended with tags/findability_score columns, idempotent SQLite migrations wired into lifespan, and shared tagging service (compute_findability_score + tag_expert_sync) created in app/services/tagging.py**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T00:16:16Z
- **Completed:** 2026-02-21T00:21:00Z
- **Tasks:** 2
- **Files modified:** 3 (app/models.py, app/main.py, app/services/tagging.py)

## Accomplishments
- Expert ORM model extended with `tags` (Text, nullable) and `findability_score` (Float, nullable) columns — defaults to None None
- Idempotent ALTER TABLE migrations added to FastAPI lifespan; same try/except pattern as existing conversations migrations
- `compute_findability_score()` implements the FIND-01 formula (bio 40pts, tags 25pts, profile URL 15pts, job title 10pts, hourly rate 10pts)
- `tag_expert_sync()` provides sync Gemini 2.5 Flash call safe for use from sync FastAPI route handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Expert model and add idempotent DB migrations** - `2d27887` (feat)
2. **Task 2: Create app/services/tagging.py with compute_findability_score and tag_expert_sync** - `7718aa7` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `app/models.py` - Added `tags: Mapped[str | None]` and `findability_score: Mapped[float | None]` after `category` column
- `app/main.py` - Added Phase 8 expert enrichment column migration block in lifespan (idempotent ALTER TABLE for tags TEXT and findability_score REAL)
- `app/services/tagging.py` - New module: `compute_findability_score()` (deterministic scoring) and `tag_expert_sync()` (sync Gemini tagging)

## Decisions Made
- TYPE_CHECKING guard for Expert import in tagging.py avoids circular imports while preserving type hints
- Deferred google-genai imports inside tag_expert_sync() body prevent failures when module loaded in environments without GOOGLE_API_KEY
- Sync Gemini client used in tag_expert_sync — async client would require asyncio.run() which raises RuntimeError inside FastAPI's running event loop
- compute_findability_score accepts optional `tags` list parameter to handle batch processing where tags are freshly computed but not yet committed to DB

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Expert schema foundation complete — Phase 8 batch tagging script (08-02) can now use `compute_findability_score` and `tag_expert_sync` from `app.services.tagging`
- Admin endpoint (08-03) can call `tag_expert_sync` synchronously on POST /api/admin/experts
- Both new columns will be created automatically on next Railway deploy (lifespan migrations are idempotent)

## Self-Check: PASSED

- FOUND: app/models.py
- FOUND: app/main.py
- FOUND: app/services/tagging.py
- FOUND: 08-01-SUMMARY.md
- FOUND commit: 2d27887 (Task 1)
- FOUND commit: 7718aa7 (Task 2)

---
*Phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality*
*Completed: 2026-02-21*
