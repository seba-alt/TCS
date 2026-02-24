---
phase: 39-sage-cross-page-navigation
plan: 01
subsystem: ui, routing
tags: [react-router, zustand, sage, layout, popover]

requires:
  - phase: 38
    provides: BrowsePage at / with category rows and navigation
  - phase: 36
    provides: navigationSlice, pilotSlice, resetPilot gate
provides:
  - "RootLayout wrapping Browse and Explorer with shared Sage components"
  - "SagePopover compact chat for Browse page"
  - "SageFAB visible on all pages via layout-level rendering"
  - "Conversation continuity across Browse to Explorer navigation"
affects: [phase-39-02]

tech-stack:
  added: []
  patterns:
    - "RootLayout with Outlet pattern for cross-page UI components"
    - "Route-aware component rendering (isExplorer check for panel vs popover)"
    - "Filter glow suppression on non-Explorer pages"

key-files:
  created:
    - frontend/src/layouts/RootLayout.tsx
    - frontend/src/components/pilot/SagePopover.tsx
  modified:
    - frontend/src/main.tsx
    - frontend/src/pages/MarketplacePage.tsx
    - frontend/src/components/pilot/SageFAB.tsx

key-decisions:
  - "SagePopover is 340x420px (smaller than SagePanel 380x560px) for lightweight chat bubble feel"
  - "RootLayout closes popover on back-navigation to Browse via prevPath ref tracking"
  - "Filter glow on SageFAB suppressed when not on /explore (Browse has no filter grid)"
  - "MarketplacePage Sage rendering fully removed — RootLayout is the single source"

patterns-established:
  - "Root layout route wrapping / and /explore — all cross-page UI goes here"
  - "Route-dependent component variants: popover on Browse, full panel on Explorer"

requirements-completed: [SAGE-01, SAGE-02]

duration: 3min
completed: 2026-02-24
---

# Phase 39 Plan 01: RootLayout + SagePopover + FAB Lift Summary

**Sage FAB and chat UI lifted to shared RootLayout — visible on Browse (popover) and Explorer (full panel) with conversation continuity via Zustand pilotSlice**

## Performance

- **Duration:** 3 min
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Created SagePopover: compact chat popover (340x420px) for Browse page Sage interactions
- Created RootLayout: shared layout wrapping / and /explore with Sage FAB + route-dependent panel/popover
- Updated router to use layout route pattern wrapping Browse and Explorer
- Removed Sage rendering from MarketplacePage (now handled by RootLayout)
- Added route-aware filter glow suppression to SageFAB

## Task Commits

1. **Task 1: Create SagePopover and RootLayout, update routing** - `fd0c8a6` (feat)

## Files Created/Modified
- `frontend/src/layouts/RootLayout.tsx` - Shared layout with Outlet + Sage components
- `frontend/src/components/pilot/SagePopover.tsx` - Compact chat popover for Browse
- `frontend/src/main.tsx` - Layout route wrapping / and /explore
- `frontend/src/pages/MarketplacePage.tsx` - Removed Sage FAB/Panel (moved to RootLayout)
- `frontend/src/components/pilot/SageFAB.tsx` - Route-aware filter glow suppression

## Decisions Made
- SagePopover dimensions: 340px wide x min(50vh, 420px) tall — smaller than Explorer panel for chat bubble feel
- No backdrop overlay on Browse popover — lightweight, doesn't dim the page
- Back-navigation detection via useRef prevPath tracking (not on every render)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RootLayout in place — Plan 02 can add discovery auto-navigation to useSage
- SagePopover renders on Browse — ready for user to interact and trigger discovery searches

---
*Phase: 39-sage-cross-page-navigation*
*Completed: 2026-02-24*
