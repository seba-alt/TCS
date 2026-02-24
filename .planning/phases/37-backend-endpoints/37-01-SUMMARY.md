---
phase: 37-backend-endpoints
plan: 01
subsystem: api
tags: [fastapi, httpx, browse, photo-proxy, streaming]

requires:
  - phase: 36-foundation
    provides: Expert.photo_url column and navigationSlice for browse navigation
provides:
  - GET /api/browse endpoint returning featured experts and category rows
  - GET /api/photos/{username} photo proxy with HTTPS enforcement and cache headers
  - Cold-start fallback (All Experts row) when no categories meet 3+ threshold
affects: [38-browse-ui, 39-sage-cross-page-navigation]

tech-stack:
  added: [httpx (moved from dev to core)]
  patterns: [browse card serializer, category row aggregation, photo proxy with streaming response]

key-files:
  created: [app/routers/browse.py]
  modified: [app/main.py, requirements.txt]

key-decisions:
  - "Photo proxy streams upstream bytes via StreamingResponse rather than redirect — preserves HTTPS enforcement and cache control"
  - "Recently Added row uses created_at DESC ordering, not findability_score — shows newest experts regardless of enrichment status"
  - "Cold-start guard checks for category rows specifically (not just any rows) to ensure fallback triggers correctly"

patterns-established:
  - "_serialize_browse_card pattern: public expert card with proxy photo URL (not raw stored URL)"
  - "_slugify helper for URL-friendly category names"

requirements-completed: [PHOTO-02]

duration: 3min
completed: 2026-02-24
---

# Plan 37-01: Browse API & Photo Proxy Summary

**GET /api/browse serves curated category rows with featured experts, and GET /api/photos/{username} proxies expert photos with HTTPS enforcement and 24h cache headers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Browse API returns featured experts (top 5 by findability_score) and category rows (3+ expert threshold) with per_row pagination
- Photo proxy enforces HTTPS on upstream URLs and returns bytes with Cache-Control: public, max-age=86400
- Cold-start fallback returns single "All Experts" row when no categories qualify
- "Recently Added" cross-category row included for variety

## Task Commits

Each task was committed atomically:

1. **Task 1: Create browse router with GET /api/browse and GET /api/photos/{username}** - `9d4bcad` (feat)
2. **Task 2: Register browse router in main.py** - `8b131bc` (feat)

## Files Created/Modified
- `app/routers/browse.py` - New browse router with both GET endpoints
- `app/main.py` - Added browse import and router registration
- `requirements.txt` - Moved httpx from dev to core dependencies

## Decisions Made
- Photo proxy uses StreamingResponse with iter([content]) rather than raw redirect — maintains HTTPS enforcement and cache header control
- Recently Added row counts total experts (not filtered) since it's a cross-category row

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Browse API ready for Phase 38 Browse UI to consume
- Photo proxy ready for expert card images
- Both endpoints are public (no auth required), matching the browse use case

---
*Phase: 37-backend-endpoints*
*Completed: 2026-02-24*
