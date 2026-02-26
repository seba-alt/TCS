---
phase: 36-foundation
plan: 01
subsystem: ui, routing
tags: [react-router, vercel, zustand, navigation]

requires:
  - phase: 35
    provides: v2.3 complete — MarketplacePage at /marketplace as starting point
provides:
  - "BrowsePage stub at / route"
  - "Explorer (MarketplacePage) relocated to /explore"
  - "/marketplace -> /explore permanent redirect (Vercel CDN + SPA)"
  - "/chat -> /explore redirect"
  - "Gated resetPilot() using navigationSource from navigationSlice"
affects: [phase-37, phase-38, phase-39]

tech-stack:
  added: []
  patterns:
    - "MarketplaceRedirect component for query-param-preserving SPA redirect"
    - "navigationSource gate on resetPilot — direct=reset, browse/sage=preserve"

key-files:
  created:
    - frontend/src/pages/BrowsePage.tsx
  modified:
    - frontend/src/main.tsx
    - frontend/src/pages/MarketplacePage.tsx
    - frontend/vercel.json

key-decisions:
  - "BrowsePage is a minimal stub — no data fetching, no store usage, Phase 38 builds the real UI"
  - "MarketplaceRedirect uses useSearchParams + Navigate for query param preservation inside SPA"
  - "resetPilot gate defaults to 'direct' — preserves existing behavior for all current paths"
  - "App component (standalone chat) import removed from main.tsx but App.tsx not deleted"

patterns-established:
  - "Route redirect with query param preservation: useSearchParams + Navigate component pattern"
  - "Conditional pilot reset via navigationSource store field"

requirements-completed: [NAV-01]

duration: 3min
completed: 2026-02-24
---

# Phase 36 Plan 01: Route Restructure + BrowsePage Stub Summary

**v3.0 URL structure established: / serves BrowsePage stub, /explore serves Explorer, /marketplace redirects permanently with query params, /chat redirects to /explore**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created BrowsePage stub component rendering "Browse - Coming soon" placeholder
- Restructured all routes: / -> BrowsePage, /explore -> MarketplacePage, /marketplace -> redirect, /chat -> redirect
- Added Vercel CDN permanent redirect for /marketplace -> /explore (308 at edge)
- Gated resetPilot() with navigationSource to enable safe Sage handoff from Browse

## Task Commits

1. **Task 1: Create BrowsePage stub and restructure routes** - `6151d89` (feat)
2. **Task 2: Add Vercel permanent redirect and gate resetPilot** - `72e4fe0` (feat)

## Files Created/Modified
- `frontend/src/pages/BrowsePage.tsx` - Minimal BrowsePage stub component
- `frontend/src/main.tsx` - Restructured router: /, /explore, /marketplace redirect, /chat redirect
- `frontend/src/pages/MarketplacePage.tsx` - Gated resetPilot with navigationSource check
- `frontend/vercel.json` - Added permanent redirect from /marketplace to /explore

## Decisions Made
- MarketplaceRedirect is a component (not inline Navigate) because useSearchParams requires router context
- BrowsePage is intentionally minimal — Phase 38 builds the real Netflix-style UI
- App.tsx (standalone chat) not deleted, just unrouted — may be useful for reference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route structure ready for Phase 38 (Browse UI) and Phase 39 (Sage cross-page)
- resetPilot gate depends on navigationSource being set by Browse navigation (Phase 38+)

---
*Phase: 36-foundation*
*Completed: 2026-02-24*
