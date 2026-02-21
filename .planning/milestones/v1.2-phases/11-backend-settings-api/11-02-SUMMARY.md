---
phase: 11-backend-settings-api
plan: "02"
subsystem: api
tags: [fastapi, sqlalchemy, sqlite, settings, admin, feature-flags, validation]

# Dependency graph
requires:
  - phase: 11-01
    provides: AppSetting ORM model, settings table, get_settings(db) function

provides:
  - GET /api/admin/settings endpoint returning all 5 intelligence settings with value, source, type, description
  - POST /api/admin/settings endpoint writing setting to DB via db.merge() upsert
  - SETTINGS_SCHEMA dict with metadata for all 5 intelligence settings
  - _validate_setting() raising HTTP 400 for unknown keys and out-of-range values
  - _coerce_value() converting raw string to native Python bool/float/int
  - .env.example documentation with DB-override pattern for all 5 tuneable keys

affects: [12-admin-settings-ui, 13-settings-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SETTINGS_SCHEMA dict as single source of truth for key metadata: type, env_default, min, max, description"
    - "db.merge() for SQLAlchemy upsert on primary-key entity — INSERT or UPDATE based on PK match"
    - "source field (db | env | default) communicates override hierarchy to API consumers"
    - "Deferred import of AppSetting inside endpoint functions to avoid circular import at module load"
    - "Value always stored as string in DB; _coerce_value() converts to native type on read"

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - .env.example

key-decisions:
  - "SETTINGS_SCHEMA placed as module-level dict (not inside function) — powers both GET response and POST validation"
  - "value field in GET response is native Python type (bool/float/int), not string — frontend receives correct type"
  - "source field ('db' | 'env' | 'default') tells Phase 12 UI whether a DB override is active"
  - "db.merge() used for upsert — AppSetting.key is PRIMARY KEY, merge cleanly handles insert-or-update"
  - "Deferred import of AppSetting inside functions (not at module level) — consistent with 11-01 pattern"
  - "Settings section placed after CSV exports section in admin.py — near bottom, with clear section comment"

patterns-established:
  - "Admin settings API pattern: SCHEMA dict + validate + coerce + merge upsert + source field"
  - "All values stored as strings in DB, typed on read — matches env var pattern for symmetry"

requirements-completed: [CONF-03, CONF-04]

# Metrics
duration: 10min
completed: 2026-02-21
---

# Phase 11 Plan 02: Admin Settings API Endpoints Summary

**GET + POST /api/admin/settings endpoints with SETTINGS_SCHEMA validation, db.merge() upsert, and source field indicating DB/env/default override hierarchy**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-21T16:00:00Z
- **Completed:** 2026-02-21T16:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added GET /api/admin/settings returning all 5 intelligence settings with native-typed value, raw string, source ("db" | "env" | "default"), type, and description
- Added POST /api/admin/settings writing to settings table via db.merge() upsert; returns updated setting with source="db"
- Added SETTINGS_SCHEMA dict as single source of truth for key metadata (type, env_default, min/max, description)
- Added _validate_setting() raising HTTP 400 for unknown keys and out-of-range values (bool/float/int)
- Added _coerce_value() converting raw string DB value to native Python type for API response
- Updated .env.example with Phase 11 settings section documenting all 5 keys with DB-override pattern and Railway guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: GET and POST /api/admin/settings endpoints** - `45c09fe` (feat)
2. **Task 2: Update .env.example with settings documentation** - `1650ffd` (chore)

## Files Created/Modified

- `app/routers/admin.py` - Added SETTINGS_SCHEMA, SettingUpdate model, _validate_setting(), _coerce_value(), GET /settings, POST /settings — all in new "Settings" section near bottom of file
- `.env.example` - Appended Phase 11 settings section with all 5 keys, valid ranges, DB-override instructions, and Railway usage guidance

## Decisions Made

- SETTINGS_SCHEMA is a module-level dict (not inside functions) — it is the single source of truth for key metadata, powering both GET response metadata and POST validation logic
- GET response `value` field contains native Python type (bool/float/int), not raw string — frontend receives correct type without manual parsing
- `source` field ("db" | "env" | "default") tells Phase 12 UI whether a DB override is currently active for each key
- db.merge() used for upsert — AppSetting.key is PRIMARY KEY, merge semantics cleanly handle both insert (new key) and update (existing key)
- AppSetting deferred import inside endpoint functions (not at module level) — consistent with the pattern established in 11-01's get_settings()
- Settings section placed after CSV exports, near the bottom of admin.py, with a clear section comment

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing ruff F821 warnings (`Integer` undefined name) found in get_gaps() and export_gaps_csv() at lines 460 and 1164. These are pre-existing issues not caused by this plan's changes. Logged to deferred-items (out of scope per deviation rules boundary).

## User Setup Required

None - no external service configuration required. The settings endpoints are ready to use as soon as the server is deployed. DB settings table is auto-created at startup.

## Next Phase Readiness

- GET /api/admin/settings ready for Phase 12 to read all 5 intelligence settings with source metadata
- POST /api/admin/settings ready for Phase 12 steering panel to write new values without redeploy
- source field tells Phase 12 UI which settings have DB overrides active (useful for toggle display state)
- .env.example documents Railway env var setup for ops team reference

## Self-Check: PASSED

- FOUND: app/routers/admin.py (with SETTINGS_SCHEMA, GET /settings, POST /settings)
- FOUND: .env.example (5 DB-controllable references)
- FOUND: 11-02-SUMMARY.md
- FOUND commit: 45c09fe (feat: settings endpoints)
- FOUND commit: 1650ffd (chore: .env.example docs)
- FOUND commit: 27bf0d4 (docs: plan metadata)

---
*Phase: 11-backend-settings-api*
*Completed: 2026-02-21*
