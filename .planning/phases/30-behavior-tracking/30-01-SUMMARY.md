---
phase: 30-behavior-tracking
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, sqlite, behavior-tracking]

# Dependency graph
requires:
  - phase: 29-sage-evolution
    provides: existing router pattern (feedback.py), models.py with SQLAlchemy 2.x style
provides:
  - UserEvent SQLAlchemy model (user_events table) with composite index
  - POST /api/events endpoint returning 202, no auth, Literal event_type validation
affects: [31-marketplace-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget event endpoint: POST returns 202 Accepted, no auth, Literal allowlist on event_type"
    - "Composite Index in __table_args__ tuple for aggregation query performance"

key-files:
  created:
    - app/routers/events.py
  modified:
    - app/models.py
    - app/main.py

key-decisions:
  - "UserEvent placed after NewsletterSubscriber in models.py, auto-created by existing create_all — no migration needed"
  - "event_type validated via Pydantic Literal not DB constraint — 422 on unknown values without extra code"
  - "payload stored as JSON string (Text column) — flexible shape per event_type for Phase 31 aggregation"

patterns-established:
  - "Behavior event router mirrors feedback.py: router = APIRouter(), Depends(get_db), db.add() + db.commit(), structlog"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 30 Plan 01: Backend — UserEvent model + events router Summary

**SQLAlchemy UserEvent model and POST /api/events endpoint for fire-and-forget behavior tracking with Pydantic Literal allowlist (card_click, sage_query, filter_change) returning 202 Accepted**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T18:00:30Z
- **Completed:** 2026-02-22T18:01:55Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- UserEvent ORM model added to app/models.py with user_events table, composite index ix_user_events_type_created on (event_type, created_at), auto-created at startup via existing Base.metadata.create_all
- POST /api/events router created at app/routers/events.py — 202 status, no auth dep, Pydantic Literal rejects unknown event_type with 422
- events router registered in app/main.py import line and include_router block after feedback.router

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UserEvent model to app/models.py** - `431cd91` (feat)
2. **Task 2: Create app/routers/events.py** - `9bfb22a` (feat)
3. **Task 3: Register events router in app/main.py** - `d04ff33` (feat)

## Files Created/Modified

- `app/models.py` - Added Index to sqlalchemy imports; appended UserEvent class after NewsletterSubscriber
- `app/routers/events.py` - New file: POST /api/events, EventRequest model, record_event handler
- `app/main.py` - Added events to router import, added app.include_router(events.router) after feedback.router

## Decisions Made

- Used Pydantic Literal for event_type validation (card_click, sage_query, filter_change) — gives 422 automatically without additional code
- payload stored as JSON string in Text column — flexible for varying shapes per event_type, matches existing pattern in Feedback.expert_ids
- No authentication on POST /api/events — fire-and-forget from frontend keepalive fetch; no sensitive data exposed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Table is auto-created by existing Base.metadata.create_all at startup. Verify in Railway logs within 60s of first deploy after this push.

## Next Phase Readiness

- Backend events infrastructure complete; ready for Phase 30-02 (frontend trackEvent() utility)
- Phase 31 aggregation endpoints can query user_events table using ix_user_events_type_created composite index
- Blocker to note: confirm conversations.response_experts column existence before Phase 31 exposure backfill

## Self-Check: PASSED

- FOUND: app/models.py (UserEvent class with Index, composite __table_args__)
- FOUND: app/routers/events.py (POST /api/events, status_code=202, Literal allowlist)
- FOUND: app/main.py (events in import + include_router)
- FOUND: .planning/phases/30-behavior-tracking/30-01-SUMMARY.md
- COMMIT 431cd91: feat(30-01): add UserEvent model to app/models.py — FOUND
- COMMIT 9bfb22a: feat(30-01): create app/routers/events.py — FOUND
- COMMIT d04ff33: feat(30-01): register events router in app/main.py — FOUND
- All verification commands passed: imports, Literal rejection, composite index

---
*Phase: 30-behavior-tracking*
*Completed: 2026-02-22*
