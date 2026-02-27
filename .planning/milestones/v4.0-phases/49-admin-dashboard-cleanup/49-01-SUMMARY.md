---
phase: 49-admin-dashboard-cleanup
plan: 01
subsystem: ui
tags: [react, react-router, admin, dashboard]

requires:
  - phase: 48-admin-features-industry-tags
    provides: admin leads and searches endpoints
provides:
  - Clean admin routing with catch-all redirect for unknown paths
  - Overview page with Recent Leads and Recent Searches cards
affects: []

tech-stack:
  added: []
  patterns:
    - "Catch-all route pattern for admin SPA sub-routes"
    - "Self-contained card components with inline adminFetch"

key-files:
  created: []
  modified:
    - frontend/src/main.tsx
    - frontend/src/admin/pages/OverviewPage.tsx

key-decisions:
  - "Used Navigate (not RedirectWithParams) for catch-all since unknown admin routes don't need query param preservation"
  - "Cards use inline adminFetch rather than shared hooks to keep components self-contained"

patterns-established:
  - "timeAgo helper for relative timestamps in admin UI"

requirements-completed: [ADM-04]

duration: 5min
completed: 2026-02-27
---

# Phase 49 Plan 01: Admin Dashboard Cleanup Summary

**Removed 5 legacy admin redirect routes, added catch-all for unknown paths, and added Recent Leads + Recent Searches cards to the overview page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T13:46:00Z
- **Completed:** 2026-02-27T13:51:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed legacy redirect routes (search-lab, score-explainer, index, searches, marketplace) from admin router
- Added catch-all `path: '*'` route redirecting unknown admin paths to /admin overview
- Added RecentLeadsCard showing 5 most recent leads sorted by last_search_at with "View all" link
- Added RecentSearchesCard showing 5 most recent searches with source badges and "View all" link
- Added timeAgo helper for relative time formatting

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove legacy redirect routes and add catch-all** - `031bf12` (feat)
2. **Task 2: Add Recent Leads and Recent Searches cards** - `d124629` (feat)

## Files Created/Modified
- `frontend/src/main.tsx` - Removed 5 legacy redirects, added catch-all `*` route
- `frontend/src/admin/pages/OverviewPage.tsx` - Added RecentLeadsCard, RecentSearchesCard, timeAgo helper

## Decisions Made
- Used `<Navigate>` (not `<RedirectWithParams>`) for the catch-all since unknown admin routes don't need query parameter preservation
- Cards use inline `adminFetch` with `useState`/`useEffect` rather than shared hooks, keeping components self-contained and consistent with existing `TopZeroResultsCard` pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase complete, ready for transition. This is the last phase in the v4.0 milestone.

---
*Phase: 49-admin-dashboard-cleanup*
*Completed: 2026-02-27*
