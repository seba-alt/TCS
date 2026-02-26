---
phase: 41-expert-email-purge
plan: 01
subsystem: database
tags: [pii, privacy, sqlite, csv, fastapi, sqlalchemy]

# Dependency graph
requires: []
provides:
  - Idempotent UPDATE experts SET email = '' migration in lifespan (runs every startup)
  - experts.csv with Email column entirely removed (12 columns, 1610 rows)
  - import_experts_csv() that never writes Expert.email from uploaded CSVs
  - add_expert() CSV append without Email field or value
  - _seed_experts_from_csv() that never reads Email from CSV
affects: [42-search-quality-fix, 43-frontend-error-fixes, 44-dead-code-purge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Idempotent startup migration: UPDATE ... SET col = '' blanks PII on every startup safely
    - Email column stripped from extrasaction=ignore writers — uploaded CSVs with Email are silently ignored

key-files:
  created: []
  modified:
    - app/main.py
    - app/routers/admin.py
    - data/experts.csv

key-decisions:
  - "Purge via UPDATE at startup (not a one-time migration flag) — guarantees blanking even if DB was restored from backup with emails"
  - "Remove email= from constructor rather than passing empty string — cleaner, relies on model default=''"
  - "Conversation.email and Feedback.email are completely untouched — those are user-consented lead captures, not expert PII"

patterns-established:
  - "PII purge pattern: idempotent UPDATE in lifespan so any DB restore is immediately re-sanitized on next startup"

requirements-completed: [PRIV-01, PRIV-02, PRIV-03]

# Metrics
duration: 8min
completed: 2026-02-26
---

# Phase 41 Plan 01: Expert Email Purge Summary

**Idempotent startup migration blanks all 1558+ Expert.email values; Email column stripped from experts.csv; import/add/seed paths permanently closed against re-introduction**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-26T13:01:28Z
- **Completed:** 2026-02-26T13:09:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `UPDATE experts SET email = ''` migration to lifespan() after Phase 36 block — runs idempotently on every server startup (PRIV-01)
- Stripped Email column from data/experts.csv entirely — 1610 rows, down from 13 to 12 columns (PRIV-02)
- Closed all three re-introduction vectors: seed path (_seed_experts_from_csv), import path (import_experts_csv), and add path (add_expert CSV append) — PRIV-03
- Conversation.email, Feedback.email, EmailLead, and admin Leads page code confirmed 100% untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Add email purge migration to lifespan and clean seed logic** - `583e6cc` (feat)
2. **Task 2: Strip Email from CSV and close import/add re-introduction vectors** - `f56222b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/main.py` - Added Phase 41 email purge migration block in lifespan(); removed email= from _seed_experts_from_csv() Expert constructor
- `app/routers/admin.py` - Removed existing.email assignment in import update branch; removed email= from Expert() constructor in import insert branch; removed "Email" from add_expert fieldnames and writerow dict
- `data/experts.csv` - Email column stripped — 12 columns remain, 1610 data rows preserved

## Decisions Made
- Used `UPDATE experts SET email = ''` (blanking rather than NULL) to match the existing default="" convention in the Expert model
- Purge runs on every startup rather than as a one-time flag — guarantees re-sanitization even if DB is restored from a pre-purge backup
- Omit email= from constructors entirely (relying on model default="") rather than passing "" explicitly — cleaner and future-proof

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Expert email purge complete — all PRIV-01/02/03 requirements satisfied
- Phase 42 (search quality fix) can proceed independently
- No blockers

## Self-Check: PASSED

- app/main.py: FOUND
- app/routers/admin.py: FOUND
- data/experts.csv: FOUND
- 41-01-SUMMARY.md: FOUND
- Commit 583e6cc (Task 1): FOUND
- Commit f56222b (Task 2): FOUND
- Commit 0813c04 (metadata): FOUND

---
*Phase: 41-expert-email-purge*
*Completed: 2026-02-26*
