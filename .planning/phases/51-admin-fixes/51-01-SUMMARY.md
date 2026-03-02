---
phase: 51-admin-fixes
plan: 01
subsystem: ui, api
tags: [react, fastapi, sqlalchemy, admin-dashboard]

requires:
  - phase: 48-admin-overview
    provides: Overview page with stat cards and analytics summary
provides:
  - Fixed lead count excluding empty emails
  - Clickable stat cards with navigation to detail pages
affects: [admin-dashboard]

tech-stack:
  added: []
  patterns:
    - "Clickable card pattern: to + onClick props on StatCard/TrendStatCard"

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - frontend/src/admin/pages/OverviewPage.tsx

key-decisions:
  - "Excluded empty/null emails from lead counts to prevent inflated zero-value stats"
  - "Used onClick handlers with useNavigate for card navigation instead of wrapping in Link components"

patterns-established:
  - "StatCard/TrendStatCard accept optional to and onClick props for navigation"

requirements-completed: [ADMN-01, ADMN-02]

duration: 8min
completed: 2026-03-02
---

# Plan 51-01: Fix Overview Stats & Clickable Cards Summary

**Fixed empty-email inflation in lead counts and made all 11 stat cards clickable with navigation to detail pages**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed lead count queries to exclude empty/null email strings that inflated stats
- Made all 11 stat cards clickable with cursor-pointer hover states
- Cards navigate to correct detail pages: leads, experts, or marketplace

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix overview stats returning zero** - `bd83411` (fix)
2. **Task 2: Make stat cards clickable with navigation** - `ba666f1` (feat)

## Files Created/Modified
- `app/routers/admin.py` - Excluded empty emails from lead count queries in /stats endpoint
- `frontend/src/admin/pages/OverviewPage.tsx` - Added useNavigate, to/onClick props to StatCard and TrendStatCard

## Decisions Made
- Excluded empty/null emails from lead count — conversations with email="" were inflating lead metrics
- Used onClick handlers with useNavigate rather than wrapping cards in Link components to maintain existing card styling

## Deviations from Plan
None - plan executed as specified

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Overview page now shows accurate stats and navigable cards
- Ready for expert deletion feature (Plan 51-02)

---
*Phase: 51-admin-fixes*
*Completed: 2026-03-02*
