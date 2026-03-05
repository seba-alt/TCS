---
phase: 09-admin-expert-tab-enhancement
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, sqlite, admin, tags, findability]

# Dependency graph
requires:
  - phase: 08-data-enrichment-pipeline
    provides: Expert.tags (JSON text) and Expert.findability_score (float) columns written by auto-tagging
provides:
  - GET /api/admin/experts returns tags as parsed list and findability_score, sorted worst-first
  - GET /api/admin/domain-map returns top-10 downvoted expert tag domains ranked by frequency
affects:
  - 09-admin-expert-tab-enhancement (frontend plans using this API contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - json.loads(e.tags or '[]') in _serialize_expert() for safe JSON column deserialization
    - Counter.most_common(10) pattern for top-N tag aggregation
    - Empty guard before .in_() query prevents SQLite empty-list error

key-files:
  created: []
  modified:
    - app/routers/admin.py

key-decisions:
  - "_serialize_expert() uses json.loads(e.tags or '[]') — safe default to empty list when tags column is NULL"
  - "GET /api/admin/experts sorts by findability_score asc nulls_first — worst-findability experts surface at top for admin review"
  - "domain-map endpoint uses Expert.profile_url.in_() not username — Feedback.expert_ids stores profile URLs"
  - "from collections import Counter placed inside function body — one-time use, keeps module import surface clean"
  - "Empty url_set guard returns early to avoid SQLite empty .in_() query overhead"

patterns-established:
  - "JSON column deserialization: always use json.loads(col or '[]') pattern — handles NULL gracefully"
  - "Auth-gated endpoints added to router (not auth_router) — dependency already applied at router level"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, SEARCH-07]

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 9 Plan 01: Admin Expert Tab Enhancement — Backend API Summary

**Extended GET /api/admin/experts with parsed tags + findability_score and worst-first sort; added GET /api/admin/domain-map returning top-10 downvoted tag domains via Counter aggregation**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T11:08:35Z
- **Completed:** 2026-02-21T11:09:25Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- `_serialize_expert()` now exposes `tags` as a parsed Python list (not raw JSON string) and `findability_score` as float or null
- `GET /api/admin/experts` defaults to ascending `findability_score` with nulls first — worst-quality experts surface at top for admin review
- New `GET /api/admin/domain-map` endpoint returns top-10 tag domains by downvote frequency, auth-gated, with empty-DB graceful handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich _serialize_expert() and fix default sort order** - `ccf460d` (feat)
2. **Task 2: Add GET /api/admin/domain-map endpoint** - `405fc18` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/routers/admin.py` - Updated `_serialize_expert()` (added tags + findability_score fields), updated `get_experts()` sort order, added `get_domain_map()` endpoint

## Decisions Made

- `json.loads(e.tags or "[]")` chosen over bare `json.loads(e.tags)` — handles NULL gracefully without try/except overhead
- `Expert.findability_score.asc().nulls_first()` — SQLAlchemy ORM syntax, compatible with SQLite
- `from collections import Counter` placed inside function body — single-use import, avoids polluting module namespace
- `Expert.profile_url.in_(list(url_set))` used (not `Expert.username`) — Feedback.expert_ids stores profile URLs per existing data contract
- Empty `url_set` guard returns `{"domains": []}` early — avoids SQLite error on empty `.in_()` call and expensive no-op query

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend API contract is complete for the Phase 9 frontend Expert tab overhaul
- Frontend plans can now render `tags` arrays, `findability_score` values, and the domain-map section
- No blockers for subsequent Phase 9 plans

## Self-Check: PASSED

- FOUND: app/routers/admin.py
- FOUND: .planning/phases/09-admin-expert-tab-enhancement/09-01-SUMMARY.md
- FOUND commit: ccf460d (Task 1 - enrich _serialize_expert)
- FOUND commit: 405fc18 (Task 2 - domain-map endpoint)

---
*Phase: 09-admin-expert-tab-enhancement*
*Completed: 2026-02-21*
