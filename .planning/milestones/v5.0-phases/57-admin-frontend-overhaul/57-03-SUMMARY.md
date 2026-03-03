---
phase: 57-admin-frontend-overhaul
plan: 03
subsystem: ui
tags: [react, search-filter, admin-experts, pagination]

requires:
  - phase: 57-admin-frontend-overhaul
    provides: AdminCard, AdminInput, AdminPageHeader, AdminPagination shared components
provides:
  - Name search as primary filter on Experts page
  - Upgraded pagination with page numbers and jump input
  - Consistent shared component usage on Experts page
affects: []

tech-stack:
  added: []
  patterns: [client-side name search filter, primary/secondary filter hierarchy]

key-files:
  created: []
  modified:
    - frontend/src/admin/pages/ExpertsPage.tsx

key-decisions:
  - "Name search is first filter applied, before zone/tag/bio filters"
  - "Clear button resets all filters including name search"
  - "Action buttons (auto-classify, import CSV) moved to right side as secondary controls"

patterns-established:
  - "Primary search + secondary filters layout pattern for admin table pages"

requirements-completed: [ADM-06, BUG-07]

duration: 4min
completed: 2026-03-03
---

# Plan 57-03: Experts Page Name Search Summary

**Prominent name search filter on Experts page with client-side filtering and upgraded AdminPagination**

## Performance

- **Duration:** 4 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added name search as the most prominent filter on the Experts page
- Client-side filtering on first_name + last_name (case-insensitive)
- Upgraded pagination from prev/next to page numbers with jump input
- Applied AdminCard, AdminInput, AdminPageHeader for visual consistency
- Page resets to 1 when any filter changes (including name search)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add name search as primary filter and upgrade pagination** - `1eb8c58` (feat)

## Files Created/Modified
- `frontend/src/admin/pages/ExpertsPage.tsx` - Name search, pagination upgrade, shared components

## Decisions Made
- Name search applied first in filter chain for maximum responsiveness
- Clear button resets all filters including name search for a fresh start
- Action buttons (auto-classify, import) moved to right as secondary controls

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Experts page fully modernized with shared components and name search

---
*Phase: 57-admin-frontend-overhaul*
*Completed: 2026-03-03*
