---
phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality
plan: "04"
subsystem: api
tags: [fastapi, gemini, auto-tagging, background-tasks, react, typescript]

# Dependency graph
requires:
  - phase: 08-01
    provides: tag_expert_sync and compute_findability_score in app/services/tagging.py
provides:
  - POST /api/admin/experts with synchronous auto-tagging and BackgroundTasks retry
  - Admin UI ExpertsPage with "Generating tags..." status message during submission
affects:
  - Phase 09 (FAISS ingestion from DB — new experts already tagged before index rebuild)
  - Phase 10 (feedback re-ranking — experts added via dashboard are already enriched)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sync Gemini call in sync FastAPI route handler (not async) — avoids asyncio.run() RuntimeError"
    - "BackgroundTasks retry pattern: try sync call inline, schedule background retry on exception"
    - "Local imports inside background task function to avoid circular imports at module load"

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - frontend/src/admin/pages/ExpertsPage.tsx

key-decisions:
  - "Auto-tagging is synchronous on POST /api/admin/experts — admin waits ~1-2s for Gemini, expert is fully enriched before response. BackgroundTasks retry only fires on Gemini failure."
  - "Plan referenced ExpertTab.tsx but actual file is ExpertsPage.tsx — updated correct file with no behavioral change"
  - "No-bio experts skip Gemini call entirely but still get a findability_score computed"

patterns-established:
  - "BackgroundTasks retry pattern: wrap sync AI call in try/except, schedule background retry on exception, never fail expert creation"
  - "Return enriched fields (tags, findability_score) in POST response so caller gets enrichment result immediately"

requirements-completed:
  - TAGS-05

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 8 Plan 04: Auto-Tagging on Expert Creation Summary

**POST /api/admin/experts now calls Gemini synchronously to tag and score each new expert, with a BackgroundTasks retry on failure and a "Generating tags..." UI message during submission**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T00:20:38Z
- **Completed:** 2026-02-21T00:22:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `add_expert` endpoint to call `tag_expert_sync()` and `compute_findability_score()` synchronously when the new expert has a bio
- Added `_retry_tag_expert_background()` — a BackgroundTasks function that retries tagging after Gemini failures, ensuring expert creation never fails due to an AI error
- No-bio experts get `findability_score` computed (without Gemini call); bio-bearing experts are fully enriched before the response returns
- Response extended to include `tags` and `findability_score` fields
- Admin UI `ExpertsPage.tsx` submit button now says "Generating tags..." during form submission, communicating the ~1-2s AI wait to admins

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend POST /api/admin/experts with synchronous auto-tagging and BackgroundTasks retry** - `026d2c1` (feat)
2. **Task 2: Update admin UI to show "Generating tags..." during expert creation** - `112a3d9` (feat)

## Files Created/Modified

- `app/routers/admin.py` - Added BackgroundTasks import, structlog logger, tagging service imports, `_retry_tag_expert_background()` helper, auto-tagging block in `add_expert`, updated return value with tags + findability_score
- `frontend/src/admin/pages/ExpertsPage.tsx` - Changed submit button loading state from "Adding..." to "Generating tags..."

## Decisions Made

- Auto-tagging is synchronous in the route handler. Admin waits ~1-2s for Gemini, but the expert is fully enriched before the response arrives. This avoids a second API call or polling pattern from the frontend.
- BackgroundTasks retry only fires on Gemini failure — expert creation itself never fails due to an AI error. Expert is saved with `tags=null` and retry runs after response is sent.
- Plan referenced `ExpertTab.tsx` as the file to modify, but the actual file implementing the expert creation form is `ExpertsPage.tsx`. Updated the correct file with the same intent.

## Deviations from Plan

**1. [Rule 1 - File path correction] Plan specified ExpertTab.tsx; actual file is ExpertsPage.tsx**
- **Found during:** Task 2 (admin UI update)
- **Issue:** `frontend/src/admin/ExpertTab.tsx` does not exist. The expert creation form lives in `frontend/src/admin/pages/ExpertsPage.tsx`
- **Fix:** Applied the "Generating tags..." change to the correct file (`ExpertsPage.tsx`)
- **Files modified:** `frontend/src/admin/pages/ExpertsPage.tsx`
- **Verification:** `grep "Generating tags" frontend/src/admin/pages/ExpertsPage.tsx` returns match; `npm run build` succeeds
- **Committed in:** `112a3d9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 file path correction)
**Impact on plan:** Trivial — the plan named the wrong file but the intent was clear. Correct file updated as intended. No scope change.

## Issues Encountered

None — all verifications passed on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- New experts added via admin dashboard are now immediately enriched with tags and findability_score
- Ready for Phase 09 batch tagging (tag_experts.py) and FAISS re-ingestion from DB
- The BackgroundTasks retry ensures any transient Gemini failures during expert creation are automatically recovered

---
*Phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality*
*Completed: 2026-02-21*
