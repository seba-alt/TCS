---
phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, sqlite, pydantic, email-capture, lead-capture]

# Dependency graph
requires:
  - phase: 02-rag-api
    provides: SQLAlchemy Base, get_db dependency, Conversation model patterns, FastAPI app with lifespan
  - phase: 01-foundation
    provides: database.py with engine and SessionLocal, app/models.py scaffold
provides:
  - EmailLead ORM model in app/models.py
  - POST /api/email-capture endpoint with idempotent INSERT OR IGNORE
  - email_leads table created on server startup via Base.metadata.create_all
affects:
  - 05-email-gate-ux (frontend consumes /api/email-capture)
  - any future analytics or CRM integration needing email leads

# Tech tracking
tech-stack:
  added: []
  patterns:
    - sqlalchemy.dialects.sqlite.insert with on_conflict_do_nothing for idempotent upserts
    - fire-and-forget backend endpoint pattern (frontend unlocks on localStorage regardless)

key-files:
  created:
    - app/routers/email_capture.py
  modified:
    - app/models.py
    - app/main.py

key-decisions:
  - "sqlalchemy.dialects.sqlite.insert used (not sqlalchemy.insert) for on_conflict_do_nothing — API is identical to postgresql dialect for future migration"
  - "Endpoint returns {status: ok} for both new and duplicate emails — frontend never sees a failure from re-submission"
  - "email_leads table auto-created via existing Base.metadata.create_all in lifespan — no additional startup code needed"

patterns-established:
  - "Idempotent insert pattern: dialects.sqlite.insert + on_conflict_do_nothing(index_elements=[column])"

requirements-completed: [EMAIL-GATE-01]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 5 Plan 01: Email Lead Capture Backend Summary

**SQLite EmailLead model and idempotent POST /api/email-capture endpoint that stores gate-submitted emails with silent duplicate handling**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-20T18:44:20Z
- **Completed:** 2026-02-20T18:45:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- EmailLead ORM model added to app/models.py with unique email constraint and created_at timestamp
- POST /api/email-capture endpoint with on_conflict_do_nothing for idempotent inserts
- Router registered in app/main.py; email_leads table auto-created on server startup
- All three contract cases verified: valid email (200), duplicate (200), invalid format (422)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EmailLead model to app/models.py** - `bebe24b` (feat)
2. **Task 2: Create /api/email-capture router and wire into main.py** - `dbddc81` (feat)

## Files Created/Modified
- `app/models.py` - Added EmailLead class with email (unique, index), created_at columns
- `app/routers/email_capture.py` - New file: POST /api/email-capture with idempotent upsert
- `app/main.py` - Added email_capture import and app.include_router(email_capture.router)

## Decisions Made
- Used `sqlalchemy.dialects.sqlite.insert` (not `sqlalchemy.insert`) for `on_conflict_do_nothing` support — comment added noting Postgres migration path (identical API)
- Endpoint is fire-and-forget from the frontend perspective — returns `{"status": "ok"}` for duplicates so the frontend never surfaces a submission error to the user

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all verifications passed on first attempt. Ruff check returned zero errors.

## User Setup Required
None - no external service configuration required. The email_leads table is created automatically on next server startup.

## Next Phase Readiness
- Backend email capture endpoint is live and tested
- Frontend email gate UI (Plan 05-02) can POST to /api/email-capture on form submission
- localStorage gate key management is a frontend-only concern — no further backend work needed for the email gate flow

---
*Phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile*
*Completed: 2026-02-20*

## Self-Check: PASSED

- FOUND: app/routers/email_capture.py
- FOUND: 05-01-SUMMARY.md
- FOUND: commit bebe24b (feat(05-01): add EmailLead ORM model to app/models.py)
- FOUND: commit dbddc81 (feat(05-01): create POST /api/email-capture endpoint and wire into main.py)
