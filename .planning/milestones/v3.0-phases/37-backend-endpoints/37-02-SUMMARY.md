---
phase: 37-backend-endpoints
plan: 02
subsystem: api
tags: [fastapi, admin, csv-import, photo-management]

requires:
  - phase: 36-foundation
    provides: Expert.photo_url column in database
provides:
  - POST /api/admin/experts/photos bulk CSV import with dry-run preview
  - _serialize_expert includes photo_url field for admin visibility
affects: [38-browse-ui]

tech-stack:
  added: []
  patterns: [CSV name-matching with ambiguity detection, dry-run preview pattern]

key-files:
  created: []
  modified: [app/routers/admin.py]

key-decisions:
  - "Case-insensitive name matching using func.lower() for first_name and last_name"
  - "Ambiguous matches (2+ experts with same name) are skipped entirely rather than guessing"
  - "UTF-8 BOM handling via decode('utf-8-sig') for Excel CSV exports"

patterns-established:
  - "Dry-run preview pattern: same logic path, conditional db.commit() based on dry_run flag"
  - "CSV column validation with case-insensitive header matching"

requirements-completed: [PHOTO-01]

duration: 2min
completed: 2026-02-24
---

# Plan 37-02: Admin Bulk Photo Import Summary

**POST /api/admin/experts/photos accepts CSV upload for bulk photo URL assignment with dry-run preview, name matching, and ambiguity detection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Admin can POST CSV with first_name,last_name,photo_url to bulk-import photo URLs
- Dry-run mode (default) returns detailed preview without writing anything
- Commit mode writes matched photo URLs to Expert records
- Ambiguous name matches reported with all matching usernames
- _serialize_expert now includes photo_url for admin expert list visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Add POST /api/admin/experts/photos endpoint** - `8f95e68` (feat)
2. **Task 2: Update _serialize_expert to include photo_url** - `f9b0ecd` (feat)

## Files Created/Modified
- `app/routers/admin.py` - New photo import endpoint + updated serializer

## Decisions Made
- Used case-insensitive matching via SQLAlchemy func.lower() for name-based lookup
- Added _get() helper for case-insensitive CSV column access (handles different header casing)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin can populate expert photos before Browse UI launches in Phase 38
- Photo URLs written to Expert.photo_url column are served by the /api/photos/{username} proxy from Plan 37-01

---
*Phase: 37-backend-endpoints*
*Completed: 2026-02-24*
