---
plan: 22-01
phase: 22-visual-infrastructure
status: complete
completed: 2026-02-22
requirements:
  - VIS-01
  - VIS-05
---

# Summary: Plan 22-01 — OKLCH Tokens + Aurora Animation + Glass Surface CSS Foundation

## What Was Built

Two files modified/created to establish the complete CSS foundation for the v2.2 aurora aesthetic.

### frontend/src/index.css (extended)

Added three sections above the existing `.expert-card` block:

**Section 1 — OKLCH Design Tokens (`:root`):**
- `--aurora-bg`: deep purple-tinted near-black base (`oklch(7% 0.020 279)`)
- `--aurora-purple`, `--aurora-violet`, `--aurora-blue`, `--aurora-cyan`, `--aurora-teal`: five blob colors anchored to brand purple `#5128F2 = oklch(49% 0.270 279)`
- `--glass-tint`: brand purple at 8% opacity for glass overlay
- `--glass-border`: white at 10% opacity for glass border
- `--glass-fallback-bg`: opaque dark purple for browsers without backdrop-filter

**Section 2 — Aurora Animation:**
- `@keyframes aurora-drift`: three keyframes (0%/33%/66%/100%) animating `background-position` across 5 gradient layers; 0% and 100% are identical for seamless loop
- `.aurora-bg`: 5-blob radial gradient on `background-image`, `background-size: 200% 200%`, `animation: aurora-drift 20s ease-in-out infinite`, `position: fixed; inset: 0; z-index: -1`
- `.aurora-paused`: `animation-play-state: paused` — toggled by JS on `document.hidden`
- `@media (prefers-reduced-motion: reduce)`: removes animation, freezes gradient at 0% positions

**Section 3 — Glass Surface:**
- `.glass-surface`: `position: relative; background-color: var(--glass-fallback-bg)` as base
- `.glass-surface::before`: `backdrop-filter: blur(4px)` + `-webkit-` prefix, `background-color: var(--glass-tint)`, `pointer-events: none; z-index: -1` — pseudo-element pattern avoids `overflow:hidden` ancestor clipping bug in Chrome
- `@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))`: overrides fallback bg to `transparent`, adds `border: 1px solid var(--glass-border)` for progressive enhancement

Existing `.expert-card` and `.expert-card:hover` rules preserved verbatim.

### frontend/src/components/AuroraBackground.tsx (new)

Thin React wrapper component:
- Renders `<div ref={auroraRef} className="aurora-bg" aria-hidden="true" />` (CSS handles all sizing/positioning)
- `useEffect` adds `visibilitychange` listener — adds `.aurora-paused` on `document.hidden`, removes on visible
- Wraps children in `<div className="relative min-h-screen">` for correct stacking context

## Key Decisions

- **OKLCH alpha values**: Purple blob at 0.35, teal/blue at 0.25-0.30, cyan at 0.20 — provides visible aurora without overwhelming content (per CONTEXT.md "ambiance not feature" guidance)
- **20s animation duration**: Mid-range of the 15-25s spec; slow enough to be ambient, fast enough to feel alive
- **`::before` pseudo-element hack**: Required by Chrome bug where `backdrop-filter` breaks on elements whose ancestors have `overflow:hidden`. FilterSidebar's inner scroll div uses `overflow-y-auto`, so the pseudo-element approach is mandatory to avoid breaking the glass effect
- **`background-position` animation**: GPU-composited, zero repaints — chosen over animating `background-size` or transforms which cause paint work
- **5-blob gradient**: Enough visual complexity to feel aurora-like without excessive rendering cost

## Self-Check

- [x] Build exits 0 (verified twice — after index.css edit, after AuroraBackground.tsx creation)
- [x] `--aurora-bg`, `--glass-tint`, `@keyframes aurora-drift`, `.aurora-bg`, `.aurora-paused`, `.glass-surface`, `.glass-surface::before`, `@supports` all present in index.css
- [x] `.expert-card` and `.expert-card:hover` rules unchanged
- [x] `AuroraBackground` exported from AuroraBackground.tsx
- [x] Single `useEffect` with `visibilitychange` and proper cleanup (`removeEventListener`)
- [x] Committed atomically: `feat(phase-22/01): add OKLCH tokens, aurora animation, and glass-surface CSS foundation`

## Deviations

None. Plan followed exactly as specified.
