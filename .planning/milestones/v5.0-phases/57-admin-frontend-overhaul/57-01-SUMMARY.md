---
phase: 57-admin-frontend-overhaul
plan: 01
subsystem: ui
tags: [react-router, nested-routes, navlink, outlet, lazy-loading]

requires:
  - phase: 50.3
    provides: Consolidated ToolsPage and DataPage with hash-fragment tabs
provides:
  - URL-based child routes for Tools page (score-explainer, search-lab, index)
  - URL-based child routes for Data page (searches, marketplace)
  - NavLink tab wrapper pattern for sub-page navigation
affects: [57-03, 57-04]

tech-stack:
  added: []
  patterns: [NavLink+Outlet tab wrapper, nested route children with index redirect]

key-files:
  created: []
  modified:
    - frontend/src/main.tsx
    - frontend/src/admin/pages/ToolsPage.tsx
    - frontend/src/admin/pages/DataPage.tsx
    - frontend/src/admin/pages/LeadsPage.tsx

key-decisions:
  - "Use relative NavLink paths (to='score-explainer') for portability"
  - "Index routes redirect with replace to prevent history stack pollution"
  - "Data page defaults to searches (not marketplace) as more actionable"
  - "IndexManagementPanel wrapped in p-8 div at router level since it lacks own padding"

patterns-established:
  - "NavLink+Outlet tab wrapper: parent renders tab bar, Outlet renders matched child"
  - "Index route redirect: { index: true, element: <Navigate to='default' replace /> }"

requirements-completed: [ADM-02]

duration: 5min
completed: 2026-03-03
---

# Plan 57-01: URL Child Routes Summary

**Tools and Data pages converted from hash-fragment tabs to URL-based nested child routes with NavLink + Outlet pattern**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced hash-fragment routing with React Router nested children for Tools (3 sub-pages) and Data (2 sub-pages)
- Browser back/forward navigation now works between sub-pages
- Direct URL bookmarking works (e.g., /admin/tools/search-lab)
- LeadsPage "Searches" link updated from hash to URL path

## Task Commits

Each task was committed atomically:

1. **Task 1: Add nested child routes to router config** - `ca7aabd` (feat)
2. **Task 2: Rewrite ToolsPage and DataPage as NavLink tab wrappers** - `ffa628f` (feat)

## Files Created/Modified
- `frontend/src/main.tsx` - Added lazy imports and nested children for tools/data routes
- `frontend/src/admin/pages/ToolsPage.tsx` - Rewritten as NavLink tab wrapper + Outlet
- `frontend/src/admin/pages/DataPage.tsx` - Rewritten as NavLink tab wrapper + Outlet
- `frontend/src/admin/pages/LeadsPage.tsx` - Updated searches link from hash to URL path

## Decisions Made
- Data page defaults to /admin/data/searches (not marketplace) as searches is more actionable
- IndexManagementPanel wrapped at router level in p-8 div since component lacks own padding
- Used relative `to` paths in NavLink for portability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Consistency] Updated LeadsPage hash reference**
- **Found during:** Task 2 (NavLink rewrite)
- **Issue:** LeadsPage had `/admin/data#searches` link that would break with new URL routing
- **Fix:** Updated to `/admin/data/searches`
- **Files modified:** frontend/src/admin/pages/LeadsPage.tsx
- **Verification:** grep confirms no hash references remain
- **Committed in:** ffa628f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (consistency fix)
**Impact on plan:** Necessary for correctness with new routing. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- URL routing foundation ready for all admin pages
- Sidebar NavLinks with `end: false` will stay highlighted on sub-page URLs

---
*Phase: 57-admin-frontend-overhaul*
*Completed: 2026-03-03*
