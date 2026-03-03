---
phase: 61-lead-journey-timeline
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, typescript, timeline, lead-analytics]

requires:
  - phase: 58.1-admin-dashboard-improvements
    provides: LeadClick model and lead-clicks endpoints
provides:
  - GET /api/admin/lead-timeline/{email} endpoint returning interleaved search+click events
  - TimelineEvent discriminated union TypeScript types
  - LeadTimelineResponse type for frontend consumption
affects: [61-02-PLAN]

tech-stack:
  added: []
  patterns: [batch-resolve expert names via Expert table, merge-and-sort interleaved event streams]

key-files:
  created: []
  modified:
    - app/routers/admin/leads.py
    - frontend/src/admin/types.ts

key-decisions:
  - "Pagination done in-memory after merge-sort — acceptable for per-lead data volumes"
  - "Expert name resolution uses batch lookup pattern from events.py get_lead_clicks"

patterns-established:
  - "Timeline event shape: discriminated union on 'type' field ('search' | 'click')"

requirements-completed: [LEAD-01, LEAD-02, LEAD-03]

duration: 3min
completed: 2026-03-03
---

# Plan 61-01: Backend Lead-Timeline Endpoint Summary

**GET /lead-timeline/{email} endpoint merging Conversation searches and LeadClick events into unified chronological stream with batch expert name resolution**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added GET /api/admin/lead-timeline/{email} endpoint that interleaves searches and clicks newest-first
- Search events include query text and result_count (parsed from response_experts JSON)
- Click events include expert_name resolved via batch Expert table lookup
- Added TypeScript discriminated union types (TimelineSearchEvent | TimelineClickEvent) matching backend shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /lead-timeline/{email} endpoint** - `1201851` (feat)
2. **Task 2: Add TypeScript types for timeline response** - `95d8bb3` (feat)

## Files Created/Modified
- `app/routers/admin/leads.py` - Added lead-timeline endpoint with merged search+click events
- `frontend/src/admin/types.ts` - Added TimelineSearchEvent, TimelineClickEvent, TimelineEvent, LeadTimelineResponse types

## Decisions Made
- Used in-memory merge-sort for pagination (per-lead volumes are small enough)
- Followed batch expert name resolution pattern from events.py

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend endpoint ready for frontend consumption in plan 61-02
- TypeScript types available for useLeadTimeline hook

---
*Phase: 61-lead-journey-timeline*
*Completed: 2026-03-03*
