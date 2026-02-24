---
phase: 39-sage-cross-page-navigation
plan: 02
subsystem: ui, hooks
tags: [sage, navigation, zustand, discovery, auto-navigate]

requires:
  - phase: 39-01
    provides: RootLayout with SagePopover on Browse and SagePanel on Explorer
provides:
  - "Discovery auto-navigation: Sage search on Browse → auto-navigate to Explorer with results"
  - "Pending Sage results consumption on Explorer mount (no competing fetch)"
  - "Non-discovery questions stay on Browse page"
affects: []

tech-stack:
  added: []
  patterns:
    - "setPendingSageResults + setSageMode BEFORE navigate() — prevents competing fetch"
    - "setTimeout auto-navigation after ~2s for user to read Sage response"
    - "useExplore consumes pendingSageResults via getState() (not selector) for one-time mount"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useSage.ts
    - frontend/src/hooks/useExplore.ts

key-decisions:
  - "2 second delay before auto-navigation — gives user time to read 'Found X experts...' response"
  - "Non-discovery questions on Browse just show message in popover — no filter application (no grid)"
  - "pendingSageResults consumed via getState() inside useEffect — avoids dependency array pollution"
  - "sageMode set to true BEFORE navigate — critical race condition prevention"

patterns-established:
  - "Browse discovery flow: API response → add message → setTimeout → setNavigationSource('sage') → navigate"
  - "One-time pending result consumption via getState() in useEffect body"

requirements-completed: [SAGE-03]

duration: 3min
completed: 2026-02-24
---

# Phase 39 Plan 02: Discovery Auto-Navigation Summary

**Sage discovery search on Browse auto-navigates to Explorer with pre-loaded results after 2s delay — no competing 530-expert fetch flash**

## Performance

- **Duration:** 3 min
- **Tasks:** 2 (1 auto + 1 checkpoint auto-approved)
- **Files modified:** 2

## Accomplishments
- Added Browse-specific discovery flow to useSage: detect search_performed, store pending results, auto-navigate after ~2s
- Non-discovery questions on Browse stay in popover (no navigation triggered)
- useExplore consumes pendingSageResults on mount — injects Sage results directly into grid
- Critical ordering preserved: sageMode + pendingSageResults set BEFORE navigate() to prevent competing fetch

## Task Commits

1. **Task 1: Discovery auto-navigation + pending results consumption** - `11f5a0d` (feat)
2. **Task 2: End-to-end verification** - auto-approved checkpoint

## Files Created/Modified
- `frontend/src/hooks/useSage.ts` - Route detection, Browse discovery flow with auto-navigate
- `frontend/src/hooks/useExplore.ts` - Pending Sage results consumption on Explorer mount

## Decisions Made
- 2 second setTimeout for auto-navigation delay per CONTEXT.md decision
- Filter refinements on Browse just show message (no grid to apply to)
- pendingSageResults consumed via getState() to avoid adding to useEffect dependency array

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 39 complete — all SAGE requirements (SAGE-01, SAGE-02, SAGE-03) implemented
- v3.0 milestone ready for final verification

---
*Phase: 39-sage-cross-page-navigation*
*Completed: 2026-02-24*
