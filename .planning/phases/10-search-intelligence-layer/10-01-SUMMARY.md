---
phase: 10-search-intelligence-layer
plan: "01"
subsystem: api
tags: [faiss, gemini, hyde, feedback-ranking, numpy, structlog, sqlalchemy]

# Dependency graph
requires:
  - phase: 09-admin-expert-tab-enhancement
    provides: Feedback model with expert_ids JSON column; confirmed feedback query pattern via domain-map endpoint
  - phase: 08-data-enrichment-pipeline
    provides: retriever.py, embedder.py, embed_query(), SIMILARITY_THRESHOLD, TOP_K exports

provides:
  - app/services/search_intelligence.py with retrieve_with_intelligence() callable
  - QUERY_EXPANSION_ENABLED and FEEDBACK_LEARNING_ENABLED env-var feature flags
  - HyDE query expansion pipeline (bio generation → blend → re-search → merge)
  - Feedback-weighted re-ranking with cold-start guard and ±20% cap

affects:
  - 10-02 (chat.py integration — will replace retriever.retrieve() with retrieve_with_intelligence())

# Tech tracking
tech-stack:
  added: []  # No new packages — all dependencies already in requirements.txt
  patterns:
    - "Lazy singleton genai.Client for HyDE generation (_hyde_client / _get_hyde_client)"
    - "Module-level feature flags from env vars via _flag() helper — read once at import time"
    - "Synchronous service module intended for run_in_executor in async chat.py"
    - "FAISS re-search with pre-built vector via _search_with_vector()"
    - "Profile-URL dedup with name fallback in _merge_candidates()"
    - "Empty url_set guard before SQLite .in_() query (same as Phase 09-01)"

key-files:
  created:
    - app/services/search_intelligence.py
  modified: []

key-decisions:
  - "retrieve_with_intelligence() is synchronous — genai.Client() and embed_query() are sync; asyncio.wait_for timeout for HyDE handled by chat.py caller (Plan 02)"
  - "Both flags default False at module level — Railway explicitly enables after validation"
  - "HyDE fires only when fewer than STRONG_RESULT_MIN (3) candidates score >= SIMILARITY_THRESHOLD"
  - "faiss.normalize_L2 mandatory after embedding average — averaged vectors are NOT unit length"
  - "feedback_applied set True whenever FEEDBACK_LEARNING_ENABLED is True, regardless of whether any expert had >= 10 interactions"
  - "Experts with profile_url=None deduped by name in _merge_candidates()"
  - "Empty url_set guard returns candidates early, avoids empty SQLite .in_() query"

patterns-established:
  - "Pattern: intelligence_meta dict always returned with all 3 keys (hyde_triggered, hyde_bio, feedback_applied) — never partial"
  - "Pattern: Graceful degradation — both HyDE and feedback failure paths log warning and return unchanged candidates"

requirements-completed: [SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06]

# Metrics
duration: 7min
completed: 2026-02-21
---

# Phase 10 Plan 01: Search Intelligence Layer Summary

**HyDE query expansion + feedback re-ranking service (search_intelligence.py) with env-var feature flags, lazy genai.Client singleton, and graceful degradation on all failure paths**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T13:10:19Z
- **Completed:** 2026-02-21T13:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `app/services/search_intelligence.py` (377 lines) implementing the full HyDE + feedback re-ranking pipeline
- `retrieve_with_intelligence()` is importable with both flags correctly defaulting to False
- All 6 internal helpers implemented: `_is_weak_query`, `_generate_hypothetical_bio`, `_blend_embeddings`, `_search_with_vector`, `_merge_candidates`, `_apply_feedback_boost`
- Both failure paths (HyDE Gemini error, feedback DB error) degrade gracefully and never raise

## Task Commits

Each task was committed atomically:

1. **Task 1: Create search_intelligence.py service module** - `83eda27` (feat)

## Files Created/Modified

- `app/services/search_intelligence.py` - HyDE + feedback re-ranking wrapper; exports `retrieve_with_intelligence`, `QUERY_EXPANSION_ENABLED`, `FEEDBACK_LEARNING_ENABLED`

## Decisions Made

- `retrieve_with_intelligence()` is synchronous, not async — genai.Client() and embed_query() are synchronous; the HyDE timeout (asyncio.wait_for 5s) is handled by the chat.py caller (Plan 02 concern), not this module
- Both feature flags default to False at module level; Railway explicitly enables them after validation per SEARCH-06 / Pitfall 7 guidance
- `feedback_applied` is set True whenever FEEDBACK_LEARNING_ENABLED is True (not conditional on whether any expert met the cold-start threshold) — signal to caller that the re-ranking path ran
- `_blend_embeddings` always calls `faiss.normalize_L2` after averaging — mandatory for IndexFlatIP correctness (averaged unit vectors have magnitude < 1)
- Empty `url_set` guard in `_apply_feedback_boost` returns early to avoid empty SQLite `.in_()` query — same pattern as Phase 09-01 decision in STATE.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Feature flags are toggled in Railway environment variables:
- `QUERY_EXPANSION_ENABLED=true` (enable HyDE)
- `FEEDBACK_LEARNING_ENABLED=true` (enable feedback re-ranking, only after verifying feedback corpus size)

## Next Phase Readiness

- `app/services/search_intelligence.py` is complete and importable — ready for Plan 02 (chat.py integration)
- Plan 02 will replace `retriever.retrieve()` in chat.py with `retrieve_with_intelligence()`, wrapping it in `loop.run_in_executor` with `asyncio.wait_for` for HyDE timeout handling
- No blockers

---
*Phase: 10-search-intelligence-layer*
*Completed: 2026-02-21*
