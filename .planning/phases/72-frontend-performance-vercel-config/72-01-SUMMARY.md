---
phase: 72-frontend-performance-vercel-config
plan: 01
subsystem: frontend, api
tags: [vite, manualChunks, tracking, batch-events, preconnect, fastapi]

requires:
  - phase: 71-backend-performance-railway-config
    provides: Backend event queue infrastructure (app/event_queue.py)
provides:
  - Client-side event batch queue in tracking.ts
  - Backend batch event endpoint POST /api/events/batch
  - 5 new Vite vendor chunks (motion, virtuoso, icons, intercom, router)
  - Preconnect hint to Railway API origin
affects: [74-analytics-hardening]

tech-stack:
  added: []
  patterns: [module-level-queue, batch-flush-pattern, manualChunks-vendor-splitting]

key-files:
  created: []
  modified:
    - frontend/src/tracking.ts
    - frontend/src/tracking.test.ts
    - frontend/vite.config.ts
    - frontend/index.html
    - app/routers/events.py

key-decisions:
  - "Export flush() for testability — enables explicit flush in tests without relying on timer"
  - "Batch queue silently drops on network error — Phase 74 handles retry/offline"
  - "motion match is broad (not framer-motion) to capture the motion package"

patterns-established:
  - "Module-level queue pattern: array + setTimeout for fire-and-forget batching"
  - "Batch API pattern: POST /api/events/batch with events array"

requirements-completed: [FPERF-01, FPERF-02, FPERF-03]

duration: 8min
completed: 2026-03-05
---

# Phase 72 Plan 01: Event Batch Queue + Vendor Chunks + Preconnect Summary

**Module-level event batch queue flushing to /api/events/batch, 5 new vendor chunks via manualChunks, and Railway preconnect hint**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- tracking.ts rewritten from per-event POST to batch queue (flush at 10 items / 3s / beforeunload)
- Backend batch endpoint POST /api/events/batch accepting up to 50 events per request
- 5 new vendor chunks: vendor-motion (132KB), vendor-virtuoso (54KB), vendor-icons (5KB), vendor-intercom (6KB), vendor-router (98KB)
- Preconnect link to Railway API in index.html
- 14 tests covering all batch queue behavior

## Task Commits

1. **Task 1: Batch endpoint + tracking.ts rewrite + tests** - `d29b845` (feat)
2. **Task 2: manualChunks expansion + preconnect** - `7c8705f` (feat)

## Files Created/Modified
- `frontend/src/tracking.ts` - Module-level queue with batch flush
- `frontend/src/tracking.test.ts` - 14 tests for batch behavior
- `frontend/vite.config.ts` - 5 new manualChunks entries
- `frontend/index.html` - Preconnect to Railway API origin
- `app/routers/events.py` - BatchEventRequest model + /api/events/batch endpoint

## Decisions Made
- Exported flush() function for testability
- Batch queue drops silently on network error (Phase 74 handles retry/offline)
- beforeunload listener registered at module level

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Event tracking now batched client-side, ready for Phase 74 analytics hardening
- Vendor chunks split for cache reuse on returning visitors
- Preconnect eliminates first-API-call latency penalty

---
*Phase: 72-frontend-performance-vercel-config*
*Completed: 2026-03-05*
