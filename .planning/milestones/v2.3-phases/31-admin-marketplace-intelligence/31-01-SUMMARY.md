---
phase: 31-admin-marketplace-intelligence
plan: "01"
subsystem: api
tags: [fastapi, sqlalchemy, sqlite, json_extract, streaming-response, admin-dashboard]

# Dependency graph
requires:
  - phase: 30-event-tracking
    provides: user_events table with sage_query and card_click event rows
provides:
  - GET /api/admin/events/demand — zero-result query aggregation with pagination
  - GET /api/admin/events/exposure — expert card click counts by context
  - GET /api/admin/events/trend — 14-day daily Sage query totals with KPI fields
  - GET /api/admin/export/demand.csv — demand data CSV download
  - GET /api/admin/export/exposure.csv — exposure data CSV download
affects: [31-admin-marketplace-intelligence, frontend-marketplace-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "json_extract(payload, '$.field') = 1 for SQLite JSON boolean comparison (not = true)"
    - "data_since field via SELECT MIN(created_at) FROM user_events for cold-start detection"
    - "StreamingResponse + metadata comment rows for CSV exports (consistent with existing pattern)"

key-files:
  created: []
  modified:
    - app/routers/admin.py

key-decisions:
  - "All five endpoints added to existing router object (not a new APIRouter) — inherits _require_admin dependency automatically"
  - "Boolean json_extract comparisons use = 1 not = true — SQLite stores JSON booleans as integers"
  - "data_since field via SELECT MIN(created_at) enables frontend cold-start empty state without additional logic"
  - "demand endpoint includes pagination (page/page_size/total) for large zero-result datasets"
  - "trend endpoint uses fixed 14-day window for daily data; KPI prior_period_total enables change calculation on frontend"

patterns-established:
  - "Marketplace Intelligence section: # --- Marketplace Intelligence endpoints --- comment block near bottom of admin.py"
  - "CSV exports follow existing pattern: metadata comment rows, blank row, column headers, data rows"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, INTEL-04]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 31 Plan 01: Marketplace Intelligence Aggregation Endpoints Summary

**Five read-only admin endpoints (demand/exposure/trend aggregation + CSV exports) reading from user_events table via json_extract, all protected by _require_admin**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T18:23:37Z
- **Completed:** 2026-02-22T18:25:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added GET /events/demand: zero-result Sage queries grouped by frequency with pagination and data_since cold-start field
- Added GET /events/exposure: expert card click counts broken down by grid vs sage_panel context
- Added GET /events/trend: 14-day daily Sage query data (hits/zero_results) with KPI fields for change calculation
- Added GET /export/demand.csv and /export/exposure.csv following existing StreamingResponse + metadata header pattern

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: All five Marketplace Intelligence endpoints** - `1ef018a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `app/routers/admin.py` - Added 5 endpoints in `# --- Marketplace Intelligence endpoints ---` section (195 lines added)

## Decisions Made
- All endpoints placed on the existing `router` object (line 199) rather than a new router — inherits `_require_admin` dependency automatically, no main.py changes needed
- Boolean json_extract comparisons use `= 1` not `= true` — SQLite stores JSON booleans as integers, `= true` would never match
- `data_since` field computed via `SELECT MIN(created_at) FROM user_events` — returns `None` when table is empty, ISO string otherwise, enabling frontend cold-start detection
- `demand` endpoint includes pagination params (`page`, `page_size`, `total`) — zero-result queries can accumulate to hundreds of rows
- `trend` endpoint uses fixed 14-day window for chart data; `prior_period_total` (days 15-28) lets frontend calculate period-over-period change without additional API calls

## Deviations from Plan

None - plan executed exactly as written. All imports (`io`, `csv`, `datetime`, `date`, `timedelta`, `StreamingResponse`) were already present in admin.py, so no new imports were needed.

## Issues Encountered
None - module imported cleanly on first attempt, all queries syntactically valid.

## User Setup Required
None - no external service configuration required. All endpoints read from the existing user_events table created in Phase 30.

## Next Phase Readiness
- All five backend endpoints are live and protected
- Frontend MarketplacePage.tsx (Phase 31-02) can immediately consume /events/demand, /events/exposure, /events/trend
- CSV download buttons can link directly to /export/demand.csv and /export/exposure.csv
- Cold-start empty state: check `data_since === null` in demand/exposure/trend responses

---
*Phase: 31-admin-marketplace-intelligence*
*Completed: 2026-02-22*

## Self-Check: PASSED

- app/routers/admin.py: FOUND
- 31-01-SUMMARY.md: FOUND
- Commit 1ef018a: FOUND
- All 5 endpoints verified: /events/demand, /events/exposure, /events/trend, /export/demand.csv, /export/exposure.csv
- Module import: PASSED (`python3 -c "import app.routers.admin; print('import ok')"` returns `import ok`)
