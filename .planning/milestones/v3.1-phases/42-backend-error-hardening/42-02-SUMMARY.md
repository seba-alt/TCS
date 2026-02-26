---
phase: 42-backend-error-hardening
plan: 02
subsystem: api
tags: [fastapi, search-lab, run_explore, faiss, pipeline, react, typescript]

# Dependency graph
requires:
  - phase: 42-backend-error-hardening
    provides: Plan 01 error fixes (FTS5 safety nets used by run_explore)
provides:
  - Search Lab compare endpoint routes explore-prefixed configs through run_explore()
  - Legacy pipeline preserved for A/B alignment validation
  - Pipeline badge (run_explore/legacy) on each Search Lab result column
  - Backwards-compatible config aliases (baseline, hyde, feedback, full) still work
affects: [43-frontend-error-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-pipeline Search Lab: _explore_for_lab() for live pipeline, _retrieve_for_lab() for legacy comparison
    - Pipeline field in API response enables UI to badge result provenance

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - frontend/src/admin/pages/SearchLabPage.tsx
    - frontend/src/admin/types.ts

key-decisions:
  - "run_explore() is the default pipeline — explore_baseline and explore_full configs use it"
  - "Legacy configs preserved permanently for alignment validation, not just temporarily"
  - "HyDE/feedback overrides only affect legacy pipeline configs — run_explore never did HyDE"
  - "Diff mode baseline reference changed from hardcoded 'baseline' to first column — works with any config as baseline"
  - "Backwards-compatible aliases (baseline, hyde, feedback, full) map to legacy pipeline for existing API consumers"

patterns-established:
  - "Dual-pipeline comparison: new pipeline as default, old pipeline as validation reference"
  - "Pipeline labels in API responses for transparent result provenance"

requirements-completed: [SRCH-01, SRCH-02]

# Metrics
duration: 10min
completed: 2026-02-26
---

# Phase 42 Plan 02: Search Lab Pipeline Alignment Summary

**Search Lab compare endpoint now routes through run_explore() as default pipeline with legacy FAISS retriever available for A/B validation; each result column shows a pipeline badge (emerald for run_explore, gray for legacy)**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added _explore_for_lab() function that calls run_explore() with the same 3-stage hybrid pipeline as live search (SRCH-01)
- Updated _LAB_CONFIGS with explore_baseline, explore_full, legacy_baseline/hyde/feedback/full presets plus backwards-compatible aliases
- Pipeline routing in _run_one(): explore-prefixed configs go through run_explore(), legacy-prefixed through original _retrieve_for_lab()
- Pipeline badge in SearchLabPage.tsx CompareColumnCard: emerald for run_explore, gray for legacy (SRCH-02)
- Default configs changed to compare explore vs legacy: ['explore_baseline', 'explore_full', 'legacy_baseline', 'legacy_full']
- Per-run overrides note updated to clarify they only affect legacy pipeline configs
- TypeScript types updated with pipeline field on CompareColumn and expanded LabConfigKey union

## Files Created/Modified
- `app/routers/admin.py` - Added _explore_for_lab() function, expanded _LAB_CONFIGS and _LAB_LABELS with 10 presets, updated CompareRequest defaults, refactored _run_one() with pipeline routing, updated serialization to handle both pipeline return types
- `frontend/src/admin/pages/SearchLabPage.tsx` - Updated CONFIG_OPTIONS to 6 pipeline-aware presets, added pipeline badge before HyDE/Feedback badges, updated default selectedConfigs, updated overrides description, fixed diff mode baseline reference
- `frontend/src/admin/types.ts` - Added pipeline field to CompareColumn and intelligence, expanded LabConfigKey union type

## Decisions Made
- Kept _retrieve_for_lab() unchanged — it powers all legacy pipeline columns
- Diff mode baseline reference changed from `config === 'baseline'` to `compareResult.columns[0]` — works with any first config as the comparison baseline
- Pipeline field included at both column level and intelligence level for redundancy/convenience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Search Lab fully aligned with live search pipeline
- Legacy pipeline available for ongoing alignment validation
- Phase 42 complete — all 5 requirements (ERR-01, ERR-03, ERR-04, SRCH-01, SRCH-02) satisfied
- Ready for Phase 43 (Frontend Fixes + Analytics + Tag Cloud)

---
*Phase: 42-backend-error-hardening*
*Completed: 2026-02-26*
