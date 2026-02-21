---
phase: 09-admin-expert-tab-enhancement
plan: "03"
subsystem: ui
tags: [react, typescript, admin, sort, filter, pagination, domain-map]

# Dependency graph
requires:
  - phase: 09-admin-expert-tab-enhancement/09-02
    provides: ExpertRow with tags+findability_score, DomainMapEntry/DomainMapResponse, useAdminDomainMap hook
provides:
  - Rebuilt ExpertsPage.tsx with sort/filter/pagination/domain-map
  - scoreZone helper for color-coded badge rendering
  - SortHeader, ScoreBadge, TagPills sub-components
affects:
  - frontend/src/admin/pages/ExpertsPage.tsx (full rewrite)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMemo chain: sorted → filtered → pageData — keeps derivation layers separate for readability and performance"
    - "Lazy domain-map: fetch triggered only on first toggle, not on page mount"
    - "Zone filter as union type 'red' | 'yellow' | 'green' | null — toggle pattern (click active = deselect)"

key-files:
  created: []
  modified:
    - frontend/src/admin/pages/ExpertsPage.tsx

key-decisions:
  - "CategoryDropdown removed from rebuilt page — new 5-column layout has no category column; auto-classify button retained in actions bar"
  - "scoreZone and sub-components defined at module level (not inside component) — avoids re-creation on every render"
  - "Domain-map section guarded with {data &&} — only renders after experts load, preventing stale toggle state"

patterns-established:
  - "useMemo derivation chain: sort → zone-filter → tag-filter → page-slice — use for multi-step table transformations"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, SEARCH-07]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 9 Plan 03: Admin Expert Tab Enhancement — Rebuilt ExpertsPage Summary

**ExpertsPage rebuilt as a quality-gate tool with sortable columns, color-coded score badges, zone filter buttons, tag filter via domain-map click-through, and 50-per-page pagination**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-21T11:15:05Z
- **Completed:** 2026-02-21T11:17:05Z
- **Tasks:** 1 auto + 1 human-verify checkpoint
- **Files modified:** 1

## Accomplishments

- `ExpertsPage.tsx` fully rebuilt from 315 lines to 471 lines
- Five-column enriched table: Name (First Last merged), Bio (120-char truncation), Tags (2-pill max + +N), Link (external-link SVG icon), Score (color-coded badge)
- `scoreZone()` helper function with ZONE_STYLES constant for red/yellow/green band logic
- `SortHeader`, `ScoreBadge`, `TagPills` sub-components defined at module level
- Sort state with `handleSort` useCallback — clicking active column toggles direction, new column resets to asc
- `sorted` and `filtered` useMemo derivations — zone filter + tag filter applied after sort
- `useEffect(() => setPageIdx(0), [...])` resets page whenever sort/filter changes
- Zone filter buttons (Red/Yellow/Green) toggle; Clear button appears when any filter active
- Tag filter indicator in actions bar showing active domain
- Pagination: Prev/Next buttons, "Page N of M" display, 50 experts per page
- Collapsible domain-map section with lazy fetch on first open, click-to-set-tagFilter, active state highlight
- Search input and search state completely removed; auto-classify button preserved

## Task Commits

1. **Task 1: Rebuild ExpertsPage.tsx** - `f603d55` (feat)

## Files Created/Modified

- `frontend/src/admin/pages/ExpertsPage.tsx` - Full rewrite: removed search, added 5-column enriched table with sort/filter/pagination/domain-map

## Decisions Made

- `CategoryDropdown` component removed — the rebuilt table does not have a category column (category classification is still available via the auto-classify button in the actions bar). This was the correct behavior per the plan's 5-column spec.
- Sub-components (`SortHeader`, `ScoreBadge`, `TagPills`, `scoreZone`) placed at module level outside the main component to avoid re-creation on every render
- `{data && (...)}` guard for both table and domain-map sections — ensures domain-map toggle only shows after expert data has loaded

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused CategoryDropdown component**
- **Found during:** Task 1 build verification
- **Issue:** TypeScript error TS6133 — `CategoryDropdown` was initially carried over from the old file but not used in the new 5-column table layout
- **Fix:** Removed `CategoryDropdown` and its `CATEGORIES` constant from the file; the auto-classify button in the actions bar is the correct entry point for classification in the new design
- **Files modified:** `frontend/src/admin/pages/ExpertsPage.tsx`
- **Commit:** `f603d55` (included in task commit)

## Issues Encountered

TypeScript TS6133 error on first build pass (`CategoryDropdown` declared but never read). Fixed inline per deviation Rule 1. Second build passed cleanly with zero errors.

## User Setup Required

None — the checkpoint (Task 2) is a human visual verification. Start backend and frontend dev servers as described in the checkpoint details.

## Next Phase Readiness

- All Phase 9 UI features are implemented and compiled
- Expert tab is ready for visual verification
- After human approval, Phase 9 Plan 03 is complete — Phase 10 can begin

## Self-Check: PASSED

- FOUND: frontend/src/admin/pages/ExpertsPage.tsx (471 lines, contains scoreZone, SortHeader, ScoreBadge, TagPills, colSpan=5, domain-map section)
- FOUND commit: f603d55 (Task 1 - ExpertsPage rebuild)

---
*Phase: 09-admin-expert-tab-enhancement*
*Completed: 2026-02-21*
