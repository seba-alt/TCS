---
phase: 68-save-event-tracking
plan: 01
subsystem: tracking, ui
tags: [zustand, vitest, fastapi, pydantic, analytics]

requires:
  - phase: 63-tracking-infrastructure
    provides: "trackEvent() with email enrichment, user_events table with email column"
  - phase: 67-email-gate-polish-list-view-fix
    provides: "toggleSavedExpert in filterSlice, bookmark UI in grid and list views"
provides:
  - "save event type accepted by backend API (EVENT_TYPES Literal)"
  - "save event type in frontend EventType union"
  - "trackEvent('save', {expert_id, action}) fired on every bookmark toggle"
  - "2 new tracking tests for save and unsave event payloads"
affects: [69-admin-saved-insights]

tech-stack:
  added: []
  patterns:
    - "Fire-and-forget analytics in Zustand actions: void trackEvent() inside set() callback"

key-files:
  created: []
  modified:
    - app/routers/events.py
    - frontend/src/tracking.ts
    - frontend/src/store/filterSlice.ts
    - frontend/src/tracking.test.ts

key-decisions:
  - "trackEvent call placed inside set() callback after localStorage write but before return — ensures event fires on every toggle regardless of React rendering"
  - "Used isRemoving boolean to determine action ('unsave' vs 'save') before array mutation for clarity"

patterns-established:
  - "Zustand action analytics pattern: void trackEvent() inside set() for fire-and-forget event tracking in store actions"

requirements-completed: [SAVE-01]

duration: 4min
completed: 2026-03-04
---

# Phase 68-01: Save Event Tracking Summary

**Backend save event type + frontend trackEvent on bookmark toggle with fire-and-forget analytics and 2 new tests**

## Performance

- **Duration:** 4 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added "save" to backend EVENT_TYPES Literal and frontend EventType union so API accepts save events
- Wired trackEvent('save', {expert_id, action}) into toggleSavedExpert Zustand action with fire-and-forget delivery
- Added 2 tests verifying save and unsave event payloads (total 10 tracking tests now passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add save event type to backend and frontend tracking** - `2e2465f` (feat)
2. **Task 2: Fire trackEvent on bookmark toggle with tests** - `73c974f` (feat)

## Files Created/Modified
- `app/routers/events.py` - Added "save" to EVENT_TYPES Literal
- `frontend/src/tracking.ts` - Added 'save' to EventType union
- `frontend/src/store/filterSlice.ts` - Added trackEvent import and fire-and-forget call in toggleSavedExpert
- `frontend/src/tracking.test.ts` - Added 2 test cases for save and unsave event payloads

## Decisions Made
- Placed trackEvent call inside the set() callback after localStorage write for consistent timing
- Used isRemoving boolean computed before array mutation for clear action determination

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Save/unsave events now flow through to user_events table with email attribution
- Phase 69 (Admin Saved Insights) can query user_events WHERE event_type='save' for Top Saved Experts card and lead timeline entries

---
*Phase: 68-save-event-tracking*
*Completed: 2026-03-04*
