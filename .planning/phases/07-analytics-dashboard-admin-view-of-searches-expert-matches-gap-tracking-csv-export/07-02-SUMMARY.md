---
phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export
plan: 02
subsystem: ui

tags: [react-router-dom, tanstack-react-table, react, typescript, vite, tailwind]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export (plan 01)
    provides: "/api/admin/* endpoints with X-Admin-Key auth — stats, searches, gaps, resolve, CSV export"
provides:
  - "react-router-dom BrowserRouter with / → App and /admin/* → AdminApp"
  - "Admin TypeScript types: AdminStats, SearchRow, SearchesResponse, GapRow, GapsResponse, SearchFilters"
  - "AdminApp layout component with sidebar + Outlet"
  - "AdminSidebar with Overview/Searches/Gaps NavLinks and brand-purple active state"
  - "useAdminStats, useAdminSearches, useAdminGaps hooks with loading/error state"
  - "adminFetch base function with X-Admin-Key header injection"
  - "useAdminExport hook with Blob URL download pattern for authenticated CSV export"
  - "Stub pages (OverviewPage, SearchesPage, GapsPage) ready for Plan 03 implementation"
affects:
  - "07-03 admin pages — builds directly on AdminApp layout, hooks, and stub pages created here"

# Tech tracking
tech-stack:
  added:
    - "react-router-dom ^7.13.0"
    - "@tanstack/react-table ^8.21.3"
  patterns:
    - "createBrowserRouter with nested /admin/* children using Outlet pattern"
    - "adminFetch generic function with X-Admin-Key header from VITE_ADMIN_KEY env var"
    - "JSON.stringify(filters) as useCallback dependency for object value-equality without deep-equal library"
    - "Blob URL download pattern for authenticated file downloads (X-Admin-Key cannot be passed via anchor href)"

key-files:
  created:
    - "frontend/src/admin/types.ts"
    - "frontend/src/admin/AdminApp.tsx"
    - "frontend/src/admin/components/AdminSidebar.tsx"
    - "frontend/src/admin/hooks/useAdminData.ts"
    - "frontend/src/admin/hooks/useAdminExport.ts"
    - "frontend/src/admin/pages/OverviewPage.tsx (stub)"
    - "frontend/src/admin/pages/SearchesPage.tsx (stub)"
    - "frontend/src/admin/pages/GapsPage.tsx (stub)"
  modified:
    - "frontend/src/main.tsx"
    - "frontend/src/vite-env.d.ts"
    - "frontend/package.json"

key-decisions:
  - "[07-02]: react-router-dom v7 installed (^7.13.0) — latest stable, createBrowserRouter API unchanged from v6"
  - "[07-02]: JSON.stringify(filters) as useCallback dep — simplest value-equality for plain filter objects without adding deep-equal dependency to admin tool"
  - "[07-02]: Blob URL download pattern in useAdminExport — plain anchor href cannot pass X-Admin-Key header; fetch + createObjectURL is required for authenticated downloads"
  - "[07-02]: Stub pages created immediately — TypeScript build requires all imports to resolve; stubs satisfy compiler while Plan 03 replaces them with real implementations"
  - "[07-02]: brand-purple token used in AdminSidebar active state — confirmed as brand.purple (#5128F2) in tailwind.config.ts"

patterns-established:
  - "adminFetch: all admin API calls go through single function with X-Admin-Key header injected from VITE_ADMIN_KEY"
  - "useAdmin* hooks: consistent loading/error/data state shape with optional refetch() for manual refresh"
  - "useAdminExport: authenticated file download via fetch + Blob URL — avoids auth header limitation of native <a href>"

requirements-completed: [ANAL-01]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 7 Plan 02: Admin Frontend Foundation Summary

**react-router-dom BrowserRouter with /admin/* route, TypeScript admin types, AdminApp layout + sidebar, and useAdminData/useAdminExport hooks with X-Admin-Key auth**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T21:00:36Z
- **Completed:** 2026-02-20T21:03:29Z
- **Tasks:** 2
- **Files modified:** 11 (3 modified, 8 created)

## Accomplishments

- Installed react-router-dom v7 and @tanstack/react-table; wired createBrowserRouter with / → App and /admin/* → AdminApp
- Built complete admin data layer: types.ts with all API response interfaces, useAdminData hooks (stats/searches/gaps) with loading/error state, useAdminExport with Blob URL authenticated download
- Created AdminApp layout with sidebar + Outlet and AdminSidebar with Overview/Searches/Gaps NavLinks using brand-purple active styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install libs, wire router, build layout** - `f37d3d4` (feat)
2. **Task 2: Build useAdminData and useAdminExport hooks** - `550dfa1` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `frontend/package.json` - Added react-router-dom ^7.13.0 and @tanstack/react-table ^8.21.3
- `frontend/src/main.tsx` - Replaced direct createRoot render with createBrowserRouter; / → App, /admin/* → AdminApp
- `frontend/src/vite-env.d.ts` - Added VITE_ADMIN_KEY to ImportMetaEnv interface
- `frontend/src/admin/types.ts` - AdminStats, SearchRow, SearchesResponse, GapRow, GapsResponse, SearchFilters interfaces
- `frontend/src/admin/AdminApp.tsx` - Flex layout: AdminSidebar + Outlet in main content area
- `frontend/src/admin/components/AdminSidebar.tsx` - NavLink sidebar with brand-purple active state for Overview/Searches/Gaps
- `frontend/src/admin/hooks/useAdminData.ts` - adminFetch with X-Admin-Key header; useAdminStats, useAdminSearches, useAdminGaps hooks
- `frontend/src/admin/hooks/useAdminExport.ts` - useAdminExport with downloadCsv Blob URL pattern for authenticated CSV downloads
- `frontend/src/admin/pages/OverviewPage.tsx` - Stub (replaced by Plan 03)
- `frontend/src/admin/pages/SearchesPage.tsx` - Stub (replaced by Plan 03)
- `frontend/src/admin/pages/GapsPage.tsx` - Stub (replaced by Plan 03)

## Decisions Made

- react-router-dom v7 (^7.13.0) — latest stable; createBrowserRouter API is unchanged from v6
- JSON.stringify(filters) as useCallback dep — simplest value-equality for plain filter objects without importing a deep-equal library; acceptable for admin tool
- Blob URL download pattern in useAdminExport — native anchor href cannot inject custom headers; fetch + createObjectURL is required for X-Admin-Key authenticated exports
- Stub pages created in this plan — TypeScript build requires all imports to resolve at compile time; stubs satisfy the compiler while Plan 03 replaces them with real implementations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - tsc --noEmit and npm run build both passed on first attempt.

## User Setup Required

None - no external service configuration required for this plan. The VITE_ADMIN_KEY env var will be needed in Vercel dashboard before the admin UI is used, but that is handled when deploying Plan 03.

## Next Phase Readiness

- All structural foundation ready for Plan 03 (admin pages): AdminApp layout mounted at /admin/*, hooks ready to consume, stub pages waiting to be replaced
- No blockers — tsc and Vite build clean

---
*Phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export*
*Completed: 2026-02-20*
