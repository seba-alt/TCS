---
phase: 45-security-and-infrastructure-hardening
plan: 02
subsystem: database, infra
tags: [sqlite, wal, busy-timeout, tsne, asyncio, lifespan]

requires:
  - phase: 44-mobile-filter-redesign
    provides: working server with SQLite database and t-SNE background task
provides:
  - SQLite WAL journal mode enabled on every connection
  - busy_timeout=5000ms per connection for concurrent write safety
  - t-SNE background computation at startup instead of shutdown
affects: [admin-features, public-explorer]

tech-stack:
  added: []
  patterns: [SQLAlchemy connect event listener for PRAGMAs, asyncio.create_task before yield for startup tasks]

key-files:
  created: []
  modified: [app/database.py, app/main.py]

key-decisions:
  - "WAL pragma set via SQLAlchemy connect event listener — fires on every new connection automatically"
  - "busy_timeout=5000ms chosen to give concurrent writers time without excessive waits"
  - "t-SNE create_task moved before yield — code after yield in lifespan runs at shutdown, not startup"

patterns-established:
  - "SQLite PRAGMAs: use @event.listens_for(engine, 'connect') for per-connection settings"
  - "Lifespan startup tasks: place asyncio.create_task() before yield, never after"

requirements-completed: [SEC-03, ADM-03]

duration: 5min
completed: 2026-02-27
---

# Plan 45-02: SQLite WAL Mode + t-SNE Fix Summary

**SQLite WAL journal mode with busy_timeout on every connection, and t-SNE background task moved from shutdown to startup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27
- **Completed:** 2026-02-27
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Enabled SQLite WAL mode via connect event listener for concurrent traffic safety
- Set busy_timeout=5000ms per connection to prevent "database is locked" errors
- Fixed t-SNE background task placement to compute at startup instead of shutdown
- Corrected misleading comments about post-yield behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: SQLite WAL mode + t-SNE lifespan fix** - `155195a` (feat)

Note: The t-SNE fix was included in the `e7ebe1a` commit (Plan 45-01) since both plans modified app/main.py concurrently.

## Files Created/Modified
- `app/database.py` - Added connect event listener for WAL + busy_timeout PRAGMAs
- `app/main.py` - Moved create_task(_compute_tsne_background) before yield

## Decisions Made
- WAL is set via event listener rather than raw SQL at startup — ensures every connection gets the pragma
- busy_timeout is per-connection (does not persist at file level like journal_mode=WAL)
- Corrected the old "post-yield NEVER above yield" comment which was incorrect

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SQLite is hardened for concurrent public traffic
- Embedding heatmap will compute at startup, resolving the permanent loading state
- Ready for Phase 46 (Frontend Performance) and Phase 47 (Explorer Polish)

---
*Phase: 45-security-and-infrastructure-hardening*
*Completed: 2026-02-27*
