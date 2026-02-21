---
phase: 13-search-lab-a-b-comparison
plan: "01"
subsystem: api
tags: [fastapi, pydantic, faiss, search-intelligence, typescript, react]

# Dependency graph
requires:
  - phase: 11-search-intelligence-settings-db
    provides: get_settings() DB read, _is_weak_query, _apply_feedback_boost, _generate_hypothetical_bio helpers
  - phase: 12-steering-panel-frontend
    provides: AdminSetting types, AdminSettingsResponse — types.ts extended here
provides:
  - POST /api/admin/compare endpoint with 4 preset configs and per-run overrides
  - _retrieve_for_lab() helper for in-memory settings override without DB write
  - CompareExpert, CompareColumn, CompareResponse, LabConfigKey, LabOverrides TypeScript types
affects: [13-02-search-lab-frontend]

# Tech tracking
tech-stack:
  added: [concurrent.futures.ThreadPoolExecutor for parallel config retrieval]
  patterns: [per-run config override: read DB settings then settings.update(config_flags), no DB write, inline retrieval logic replication]

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - frontend/src/admin/types.ts

key-decisions:
  - "_retrieve_for_lab() reads DB settings then merges config_flags on top — does NOT call retrieve_with_intelligence() which would read DB again"
  - "ThreadPoolExecutor max_workers = len(config_flag_pairs) — one thread per requested config, parallel execution"
  - "Per-run overrides applied uniformly on top of every selected preset via {**preset, **body.overrides} merge"
  - "Private search_intelligence helpers imported at module top with # noqa: PLC2701 on the import block — not per call-site"
  - "Field imported from pydantic at module level (added to existing BaseModel import)"

patterns-established:
  - "Lab retrieval pattern: get_settings(db) + settings.update(override_flags) + inline steps = same logic as retrieve_with_intelligence() without a second DB read"
  - "noqa: PLC2701 on module-level import of private functions, not on each call site"

requirements-completed: [LAB-01, LAB-04]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 13 Plan 01: A/B Comparison Backend + Types Summary

**POST /api/admin/compare with 4 preset intelligence configs run in parallel via ThreadPoolExecutor, plus 5 TypeScript types (CompareResponse, CompareColumn, CompareExpert, LabConfigKey, LabOverrides) mirroring the backend response shape**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T16:09:36Z
- **Completed:** 2026-02-21T16:12:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added POST /api/admin/compare endpoint that runs a query through up to 4 preset intelligence configs in parallel and returns ranked expert results per config without touching global DB settings
- Implemented _retrieve_for_lab() helper that reads DB settings once, merges per-config flags on top in memory, then runs HyDE + feedback logic inline — eliminating any second DB read
- Added 5 TypeScript types to types.ts that exactly match the backend JSON response shape, ready for Plan 02 frontend consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Add POST /api/admin/compare to admin.py** - `eab19d2` (feat)
2. **Task 2: Add A/B comparison TypeScript types to types.ts** - `75c07c3` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `app/routers/admin.py` - Added _LAB_CONFIGS presets, CompareRequest model, _retrieve_for_lab() helper, and POST /compare endpoint; added Field, ThreadPoolExecutor, and search_intelligence private helper imports
- `frontend/src/admin/types.ts` - Appended CompareExpert, CompareColumn, CompareResponse, LabConfigKey, LabOverrides types

## Decisions Made

- `_retrieve_for_lab()` does NOT call `retrieve_with_intelligence()` (which would re-read the DB) — instead it calls `get_settings(db)` once, merges `config_flags` on top, and runs the three retrieval steps directly using the merged settings dict. This is the only way to honor per-config flag overrides without a second DB read.
- `ThreadPoolExecutor(max_workers=len(config_flag_pairs))` — one thread per config, true parallel execution. Safe because FAISS reads are thread-safe and DB is read-only in this path.
- Per-run overrides applied uniformly across all selected configs via `{**_LAB_CONFIGS[name], **body.overrides}`. This matches the CONTEXT.md decision that override scope applies to all selected configs.
- Private helpers from `search_intelligence` imported at module top with a single `# noqa: PLC2701` on the import block — not repeated per call-site.

## Deviations from Plan

None - plan executed exactly as written.

The one deviation-candidate was the `from pydantic import Field` addition — `Field` was referenced in `CompareRequest` but not in the original import. This was corrected by extending the existing `from pydantic import BaseModel` to `from pydantic import BaseModel, Field` (Rule 3: blocking issue auto-fixed, no user decision required).

## Issues Encountered

None - both verification checks passed on first attempt (admin.py imports cleanly, ruff passes, frontend npm run build succeeds).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- POST /api/admin/compare is deployed on next `git push` to main (Railway auto-deploys)
- TypeScript types are ready for Plan 02 to wire up the SearchLabPage UI component
- No blockers — data contract between backend and frontend is fully defined

## Self-Check: PASSED

- FOUND: app/routers/admin.py
- FOUND: frontend/src/admin/types.ts
- FOUND: 13-01-SUMMARY.md
- FOUND: eab19d2 (task 1 commit)
- FOUND: 75c07c3 (task 2 commit)
- admin.py imports cleanly: OK
- ruff check: All checks passed!
- TypeScript types: all 5 exported (CompareResponse, CompareColumn, CompareExpert, LabConfigKey, LabOverrides confirmed)

---
*Phase: 13-search-lab-a-b-comparison*
*Completed: 2026-02-21*
