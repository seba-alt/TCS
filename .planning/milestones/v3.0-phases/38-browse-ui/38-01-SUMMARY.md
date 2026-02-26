---
phase: 38-browse-ui
plan: 01
subsystem: ui
tags: [react, typescript, motion, tailwind, scroll-snap, glassmorphic, browse]

# Dependency graph
requires:
  - phase: 37-backend-endpoints
    provides: GET /api/browse endpoint returning featured + rows with photo_url
provides:
  - useBrowse hook fetching /api/browse with typed BrowseCard/BrowseRow/BrowseData interfaces
  - BrowseCard glassmorphic component with photo/monogram fallback and hover expand
  - BrowseRow horizontal snap-scroll row with fade edges and See All affordances
  - SkeletonBrowseCard and SkeletonBrowseRow for loading state placeholders
affects: [38-02-browse-page, plan 02 assembles all these into BrowsePage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dark gradient overlay (from-black/70) instead of .glass-surface inside overflow:hidden cards (Pitfall 1 workaround)"
    - "Deterministic monogram gradient via charCodeAt(0) % palette.length for consistent per-expert colors"
    - "CSS snap-x snap-mandatory + [scrollbar-width:none] for hidden horizontal scroll rows"
    - "var(--aurora-bg) in fade edge gradient overlays to match page background seamlessly"
    - "Mobile tap-to-expand: first tap = expand tags, second tap = open profile_url in new tab"

key-files:
  created:
    - frontend/src/hooks/useBrowse.ts
    - frontend/src/components/browse/BrowseCard.tsx
    - frontend/src/components/browse/BrowseRow.tsx
    - frontend/src/components/browse/SkeletonBrowseCard.tsx
    - frontend/src/components/browse/SkeletonBrowseRow.tsx
  modified: []

key-decisions:
  - "Used dark gradient overlay (bg-gradient-to-t from-black/70) instead of .glass-surface for BrowseCard frosted look — backdrop-filter breaks inside overflow:hidden (Pitfall 1 from research)"
  - "MonogramFallback with 6 brand-aligned purple/violet/indigo gradients, color selected deterministically via charCodeAt(0) % 6"
  - "Mobile second-tap on expanded card opens profile_url in new tab — most natural 'I want more' interaction"
  - "Fade edge overlays use inline style with var(--aurora-bg, #f8f7ff) to match aurora near-white background"

patterns-established:
  - "Pattern: BrowseCard type aliased as BrowseCardType to avoid name collision with component name"
  - "Pattern: SeeAllEndCard defined locally inside BrowseRow.tsx (not a separate file)"
  - "Pattern: MonogramFallback defined locally inside BrowseCard.tsx (not a separate file)"

requirements-completed: [BROWSE-02, BROWSE-03, PHOTO-03]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 38 Plan 01: Browse UI Components Summary

**useBrowse hook + 4 React components (BrowseCard, BrowseRow, SkeletonBrowseCard, SkeletonBrowseRow) providing all building blocks for Netflix-style Browse page with photo/monogram cards, horizontal snap-scroll rows, and animate-pulse skeletons**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T20:45:42Z
- **Completed:** 2026-02-24T20:47:30Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments
- `useBrowse` hook fetches `/api/browse?per_row=10` with AbortController cleanup; exports `BrowseCard`, `BrowseRow`, `BrowseData` TypeScript interfaces matching backend `_serialize_browse_card` shape
- `BrowseCard` glassmorphic card with photo from `photo_url`, `onError` monogram fallback using 6 deterministic brand gradients, dark gradient overlay (not .glass-surface — avoids Pitfall 1 backdrop-filter/overflow:hidden conflict), hover tag reveal + mobile tap-to-expand
- `BrowseRow` horizontal snap-scroll row with fade edge overlays using `var(--aurora-bg)`, hidden scrollbar (cross-browser), See All header link + SeeAllEndCard at scroll end
- `SkeletonBrowseCard` and `SkeletonBrowseRow` matching exact card dimensions with `animate-pulse` for loading state

## Task Commits

Each task was committed atomically:

1. **Task 1: useBrowse hook and BrowseCard component** - `47e6be3` (feat)
2. **Task 2: BrowseRow, SkeletonBrowseCard, SkeletonBrowseRow** - `2c33317` (feat)

**Plan metadata:** (final commit hash recorded after state updates)

## Files Created/Modified
- `frontend/src/hooks/useBrowse.ts` - Data fetching hook for GET /api/browse; exports BrowseCard, BrowseRow, BrowseData interfaces + useBrowse()
- `frontend/src/components/browse/BrowseCard.tsx` - Glassmorphic expert card with photo/monogram, dark overlay, hover/tap expand, mobile second-tap opens profile
- `frontend/src/components/browse/BrowseRow.tsx` - Horizontal snap-scroll row with fade edge overlays, See All header button, SeeAllEndCard
- `frontend/src/components/browse/SkeletonBrowseCard.tsx` - animate-pulse skeleton card matching 160x220 BrowseCard dimensions
- `frontend/src/components/browse/SkeletonBrowseRow.tsx` - Row of N skeleton cards with skeleton header for loading state

## Decisions Made
- Used dark gradient overlay (`from-black/70`) instead of `.glass-surface` for the BrowseCard frosted look — `backdrop-filter` breaks inside `overflow:hidden` (documented Pitfall 1 from research). Dark gradient is the standard Netflix pattern and looks equally polished.
- MonogramFallback uses 6 brand-aligned purple/violet/indigo gradients, color selected deterministically via `charCodeAt(0) % 6` for consistent per-expert color assignment.
- Mobile second-tap on expanded card opens `profile_url` in new tab — most natural "I want more info" interaction per research Open Question 3 recommendation.
- Fade edge overlays use inline CSS `var(--aurora-bg, #f8f7ff)` fallback to match the aurora near-white page background seamlessly.

## Deviations from Plan

None — plan executed exactly as written. All implementation details followed the plan and research specifications precisely.

## Issues Encountered

None — TypeScript compiled with zero errors on first attempt for both tasks. All 5 files created successfully.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

All 5 building block files are ready for Plan 02 (BrowsePage assembly):
- `useBrowse()` returns `{ data, loading, error }` — ready for BrowsePage to consume
- `BrowseCard`, `BrowseRow`, `SkeletonBrowseCard`, `SkeletonBrowseRow` — ready for page-level composition
- `onSeeAll` prop on BrowseRow accepts `(slug: string, title: string) => void` — BrowsePage will pass the navigation handler

No blockers.

---
*Phase: 38-browse-ui*
*Completed: 2026-02-24*
