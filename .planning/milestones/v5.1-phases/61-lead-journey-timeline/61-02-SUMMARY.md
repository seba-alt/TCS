---
phase: 61-lead-journey-timeline
plan: 02
subsystem: ui
tags: [react, timeline, leads, hooks, tailwind]

requires:
  - phase: 61-lead-journey-timeline
    provides: GET /api/admin/lead-timeline/{email} endpoint + TimelineEvent types
provides:
  - Chronological lead journey timeline in expanded LeadsPage rows
  - useLeadTimeline hook with pagination support
  - Time-gap labels (30+ min normal, 1+ day emphasized)
affects: []

tech-stack:
  added: []
  patterns: [vertical-line timeline with dot nodes, discriminated union narrowing for event types]

key-files:
  created: []
  modified:
    - frontend/src/admin/pages/LeadsPage.tsx
    - frontend/src/admin/hooks/useAdminData.ts

key-decisions:
  - "Removed standalone Click Activity table — timeline replaces it"
  - "Search events blue accent, click events purple accent per CONTEXT.md"
  - "Expert name rendered as link to /admin/experts?search={username}"

patterns-established:
  - "Timeline layout: border-l-2 vertical line + absolute positioned dot nodes"
  - "Time gap threshold: 30min for label, 24h for emphasized (amber) styling"

requirements-completed: [LEAD-01, LEAD-02, LEAD-03]

duration: 4min
completed: 2026-03-03
---

# Plan 61-02: Frontend Timeline UI Summary

**Unified chronological timeline in LeadsPage expanded rows with color-coded search/click events, time-gap labels, and paginated loading**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced dual "Recent queries" + "Expert Clicks" sections with unified chronological timeline
- Added useLeadTimeline hook with offset-based pagination and data appending
- Search events show blue magnifying glass icon, query text, and result count badge
- Click events show purple cursor icon, expert name as clickable link, and preceding search query
- Time gaps >= 30 minutes display labeled dividers; gaps >= 1 day get amber emphasized styling
- "Load earlier events" button fetches next page and appends to existing timeline
- Removed standalone Click Activity table — no longer needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useLeadTimeline hook** - `10b412f` (feat)
2. **Task 2: Rewrite LeadsPage expanded row with timeline** - `570b745` (feat)

## Files Created/Modified
- `frontend/src/admin/hooks/useAdminData.ts` - Added useLeadTimeline hook with pagination
- `frontend/src/admin/pages/LeadsPage.tsx` - Rewrote expanded row with chronological timeline, removed Click Activity table

## Decisions Made
- Removed standalone Click Activity table since timeline provides the same data in a lead-centric view
- Expert names link to /admin/experts?search={username} for quick expert lookup
- Updated helper text from "Click a row to expand queries and clicks" to "Click a row to expand journey timeline"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 61 complete — all LEAD-01/02/03 requirements delivered
- Ready for Phase 62: Overview Enhancements

---
*Phase: 61-lead-journey-timeline*
*Completed: 2026-03-03*
