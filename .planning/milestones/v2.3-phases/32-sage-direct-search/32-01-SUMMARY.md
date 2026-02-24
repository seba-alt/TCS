---
phase: 32-sage-direct-search
plan: "01"
subsystem: api
tags: [fastapi, pilot, sage, faiss, pydantic]

# Dependency graph
requires:
  - phase: 31-admin-marketplace-intelligence
    provides: stable backend foundation
provides:
  - Populated experts array in pilot API search_experts response
affects: [frontend sage integration, 32-02, 32-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [model_dump() serialization of ExpertCard objects into pilot response]

key-files:
  created: []
  modified:
    - app/services/pilot_service.py

key-decisions:
  - "Only primary result experts are serialized — fallback result experts are excluded from the response (fallback used only for narration context)"
  - "Zero-result paths return experts: [] automatically — result.experts is already [] from run_explore(), no special casing needed"

patterns-established:
  - "Pilot response serialization: ExpertCard Pydantic models serialized via model_dump() into the response dict"

requirements-completed: [SAGE-DX-01, SAGE-DX-02]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 32 Plan 01: Sage Direct Search — Experts Array Population Summary

**Pilot API search_experts response now includes serialized ExpertCard objects via `[e.model_dump() for e in result.experts]` — one surgical line added to `_handle_search_experts`**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T16:02:46Z
- **Completed:** 2026-02-22T16:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `"experts": [e.model_dump() for e in result.experts]` to `_handle_search_experts` return dict
- Zero-result paths correctly produce `experts: []` (empty list) with no additional code
- `_handle_apply_filters` return dict remains unchanged — no `experts` key, stays `experts: null`

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate experts array in _handle_search_experts** - `799f91b` (feat)

**Plan metadata:** (docs commit after summary)

## Files Created/Modified
- `app/services/pilot_service.py` - Added `experts` key to `_handle_search_experts` return dict (1 line)

## Decisions Made
- Only primary `result.experts` are serialized — the `fallback` variable's experts are intentionally excluded (fallback used only to inform Gemini narration, not the grid)
- No schema changes needed — `PilotResponse.experts: list[dict] | None = None` already accepts the serialized list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pilot API now returns `experts` array for `search_experts` queries
- Frontend (32-02) can now consume this array to directly populate the expert grid without a separate search call
- `apply_filters` path unaffected — returns `experts: null` as expected

---
*Phase: 32-sage-direct-search*
*Completed: 2026-02-22*

## Self-Check: PASSED
- FOUND: app/services/pilot_service.py
- FOUND: 32-01-SUMMARY.md
- FOUND commit: 799f91b
- model_dump count: 1 (exactly one occurrence, in _handle_search_experts only)
