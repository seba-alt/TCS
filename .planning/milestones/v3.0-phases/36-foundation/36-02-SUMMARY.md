---
phase: 36-foundation
plan: 02
subsystem: store, database
tags: [zustand, sqlalchemy, sqlite, navigation, photo]

requires:
  - phase: 35
    provides: v2.3 complete — ExplorerStore with filter/results/pilot slices
provides:
  - "NavigationSlice in Zustand store (navigationSource, pendingSageResults, pendingSearchQuery)"
  - "useNavigationSlice convenience hook"
  - "Expert.photo_url nullable column in SQLAlchemy model"
  - "Idempotent ALTER TABLE migration for photo_url in app startup"
affects: [phase-37, phase-38, phase-39]

tech-stack:
  added: []
  patterns:
    - "NavigationSlice follows same StateCreator pattern as pilotSlice — excluded from persist partialize"
    - "Idempotent ALTER TABLE with try/except pass pattern for Railway safety"

key-files:
  created:
    - frontend/src/store/navigationSlice.ts
  modified:
    - frontend/src/store/index.ts
    - app/models.py
    - app/main.py

key-decisions:
  - "pendingSageResults stores full Expert objects (not IDs) — matches existing resultsSlice pattern"
  - "navigationSource defaults to 'direct' — critical for resetPilot gate in Plan 01"
  - "photo_url is String(500) nullable — same pattern as profile_url"
  - "ALTER TABLE migration placed after Phase 8 block, follows established try/except/pass pattern"

patterns-established:
  - "NavigationSlice: ephemeral cross-page state, not persisted, cleared after consumption"
  - "Expert model column addition: ORM model + idempotent ALTER TABLE in lifespan"

requirements-completed: [SAGE-04]

duration: 3min
completed: 2026-02-24
---

# Phase 36 Plan 02: Zustand NavigationSlice + Expert.photo_url Summary

**Cross-page navigation state layer (navigationSlice) with Sage handoff fields and Expert.photo_url column with Railway-safe migration**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created navigationSlice with navigationSource, pendingSageResults, and pendingSearchQuery fields
- Integrated NavigationSlice into combined ExplorerStore type (not persisted to localStorage)
- Added useNavigationSlice convenience hook with useShallow
- Added nullable photo_url column to Expert SQLAlchemy model
- Added idempotent ALTER TABLE migration in app startup lifespan

## Task Commits

1. **Task 1: Create navigationSlice and integrate into combined store** - `712f77c` (feat)
2. **Task 2: Add Expert.photo_url column with idempotent migration** - `af08be6` (feat)

## Files Created/Modified
- `frontend/src/store/navigationSlice.ts` - New slice with cross-page navigation state
- `frontend/src/store/index.ts` - ExplorerStore type extended with NavigationSlice
- `app/models.py` - Expert model with nullable photo_url column
- `app/main.py` - Phase 36 ALTER TABLE migration block

## Decisions Made
- Storing full Expert objects in pendingSageResults (not IDs) — avoids redundant lookup, matches existing patterns
- clearPendingSageResults clears both results AND query atomically
- No Zustand persist version bump needed — partialize shape unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NavigationSlice ready for Phase 38 (Browse→Explorer navigation) and Phase 39 (Sage cross-page handoff)
- photo_url column ready for Phase 37 (photo API endpoints and bulk import)
- Migration is Railway-safe — tested that column appears in ORM model

---
*Phase: 36-foundation*
*Completed: 2026-02-24*
