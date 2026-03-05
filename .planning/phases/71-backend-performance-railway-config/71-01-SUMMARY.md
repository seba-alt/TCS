---
phase: 71-backend-performance-railway-config
plan: "01"
subsystem: api, ui
tags: [fastapi, health-endpoint, pagination, react, typescript, sqlite, cache]

# Dependency graph
requires: []
provides:
  - "GET /api/health — fast, unauthenticated Railway healthcheck (unchanged)"
  - "GET /api/admin/health — authenticated endpoint returning DB status, expert_count, db_latency_ms, faiss_vectors, uptime_s, version"
  - "GET /api/admin/experts — paginated with page/limit/search params; returns total, page, total_pages"
  - "Admin experts sorted alphabetically A-Z by first name"
  - "invalidate_explore_cache() wired in add_expert, delete_expert, delete_experts_bulk"
  - "app/services/explore_cache.py — thread-safe TTL cache (5 min) with invalidation"
  - "useAdminExpertsPaginated hook — server-side pagination + 300ms debounced search"
  - "ExpertsPage.tsx — server-side paginated table with AdminPagination controls"
  - "OverviewPage.tsx health widget — calls /api/admin/health with fallback to public endpoint; shows DB latency + expert count"
  - "BPERF-03 verified: browse.py:196 already returns Cache-Control: public, max-age=86400"

affects: [71-02-PLAN, 72-frontend-performance, 73-seo, 74-observability-launch]

# Tech tracking
tech-stack:
  added: []  # No new packages — stdlib only (time, math, threading)
  patterns:
    - "Two-tier health endpoints: public fast unauthenticated + authenticated admin diagnostics"
    - "Module-level thread-safe TTL cache with LRU eviction (matching _embed_cache, _settings_cache patterns)"
    - "Server-side pagination: 0-indexed page + limit + search; returns total/page/total_pages"
    - "useAdminExpertsPaginated hook with debounced search (300ms) and page reset on search change"
    - "Admin health widget: adminFetch with fallback to public fetch on auth failure"

key-files:
  created:
    - app/services/explore_cache.py
  modified:
    - app/routers/health.py
    - app/routers/admin/experts.py
    - frontend/src/admin/hooks/useAdminData.ts
    - frontend/src/admin/pages/ExpertsPage.tsx
    - frontend/src/admin/pages/OverviewPage.tsx
    - frontend/src/admin/types.ts

key-decisions:
  - "Two-tier health: /api/health stays minimal (Railway), /api/admin/health adds diagnostics (admin JWT)"
  - "Explore cache TTL is 300s (5min) per CONTEXT.md user decision"
  - "Admin experts default sort changed from findability_score to first_name A-Z (user decision)"
  - "useAdminExperts hook kept unchanged to avoid breaking SettingsPage and TagManagerPage"
  - "explore_cache.py created as new service module (Rule 3 deviation — required by experts.py)"

patterns-established:
  - "Pattern: import _require_admin from app.routers.admin._common into health.py (safe, no circular import)"
  - "Pattern: server-side pagination with 0-indexed page, total_pages for AdminPagination component"

requirements-completed: [BPERF-01, BPERF-02, BPERF-03]

# Metrics
duration: ~20min
completed: 2026-03-05
---

# Phase 71 Plan 01: Health Endpoints + Expert Pagination Summary

**Two-tier health endpoints (public Railway check + authenticated admin diagnostics) and server-side paginated expert list replacing full-list fetch, with explore cache invalidation on mutations.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-05T12:00:00Z
- **Completed:** 2026-03-05T12:20:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Two-tier health design: `/api/health` unchanged (fast/unauthenticated), new `/api/admin/health` returns DB status, expert count, latency, FAISS vectors, uptime, version with admin JWT
- Admin experts endpoint refactored from full-list to paginated (page/limit/search Query params, returns total/page/total_pages) — fixes Sentry large-payload alerts from 530+ expert responses
- Frontend wired to server-side pagination: `useAdminExpertsPaginated` hook, debounced search, AdminPagination component, enriched health widget
- `app/services/explore_cache.py` created as foundation for explore cache invalidation across mutation paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Two-tier health endpoints + paginated admin experts backend** - `53e9a72` (feat)
2. **Task 2: Admin frontend — paginated experts table + health widget upgrade** - `121f01c` (docs/feat)

## Files Created/Modified

- `app/routers/health.py` — Added `/api/admin/health` endpoint with DB diagnostics + JWT auth
- `app/routers/admin/experts.py` — Added page/limit/search params; A-Z sort; invalidate_explore_cache() calls
- `app/services/explore_cache.py` — New thread-safe TTL cache module (5-min TTL, 200 entry max)
- `frontend/src/admin/hooks/useAdminData.ts` — Added useAdminExpertsPaginated hook
- `frontend/src/admin/pages/ExpertsPage.tsx` — Server-side paginated table; removed client-side sort/filter
- `frontend/src/admin/pages/OverviewPage.tsx` — Health widget upgraded to /api/admin/health with fallback
- `frontend/src/admin/types.ts` — Added PaginatedExpertsResponse interface

## Decisions Made

- Explore cache TTL set to 300s (5 minutes) per CONTEXT.md user decision, overriding BPERF-07 30s spec
- Admin experts default sort changed to first_name A-Z (user decision) from findability_score
- `useAdminExperts` hook kept unchanged — SettingsPage and TagManagerPage depend on the full-list response
- Health endpoint placed in `health.py` (importing `_require_admin` from `admin._common`) — no circular import exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created app/services/explore_cache.py**
- **Found during:** Task 1 (backend implementation)
- **Issue:** experts.py required `from app.services.explore_cache import invalidate_explore_cache` but the file didn't exist
- **Fix:** Created `app/services/explore_cache.py` with `get_cached`, `set_cached`, `invalidate_explore_cache` following existing project TTL cache pattern
- **Files modified:** app/services/explore_cache.py (created)
- **Verification:** `python3 -c "from app.services.explore_cache import ..."` imports cleanly; functional test passes
- **Committed in:** `53e9a72` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing dependency)
**Impact on plan:** Required for correctness — explore_cache was referenced in plan but not pre-existing. No scope creep.

## Issues Encountered

- Previous execution had already committed backend Task 1 in `53e9a72` before this run; SUMMARY.md was the only missing artifact
- Task 2 frontend was bundled into `121f01c` (71-02 docs commit) from a prior run

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend health endpoints and pagination are deployed on `main`
- Explore cache module is ready for Plan 71-02 to wire into `explore.py`
- Frontend ExpertsPage and OverviewPage updated and TypeScript-clean

---
*Phase: 71-backend-performance-railway-config*
*Completed: 2026-03-05*
