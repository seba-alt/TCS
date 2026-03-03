---
phase: 56-backend-performance-admin-refactor
plan: 01
subsystem: api
tags: [caching, ttl, google-genai, sqlite, threading]

requires:
  - phase: 55-explorer-bug-fixes
    provides: Stable explorer and search pipeline
provides:
  - 60s TTL embedding cache in embedder.py (_embed_cache, _embed_lock, EMBED_CACHE_TTL)
  - 30s TTL settings cache in search_intelligence.py with invalidate_settings_cache() hook
affects: [56-03 admin split (settings POST must call invalidate_settings_cache)]

tech-stack:
  added: []
  patterns: [module-level TTL dict with threading.Lock for in-process caching]

key-files:
  created: []
  modified:
    - app/services/embedder.py
    - app/services/search_intelligence.py

key-decisions:
  - "TTL-only invalidation for embedding cache (60s) — embeddings are stateless lookups"
  - "TTL + explicit invalidation for settings cache (30s) — admin changes take effect immediately via invalidate_settings_cache()"
  - "Lock held only during dict read/write, not during API/DB calls — prevents request serialization"

patterns-established:
  - "Module-level TTL cache pattern: dict + threading.Lock + time.time() timestamp + eviction on write"
  - "Explicit invalidation hook exported for cross-module wiring (invalidate_settings_cache)"

requirements-completed: [PERF-01, PERF-04]

duration: 3min
completed: 2026-03-03
---

# Plan 56-01: Embedding & Settings TTL Caches Summary

**In-memory TTL caches for Google embedding API calls (60s) and intelligence settings DB reads (30s) with explicit invalidation hook**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- embed_query() checks an in-memory cache before calling the ~500ms Google API — repeated identical queries return instantly within 60 seconds
- get_settings() caches all 5 intelligence settings for 30 seconds, eliminating a DB round-trip on every chat message
- invalidate_settings_cache() exported and ready for Plan 03 to wire into POST /settings endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TTL embedding cache to embedder.py** - `9a80f4d` (feat)
2. **Task 2: Add TTL settings cache to search_intelligence.py** - `90dafbf` (feat)

## Files Created/Modified
- `app/services/embedder.py` - Added _embed_cache dict, _embed_lock, EMBED_CACHE_TTL=60s; modified embed_query() to check cache before API call
- `app/services/search_intelligence.py` - Added _settings_cache, _settings_cache_ts, _settings_lock, SETTINGS_CACHE_TTL=30s; modified get_settings() to use cache; added invalidate_settings_cache()

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Embedding cache active on next deploy — no configuration needed
- Settings cache active on next deploy — invalidation hook ready for wiring in Plan 03
- No new dependencies added (only stdlib threading and time)

---
*Phase: 56-backend-performance-admin-refactor*
*Completed: 2026-03-03*
