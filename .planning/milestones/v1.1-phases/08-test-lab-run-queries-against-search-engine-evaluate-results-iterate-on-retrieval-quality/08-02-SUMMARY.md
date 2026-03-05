---
phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality
plan: "02"
subsystem: database
tags: [python, asyncio, gemini, tqdm, sqlalchemy, sqlite, batch-processing]

# Dependency graph
requires:
  - phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality
    plan: "01"
    provides: Expert ORM model with tags/findability_score columns and compute_findability_score from app/services/tagging.py
provides:
  - scripts/tag_experts.py async batch script for AI-tagging all experts via Gemini 2.5 Flash
  - Idempotent batch run (skips already-tagged experts and no-bio experts)
  - Retry-once-then-skip pattern for individual Gemini failures
  - Findability scores computed for ALL experts including no-bio ones
affects: [08-03, 08-04, app/routers/admin.py]

# Tech tracking
tech-stack:
  added: [tqdm==4.66.*]
  patterns:
    - "Async Gemini calls via client.aio (asyncio context) vs sync client for FastAPI routes"
    - "asyncio.Semaphore for concurrency control on external API calls (CONCURRENCY=5)"
    - "Sync DB helpers + async orchestration: no SessionLocal held open across await calls"
    - "tqdm.asyncio for progress bars compatible with asyncio.gather"

key-files:
  created:
    - scripts/tag_experts.py
  modified:
    - requirements.txt

key-decisions:
  - "All DB helper functions (_load_untagged_experts, _write_tags_to_db, _write_score_to_db) are sync — no SessionLocal held open across any await call, preventing SQLite thread errors"
  - "CONCURRENCY=5 as conservative default with comment pointing to AI Studio RPM docs at ai.google.dev"
  - "Async Gemini client (client.aio) used in batch script — sync client reserved for FastAPI route handlers (tag_expert_sync)"
  - "No-bio experts receive findability_score write via _write_score_to_db synchronously after async tagging pass completes"
  - "tqdm.asyncio import pattern (from tqdm.asyncio import tqdm as async_tqdm) for asyncio.gather compatibility"

patterns-established:
  - "Batch scripts: async orchestration with sync DB helpers pattern for SQLite thread safety"
  - "Semaphore-controlled asyncio.gather for rate-limited external API calls"

requirements-completed: [TAGS-01, FIND-03]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 8 Plan 02: Async Batch Tagging Script Summary

**Async batch script using Gemini 2.5 Flash structured output with semaphore-controlled concurrency, idempotent re-runs, retry-once-skip pattern, and findability scoring for all experts including no-bio ones**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T00:20:00Z
- **Completed:** 2026-02-21T00:22:04Z
- **Tasks:** 2
- **Files modified:** 2 (requirements.txt, scripts/tag_experts.py created)

## Accomplishments
- `scripts/tag_experts.py` created: async batch script that AI-tags all experts with bio using Gemini 2.5 Flash structured output
- CONCURRENCY=5 semaphore controls parallel Gemini calls — tune via constant at top of file
- Idempotent: re-running the script skips experts where tags IS NOT NULL
- Retry-once-then-skip: individual Gemini failures log to failures list, do not abort the run
- No-bio experts skipped from Gemini calls but still receive a findability score
- Progress bar (tqdm) shows total count including no-bio skips; run summary printed only when there are failures or skips
- `tqdm==4.66.*` added to requirements.txt

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tqdm to requirements.txt** - `79fd51e` (chore)
2. **Task 2: Create scripts/tag_experts.py** - `761cb97` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `requirements.txt` - Added tqdm==4.66.* after sqlalchemy dependency
- `scripts/tag_experts.py` - New async batch tagging script (187 lines): async Gemini calls, semaphore concurrency, tqdm progress, retry logic, sync DB helpers, no-bio scoring

## Decisions Made
- All DB helper functions are sync (no SessionLocal open across await) — prevents SQLite "objects created in a thread" errors
- `client.aio` (async Gemini variant) used in batch script; sync `genai.Client()` reserved for FastAPI route handlers
- CONCURRENCY=5 conservative default; constant placed at top of file with AI Studio RPM docs link for easy tuning
- No-bio experts processed synchronously after async tagging pass — no Gemini call, only `_write_score_to_db`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `tqdm` not installed in local dev environment — installed via `pip install tqdm` for verification (not a code issue; tqdm is now in requirements.txt for deployment)

## User Setup Required
None - no external service configuration required. Script requires GOOGLE_API_KEY in environment when run.

## Next Phase Readiness
- `scripts/tag_experts.py` is ready to run after `scripts/ingest.py` has populated the Expert DB table
- Requires `GOOGLE_API_KEY` environment variable to be set before running
- Admin endpoint (08-03) can use `tag_expert_sync` from `app.services.tagging` for per-expert sync tagging on POST /api/admin/experts
- FAISS re-ingestion (08-04) can now proceed after batch tagging populates tags on all experts

## Self-Check: PASSED

- FOUND: scripts/tag_experts.py
- FOUND: requirements.txt (contains tqdm==4.66.*)
- FOUND commit: 79fd51e (Task 1)
- FOUND commit: 761cb97 (Task 2)

---
*Phase: 08-test-lab-run-queries-against-search-engine-evaluate-results-iterate-on-retrieval-quality*
*Completed: 2026-02-21*
