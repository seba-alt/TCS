---
phase: 38-browse-ui
plan: 02
subsystem: ui
tags: [react, framer-motion, motion-react, tailwind, zustand, netflix-browse, hero-carousel]

# Dependency graph
requires:
  - phase: 38-01
    provides: useBrowse hook, BrowseCard, BrowseRow, SkeletonBrowseRow components
  - phase: 36-foundation
    provides: navigationSlice (setNavigationSource, resetFilters), AuroraBackground
  - phase: 37-backend
    provides: /api/browse endpoint with featured + rows data, photo_url proxy

provides:
  - HeroBanner auto-rotating carousel with AnimatePresence fade/slide transitions
  - SkeletonHeroBanner matching-dimension loading placeholder
  - Full BrowsePage assembling all browse components — Netflix-style landing at /
  - Navigation wiring: See All -> /explore?q={title}, Explore All -> /explore

affects: [39-sage-navigation, any phase touching BrowsePage or explore navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HeroBanner uses AnimatePresence mode="wait" with keyed motion.div for seamless expert transitions
    - setNavigationSource('browse') called BEFORE navigate() in same tick — prevents stale navigationSource race
    - Browse data is page-local (useBrowse hook), not Zustand — Zustand only used for cross-page navigation state
    - Deterministic gradient fallback using charCodeAt(0) % palette.length for consistent per-expert color

key-files:
  created:
    - frontend/src/components/browse/HeroBanner.tsx
    - frontend/src/components/browse/SkeletonHeroBanner.tsx
  modified:
    - frontend/src/pages/BrowsePage.tsx

key-decisions:
  - "HeroBanner rotation uses setInterval cleared on paused=true — simpler than RAF, sufficient for 5s cadence"
  - "recently-added slug mapped to 'Recently Joined' display label in BrowsePage (not in hook/backend)"
  - "setNavigationSource('browse') called BEFORE navigate() — maintains Phase 36 pattern for browse navigation"
  - "SkeletonHeroBanner is a single animate-pulse div — matching HeroBanner outer dimensions (h-[180px] md:h-[300px])"

patterns-established:
  - "Navigation pattern: always setNavigationSource(source) before navigate() to prevent stale state race"
  - "Hero banner: AnimatePresence mode='wait' + keyed motion.div for seamless card transitions"
  - "Skeleton parity: skeleton components match exact dimensions of real components (no layout shift)"

requirements-completed: [BROWSE-01, BROWSE-04, NAV-02]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 38 Plan 02: Browse Page Assembly Summary

**HeroBanner auto-rotating carousel (AnimatePresence) + full Netflix-style BrowsePage at / with skeleton loading, hero + category rows, and navigation to Explorer**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T20:50:18Z
- **Completed:** 2026-02-24T20:52:09Z
- **Tasks:** 3 (2 auto + 1 checkpoint, auto-approved)
- **Files modified:** 3

## Accomplishments
- HeroBanner carousel cycles through featured experts every 5s with AnimatePresence fade/slide, pauses on hover, shows expert photo or purple/indigo gradient placeholder with dark readability overlay, "Explore All Experts" CTA, and indicator dots
- SkeletonHeroBanner pulsing placeholder matches HeroBanner dimensions — no layout shift when data loads
- BrowsePage replaces stub: AuroraBackground wrapper, hero + 4 skeleton rows during loading, actual category rows after, gap-12 md:gap-16 (48/64px) premium spacing, error state with reload, "recently-added" -> "Recently Joined" display mapping
- All navigation handlers call `setNavigationSource('browse')` before `navigate()` — preserves Phase 36 sessionSource guard preventing stale resetPilot() calls on Explorer mount

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HeroBanner carousel and SkeletonHeroBanner** - `edc7c40` (feat)
2. **Task 1 (cleanup): Add JSDoc comment to SkeletonHeroBanner** - `de7d41a` (chore)
3. **Task 2: Assemble BrowsePage with hero, rows, skeletons, and navigation** - `b730df4` (feat)
4. **Task 3: Visual verification (auto-approved, auto_advance=true)**

**Plan metadata:** (docs commit — final step)

## Files Created/Modified
- `frontend/src/components/browse/HeroBanner.tsx` — Auto-rotating featured expert carousel with AnimatePresence, pause on hover, photo/gradient fallback, Explore All CTA, indicator dots (110 lines)
- `frontend/src/components/browse/SkeletonHeroBanner.tsx` — Pulsing placeholder matching HeroBanner outer dimensions (10 lines)
- `frontend/src/pages/BrowsePage.tsx` — Full Netflix-style browse page: AuroraBackground, hero, 4 category rows, skeleton loading, error state, navigation handlers (85 lines)

## Decisions Made
- `recently-added` slug mapped to `'Recently Joined'` display label inline in BrowsePage rather than in hook/backend — UI concern, frontend-only change
- SkeletonHeroBanner implemented as single `animate-pulse` div — functionally complete, JSDoc comment added for clarity
- HeroBanner uses `setInterval` cleared on `paused=true` — appropriate for 5s rotation, simpler than requestAnimationFrame

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Browse page fully assembled at `/` — ready for Phase 39 (Sage Cross-Page Navigation)
- All navigation hooks (setNavigationSource, resetFilters) correctly wired for Sage integration
- Hero + rows + skeleton loading complete — no blank areas, premium spacious feel achieved

---
*Phase: 38-browse-ui*
*Completed: 2026-02-24*
