---
phase: 11-backend-settings-api
plan: "01"
subsystem: database
tags: [sqlalchemy, sqlite, orm, settings, feature-flags]

# Dependency graph
requires:
  - phase: 10-search-intelligence-layer
    provides: retrieve_with_intelligence() + search intelligence module that reads module-level constants
provides:
  - AppSetting ORM model (key/value/updated_at) registered with Base metadata
  - settings table created at startup via Base.metadata.create_all()
  - get_settings(db) function reading all 5 intelligence settings from DB with env var fallback
  - per-call settings reading in retrieve_with_intelligence() replacing module-level constants
affects: [12-admin-settings-api, 13-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-backed runtime settings with env var fallback pattern: rows.get(key, os.getenv(key, default))"
    - "Deferred import inside get_settings() to avoid circular imports at module load"
    - "Per-request DB read for small config tables (5 rows max) — no caching, immediate consistency"

key-files:
  created: []
  modified:
    - app/models.py
    - app/main.py
    - app/services/search_intelligence.py

key-decisions:
  - "AppSetting uses SCREAMING_SNAKE_CASE keys matching env var names for clarity and fallback symmetry"
  - "get_settings() uses deferred import of AppSetting inside function to avoid circular import at module load time"
  - "HYDE_TIMEOUT_SECONDS=5.0 kept as hardcoded safety constant — hang-protection guard, not a tuneable setting"
  - "SIMILARITY_THRESHOLD import removed from retriever in search_intelligence; only TOP_K still needed for _search_with_vector"
  - "_is_weak_query() now accepts strong_result_min and similarity_threshold as parameters (no module globals)"
  - "_apply_feedback_boost() now accepts feedback_boost_cap as parameter; boost_factor = cap * 2 (ratio range 0.0-1.0)"
  - "Base.metadata.create_all() handles settings table creation on fresh DBs; create_all is idempotent on existing DBs"

patterns-established:
  - "DB settings pattern: SELECT * from small table, Python dict, _db_or_env() helper with typed converters"
  - "No caching of settings — SELECT on every chat request ensures zero-redeploy config changes"

requirements-completed: [CONF-01, CONF-02]

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 11 Plan 01: AppSetting Model and Per-Request DB Settings Summary

**AppSetting ORM model + settings table + get_settings(db) replacing module-level feature flag constants in search_intelligence.py**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T00:00:00Z
- **Completed:** 2026-02-21T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added AppSetting ORM model to app/models.py with key (VARCHAR PRIMARY KEY), value (TEXT), updated_at (DATETIME) columns; table name "settings"
- settings table auto-created at startup via Base.metadata.create_all() — idempotent on existing Railway DBs
- Refactored search_intelligence.py to use get_settings(db) on every retrieve_with_intelligence() call, reading all 5 intelligence settings from DB with env var fallback
- Removed module-level QUERY_EXPANSION_ENABLED, FEEDBACK_LEARNING_ENABLED, STRONG_RESULT_MIN constants; updated _is_weak_query() and _apply_feedback_boost() to accept settings as parameters

## Task Commits

Each task was committed atomically:

1. **Task 1: AppSetting model + settings table migration** - `4100040` (feat)
2. **Task 2: Refactor search_intelligence.py to per-call DB settings** - `a7f4a67` (feat)

## Files Created/Modified

- `app/models.py` - Added AppSetting class with key/value/updated_at columns; __tablename__ = "settings"
- `app/main.py` - Added log line "startup: settings table created/verified" after expert enrichment block
- `app/services/search_intelligence.py` - Replaced module-level constants with get_settings(db); updated _is_weak_query() and _apply_feedback_boost() signatures

## Decisions Made

- AppSetting uses SCREAMING_SNAKE_CASE keys matching env var names for clarity and fallback symmetry
- get_settings() uses deferred import of AppSetting inside function to avoid circular import at module load time
- HYDE_TIMEOUT_SECONDS=5.0 kept as hardcoded safety constant (hang-protection guard, not a tuneable setting)
- SIMILARITY_THRESHOLD import removed from retriever in search_intelligence; only TOP_K still needed for _search_with_vector
- _is_weak_query() now accepts strong_result_min and similarity_threshold as parameters (no module globals)
- _apply_feedback_boost() now accepts feedback_boost_cap as parameter; boost_factor = cap * 2 (ratio range 0.0-1.0, cap range 0.0-0.50)
- Base.metadata.create_all() handles settings table creation on fresh DBs; create_all is idempotent on existing DBs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The settings table is created automatically at server startup.

## Next Phase Readiness

- AppSetting model and settings table are ready for Plan 02 (admin API endpoints: GET /api/admin/settings, PATCH /api/admin/settings/:key)
- get_settings(db) is callable from any service that receives a DB session
- Changing any of the 5 settings via SQL INSERT/UPDATE will take effect on the next chat request without restarting the server

---
*Phase: 11-backend-settings-api*
*Completed: 2026-02-21*
