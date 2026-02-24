---
phase: 33-command-center-header
plan: "01"
subsystem: ui
tags: [react, framer-motion, zustand, typescript, hooks, animation]

# Dependency graph
requires:
  - phase: 32-sage-direct-search
    provides: isStreaming + sageMode + total in store (PilotSlice, ResultsSlice)
provides:
  - useHeaderSearch hook with debounce, placeholder rotation, tinrate easter egg, store bindings
  - Header.tsx glassmorphic Command Center component with all animations
affects: [33-02, MarketplacePage integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [hook-component split for complex UI logic, useMotionValue+useSpring subscription pattern for animated counters]

key-files:
  created:
    - frontend/src/hooks/useHeaderSearch.ts
    - frontend/src/components/Header.tsx
  modified: []

key-decisions:
  - "Easter egg (tinrate) fires on every match — no one-shot guard, always rewarding"
  - "Placeholder rotation paused when localValue has text (not on focus alone) — via useEffect dep array"
  - "particlePositions stored in useRef to avoid re-generating positions on every render"
  - "springCount subscription returns unsub function used as useEffect cleanup — prevents stale listeners"

patterns-established:
  - "useMotionValue + useSpring + .on('change') subscription pattern for spring-animated display values"
  - "AnimatePresence mode='wait' for crossfading animated placeholders"
  - "Easter egg: clear input + setQuery('') + trigger state booleans, then return early from handleChange"

requirements-completed: [HDR-01, HDR-02, HDR-03]

# Metrics
duration: 15min
completed: 2026-02-22
---

# Phase 33-01: Command Center Header — Hook + Component Summary

**useHeaderSearch hook + glassmorphic Header.tsx with spring count, animated placeholders, isStreaming pulse, and tinrate tilt/particle easter egg**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-22
- **Completed:** 2026-02-22
- **Tasks:** 2
- **Files modified:** 2 (both created new)

## Accomplishments
- `useHeaderSearch.ts` hook: 8-phrase placeholder rotation (4.5s interval, paused on input), 350ms debounced setQuery, tinrate easter egg detection (tilt + particle burst), isStreaming/sageMode/total store bindings, trackEvent on non-empty queries
- `Header.tsx`: sticky glassmorphic panel (backdrop-blur-md, bg-white/70, aurora radial gradient), logo with purple drop-shadow glow, AnimatePresence crossfading placeholders, 1.02 focus scale spring, purple pulse dot while isStreaming, spring-animated expert count via useMotionValue+useSpring subscription, 3-degree tilt spring + emoji particle burst on 'tinrate'
- TypeScript and full Vite production build: 0 errors

## Task Commits

1. **Task 1: Create useHeaderSearch.ts** - `a1285e2` (feat)
2. **Task 2: Create Header.tsx** - `7f60bde` (feat)

## Files Created/Modified
- `frontend/src/hooks/useHeaderSearch.ts` - All header search logic: debounce, placeholder rotation, easter egg, store bindings
- `frontend/src/components/Header.tsx` - Command Center header component with glassmorphism, Framer Motion animations, spring count, Sage pulse

## Decisions Made
- Easter egg fires every time — no one-shot guard, always rewarding per CONTEXT.md
- particlePositions stored in useRef so positions are stable and not regenerated on re-renders
- springCount subscription cleanup via returned unsub function in useEffect to avoid stale listeners
- Placeholder rotation useEffect includes `localValue` in dep array so it re-evaluates pause condition when input changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useHeaderSearch` and `Header` are standalone and fully tested (TypeScript + build pass)
- Plan 33-02 can immediately import `Header` and wire it into MarketplacePage.tsx
- SearchInput.tsx deletion is scoped to Plan 33-02

---
*Phase: 33-command-center-header*
*Completed: 2026-02-22*
