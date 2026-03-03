---
phase: 52-explorer-search-ux
plan: 02
subsystem: ui
tags: [react, zustand, fastapi, python, fts5, autocomplete, rate-slider]

# Dependency graph
requires: [52-01]
provides:
  - Tag-prioritized autocomplete suggestions (backend queries tags column first, frontend merges tag matches before backend results)
  - Individual tag extraction from JSON arrays in FTS5 tags column
  - Starts-with tag matches ranked above contains-only matches in client-side filtering
  - max_rate field in ExploreResponse computed from full pre-filtered set
  - maxRate state in Zustand ResultsSlice synced from API response
  - Dynamic RateSlider max derived from API max_rate (rounded to nearest 10, floor 10)
  - Auto-adjust: slider and store rateMax clamp down when filtered max decreases
  - EUR max rate label below slider
  - Smooth transition-all duration-300 on slider range changes
affects: [explorer, search, autocomplete, rate-filter, ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tag-first suggest: query tags column (limit 5) before job_title/company (limit 3) in FTS5 loop; parse JSON arrays for individual tag extraction"
    - "Client-side tag ranking: starts-with matches before contains-only, merged before backend results"
    - "Dynamic slider max: roundedMax = ceil(max(maxRate, 10) / 10) * 10; auto-adjust via useEffect([roundedMax])"
    - "max_rate in ExploreResponse: computed once from full filtered_experts list before pagination"

key-files:
  created: []
  modified:
    - app/routers/suggest.py
    - frontend/src/hooks/useHeaderSearch.ts
    - app/services/explorer.py
    - frontend/src/store/resultsSlice.ts
    - frontend/src/hooks/useExplore.ts
    - frontend/src/store/index.ts
    - frontend/src/components/sidebar/RateSlider.tsx

key-decisions:
  - "Tags queried first in FTS5 loop with limit 5 (vs 3 for job_title/company) to give more tag suggestions"
  - "JSON array parsing for tags column: json.loads(raw) with fallback to [raw]; filters by query substring match"
  - "Frontend merge order changed to tagMatches-first then backendResults, not backend-first"
  - "roundedMax = ceil(max(maxRate, 10) / 10) * 10 — clean step alignment with floor to prevent 0-range"
  - "maxRate default 5000 in store and resetResults matches pre-existing hardcoded slider max"
  - "loadNextPage does NOT update maxRate — initial fetch sets range for the full filtered set"

patterns-established:
  - "API max_rate pattern: compute from filtered set, include in all ExploreResponse branches including empty-result early return"
  - "Dynamic slider pattern: derive roundedMax from store, useEffect auto-adjust for downstream filter changes"

requirements-completed: [EXPL-05, EXPL-06]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 52 Plan 02: Explorer Search UX Summary

**Tag-prioritized autocomplete with JSON array tag extraction, and dynamic rate slider with auto-adjust from API max_rate**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T07:49:40Z
- **Completed:** 2026-03-03T07:53:18Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Backend `suggest.py` now queries `tags` column first (limit 5) before `job_title`/`company` (limit 3), extracts individual tags from JSON arrays, and filters against the query substring
- Frontend `useHeaderSearch.ts` now merges client-side tag matches (starts-with ranked above contains-only) before backend results
- Backend `ExploreResponse` gains `max_rate: float` computed from the full pre-filtered expert set, included in all return branches
- `ResultsSlice` gains `maxRate: number` (default 5000) updated by `setResults` and reset by `resetResults`
- `useExplore` passes `data.max_rate ?? 5000` as the 4th argument to `setResults`
- `RateSlider` uses `roundedMax` (dynamic ceiling rounded to nearest 10, floored at 10) instead of hardcoded 5000
- Auto-adjust `useEffect` clamps `localValue` and store `rateMax` down when `roundedMax` decreases
- EUR max rate label shown below slider
- Slider wrapped in `transition-all duration-300` div for smooth visual transitions

## Task Commits

Each task was committed atomically:

1. **Task 1: Autocomplete tag-first ranking and relevance improvements** - `afa5cea` (feat)
2. **Task 2: Dynamic rate slider with auto-adjust and max label** - `91a8c3d` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `app/routers/suggest.py` - Added `import json`; changed column loop to tags-first with JSON array parsing; per-column limits (tags=5, job_title=3, company=3)
- `frontend/src/hooks/useHeaderSearch.ts` - Split tagMatches into startsWithMatches + containsMatches; changed merge order to tagMatches-first
- `app/services/explorer.py` - Added `max_rate: float` to ExploreResponse; computes `actual_max_rate` from filtered_experts; included in all return branches
- `frontend/src/store/resultsSlice.ts` - Added `maxRate: number` field (default 5000); updated `setResults` signature to accept 4th param; `resetResults` resets maxRate to 5000
- `frontend/src/hooks/useExplore.ts` - Updated `setResults` call to pass `data.max_rate ?? 5000`
- `frontend/src/store/index.ts` - Added `maxRate` to `useResultsSlice` hook selector
- `frontend/src/components/sidebar/RateSlider.tsx` - Dynamic `roundedMax` from store; `useEffect` auto-adjust; EUR max label; transition wrapper

## Decisions Made
- Tags queried first with limit 5 vs 3 for other columns — gives more tag-based suggestions to front-load
- JSON parsing uses `raw.startswith('[')` check before `json.loads` to avoid exceptions on non-array values
- Frontend merge: `[...tagMatches, ...backendResults]` — tags first ensures local tag knowledge takes priority over backend FTS5 results
- `roundedMax = Math.ceil(sliderMax / 10) * 10` with `sliderMax = Math.max(maxRate, 10)` — floor prevents degenerate slider; ceiling rounds to clean step
- `maxRate` default 5000 preserves backward compatibility with the previous hardcoded slider max
- `loadNextPage` does NOT update maxRate — paginated append doesn't change the filtered set's max rate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all changes compiled and built cleanly on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Explorer UX improvements (EXPL-01 through EXPL-06) all complete
- Autocomplete now surfaces tags prominently with correct merge order
- Rate slider is fully dynamic, responsive to filter context changes
- Ready for next phase in explorer or other v4.1 UX work

---
*Phase: 52-explorer-search-ux*
*Completed: 2026-03-03*

## Self-Check: PASSED

- app/routers/suggest.py: FOUND
- frontend/src/hooks/useHeaderSearch.ts: FOUND
- app/services/explorer.py: FOUND
- frontend/src/store/resultsSlice.ts: FOUND
- frontend/src/components/sidebar/RateSlider.tsx: FOUND
- .planning/phases/52-explorer-search-ux/52-02-SUMMARY.md: FOUND
- Commit afa5cea: FOUND
- Commit 91a8c3d: FOUND
