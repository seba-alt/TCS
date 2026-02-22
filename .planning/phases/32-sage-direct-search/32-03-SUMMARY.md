---
phase: 32-sage-direct-search
plan: "03"
subsystem: ui
tags: [react, zustand, motion, tailwind, faiss, fastapi]

# Dependency graph
requires:
  - phase: 32-02
    provides: sageMode state machine across resultsSlice, filterSlice, useExplore, useSage
provides:
  - Sage icon (opacity-animated) in FilterChips count bar when sageMode=true
  - Sage-specific empty state message with hidden tag chips when sageMode=true
  - Inline dark tooltip confirmation before SearchInput exits sage mode
  - Inline dark tooltip confirmation before RateSlider exits sage mode
  - Correct result count for text queries — len(scored), not len(filtered_experts)
  - Abort race condition fix in useExplore preventing explore response from overwriting sage results
affects: [33, explore-endpoint, pilot-endpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sageMode-gated actions: intercept action → show inline tooltip → Switch/Cancel → commit or revert"
    - "motion.img with animate={{ opacity }} for smooth fade without conditional rendering"
    - "onMouseDown preventDefault on tooltip buttons to prevent blur before click registers"
    - "total = len(scored) for text queries — only count experts with semantic signal"
    - "Abort in-flight fetch before early return when state machine hands control to another data source"

key-files:
  created: []
  modified:
    - frontend/src/components/marketplace/FilterChips.tsx
    - frontend/src/components/marketplace/EmptyState.tsx
    - frontend/src/components/sidebar/SearchInput.tsx
    - frontend/src/components/sidebar/RateSlider.tsx
    - frontend/src/hooks/useExplore.ts
    - app/services/explorer.py

key-decisions:
  - "motion.img always in DOM with animate={{ opacity }} — fades smoothly rather than abrupt conditional render"
  - "FilterChips early-return guard (chips.length === 0 && total === 0) left unchanged — icon absent in zero-result sage state is acceptable since EmptyState fills the grid area"
  - "setQuery/setRateRange call setSageMode(false) internally via filterSlice — no double-calling needed in confirmation handlers"
  - "Tag chips exit sage mode silently (filterSlice.toggleTag already calls setSageMode(false)) — no component change needed"
  - "total = len(scored) for text queries — pre-filter pool is not meaningful when no rate/tag filters narrow it"
  - "Pure filter mode total = len(filtered_experts) — all filtered experts ARE the results there"
  - "Abort controllerRef.current when sageMode=true — previous guard prevented new fetch but not mid-flight response overwriting sage results"

patterns-established:
  - "Sage confirmation pattern: gate action on sageMode → store pending value → show tooltip → Switch commits + exits / Cancel reverts display"
  - "Always use onMouseDown + preventDefault on tooltip buttons inside positioned overlays to prevent blur-before-click race"
  - "When state machine delegates to a different data source, abort any in-flight fetch from the previous source immediately"

requirements-completed: [SAGE-DX-02, SAGE-DX-03]

# Metrics
duration: 25min
completed: 2026-02-22
---

# Phase 32 Plan 03: Sage Direct Search UX Layer Summary

**Sage mode UX layer with opacity-animated icon, sage empty state, filter confirmation tooltips, and two post-verify bug fixes: correct result count + explore-race-condition elimination**

## Performance

- **Duration:** ~25 min (12 min planned tasks + bug fixes post-human-verify)
- **Started:** 2026-02-22
- **Completed:** 2026-02-22
- **Tasks:** 2 planned + 2 bug fixes (post human-verify)
- **Files modified:** 6

## Accomplishments

- FilterChips shows `/icon.png` (16x16) via `motion.img` with `animate={{ opacity: sageMode ? 1 : 0 }}` and 0.3s transition — smooth fade, always in DOM
- EmptyState shows "No results found. Try describing what you need differently in Sage." and hides tag chip suggestions when sageMode=true
- SearchInput intercepts typing while sageMode=true — Switch commits query + exits sage mode, Cancel reverts input
- RateSlider intercepts drag-end (onValueCommit) while sageMode=true — Switch commits range + exits sage mode, Cancel reverts slider
- Fixed expert counter showing 1558: text queries now report `len(scored)` (experts with FAISS/BM25 signal) rather than `len(filtered_experts)` (full pre-filter pool)
- Fixed "grid shows empty despite Sage saying she found results": aborted in-flight `/api/explore` response when sageMode activates, eliminating race condition

## Task Commits

Each task was committed atomically:

1. **Task 1: Sage icon in FilterChips + Sage-specific EmptyState** - `c802815` (feat)
2. **Task 2: Inline sage-mode confirmation in SearchInput and RateSlider** - `cd0d24d` (feat)
3. **Bug fix A: total = semantically-matched experts in text query mode** - `179161a` (fix)
4. **Bug fix B: abort in-flight explore request when sageMode becomes true** - `c0dcf3a` (fix)

## Files Created/Modified

- `frontend/src/components/marketplace/FilterChips.tsx` - Added sageMode selector + motion.img icon with opacity transition
- `frontend/src/components/marketplace/EmptyState.tsx` - Added sageMode selector + conditional message + hidden tag chips in sage mode
- `frontend/src/components/sidebar/SearchInput.tsx` - Added sageMode selector + showSageConfirm/pendingQuery state + handleSageConfirmSwitch/Cancel + tooltip JSX
- `frontend/src/components/sidebar/RateSlider.tsx` - Added sageMode selector + showSageConfirm/pendingRange state + handleValueCommit gate + handleSageConfirmSwitch/Cancel + tooltip JSX
- `frontend/src/hooks/useExplore.ts` - Abort controllerRef.current before early return when sageMode=true (race condition fix)
- `app/services/explorer.py` - total = len(scored) for text queries; total = len(filtered_experts) for pure filter mode

## Decisions Made

- `motion.img` always rendered in DOM — opacity transition handles visibility, no conditional unmounting
- FilterChips early-return guard left intact — zero-result sage mode shows EmptyState instead, which is the correct UX
- `setQuery` and `setRateRange` internally call `setSageMode(false)` via filterSlice — confirmation handlers do not need to call `setSageMode` directly
- Tag chips: no component change needed — `toggleTag` already calls `setSageMode(false)` per Plan 02 filterSlice implementation
- `onMouseDown={(e) => e.preventDefault()}` on tooltip buttons prevents blur-before-click in both SearchInput and RateSlider
- `total = len(scored)` for text queries: the pre-filter pool (rate + tags) can be the full DB when no filters are active. Only experts that score in FAISS or BM25 are meaningful search results.
- Abort `controllerRef.current` when sageMode=true: the previous `if (sageMode) return` guard prevented a NEW fetch but the mid-flight `.then()` callback still called `setResults()`. Now the old request is aborted before yielding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Counter stuck at 1558 — total was pre-filter pool, not semantic match count**
- **Found during:** Human verify checkpoint (post-Task 2)
- **Issue:** `explorer.py` computed `total = len(filtered_experts)` before FAISS/BM25 scoring. With no rate/tag filters, `filtered_experts` = entire DB (1558 experts). The counter showed 1558 for every text query because all experts pass the default rate range.
- **Fix:** Moved `total` computation to after scoring: `total = len(scored)`. Added `total = len(filtered_experts)` in the pure filter mode branch where it remains correct.
- **Files modified:** `app/services/explorer.py`
- **Verification:** Python syntax check passed; both explore endpoint and pilot service (which calls `run_explore()` directly) now return the correct count.
- **Committed in:** `179161a`

**2. [Rule 1 - Bug] Sage says she found results but grid shows empty — explore race condition**
- **Found during:** Human verify checkpoint (post-Task 2)
- **Issue:** `useExplore`'s sageMode guard prevented a NEW fetch but did not abort any in-flight `/api/explore` request. When sageMode transitions to true, a previous fetch could complete and call `setResults(exploreData)` AFTER `useSage` had already called `store.setResults(sageExperts)` — overwriting sage results with explore results, leaving the grid blank.
- **Fix:** Added `controllerRef.current.abort(); controllerRef.current = null` inside the `if (sageMode)` guard before returning.
- **Files modified:** `frontend/src/hooks/useExplore.ts`
- **Verification:** TypeScript build passed (zero errors). Race condition eliminated — mid-flight explore response is cancelled when sage takes control.
- **Committed in:** `c0dcf3a`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, discovered during human verify)
**Impact on plan:** Both fixes essential for correctness — they were the root causes of the two most-reported user issues. No scope creep.

## Issues Encountered

- **Bug 3 (search quality perception gap)**: User reported Sage results differing from search lab for the same query. Root cause: Sage passes Gemini's extracted NL query (e.g., "find me a blockchain expert") to FAISS while search lab uses a short keyword (e.g., "blockchain") — different embeddings produce different ranking. The backend code path is identical (`run_explore()` in both). After fixing the counter bug (Bug 1), the perception gap likely resolves since both now show the same result count for comparable queries. No code change made to query normalization — Gemini already extracts a clean intent as the query argument.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 32 Sage Direct Search fully complete: backend experts array (Plan 01), sageMode state machine (Plan 02), UX affordances + bug fixes (Plan 03)
- Sage discovery results inject directly into grid, count reflects semantic matches, icon fades correctly, empty state guides users back to Sage, filter controls prompt confirmation before replacing sage results
- No blockers

---
*Phase: 32-sage-direct-search*
*Completed: 2026-02-22*
