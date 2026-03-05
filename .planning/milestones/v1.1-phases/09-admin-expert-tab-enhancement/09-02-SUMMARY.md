---
phase: 09-admin-expert-tab-enhancement
plan: "02"
subsystem: ui
tags: [react, typescript, hooks, types, admin]

# Dependency graph
requires:
  - phase: 09-admin-expert-tab-enhancement/09-01
    provides: enriched GET /api/admin/experts (tags + findability_score) and GET /api/admin/domain-map endpoints
provides:
  - ExpertRow interface with tags: string[] and findability_score: number | null
  - DomainMapEntry and DomainMapResponse interfaces exported from types.ts
  - useAdminDomainMap hook with lazy fetchData pattern in useAdminData.ts
affects:
  - 09-admin-expert-tab-enhancement (Plan 03 ExpertsPage.tsx overhaul consumes these types and hook)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy hook pattern: loading starts false, no useEffect, fetchData() exposed for caller to trigger manually"

key-files:
  created: []
  modified:
    - frontend/src/admin/types.ts
    - frontend/src/admin/hooks/useAdminData.ts

key-decisions:
  - "DomainMapEntry and DomainMapResponse placed after ExpertRow in types.ts — logically grouped with expert data"
  - "useAdminDomainMap starts loading=false with no useEffect — lazy pattern enables on-demand fetch when domain-map section first opened"
  - "DomainMapResponse added to existing import statement in useAdminData.ts — no separate import statement"

patterns-established:
  - "Lazy hook pattern: loading=false initial state + exposed fetchData() + no useEffect — use for sections that load on user interaction rather than page mount"

requirements-completed: [ADMIN-04, ADMIN-05, SEARCH-07]

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 9 Plan 02: Admin Expert Tab Enhancement — TypeScript Types and Hook Layer Summary

**TypeScript ExpertRow enriched with tags+findability_score, DomainMapEntry/DomainMapResponse interfaces added, and useAdminDomainMap lazy-fetch hook wired to GET /api/admin/domain-map**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T11:11:45Z
- **Completed:** 2026-02-21T11:12:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `ExpertRow` now has `tags: string[]` and `findability_score: number | null`, matching the enriched API response shape from Plan 01
- `DomainMapEntry` and `DomainMapResponse` interfaces exported from types.ts — Plan 03 can reference them type-safely
- `useAdminDomainMap` hook added with lazy pattern (loading starts false, no auto-fetch, `fetchData()` exposed for caller) — ExpertsPage will call this when the domain-map section is first opened

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ExpertRow and add domain-map types** - `8741bf0` (feat)
2. **Task 2: Add useAdminDomainMap hook** - `8ff40f8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/admin/types.ts` - Added `tags: string[]` and `findability_score: number | null` to ExpertRow; added `DomainMapEntry` and `DomainMapResponse` interfaces
- `frontend/src/admin/hooks/useAdminData.ts` - Added `DomainMapResponse` to types import; added `useAdminDomainMap` hook at bottom of file

## Decisions Made

- `DomainMapEntry` and `DomainMapResponse` placed after `ExpertRow` in types.ts — logically grouped with expert-related data rather than at the end after `ExpertsResponse`
- `useAdminDomainMap` starts with `loading=false` (not `true`) — this hook is lazy by design; it must not trigger an auto-fetch or show a spinner on mount
- `DomainMapResponse` added to the existing `import type { ... }` block in useAdminData.ts — plan explicitly required no separate import statement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compilation passed cleanly after both tasks (zero errors, zero warnings).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All TypeScript types and hooks are in place for Plan 03 to write ExpertsPage.tsx type-safely
- `ExpertRow.tags` and `ExpertRow.findability_score` are available for display/sorting in the experts table
- `useAdminDomainMap` is ready to be imported and called lazily from ExpertsPage
- No blockers for Plan 03

## Self-Check: PASSED

- FOUND: frontend/src/admin/types.ts (contains tags: string[], findability_score: number | null, DomainMapEntry, DomainMapResponse)
- FOUND: frontend/src/admin/hooks/useAdminData.ts (contains useAdminDomainMap at line 137)
- FOUND commit: 8741bf0 (Task 1 - types.ts update)
- FOUND commit: 8ff40f8 (Task 2 - useAdminDomainMap hook)

---
*Phase: 09-admin-expert-tab-enhancement*
*Completed: 2026-02-21*
