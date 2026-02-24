---
phase: 32-sage-direct-search
plan: "02"
subsystem: ui
tags: [zustand, react, typescript, sage, store, hooks]

# Dependency graph
requires:
  - phase: 32-sage-direct-search
    provides: "32-01 pilot experts array population — backend returns experts[] in PilotResponse"
provides:
  - "sageMode boolean flag in resultsSlice (ephemeral, not persisted)"
  - "setSageMode action in resultsSlice and exposed via useResultsSlice"
  - "Filter actions (setQuery/setRateRange/toggleTag/setTags/resetFilters) exit sageMode on call"
  - "useExplore early-return guard prevents re-fetch while sageMode=true"
  - "useSage injects experts directly via store.setResults + store.setSageMode(true)"
affects:
  - 32-sage-direct-search
  - any future plan touching filterSlice, useExplore, or useSage

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sageMode state machine: useSage injects results → useExplore early-returns → filter actions clear sageMode"
    - "Cross-slice get() pattern in Zustand StateCreator for filterSlice calling setSageMode from resultsSlice"
    - "useExplorerStore.getState() static accessor in async handlers (not a hook call)"

key-files:
  created: []
  modified:
    - frontend/src/store/resultsSlice.ts
    - frontend/src/store/index.ts
    - frontend/src/store/filterSlice.ts
    - frontend/src/hooks/useExplore.ts
    - frontend/src/hooks/useSage.ts

key-decisions:
  - "sageMode is NOT added to partialize allowlist — ephemeral display state must reset to false on page refresh"
  - "setSortBy intentionally does NOT call setSageMode(false) — sorting Sage results is valid without exiting sage mode"
  - "useExplore guard is the FIRST statement in useEffect (before abort/setLoading) to prevent loading flash"
  - "store.setLoading(false) called before store.setResults in useSage to avoid skeleton flash from mid-flight prior fetch"

patterns-established:
  - "Sage direct injection: store.setResults(experts, total, null) + store.setSageMode(true) — no URL/filter pollution"
  - "Cross-slice get() in StateCreator: (set, get) => ({ action: () => { get().crossSliceAction(); set(...) } })"

requirements-completed: [SAGE-DX-01, SAGE-DX-02, SAGE-DX-03]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 32 Plan 02: Sage Direct Search Summary

**sageMode Zustand state machine: Sage discovery results injected directly into expert grid via store.setResults + setSageMode(true), bypassing useExplore re-fetch and leaving the search bar empty**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T21:22:50Z
- **Completed:** 2026-02-22T21:25:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `sageMode: boolean` and `setSageMode` to `ResultsSlice` interface, initial state, and `resetResults` — not persisted to localStorage
- Exposed `sageMode` and `setSageMode` in `useResultsSlice` hook via `useShallow` selector
- Updated `filterSlice` StateCreator to accept `get` parameter; five filter actions call `get().setSageMode(false)` on execution; `setSortBy` is intentionally excluded
- Added `sageMode` selector and early-return guard to `useExplore` useEffect (first statement, before abort/setLoading); added `sageMode` to dep array
- Replaced `validateAndApplyFilters` search_performed path in `useSage` with direct `store.setResults(experts, total, null)` + `store.setSageMode(true)` injection; added `Expert` type import

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sageMode to resultsSlice and expose in useResultsSlice** - `00ecd30` (feat)
2. **Task 2: Add setSageMode(false) to filter actions + sageMode guard in useExplore + direct injection in useSage** - `c5cf427` (feat)

## Files Created/Modified
- `frontend/src/store/resultsSlice.ts` - Added `sageMode` field + `setSageMode` action to interface, initial state, and `resetResults`
- `frontend/src/store/index.ts` - Exposed `sageMode` + `setSageMode` in `useResultsSlice` hook; `partialize` unchanged
- `frontend/src/store/filterSlice.ts` - Added `get` parameter to StateCreator; five filter actions exit sage mode; `setSortBy` unchanged
- `frontend/src/hooks/useExplore.ts` - Added `sageMode` selector + early-return guard + dep array entry
- `frontend/src/hooks/useSage.ts` - Imported `Expert` type; extended data type with `experts?`; replaced broken validateAndApplyFilters path with direct store injection

## Decisions Made
- `sageMode` is NOT in the `partialize` allowlist — it is ephemeral display state that must reset on page refresh (not a filter preference)
- `setSortBy` does NOT call `setSageMode(false)` — reordering Sage results is a valid user action that should preserve the Sage result set
- The `if (sageMode) return` guard is the first statement in the `useEffect`, placed before `controllerRef.current.abort()` and `setLoading(true)` to eliminate any loading flash when Sage injects results
- `store.setLoading(false)` is called before `store.setResults(...)` in `useSage` to ensure no skeleton flash from a potentially mid-flight prior `useExplore` fetch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- sageMode state machine complete: normal mode (useExplore watches filters) and sage mode (direct injection, early-return guard) fully wired
- apply_filters path in useSage unchanged — backward-compatible
- Ready for Plan 03: UI affordances for sage mode (e.g., tag chip click confirmation when in sage mode)

---
*Phase: 32-sage-direct-search*
*Completed: 2026-02-22*
