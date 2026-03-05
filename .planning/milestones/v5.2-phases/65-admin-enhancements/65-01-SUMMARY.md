---
phase: 65-admin-enhancements
plan: 01
subsystem: ui
tags: [react, tailwind, accordion, admin-dashboard]

# Dependency graph
requires:
  - phase: 62-lead-insights
    provides: TopExpertsCard and TopQueriesCard components, analytics endpoints
provides:
  - "Accordion See All / Show less expansion on Top Clicks and Top Searches overview cards"
  - "TopQueriesCard fetches up to 50 queries (previously 5)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accordion state lifted to parent with single-slot expansion (expandedCard)"

key-files:
  created: []
  modified:
    - frontend/src/admin/pages/OverviewPage.tsx

key-decisions:
  - "Single expandedCard state slot enforces accordion behavior — expanding one card collapses the other"
  - "No animation on expand/collapse — instant toggle, no Framer Motion in admin"
  - "Max height 360px with overflow-y-auto for internal scrolling on expanded cards"
  - "TopQueriesCard fetch limit bumped from 5 to 50 — all data loaded upfront, no expand-triggered fetch"

patterns-established:
  - "Accordion expansion: parent owns expandedCard state, children receive isExpanded + onToggle props"

requirements-completed: [ADMOV-01, ADMOV-02, ADMOV-03, ANLYT-01]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 65 Plan 01: Admin Accordion Expansion Summary

**Accordion "See All" / "Show less" expansion on Top Clicks and Top Searches overview cards with internal scroll, plus Speed Insights verification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T12:44:00Z
- **Completed:** 2026-03-04T12:47:16Z
- **Tasks:** 2 (1 auto + 1 checkpoint auto-approved)
- **Files modified:** 1

## Accomplishments
- TopExpertsCard shows all ranked experts when expanded, top 5 when collapsed
- TopQueriesCard shows up to 50 ranked queries when expanded, top 5 when collapsed
- Only one card can be expanded at a time (accordion behavior via single state slot)
- Expanded cards scroll internally with max-h-[360px]
- "See All" / "Show less" toggle visible only when >5 rows
- Period toggle changes do not collapse the expanded card
- Verified SpeedInsights component already active in App.tsx (line 111)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accordion expansion to TopExpertsCard and TopQueriesCard** - `ac0e069` (feat)
2. **Task 2: Verify accordion expansion and Speed Insights** - checkpoint auto-approved

## Files Created/Modified
- `frontend/src/admin/pages/OverviewPage.tsx` - Added expandedCard state, refactored TopExpertsCard and TopQueriesCard with isExpanded/onToggle props, See All/Show less toggle, internal scroll container

## Decisions Made
- Single expandedCard state slot in OverviewPage enforces accordion (expanding one collapses other)
- No animation — instant expand/collapse (no Framer Motion in admin codebase)
- 360px max height fits ~12 rows at current row height
- Fetch limit for top queries bumped to 50 upfront (no lazy loading on expand)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 65 is the last phase in v5.2 milestone — ready for phase completion and verification.

---
*Phase: 65-admin-enhancements*
*Completed: 2026-03-04*
