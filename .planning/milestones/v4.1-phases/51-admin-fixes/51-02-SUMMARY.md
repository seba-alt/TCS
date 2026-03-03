---
phase: 51-admin-fixes
plan: 02
subsystem: api, ui
tags: [fastapi, react, faiss, admin-dashboard, expert-management]

requires:
  - phase: 48-admin-overview
    provides: Expert list page with table and management features
provides:
  - DELETE /api/admin/experts/{username} single expert deletion
  - POST /api/admin/experts/delete-bulk bulk expert deletion
  - Frontend checkboxes, delete buttons, confirmation dialog
  - Automatic FAISS index rebuild after deletion
affects: [admin-dashboard, expert-management]

tech-stack:
  added: []
  patterns:
    - "adminDelete helper for DELETE HTTP method in admin hooks"
    - "Confirmation modal pattern for destructive actions"

key-files:
  created: []
  modified:
    - app/routers/admin.py
    - frontend/src/admin/pages/ExpertsPage.tsx
    - frontend/src/admin/hooks/useAdminData.ts

key-decisions:
  - "Hard delete (not soft delete) — experts permanently removed from DB, metadata.json, and experts.csv"
  - "FAISS rebuild triggered automatically in background thread after deletion"
  - "Bulk delete uses POST with body (not DELETE) since DELETE with request body is non-standard"

patterns-established:
  - "adminDelete helper for DELETE requests with auth"
  - "Confirmation modal overlay for destructive admin actions"
  - "Rebuild notice with auto-dismiss after 10 seconds"

requirements-completed: [ADMN-03]

duration: 12min
completed: 2026-03-02
---

# Plan 51-02: Expert Deletion Summary

**Single and bulk expert deletion with confirmation dialogs, checkbox multi-select, and automatic FAISS index rebuild**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Backend DELETE endpoint for single expert removal from DB, metadata.json, and experts.csv
- Backend POST endpoint for bulk deletion of multiple experts
- Both endpoints trigger background FAISS index rebuild
- Frontend per-row trash icon button for single deletion
- Checkbox column with select-all for multi-select
- "Delete selected (N)" bulk action button
- Confirmation modal dialog with cancel/delete actions
- FAISS rebuild notice with 10s auto-dismiss

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend expert deletion endpoints** - `e6d1738` (feat)
2. **Task 2: Frontend deletion UI** - `96be0ef` (feat)

## Files Created/Modified
- `app/routers/admin.py` - Added DELETE /experts/{username} and POST /experts/delete-bulk endpoints with FAISS rebuild
- `frontend/src/admin/pages/ExpertsPage.tsx` - Added checkboxes, delete buttons, confirmation modal, rebuild notice
- `frontend/src/admin/hooks/useAdminData.ts` - Added adminDelete helper function

## Decisions Made
- Hard delete (permanent removal) rather than soft delete — matches project simplicity
- FAISS rebuild skipped if already running to prevent concurrent builds
- Bulk delete uses POST (not DELETE) since DELETE with request body is non-standard HTTP

## Deviations from Plan
None - plan executed as specified

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Expert deletion feature complete
- Phase 51 fully implemented

---
*Phase: 51-admin-fixes*
*Completed: 2026-03-02*
