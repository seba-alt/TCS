---
phase: 30-behavior-tracking
plan: "02"
subsystem: ui
tags: [react, typescript, tracking, analytics, fetch, localStorage]

# Dependency graph
requires:
  - phase: 30-behavior-tracking
    provides: POST /api/events endpoint + UserEvent model accepting card_click, sage_query, filter_change

provides:
  - trackEvent() module function in frontend/src/tracking.ts
  - card_click events from ExpertCard (expert_id, context, rank, active_filters snapshot)
  - sage_query events from useSage (query_text, function_called, result_count, zero_results)
  - filter_change events from SearchInput (debounced query), RateSlider (drag-end), TagMultiSelect (add-only)

affects:
  - 31-marketplace-intelligence

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "trackEvent() as module function (not hook) — importable anywhere without React rules"
    - "void fetch with keepalive:true — events survive page navigation"
    - "getSessionId() with localStorage persistence — session_id generated once, reused"
    - "Snapshot pattern: useExplorerStore.getState() in event handlers (not reactive)"
    - "Tag tracking: only ADD events tracked, not removes — reduces noise"
    - "Rate tracking: onValueCommit (drag-end) not onValueChange (per-tick)"

key-files:
  created:
    - frontend/src/tracking.ts
  modified:
    - frontend/src/components/marketplace/ExpertCard.tsx
    - frontend/src/components/marketplace/ExpertGrid.tsx
    - frontend/src/hooks/useSage.ts
    - frontend/src/components/sidebar/SearchInput.tsx
    - frontend/src/components/sidebar/RateSlider.tsx
    - frontend/src/components/sidebar/TagMultiSelect.tsx

key-decisions:
  - "trackEvent is a module function (not hook) — can be called in event handlers and async functions without React rules"
  - "void fetch with keepalive:true — no await anywhere in call path"
  - "ExpertCard gets context='grid' default + optional rank from VirtuosoGrid index"
  - "Tag ADD-only tracking — remove events are noise for demand signal"
  - "sage_query expert_ids omitted — not in PilotResponse yet, Phase 31 uses result_count/zero_results"

patterns-established:
  - "Fire-and-forget: always void trackEvent(...), never await"
  - "Store snapshot in click handlers: useExplorerStore.getState() not reactive selectors"
  - "Filter tracking: debounced for query, drag-end for rate, discrete-action for tags"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 30 Plan 02: Frontend — tracking.ts module + event instrumentation Summary

**fire-and-forget trackEvent() module instrumenting ExpertCard clicks, Sage queries, and filter interactions via void fetch with keepalive:true**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T18:03:55Z
- **Completed:** 2026-02-22T18:06:12Z
- **Tasks:** 7
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Created `tracking.ts` with `trackEvent()` as a named module export using `void fetch(..., { keepalive: true })` and localStorage-persisted session_id
- Instrumented `ExpertCard` with `card_click` events including context prop, rank prop, and active_filters snapshot at click time
- Instrumented `useSage` with `sage_query` events capturing query_text, function_called, result_count, and zero_results
- Instrumented all three filter components: SearchInput (debounced), RateSlider (drag-end), TagMultiSelect (add-only)
- Zero `await trackEvent` calls anywhere in the codebase — all fire-and-forget
- TypeScript clean (`npx tsc --noEmit` exits 0), production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tracking.ts** - `e02d608` (feat)
2. **Task 2: Instrument ExpertCard for card_click** - `b14ff99` (feat)
3. **Task 3: Update ExpertGrid to pass rank prop** - `ce41cb5` (feat)
4. **Task 4: Instrument useSage for sage_query** - `14cb72c` (feat)
5. **Task 5: Instrument SearchInput for filter_change (query)** - `5f73a32` (feat)
6. **Task 6: Instrument RateSlider for filter_change (rate)** - `cef15d1` (feat)
7. **Task 7: Instrument TagMultiSelect for filter_change (tags)** - `1dce217` (feat)

## Files Created/Modified
- `frontend/src/tracking.ts` - Fire-and-forget trackEvent() module function with session_id persistence
- `frontend/src/components/marketplace/ExpertCard.tsx` - Added context/rank props, card_click tracking before onViewProfile
- `frontend/src/components/marketplace/ExpertGrid.tsx` - Changed _index to index, passes rank={index} to ExpertCard
- `frontend/src/hooks/useSage.ts` - sage_query event after data received, before filter dispatch
- `frontend/src/components/sidebar/SearchInput.tsx` - filter_change inside debounce callback, non-empty only
- `frontend/src/components/sidebar/RateSlider.tsx` - filter_change inside onValueCommit (drag-end)
- `frontend/src/components/sidebar/TagMultiSelect.tsx` - filter_change on tag ADD only (isSelected guard)

## Decisions Made
- `trackEvent` is a module function (not a hook) so it can be called from async handlers and non-component code without React rules violations
- `expert_ids` omitted from sage_query payload — not currently available in PilotResponse; Phase 31 will use result_count and zero_results for demand signals
- TagMultiSelect tracks ADD-only events: remove events are noise for demand analysis
- RateSlider uses `onValueCommit` (Radix UI drag-end) not `onValueChange` (per-tick) to avoid flooding the events table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Events flow automatically to the `/api/events` endpoint (30-01) on deploy.

## Next Phase Readiness
- All three event types (card_click, sage_query, filter_change) now emitted from the frontend
- Phase 31 can immediately build admin analytics endpoints reading from UserEvent table
- Both demand signal fields (result_count, zero_results) are in sage_query payload for Phase 31 aggregation

## Self-Check: PASSED

- [x] `frontend/src/tracking.ts` exists with `trackEvent()` named export, `void fetch(...)`, `keepalive: true`, session_id from localStorage
- [x] `ExpertCard.tsx` has `context` prop (default `'grid'`), `rank` prop, `trackEvent('card_click', ...)` fires before `onViewProfile`
- [x] `ExpertGrid.tsx` passes `rank={index}` to `ExpertCard` (index not _index)
- [x] `useSage.ts` fires `sage_query` event with `function_called` from `data.search_performed` boolean
- [x] `SearchInput.tsx` fires `filter_change` inside debounce callback, only when value is non-empty
- [x] `RateSlider.tsx` fires `filter_change` inside `onValueCommit` (drag-end only)
- [x] `TagMultiSelect.tsx` fires `filter_change` only on tag ADD (not on remove)
- [x] Zero `await trackEvent` calls anywhere in codebase
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0

---
*Phase: 30-behavior-tracking*
*Completed: 2026-02-22*
