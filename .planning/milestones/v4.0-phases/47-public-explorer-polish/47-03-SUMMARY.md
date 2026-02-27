---
phase: 47-public-explorer-polish
plan: 03
subsystem: ui
tags: [vaul, media-query, error-handling, retry, responsive]

requires:
  - phase: 47-public-explorer-polish
    provides: "ExpertGrid with parent-controlled state, ExpertCard, resultsSlice, useExplore"
provides:
  - "JS-based conditional render for SageMobileSheet (no desktop portal leak)"
  - "Desktop card click bypasses tap-to-expand, opens profile directly"
  - "Parent-controlled expanded state in ExpertGrid (single card expanded at a time)"
  - "Error state UI with retry mechanism in ExpertGrid"
  - "retryTrigger counter in resultsSlice for re-fetch coordination"
affects: []

tech-stack:
  added: []
  patterns:
    - "useMediaQuery hook for JS-based responsive rendering"
    - "retryTrigger counter pattern for useEffect re-fetch"
    - "Error state with network detection (WifiOff vs AlertCircle)"

key-files:
  created: []
  modified:
    - frontend/src/layouts/RootLayout.tsx
    - frontend/src/components/marketplace/ExpertCard.tsx
    - frontend/src/components/marketplace/ExpertGrid.tsx
    - frontend/src/store/resultsSlice.ts
    - frontend/src/store/index.ts
    - frontend/src/hooks/useExplore.ts

key-decisions:
  - "Used inline useMediaQuery hook in RootLayout instead of shared utility — single use case"
  - "Desktop detection via window.innerWidth >= 768 in click handler (matches Tailwind md: breakpoint)"
  - "Used &apos; entity for apostrophe in error message JSX to avoid lint issues"
  - "Network error detection via keyword matching on error message string"

patterns-established:
  - "Portal-based components (Vaul, Radix) should use JS conditionals, not CSS display:none"
  - "Retry pattern: counter in store + dep array in effect = clean re-fetch trigger"

requirements-completed: [EXP-04, EXP-05, EXP-06]

duration: 5min
completed: 2026-02-27
---

# Plan 47-03: Behavioral Fixes Summary

**JS conditional Sage render, desktop card click bypass, and error retry UI for Explorer grid**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced CSS md:hidden on SageMobileSheet with useMediaQuery JS conditional to prevent Vaul portal from double-mounting on desktop
- Desktop card clicks now open profile directly (skip tap-to-expand); mobile retains two-tap flow
- Lifted expanded state from ExpertCard to ExpertGrid parent — only one card expanded at a time
- Added retryTrigger counter to resultsSlice with retry action
- Wired retryTrigger into useExplore useEffect dep array for re-fetch
- ExpertGrid shows "Oops, something went wrong" error state with Retry button
- Network errors show "Check your connection" variant with WifiOff icon

## Task Commits

1. **Task 1: Fix Sage double-render and desktop card click behavior** - `7ebe5b8` (fix)
2. **Task 2: Add error state with retry to Explorer grid** - `685e7f2` (feat)

## Files Created/Modified
- `frontend/src/layouts/RootLayout.tsx` - useMediaQuery hook, conditional SageMobileSheet render
- `frontend/src/components/marketplace/ExpertCard.tsx` - isExpanded/onExpand props, desktop viewport bypass
- `frontend/src/components/marketplace/ExpertGrid.tsx` - expandedExpertId parent state, error UI with retry
- `frontend/src/store/resultsSlice.ts` - retryTrigger counter and retry action
- `frontend/src/store/index.ts` - exposed retryTrigger and retry in useResultsSlice
- `frontend/src/hooks/useExplore.ts` - retryTrigger in useEffect dep array

## Decisions Made
- Inline useMediaQuery hook vs shared utility — single use case in RootLayout
- window.innerWidth >= 768 matches Tailwind md: breakpoint for desktop detection
- Network error detection via lowercase keyword matching on error string

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three behavioral issues resolved
- Error recovery path available for API failures

---
*Phase: 47-public-explorer-polish*
*Completed: 2026-02-27*
