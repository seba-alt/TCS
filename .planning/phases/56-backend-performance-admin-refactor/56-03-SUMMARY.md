---
phase: 56-backend-performance-admin-refactor
plan: 03
subsystem: api
tags: [fastapi, router-split, admin, modularization]

requires:
  - phase: 56-01
    provides: invalidate_settings_cache() hook for settings POST wiring
  - phase: 56-02
    provides: sync_expert_tags() and sync_all_expert_tags() for expert write path wiring
provides:
  - admin/ router package with 10 focused sub-modules replacing 2225-line monolith
  - Settings cache invalidation wired in POST /settings
  - Tag sync wired in expert write paths (add_expert, import-csv, ingest, background retry)
affects: [any future admin endpoint additions — add to appropriate sub-module]

tech-stack:
  added: []
  patterns: [FastAPI router package with __init__.py assembly and shared _common.py]

key-files:
  created:
    - app/routers/admin/__init__.py
    - app/routers/admin/_common.py
    - app/routers/admin/analytics.py
    - app/routers/admin/compare.py
    - app/routers/admin/events.py
    - app/routers/admin/experts.py
    - app/routers/admin/exports.py
    - app/routers/admin/imports.py
    - app/routers/admin/leads.py
    - app/routers/admin/settings.py
  modified: []

key-decisions:
  - "Split experts.py further into compare.py (Search Lab) and imports.py (CSV/photo bulk import) to meet 400-line limit"
  - "Sub-module routers use plain APIRouter() with no prefix — inherit /api/admin from parent router in _common.py"
  - "_common.py holds all shared state (ingest dict, auth, helpers) to avoid circular imports between sub-modules"

patterns-established:
  - "Admin sub-module pattern: from app.routers.admin._common import shared items; router = APIRouter(); define endpoints"
  - "Package assembly pattern: __init__.py imports sub-modules and calls router.include_router() for each"

requirements-completed: [ADM-01]

duration: 8min
completed: 2026-03-03
---

# Plan 56-03: Admin Router Split Summary

**Split 2225-line admin.py monolith into 10-file router package with settings cache invalidation and tag sync wiring**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 11 (1 deleted, 10 created)

## Accomplishments
- Replaced the largest file in the codebase (2225 lines) with 10 focused modules, each under 400 lines
- All 36 admin API routes preserved with zero changes to main.py imports
- Wired invalidate_settings_cache() in POST /settings endpoint (from Plan 01)
- Wired sync_expert_tags() in expert write paths: add_expert, import-csv, ingest, background retry (from Plan 02)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Admin router split and package assembly** - `8fb99ac` (refactor)
2. **Task 2b: Further split experts.py into compare.py and imports.py** - `67e6846` (refactor)

## Files Created/Modified
- `app/routers/admin/__init__.py` - Package assembly, re-exports auth_router, router, _auto_categorize
- `app/routers/admin/_common.py` - Shared auth, helpers, constants, Pydantic models, ingest state (308 lines)
- `app/routers/admin/analytics.py` - Stats, searches, gaps, analytics-summary endpoints (319 lines)
- `app/routers/admin/compare.py` - Search Lab A/B compare endpoint (154 lines)
- `app/routers/admin/events.py` - Demand, exposure, lead-clicks endpoints (149 lines)
- `app/routers/admin/experts.py` - Expert CRUD, tag-all, ingest, domain-map, add-expert, deletion (381 lines)
- `app/routers/admin/exports.py` - CSV export endpoints for searches, gaps, exposure (175 lines)
- `app/routers/admin/imports.py` - CSV import, photo import endpoints (211 lines)
- `app/routers/admin/leads.py` - Leads, newsletter-subscribers, lead/newsletter CSV exports (146 lines)
- `app/routers/admin/settings.py` - Intelligence settings CRUD, reset-data (176 lines)
- `app/routers/admin.py` - DELETED (2225 lines removed)

## Decisions Made
- Split experts.py further into compare.py and imports.py because the original 6-module split left experts.py at 718 lines, exceeding the 400-line requirement
- Kept _common.py as the single source of shared state to prevent circular imports between sub-modules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Additional sub-module split for line limit compliance**
- **Found during:** Task 2 (route verification)
- **Issue:** experts.py was 718 lines after initial 6-module split, exceeding 400-line limit
- **Fix:** Extracted Search Lab compare code into compare.py (154 lines) and CSV/photo import code into imports.py (211 lines)
- **Files modified:** experts.py, compare.py (new), imports.py (new), __init__.py
- **Verification:** All files under 400 lines, all 36 routes preserved, app loads correctly
- **Committed in:** `67e6846`

---

**Total deviations:** 1 auto-fixed (line limit compliance)
**Impact on plan:** Necessary to meet the "under 400 lines" must-have truth. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin package complete and ready for production
- Future admin endpoints should be added to the appropriate sub-module file
- No new dependencies added

---
*Phase: 56-backend-performance-admin-refactor*
*Completed: 2026-03-03*
