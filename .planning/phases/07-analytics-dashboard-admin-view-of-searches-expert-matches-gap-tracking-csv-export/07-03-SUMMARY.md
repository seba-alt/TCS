---
phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export
plan: 03
subsystem: ui

tags: [react, typescript, tanstack-react-table, tailwind, vite, admin-dashboard]

# Dependency graph
requires:
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export (plan 01)
    provides: "/api/admin/* endpoints — stats, searches (with response_experts JSON), gaps, resolve, CSV export"
  - phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export (plan 02)
    provides: "AdminApp layout, AdminSidebar, useAdminStats/useAdminSearches/useAdminGaps hooks, useAdminExport, stub pages, SearchRow/GapRow/SearchFilters types"
provides:
  - "StatCard: presentational metric card with optional highlight border and sub-label"
  - "ExportDialog: modal asking filtered vs all CSV choice with backdrop click-to-close"
  - "ExpandedExpertRow: inline expert list showing name, title, company, rate, profile link from response_experts JSON"
  - "SearchesTable: TanStack Table v8 with expandable rows, gap badge, 25/50 row pagination"
  - "GapsTable: frequency-ranked gaps table with resolved status badge and Mark Resolved action"
  - "OverviewPage: 4 StatCards using live useAdminStats hook (total searches, matches, match rate, gaps)"
  - "SearchesPage: filter panel + SearchesTable + ExportDialog (email, gap flag, date range filters)"
  - "GapsPage: GapsTable with resolve refetch callback + ExportDialog"
  - "response_experts field added to SearchRow type and admin.py /searches serializer"
affects:
  - "Phase 08 test lab — admin dashboard now fully functional for production inspection"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Table v8: useReactTable with getCoreRowModel + getPaginationRowModel + getFilteredRowModel for client-side table management"
    - "Set<number> for expandable row state — O(1) toggle/check without extra library"
    - "Direct fetch in GapsTable for POST resolve — avoids extending adminFetch for single POST call"
    - "pageSize sync via conditional table.setPageSize() inside render — keeps parent-controlled pageSize in sync with TanStack internal state"

key-files:
  created:
    - "frontend/src/admin/components/StatCard.tsx"
    - "frontend/src/admin/components/ExportDialog.tsx"
    - "frontend/src/admin/components/ExpandedExpertRow.tsx"
    - "frontend/src/admin/components/SearchesTable.tsx"
    - "frontend/src/admin/components/GapsTable.tsx"
  modified:
    - "frontend/src/admin/pages/OverviewPage.tsx (stub replaced with 4-StatCard live page)"
    - "frontend/src/admin/pages/SearchesPage.tsx (stub replaced with filter panel + table + export)"
    - "frontend/src/admin/pages/GapsPage.tsx (stub replaced with gaps table + export)"
    - "frontend/src/admin/types.ts (response_experts added to SearchRow)"
    - "app/routers/admin.py (response_experts added to _serialize output)"

key-decisions:
  - "[07-03]: response_experts returned from /api/admin/searches as raw JSON string — frontend ExpandedExpertRow parses it locally, keeping serializer simple"
  - "[07-03]: Direct fetch in GapsTable for POST resolve instead of extending adminFetch — adminFetch is GET-only by design; single POST call doesn't justify refactoring the base utility"
  - "[07-03]: pageSize sync via conditional table.setPageSize() in render — simpler than useEffect; acceptable for admin tool with controlled pageSize prop"
  - "[07-03]: Set<number> for expanded row tracking — O(1) toggle without external library; immutable update pattern with new Set(prev)"

patterns-established:
  - "adminFetch stays GET-only; any POST calls use fetch directly with VITE_ADMIN_KEY from import.meta.env"
  - "Expandable table rows: Map/Set of row IDs in local state, ExpandedExpertRow injected as sibling <tr> in tbody"

requirements-completed: [ANAL-01]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 7 Plan 03: Admin Dashboard Pages Summary

**Full admin UI — TanStack Table searches page with expandable expert rows, gap frequency table with resolve action, StatCard overview, and CSV export dialogs for both sections**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T21:07:16Z
- **Completed:** 2026-02-20T21:10:16Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- OverviewPage shows live 4-StatCard grid (total searches, matches, match rate, gaps) using useAdminStats hook
- SearchesPage: full filter panel (email, gap flag, date range) + TanStack Table v8 with expandable rows revealing full expert match details inline + 25/50 pagination + ExportDialog
- GapsPage: frequency-ranked gaps table with resolved/open status badges, Mark Resolved per row, and ExportDialog
- Backend `/api/admin/searches` updated to include `response_experts` raw JSON in each row for frontend expand feature

## Task Commits

Each task was committed atomically:

1. **Task 1: Build StatCard, ExportDialog, ExpandedExpertRow, and OverviewPage** - `ae59322` (feat)
2. **Task 2: Build SearchesTable, GapsTable, SearchesPage, and GapsPage** - `8c34d2b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/admin/components/StatCard.tsx` - Presentational metric card with optional brand-purple highlight border
- `frontend/src/admin/components/ExportDialog.tsx` - Modal dialog asking filtered vs all CSV export, backdrop click closes
- `frontend/src/admin/components/ExpandedExpertRow.tsx` - Inline expert list parsed from response_experts JSON string
- `frontend/src/admin/components/SearchesTable.tsx` - TanStack Table v8 with expandable rows, gap badge, 25/50 pagination
- `frontend/src/admin/components/GapsTable.tsx` - Frequency-ranked gaps table with resolved badge and Mark Resolved action
- `frontend/src/admin/pages/OverviewPage.tsx` - Replaced stub with 4-StatCard live grid
- `frontend/src/admin/pages/SearchesPage.tsx` - Replaced stub with full filter panel + table + export
- `frontend/src/admin/pages/GapsPage.tsx` - Replaced stub with gaps table + export
- `frontend/src/admin/types.ts` - Added `response_experts: string` to SearchRow interface
- `app/routers/admin.py` - Added `response_experts` field to `_serialize()` output in `/searches` endpoint

## Decisions Made
- `response_experts` returned as raw JSON string from backend, parsed locally in ExpandedExpertRow — keeps API serializer simple, parsing failure is gracefully handled with empty array fallback
- Direct `fetch()` in GapsTable for POST resolve rather than extending `adminFetch` — adminFetch is GET-only by design; single POST call doesn't justify refactoring shared utility
- `Set<number>` for expanded row state — O(1) toggle/check without extra library dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added response_experts to backend /searches serializer**
- **Found during:** Task 2 (SearchesTable implementation)
- **Issue:** Plan noted response_experts is needed for ExpandedExpertRow but was not in the existing _serialize() dict in admin.py — expanding a row would always show "No expert matches"
- **Fix:** Added `"response_experts": row.response_experts or "[]"` to _serialize() in admin.py; added `response_experts: string` to SearchRow type in types.ts
- **Files modified:** app/routers/admin.py, frontend/src/admin/types.ts
- **Verification:** TypeScript check and Vite build pass with no errors
- **Committed in:** 8c34d2b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing critical field in API serializer)
**Impact on plan:** Essential for correctness — without this fix the expand feature would be non-functional. No scope creep.

## Issues Encountered
None — plan executed cleanly. TypeScript check and Vite production build both passed after each task.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin dashboard fully functional: Overview stats, searchable/filterable/paginated searches table with expandable expert rows, gaps tracking with resolve action, CSV export for both sections
- Phase 8 (test lab) can proceed — all admin infrastructure is in place for inspecting search quality

---
*Phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export*
*Completed: 2026-02-20*

## Self-Check: PASSED

All 8 component/page files confirmed present on disk. Both task commits verified in git log (ae59322, 8c34d2b). Vite build and TypeScript check both pass.
