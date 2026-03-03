---
phase: 52-explorer-search-ux
plan: 01
subsystem: ui
tags: [react, zustand, faiss, python, fastapi, intercom]

# Dependency graph
requires: []
provides:
  - Seeded findability-weighted random ordering in pure filter mode (backend)
  - Session-stable seed generated per page load in useExplore hook
  - Sort-by UI removed from desktop FilterChips and mobile MobileInlineFilters
  - sortBy/sortOrder removed from Zustand store with persist v3 migration
  - Search bar autofocused on Explorer page load via imperative ref
  - Intercom CTA in EmptyState that opens messenger widget via useIntercom().show()
affects: [explorer, search, ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-stable seed pattern: useState(() => Math.floor(Math.random() * 1_000_000) + 1) generates seed once per mount, reused across filter changes"
    - "Seeded weighted-random sort: -(findability_score) + rng.random() * SPREAD_FACTOR gives varied but findability-influenced ordering"
    - "Imperative autofocus: useRef + useEffect mount focus instead of autoFocus attr for reliability with animated transitions"

key-files:
  created: []
  modified:
    - app/services/explorer.py
    - app/routers/explore.py
    - frontend/src/store/filterSlice.ts
    - frontend/src/store/index.ts
    - frontend/src/hooks/useExplore.ts
    - frontend/src/components/marketplace/FilterChips.tsx
    - frontend/src/components/marketplace/MobileInlineFilters.tsx
    - frontend/src/components/Header.tsx
    - frontend/src/components/marketplace/EmptyState.tsx

key-decisions:
  - "Spread factor of 30 chosen for weighted-random: enough variety within findability tiers without lifting low-findability experts to the top"
  - "Seed value 0 in API = no randomization (backward compatible); positive integer = seeded random mode"
  - "Persist store bumped to version 3 with migration to delete sortBy/sortOrder from stale localStorage"
  - "Autofocus via imperative ref (not autoFocus HTML attr) — more reliable with motion/react animated mount"

patterns-established:
  - "Session-stable seed: generate once via useState initializer, pass to all fetches including pagination"
  - "Sort-by removal pattern: delete from store interface + filterDefaults + partialize + persist migration"

requirements-completed: [EXPL-01, EXPL-02, EXPL-03, EXPL-04]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 52 Plan 01: Explorer Search UX Summary

**Seeded findability-weighted random initial display, sort-by removal from store+UI, search autofocus, and Intercom no-results CTA**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T07:43:27Z
- **Completed:** 2026-03-03T07:47:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Backend `run_explore()` accepts `seed` parameter; pure filter mode uses `random.Random(seed)` for weighted-random ordering with spread factor 30 (higher findability still tends toward top, but with variety)
- Frontend generates a session-stable seed once per page load; same seed reused when user clears search and returns to pure filter mode
- Sort-by dropdown fully removed from desktop FilterChips and mobile MobileInlineFilters; `sortBy`/`sortOrder` deleted from Zustand store, persist config, and localStorage via v3 migration
- Search bar autofocused on Explorer page load using imperative `useRef` + `useEffect` mount approach
- EmptyState shows Intercom CTA button that opens the messenger widget via `useIntercom().show()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend randomized initial display + Sort-by removal from store** - `5da220d` (feat)
2. **Task 2: Search bar autofocus + Intercom no-results CTA** - `158ac81` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `app/services/explorer.py` - Added `seed` param + weighted-random shuffle branch in pure filter mode
- `app/routers/explore.py` - Added `seed: int = Query(default=0)` param, passes to run_explore
- `frontend/src/store/filterSlice.ts` - Removed sortBy/sortOrder fields and setSortBy action
- `frontend/src/store/index.ts` - Removed sortBy/sortOrder from partialize, bumped version 2→3 with migration
- `frontend/src/hooks/useExplore.ts` - Removed sortBy selector/dep, added session-stable seed, passes seed when query is empty
- `frontend/src/components/marketplace/FilterChips.tsx` - Removed SORT_OPTIONS, sortOpen state, sortRef, click-outside effect, sort dropdown JSX
- `frontend/src/components/marketplace/MobileInlineFilters.tsx` - Removed SORT_OPTIONS, sortOpen state, Sort button, Sort Sheet AnimatePresence block
- `frontend/src/components/Header.tsx` - Added inputRef + useEffect mount focus for autofocus
- `frontend/src/components/marketplace/EmptyState.tsx` - Added useIntercom import, Intercom CTA button with MessageCircle icon

## Decisions Made
- Spread factor of 30 for weighted-random: `-(findability_score) + rng.random() * 30` gives natural variety within tiers without putting 0-findability experts at the top
- Seed value 0 means deterministic (backward compatible); only positive seeds trigger randomization
- Persist store version bumped 2→3 with explicit `delete state.sortBy` migration to clean stale localStorage
- Used imperative `useRef` + `useEffect` focus instead of HTML `autoFocus` — more reliable with motion/react animated mount transitions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all changes compiled cleanly on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Explorer UX improvements (EXPL-01 through EXPL-04) complete
- Seeded random ordering is live for pure filter mode; text search retains relevance ranking
- Sort-by removed from all UI surfaces; localStorage migration handles stale persisted state automatically
- Ready for Phase 52 Plan 02 if additional explorer UX work is planned

---
*Phase: 52-explorer-search-ux*
*Completed: 2026-03-03*
