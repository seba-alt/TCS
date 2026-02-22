---
phase: 15-zustand-state-and-routing
plan: 01
subsystem: ui
tags: [zustand, react, state-management, localStorage, react-router]

# Dependency graph
requires:
  - phase: 14-hybrid-search-backend
    provides: /api/explore response contract (Expert interface shape)
provides:
  - useExplorerStore with filter/results/pilot slices (Zustand v5)
  - localStorage persistence scoped to filter fields only (partialize)
  - MarketplacePage shell with pilot reset on mount
  - Routing: '/' -> MarketplacePage, '/chat' -> App
affects:
  - 16-marketplace-search-ui
  - 17-expert-card-and-virtuoso
  - 18-co-pilot-ui
  - 19-animations-polish

# Tech tracking
tech-stack:
  added: [zustand ^5.0.11]
  patterns:
    - Zustand v5 multi-slice store with persist middleware
    - partialize scopes localStorage to data fields only (no actions, no results, no pilot)
    - useShallow slice hooks to avoid infinite re-renders with object selectors
    - StateCreator typed with [['zustand/persist', unknown]] to avoid circular reference

key-files:
  created:
    - frontend/src/store/filterSlice.ts
    - frontend/src/store/resultsSlice.ts
    - frontend/src/store/pilotSlice.ts
    - frontend/src/store/index.ts
    - frontend/src/pages/MarketplacePage.tsx
  modified:
    - frontend/src/main.tsx

key-decisions:
  - "Zustand v5 pattern: type goes on create<T>() not on persist — combined with (...a) spread"
  - "StateCreator typed with [['zustand/persist', unknown]] in slice files to avoid circular reference with ExplorerStore type in index.ts"
  - "useShallow from 'zustand/react/shallow' (v5 path, not 'zustand/shallow') for all slice hooks"
  - "'/chat' route preserves old App interface but is not linked from new marketplace UI"

patterns-established:
  - "Slice pattern: each slice file exports interface + StateCreator, index.ts combines and exports hooks"
  - "partialize pattern: only query/rateMin/rateMax/tags/sortBy/sortOrder persisted — never actions, results, or pilot"
  - "Slice hook pattern: useFilterSlice/useResultsSlice/usePilotSlice each use useShallow to select all fields"

requirements-completed: [STATE-01, STATE-02, STATE-03]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 15 Plan 01: Zustand State and Routing Summary

**Three-slice Zustand v5 store (filter/results/pilot) with localStorage persistence scoped to filter fields only, plus MarketplacePage shell at '/' route**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T20:45:42Z
- **Completed:** 2026-02-21T20:47:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed Zustand ^5.0.11 and created the three-slice useExplorerStore with correct v5 persist middleware pattern
- persist middleware partialize scopes localStorage to six filter fields only — results and pilot slices are never persisted
- Created MarketplacePage shell that resets pilot state on mount; updated '/' route to point to it; preserved '/chat' for old App interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Zustand and create the three-slice store** - `16060b0` (feat)
2. **Task 2: Create MarketplacePage shell and update routing** - `dfeb8af` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/store/filterSlice.ts` - FilterSlice type and StateCreator with query/rateMin/rateMax/tags/sortBy/sortOrder fields and setQuery/setRateRange/toggleTag/setSortBy/resetFilters actions
- `frontend/src/store/resultsSlice.ts` - ResultsSlice type, Expert interface, and StateCreator with experts/total/cursor/loading/error fields
- `frontend/src/store/pilotSlice.ts` - PilotSlice type, PilotMessage interface, and StateCreator with messages/isOpen/isStreaming/sessionId fields
- `frontend/src/store/index.ts` - Combined ExplorerStore with persist middleware; exports useExplorerStore, useFilterSlice, useResultsSlice, usePilotSlice, Expert, PilotMessage types
- `frontend/src/pages/MarketplacePage.tsx` - Shell page that calls resetPilot() on mount; placeholder content for Phase 16
- `frontend/src/main.tsx` - Updated routing: '/' -> MarketplacePage, '/chat' -> App (preserved), admin routes unchanged

## Decisions Made
- Used `[['zustand/persist', unknown]]` type parameter in slice StateCreators to avoid circular reference (slice files import ExplorerStore type from index.ts, which imports slice types — TypeScript is fine with circular type-only imports, and `unknown` for persist parameter avoids issues)
- useShallow imported from `'zustand/react/shallow'` (v5 path — NOT `'zustand/shallow'`) for all three slice hooks
- '/chat' route added for old App interface but not linked from new marketplace UI (per plan decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Store is ready: `import { useExplorerStore } from '@/store'` works from any component with no Provider wrapper
- Filter state will persist across browser reloads; results and pilot are ephemeral
- Phase 16 (marketplace search UI) can wire API calls by calling setLoading/setResults/setError from useResultsSlice
- Phase 16 onRehydrateStorage hook point is in place (currently no-op, Phase 16 will wire triggerSearch)
- MarketplacePage shell at '/' is the entry point for Phase 16 to build upon

---
*Phase: 15-zustand-state-and-routing*
*Completed: 2026-02-21*
