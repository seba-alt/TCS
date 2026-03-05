---
phase: 71-backend-performance-railway-config
plan: "02"
subsystem: api, database, infra
tags: [asyncio, sqlite, gzip, cache, fastapi, sqlalchemy, queuepool]

# Dependency graph
requires:
  - phase: 71-backend-performance-railway-config
    provides: Plan 71-01 expert CRUD invalidation hooks already added to experts.py

provides:
  - "Asyncio event queue (app/event_queue.py) shared module for fire-and-forget event writes"
  - "Background event flush worker in lifespan: batches up to 10 events per 2s, retry-once-then-drop"
  - "POST /api/events returns 202 without synchronous DB write"
  - "SQLite PRAGMAs tuned on every connection: WAL, synchronous=NORMAL, cache_size=-32000, temp_store=MEMORY, mmap_size=128MB, wal_autocheckpoint=1000"
  - "GZipMiddleware compresses API responses over 500 bytes"
  - "Explore endpoint TTL cache: 5-minute TTL, 200 entry max, seed>0 bypasses cache"
  - "Explore cache invalidated on expert mutation and ingest rebuild"
  - "SQLAlchemy QueuePool: size=5, max_overflow=10, pool_pre_ping=True"

affects: [72-frontend-performance, 73-seo, 74-observability-launch]

# Tech tracking
tech-stack:
  added: []  # No new packages — all built-in Starlette/stdlib (confirmed in research)
  patterns:
    - "Asyncio shared queue module to avoid circular imports between main.py and routers"
    - "Background asyncio task in lifespan with explicit cancel+await on shutdown"
    - "Module-level thread-safe dict cache with TTL + LRU eviction (matching _settings_cache pattern)"
    - "Cache invalidation on all mutation paths: add, delete, bulk delete, ingest"

key-files:
  created:
    - app/event_queue.py
    - app/services/explore_cache.py
  modified:
    - app/routers/events.py
    - app/main.py
    - app/database.py
    - app/routers/explore.py
    - app/routers/admin/_common.py

key-decisions:
  - "Event queue module (app/event_queue.py) kept separate from both main.py and events.py to avoid circular imports"
  - "Flush worker uses asyncio.wait_for with a rolling deadline to collect up to BATCH_SIZE events within FLUSH_INTERVAL; retry once on DB failure then drop"
  - "GZipMiddleware registered after CORSMiddleware (Starlette LIFO order = GZip runs on response after CORS headers are set)"
  - "Explore cache TTL set to 300s (5 minutes) per user decision in CONTEXT.md, overriding the 30s in BPERF-07"
  - "Seeded explore queries (seed>0) always bypass cache — randomized results must not be cached"

patterns-established:
  - "Shared asyncio queue in own module: avoids circular import between lifespan (main.py) and route handler"
  - "Thread-safe TTL cache with max-size eviction: matches _settings_cache pattern from search_intelligence.py"

requirements-completed: [BPERF-04, BPERF-05, BPERF-06, BPERF-07, BPERF-08]

# Metrics
duration: 3min
completed: "2026-03-05"
---

# Phase 71 Plan 02: Event Batch Queue, SQLite Tuning, GZip & Explore Cache Summary

**Fire-and-forget event writes via asyncio batch queue, 5 new SQLite PRAGMAs, GZip compression for responses >500 bytes, and 5-minute TTL explore cache with full invalidation coverage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T12:16:00Z
- **Completed:** 2026-03-05T12:19:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 modified, 2 created)

## Accomplishments
- POST /api/events now returns 202 immediately with zero DB involvement in the request path; background worker batches and flushes every 2s or 10 items
- SQLite connection tuned with 5 PRAGMAs (synchronous=NORMAL, cache_size=-32000, temp_store=MEMORY, mmap_size=128MB, wal_autocheckpoint=1000) for improved write throughput under 10k-user launch load
- Explore endpoint response caching reduces repeated identical queries to microseconds (5-min TTL, 200 entries, cache bypassed for seeded/randomized results)
- GZipMiddleware applied to all API responses over 500 bytes, reducing payload sizes for explore/chat/browse endpoints
- SQLAlchemy connection pool explicitly configured (QueuePool, size=5, max_overflow=10, pool_pre_ping=True) for Railway container restart resilience

## Task Commits

Each task was committed atomically:

1. **Task 1: Event batch queue + SQLite tuning + connection pool config + GZip** - `53e9a72` (feat)
2. **Task 2: Explore endpoint TTL cache with invalidation** - `7df3267` (feat)

## Files Created/Modified
- `app/event_queue.py` - Shared asyncio.Queue(maxsize=1000); imported by main.py and events.py to avoid circular import
- `app/routers/events.py` - Async fire-and-forget: enqueue to _event_queue, drop oldest when full, return 202 immediately
- `app/main.py` - _event_flush_worker() async task in lifespan + GZipMiddleware after CORSMiddleware
- `app/database.py` - QueuePool config + 5 new SQLite PRAGMAs on every connection
- `app/services/explore_cache.py` - Thread-safe TTL dict cache, 5-min TTL, 200-entry max, full clear on invalidation
- `app/routers/explore.py` - Cache lookup before executor, cache store after; seed>0 bypasses cache
- `app/routers/admin/_common.py` - invalidate_explore_cache() called after successful FAISS ingest rebuild

## Decisions Made
- Event queue kept in its own module (`app/event_queue.py`) rather than defined in `main.py` or `events.py` — both need access and a shared module is the only pattern that avoids a circular import
- Explore cache TTL is 300s (5 min) per user decision, not 30s from BPERF-07 requirement; the user's CONTEXT.md decision takes precedence
- Seeded explore queries (`seed > 0`) bypass cache entirely — seeded results are randomized per request and caching would defeat the purpose

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `explore_cache.py` was already present in the working tree from Plan 71-01 partial work (confirmed content was correct and complete before Task 2 began); included in Task 1's commit via git staging — no functional impact

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 BPERF requirements (04-08) are satisfied
- Phase 72 (Frontend Performance) can proceed
- Railway will pick up all changes on next push to main

---
*Phase: 71-backend-performance-railway-config*
*Completed: 2026-03-05*
