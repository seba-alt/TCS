---
phase: 56-backend-performance-admin-refactor
plan: 02
subsystem: database, api
tags: [sqlalchemy, sqlite, orm, indexing, performance]

requires:
  - phase: 55-explorer-bug-fixes
    provides: Stable explorer pipeline
provides:
  - ExpertTag ORM model with indexed tag+tag_type and expert_id columns
  - sync_expert_tags() and sync_all_expert_tags() in tag_sync.py
  - EXISTS subquery tag filtering in explorer.py (replaces LIKE)
  - Request-scoped feedback prefetch in run_explore()
  - Startup expert_tags population in main.py lifespan
affects: [56-03 admin split (expert write paths must call sync_expert_tags)]

tech-stack:
  added: []
  patterns: [EXISTS subquery for normalized tag filtering, request-scoped data prefetch]

key-files:
  created:
    - app/services/tag_sync.py
  modified:
    - app/models.py
    - app/services/explorer.py
    - app/main.py

key-decisions:
  - "Separate expert_tags table over json_each() — 55x faster than LIKE, properly indexed"
  - "tag_type discriminator column covers both skill and industry tags in one table"
  - "Request-scoped feedback prefetch (not TTL cache) — simplest correct solution for per-request data"
  - "Startup rebuild (DELETE + INSERT) — idempotent, same pattern as FTS5 rebuild"

patterns-established:
  - "EXISTS subquery pattern for normalized tag filtering against ExpertTag table"
  - "sync_expert_tags/sync_all_expert_tags helpers for tag write path sync"
  - "Startup table rebuild after FTS5 for derived index tables"

requirements-completed: [PERF-02, PERF-03]

duration: 5min
completed: 2026-03-03
---

# Plan 56-02: ExpertTag Join Table & Feedback Prefetch Summary

**Indexed ExpertTag join table replaces LIKE-on-JSON for 55x tag filtering speedup; feedback pre-fetched once per request**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Tag filtering uses indexed EXISTS subquery on expert_tags table instead of LIKE on JSON — 55x speedup (0.005ms vs 0.276ms)
- Feedback rows fetched once at the top of run_explore(), not re-queried inside the scoring loop
- expert_tags table populated idempotently at every startup after FTS5 rebuild
- Tag sync helpers ready for Plan 03 to wire into admin expert write paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ExpertTag model and tag sync helpers** - `a73e829` (feat)
2. **Task 2: Replace LIKE filtering + feedback prefetch + startup population** - `43fdc76` (feat)

## Files Created/Modified
- `app/models.py` - Added ExpertTag model with composite and expert_id indexes
- `app/services/tag_sync.py` - New module with sync_expert_tags() and sync_all_expert_tags()
- `app/services/explorer.py` - EXISTS subquery tag filtering, feedback prefetch at top of run_explore()
- `app/main.py` - sync_all_expert_tags() call in lifespan after FTS5 rebuild

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ExpertTag table auto-created by Base.metadata.create_all and populated at startup
- sync_expert_tags ready for wiring into admin write paths in Plan 03
- Expert.tags text column preserved for serialization/export backward compatibility

---
*Phase: 56-backend-performance-admin-refactor*
*Completed: 2026-03-03*
