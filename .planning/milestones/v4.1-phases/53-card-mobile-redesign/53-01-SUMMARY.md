---
phase: 53-card-mobile-redesign
plan: 01
subsystem: ui
tags: [react, tailwind, virtuoso, responsive-design, mobile]

# Dependency graph
requires:
  - phase: 52-explorer-search-ux
    provides: ExploreResponse with experts data, findability scores, match_reason fields
provides:
  - Responsive ExpertCard with mobile-first photo-centric layout (80px centered) and desktop photo-left layout (64px)
  - ExpertGrid without expand state — direct navigation on tap
  - ExpertList with enlarged 48px profile photos
affects: [54-mobile-filter-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [Tailwind md: breakpoint for responsive two-layout components, absolute-positioned bookmark overlay]

key-files:
  created: []
  modified:
    - frontend/src/components/marketplace/ExpertCard.tsx
    - frontend/src/components/marketplace/ExpertGrid.tsx
    - frontend/src/components/marketplace/ExpertList.tsx

key-decisions:
  - "ExpertCard uses two entirely separate JSX blocks (md:hidden / hidden md:flex) for mobile vs desktop layouts rather than conditional class merging — cleaner separation of concerns"
  - "Mobile card height fixed at 200px (up from 180px) to accommodate larger 80px photo with name/title/rate below"
  - "Desktop photo size: 64px (w-16) — larger than old 32px, prominent without dominating text content on left"
  - "List view photo size: 48px (w-12) — clear improvement over old 32px while keeping row compact"
  - "Bookmark button positioned absolute top-right on card — works on both vertical and horizontal layouts without layout coupling"

patterns-established:
  - "Responsive two-layout pattern: use md:hidden and hidden md:flex blocks for fundamentally different mobile/desktop layouts rather than class conditionals"
  - "handleCardClick always calls onViewProfile directly — no expand state, no viewport branching, single behavior"

requirements-completed: [CARD-01, CARD-02, CARD-03]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 53 Plan 01: Card & Mobile Redesign Summary

**Responsive ExpertCard rewrite: 80px photo-centric vertical mobile layout and 64px photo-left horizontal desktop layout, with direct-tap navigation replacing two-tap expand behavior**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T08:02:18Z
- **Completed:** 2026-03-03T08:04:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ExpertCard rewritten with two distinct responsive layouts: mobile shows large centered photo with name/title/rate only; desktop shows bigger photo on left with full info (company, rate, tags, match reason, View Profile)
- Removed two-tap expand behavior entirely — handleCardClick always fires onViewProfile directly on all viewports
- ExpertGrid cleaned of expandedExpertId state and handleExpand function; ExpertCard rendered without isExpanded/onExpand props
- ExpertList photos enlarged from 32px (w-8) to 48px (w-12) for visual prominence matching new card design

## Task Commits

Each task was committed atomically:

1. **Task 1: Redesign ExpertCard with responsive mobile/desktop layouts and remove tap-expand** - `a933429` (feat)
2. **Task 2: Update ExpertGrid and ExpertList to use redesigned card without expand state** - `71ab201` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/marketplace/ExpertCard.tsx` - Rewritten with md:hidden / hidden md:flex two-layout pattern; isExpanded and onExpand props removed; bookmark absolute-positioned; monogram fallback at larger sizes
- `frontend/src/components/marketplace/ExpertGrid.tsx` - Removed expandedExpertId state, handleExpand, and unused useState import; ExpertCard rendered with only expert/onViewProfile/rank props
- `frontend/src/components/marketplace/ExpertList.tsx` - Photo size increased from w-8 h-8 to w-12 h-12; skeleton and fallback updated to match; gap-3 to gap-4

## Decisions Made

- Used two separate JSX blocks (md:hidden and hidden md:flex) rather than per-element breakpoint class merging — the layouts are structurally different enough that sharing DOM structure would make both layouts worse
- Mobile card fixed at 200px height (80px photo + ~120px content area); desktop stays at 180px in photo-left row orientation
- Desktop photo 64px (w-16 h-16); comfortable balance between prominence and not overwhelming text column
- List view photo 48px (w-12 h-12) — meaningful visual step up from 32px, keeps row scannable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled clean on first attempt, Vite build succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Card redesign complete; grid/list toggle preserved with new layouts
- Bookmark, tracking, and lead-click functionality confirmed unchanged
- Ready for Phase 53 Plan 02: Mobile filter polish (remove clear button, remove search-within inputs, fix tag scroll glitch)

---
*Phase: 53-card-mobile-redesign*
*Completed: 2026-03-03*
