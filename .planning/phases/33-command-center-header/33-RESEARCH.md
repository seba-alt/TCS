# Phase 33: Command Center Header - Research

**Researched:** 2026-02-22
**Domain:** React / Framer Motion (motion/react v12) / Tailwind v3 / Zustand / glassmorphism UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Search bar role:**
- Header search bar **replaces** the sidebar `SearchInput.tsx` — removes that component entirely from the sidebar
- Sidebar layout starts directly with rate slider + tags (no search row)
- Header search is `max-w-2xl centered` — floating feel, breathing room on wide screens
- Controlled input: reads `store.query`, writes `store.setQuery` on change
- Expert count remains in FilterChips only (not duplicated in header)

**Visual intensity:**
- `backdrop-blur-md bg-white/70 border-b border-white/20` — noticeable glass, balanced
- Aurora radial gradient: **moderate 8-10% opacity** — visible warmth, purple-to-deep-blue bloom at top-right corner
- Logo glow: `drop-shadow-[0_0_15px_rgba(139,92,246,0.30)]` — soft purple halo
- Aurora background motion: **Claude's discretion** — pick what's tasteful alongside search bar and Sage pulse animations

**Placeholder animation:**
- Style: **fade crossfade** — one fades out, next fades in (Framer Motion AnimatePresence)
- Timing: **4-5 second** interval between rotations
- Pause logic: pause rotation when input has any text (not on focus alone)
- Quantity: **6-8 phrases**, Claude writes them — playful, brand-aligned, varied

**Easter egg:**
- Trigger: typing **"tinrate"** exactly in the header search bar
- Effects: 3-degree header tilt **+ small floating star/emoji particles burst from logo corner for ~1s**
- Post-trigger: input is cleared ("consumed")
- Frequency: fires **every time** "tinrate" is typed — always rewarding

### Claude's Discretion
- Aurora background animation (static vs very slow drift) — pick what's tasteful
- Exact star/emoji particle emoji choice and count
- Framer Motion spring/easing values for tilt and scale animations
- Error state for search input

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HDR-01 | Glassmorphic header — `backdrop-blur-md bg-white/70` with aurora radial gradient backdrop; sticky top-0, grid scrolls visibly underneath | Glass pattern from `index.css` `.glass-surface`, Tailwind arbitrary gradient syntax verified, `sticky top-0 z-50` replaces current `fixed` positioning |
| HDR-02 | Animated search bar — rotating playful placeholders, scale-1.02 focus via Framer Motion, Sage-in-flight pulse glow, controlled input reads from `store.query` | `AnimatePresence mode="wait"` pattern confirmed (see `EverythingIsPossible.tsx`), `motion/react` exports verified, `isStreaming` is the correct Sage-in-flight signal |
| HDR-03 | Expert count spring animation + easter egg — count reads `store.total` with spring transition; typing trigger phrase causes 3-degree header tilt | `useMotionValue` + `useSpring` confirmed in `motion/react` v12.34.3, `motion.header` confirmed, `store.total` lives in `resultsSlice` |
</phase_requirements>

---

## Summary

Phase 33 transforms the marketplace page header from a minimal inline `<header>` element into a premium "Command Center" with glassmorphism, animated search, and interactive easter eggs. The implementation is contained in the `/marketplace` route — specifically `MarketplacePage.tsx` which currently owns the header JSX inline. The architecture decision is: extract the header block into a proper `Header.tsx` component (replacing the legacy chat-only `Header.tsx`) or refactor in-place. Given the CONTEXT.md constraint of "Header.tsx is the only file modified", the correct approach is to repurpose `Header.tsx` as the new marketplace header, import it into `MarketplacePage.tsx`, and remove the inline header there.

The Motion library installed is `motion` v12.34.3 (the renamed successor to `framer-motion`), imported as `from 'motion/react'`. This is already in use throughout the project — `AnimatePresence`, `motion`, `useMotionValue`, `useSpring`, and `useTransform` are all confirmed exports. The existing `EverythingIsPossible.tsx` component demonstrates the exact `AnimatePresence mode="wait"` crossfade pattern needed for placeholder rotation. The `SageFAB.tsx` demonstrates the spring + boxShadow glow pattern needed for the Sage pulse indicator.

The critical "Sage in-flight" signal for the pulse glow is `isStreaming` (from `pilotSlice`), NOT `sageMode` (from `resultsSlice`). `sageMode` indicates "results were injected by Sage" (a persistent mode), while `isStreaming` indicates "a Sage API call is currently executing" (the actual in-flight state). The architecture notes in the phase description say "sageMode transitioning" but the correct Zustand field is `store.isStreaming`.

**Primary recommendation:** Build `Header.tsx` as the new Command Center component, import it into `MarketplacePage.tsx` replacing the existing inline `<header>`, and extract all hook logic into `useHeaderSearch.ts` as specified.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion/react | 12.34.3 (installed) | AnimatePresence, motion.header, useMotionValue, useSpring | Already used throughout project — zero new dependency |
| zustand | 5.0.11 (installed) | Read store.query, store.total, store.isStreaming, store.sageMode | Project store — no alternative |
| tailwindcss | 3.4.19 (installed) | Glassmorphism classes, arbitrary values for radial gradient | Project CSS framework |
| lucide-react | 0.575.0 (installed) | Search icon in search bar | Already used in sidebar components |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react (useState, useEffect, useRef) | 19.2.0 | Local state for placeholder index, easter egg detection | For non-animated state and timers |
| motion/react (useTransform) | 12.34.3 | Transform spring value to display string for count | If raw number needs string formatting |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion/react AnimatePresence | CSS transitions only | AnimatePresence handles unmount animations that CSS cannot (element must stay in DOM during exit) |
| useMotionValue + useSpring for count | useState + CSS transition | Spring physics gives natural overshoot feel; useSpring is built for this |
| Tailwind arbitrary radial-gradient | Inline style | Tailwind arbitrary values work in v3, but inline style is cleaner for the radial gradient since it's a one-off complex string |

**Installation:** No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### File Structure

```
frontend/src/
├── components/
│   ├── Header.tsx              # REWRITTEN: Command Center header (replaces chat-only stub)
│   └── sidebar/
│       ├── FilterSidebar.tsx   # MODIFIED: Remove SearchInput import/usage
│       └── SearchInput.tsx     # DELETED: Moved to Header.tsx
├── hooks/
│   └── useHeaderSearch.ts      # NEW: All header search logic extracted here
└── pages/
    └── MarketplacePage.tsx     # MODIFIED: Import Header, remove inline <header> block
```

### Pattern 1: AnimatePresence Placeholder Rotation (exact project pattern)

**What:** Cycle through placeholder phrases with a fade crossfade using `AnimatePresence mode="wait"`. The key prop forces remount on every phrase change, triggering exit + enter animations.

**When to use:** When text content changes require exit animation before new content enters.

**Example (adapted from EverythingIsPossible.tsx — same project):**
```typescript
// Source: frontend/src/components/sidebar/EverythingIsPossible.tsx (verified)
import { AnimatePresence, motion } from 'motion/react'

// In useHeaderSearch.ts:
const PLACEHOLDERS = [
  'Find a fintech strategist…',
  'Who builds Stripe integrations?',
  'Need a fractional CTO for a week?',
  'Show me healthcare product experts…',
  'Which consultant actually ships?',
  'Find someone who\'s done this before…',
  'Looking for a Berlin-based advisor…',
  'Who knows Shopify like their backyard?',
]
const [placeholderIndex, setPlaceholderIndex] = useState(0)

// Pause when query has text
useEffect(() => {
  if (query) return  // pause — input has text
  const id = setInterval(() => {
    setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length)
  }, 4500)
  return () => clearInterval(id)
}, [query])

// In JSX — the placeholder is a visually-positioned overlay, not the real input placeholder attr:
<AnimatePresence mode="wait">
  <motion.span
    key={placeholderIndex}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none select-none"
  >
    {PLACEHOLDERS[placeholderIndex]}
  </motion.span>
</AnimatePresence>
```

**Note:** Use a custom `span` overlay for animated placeholder (not the native `placeholder` attr), shown only when `!localValue`. This avoids CSS-only crossfade limitations and works with controlled inputs.

### Pattern 2: motion.header with Spring Rotate (easter egg tilt)

**What:** Use `motion.header` with a `useMotionValue` for rotation + `useSpring` for physics, and `animate` directly via `.set()`.

**When to use:** When an element needs a one-shot spring animation triggered imperatively (not via gesture).

**Example:**
```typescript
// Source: motion.dev API verified (useMotionValue + useSpring in motion/react v12)
import { motion, useMotionValue, useSpring } from 'motion/react'

const rotateX = useMotionValue(0)
const rotate = useSpring(rotateX, { stiffness: 300, damping: 20 })

function triggerTilt() {
  rotateX.set(3)  // tilt to 3 degrees
  setTimeout(() => rotateX.set(0), 800)  // reset after 800ms
}

// In JSX:
<motion.header style={{ rotate }} className="...">
  ...
</motion.header>
```

### Pattern 3: Scale on Focus via Framer Motion

**What:** Wrap the search bar container in a `motion.div` and use `whileFocus` or state-driven `animate` to scale to 1.02.

**When to use:** When a non-input element (container) needs to react to focus events on a child input.

**Example:**
```typescript
// Source: motion/react v12 API — whileFocus prop on motion.div
import { motion } from 'motion/react'

// Option A: whileFocus on the motion.div wrapping the input (only triggers when div itself has focus)
// Option B (PREFERRED for container): Track focus state with useState + animate prop
const [isFocused, setIsFocused] = useState(false)

<motion.div
  animate={{ scale: isFocused ? 1.02 : 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
  <input
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
    ...
  />
</motion.div>
```

### Pattern 4: Sage In-Flight Pulse Glow

**What:** Animated opacity or boxShadow pulse left of search icon, driven by `isStreaming` (not `sageMode`).

**When to use:** While `store.isStreaming === true` — Sage API call in flight.

**Example (adapted from SageFAB.tsx glow pattern):**
```typescript
// Source: frontend/src/components/pilot/SageFAB.tsx (verified)
const isStreaming = useExplorerStore((s) => s.isStreaming)

// Simple animate-pulse with conditional opacity:
<motion.div
  animate={{ opacity: isStreaming ? 1 : 0 }}
  transition={{ duration: 0.3 }}
  className="w-2 h-2 rounded-full bg-brand-purple animate-pulse"
  aria-hidden="true"
/>
```

### Pattern 5: Expert Count Spring (store.total)

**What:** `useMotionValue` tracks the raw number, `useSpring` adds physics, display value formatted via `useTransform` or rounded via `Math.round` in a subscriber.

**When to use:** When a numeric value changes and should animate smoothly to new value.

**Example:**
```typescript
// Source: motion.dev/docs/react-use-spring (verified: useSpring accepts initial value)
import { useMotionValue, useSpring, useTransform, motion } from 'motion/react'
import { useEffect } from 'react'

const rawCount = useMotionValue(total)
const springCount = useSpring(rawCount, { stiffness: 200, damping: 25 })
const displayCount = useTransform(springCount, (v) => Math.round(v))

// Sync when store.total changes:
useEffect(() => {
  rawCount.set(total)
}, [total, rawCount])

// In JSX — use motion.span with style:
<motion.span style={{ display: 'inline-block' }}>
  {/* Read springCount as text — must use a subscriber */}
  <Counter value={springCount} />
</motion.span>
```

**IMPORTANT:** `useTransform` returns a `MotionValue<number>`, not a React state value. To display it as text, you need `useMotionValueEvent` or a `motion.span` with `textContent` bound via `style`, or a `useEffect` that subscribes. The simplest approach is a small `AnimatedCount` component using `motion.span` with `style={{ ['--n' as string]: springCount }}` + CSS `counter-set`, or subscribe via `springCount.on('change', ...)`. The most idiomatic approach for this use case: use a small local `useState` + `springCount.on('change', cb)` to drive a React number state.

### Pattern 6: Easter Egg Particle Burst

**What:** On "tinrate" trigger, render 5-8 emoji spans that animate from logo corner with random trajectories, fade out in ~1s, then unmount.

**When to use:** After easter egg phrase is detected in input.

**Example:**
```typescript
// Source: motion.dev AnimatePresence pattern (verified concept)
const [showParticles, setShowParticles] = useState(false)

// In JSX:
<AnimatePresence>
  {showParticles && (
    <>
      {['⭐','✨','🌟','💫','⭐','✨'].map((emoji, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{
            opacity: 0,
            x: (Math.random() - 0.5) * 80,
            y: -60 - Math.random() * 40,
            scale: 0.5,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
          className="absolute pointer-events-none text-lg z-50"
          style={{ left: logoRef.current?.offsetLeft, top: 0 }}
          onAnimationComplete={() => { if (i === 5) setShowParticles(false) }}
        >
          {emoji}
        </motion.span>
      ))}
    </>
  )}
</AnimatePresence>
```

**Note:** `Math.random()` in `animate` prop is not reactive — it generates on render, which is fine for a one-shot trigger. Use `useRef` to pre-generate positions to avoid recalculation.

### Pattern 7: Glassmorphism Header (Tailwind v3)

**What:** Tailwind v3 arbitrary value syntax for the scoped radial gradient layer + standard backdrop-blur classes.

**When to use:** This phase's header background.

**Example:**
```tsx
// Source: Tailwind v3 arbitrary values — project already uses this pattern
<motion.header
  style={{ rotate }}
  className={[
    'sticky top-0 z-50',
    'backdrop-blur-md bg-white/70 border-b border-white/20',
    'bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.09),_transparent_60%)]',
    'px-6 py-3',
    'flex items-center gap-6',
  ].join(' ')}
>
```

**Note:** Tailwind v3 supports `bg-[radial-gradient(...)]` arbitrary values. The `_` replaces spaces in arbitrary value syntax. Both `bg-white/70` (base) and `bg-[radial-gradient(...)]` can coexist — Tailwind generates separate `background-color` and `background-image` properties. But to layer both, inline style or a CSS layer approach may be needed since Tailwind `bg-*` and `bg-[image]` compete for the same `background` property. **Safe solution:** use `style` for the gradient and Tailwind for the rest (see Anti-Patterns).

### Anti-Patterns to Avoid

- **Two Tailwind bg-* classes competing:** `bg-white/70` sets `background-color`; `bg-[radial-gradient(...)]` sets `background-image`. These actually DON'T conflict because CSS `background-color` and `background-image` are separate properties — both work together natively. This is safe.
- **Using `sageMode` for the pulse indicator:** `sageMode` indicates "results are from Sage" (persistent). The in-flight pulse should use `isStreaming` (transient during API call). Using `sageMode` would leave the pulse on permanently after a Sage search.
- **Mutating `store.query` directly in the easter egg handler:** The easter egg should clear `localValue` (local state) and call `store.setQuery('')` if current query is empty, or clear input without calling setQuery (the input is "consumed" per CONTEXT.md, meaning the easter egg phrase is not committed as a search query).
- **Using `placeholder` HTML attr for animated text:** The native `placeholder` attribute cannot be cross-faded with Framer Motion. Use an absolutely-positioned `<span>` overlay instead, shown only when `!localValue`.
- **Using `Math.random()` inside AnimatePresence exit:** Exit animations are captured at unmount time. Pre-generate particle positions in a `useRef` array.
- **`motion.header` breaking sticky positioning:** `motion.header` renders as `<header>` with transform styles. `sticky` positioning in CSS is not broken by `transform: rotate()` when the transform value is 0 (identity). However, an active non-identity transform on a sticky element CAN break stacking. Since the tilt is brief (800ms), this is acceptable. Use `will-change: transform` on the header to hint the browser.
- **Importing from 'framer-motion':** This project uses `motion` v12, imported as `from 'motion/react'`. Never use `from 'framer-motion'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring-physics number animation | Custom timer-based interpolation | `useMotionValue` + `useSpring` from motion/react | Physics simulation handles velocity, overshoot, and chaining automatically |
| Exit animation for placeholder text | CSS opacity transition on conditional render | `AnimatePresence mode="wait"` with `exit` prop | React unmounts elements immediately without AnimatePresence; exit animations are impossible without it |
| Crossfade with `display:none` toggle | Absolute positioning hacks | `AnimatePresence` handles DOM presence + animation together | Correct lifecycle management, handles React 19 concurrent mode |
| Glassmorphism backdrop filter | Custom CSS class | Project's existing `glass-surface` CSS class in `index.css` | Already handles the `overflow:hidden` ancestor bug via `::before` pseudo-element |

**Key insight:** The project already has a well-designed glass surface system (`glass-surface` CSS class). The header CAN use this class, though the CONTEXT.md specifies direct Tailwind classes (`backdrop-blur-md bg-white/70`). The direct Tailwind approach is fine for the header since it is `position:sticky` (not inside an `overflow:hidden` ancestor), making the `::before` workaround unnecessary.

---

## Common Pitfalls

### Pitfall 1: Wrong Sage Signal for Pulse Indicator
**What goes wrong:** Using `sageMode` (from `resultsSlice`) for the pulse glow makes it stay on permanently after every Sage search result is loaded.
**Why it happens:** `sageMode` is a persistent results-mode flag; `isStreaming` is the transient in-flight flag.
**How to avoid:** Use `useExplorerStore((s) => s.isStreaming)` for the pulse glow.
**Warning signs:** Pulse never turns off after first Sage query.

### Pitfall 2: Header Already Exists Inline in MarketplacePage.tsx
**What goes wrong:** Modifying only `Header.tsx` and not updating `MarketplacePage.tsx` results in no visible change on the `/marketplace` route.
**Why it happens:** The existing `Header.tsx` is only used by the legacy `/chat` route (`App.tsx`). The marketplace has its own inline `<header>` block at lines 100-114 of `MarketplacePage.tsx`.
**How to avoid:** The plan MUST include:
  1. Rewriting `Header.tsx` as the new Command Center component
  2. Updating `MarketplacePage.tsx` to `import Header from '../components/Header'` and replacing the inline `<header>` block with `<Header />`
  3. Keeping `App.tsx` intact (or noting that `Header.tsx` changes will affect the `/chat` route — coordinate if needed)
**Warning signs:** Header visually unchanged on `/marketplace`, only `/chat` route looks different.

### Pitfall 3: SearchInput Removal Requires Three Touchpoints
**What goes wrong:** Removing `SearchInput` only from `FilterSidebar.tsx` misses the import in `MarketplacePage.tsx`.
**Why it happens:** `SearchInput` is imported in `MarketplacePage.tsx` (not `FilterSidebar.tsx` — the sidebar currently does NOT render SearchInput). The marketplace inline header renders it.
**How to avoid:** Remove `SearchInput` import from `MarketplacePage.tsx`. Then delete `SearchInput.tsx` or leave it as dead code until confirmed working. Files to touch: `MarketplacePage.tsx` (remove import + usage), `SearchInput.tsx` (delete per CONTEXT.md).
**Warning signs:** TypeScript unused import warning in `MarketplacePage.tsx`.

### Pitfall 4: Placeholder Flicker on Route Change
**What goes wrong:** Placeholder rotation timer resets every time the header re-mounts, causing index to jump to 0.
**Why it happens:** `useState(0)` initializes to 0 on every mount.
**How to avoid:** This is acceptable behavior (not a bug per se), but to fully prevent "flicker" (the CONTEXT.md says "no flicker on route change"), ensure the interval cleanup happens correctly via `useEffect` return. The pause-on-text logic handles the main concern. `useRef` for the interval ID is cleaner than `useState`.
**Warning signs:** Placeholder always shows the first phrase after navigation.

### Pitfall 5: Easter Egg Clears Query State Incorrectly
**What goes wrong:** Calling `store.setQuery('')` after the easter egg clears active filter state and triggers a grid refetch.
**Why it happens:** `setQuery` in `filterSlice` calls `setSageMode(false)` and updates the store, triggering `useExplore`.
**How to avoid:** Only clear `localValue` (the local input state). Only call `store.setQuery('')` if the store's current query is already empty (i.e., the user typed "tinrate" into an otherwise empty search bar). If the user had typed "fintech tinrate", the easter egg phrase should be detected within the value, the input cleared to empty, and `store.setQuery('')` called to also clear the committed query. The CONTEXT.md says "input is cleared" which implies both local and store.
**Warning signs:** Easter egg clears search results on every trigger even when user had active search.

### Pitfall 6: useMotionValue + useSpring for Count Display
**What goes wrong:** Trying to render `springCount` directly as JSX text (`{springCount}`) — MotionValues are not React state and don't trigger re-renders when displayed this way.
**Why it happens:** MotionValue is a signal-like object, not a React state atom.
**How to avoid:** Use one of these patterns:
  - `motion.span` with `style={{ /* not applicable for text */ }}` — does not work for text nodes
  - Subscribe: `useEffect(() => springCount.on('change', v => setDisplayCount(Math.round(v))), [])` + render `displayCount` (a regular `useState`)
  - `useMotionValueEvent(springCount, 'change', (v) => setDisplayCount(Math.round(v)))` — cleanest
**Warning signs:** Count shows `[object Object]` or static value that never updates.

---

## Code Examples

Verified patterns from official sources and project codebase:

### useHeaderSearch.ts — Core Hook Shape

```typescript
// Source: adapted from SearchInput.tsx + EverythingIsPossible.tsx (project verified)
import { useState, useEffect, useRef } from 'react'
import { useExplorerStore } from '../store'
import { trackEvent } from '../tracking'

const PLACEHOLDERS = [
  'Find a fintech strategist…',
  'Who builds Stripe integrations?',
  'Need a fractional CTO for a week?',
  'Show me healthcare product experts…',
  'Which consultant actually ships?',
  'Find someone who\'s done this before…',
  'Looking for a Berlin-based advisor…',
  'Who knows Shopify like their backyard?',
]

const DEBOUNCE_MS = 350
const EASTER_EGG_PHRASE = 'tinrate'

export function useHeaderSearch() {
  const query = useExplorerStore((s) => s.query)
  const setQuery = useExplorerStore((s) => s.setQuery)
  const total = useExplorerStore((s) => s.total)
  const isStreaming = useExplorerStore((s) => s.isStreaming)
  const sageMode = useExplorerStore((s) => s.sageMode)

  const [localValue, setLocalValue] = useState(query)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [tiltActive, setTiltActive] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local value when store changes externally
  useEffect(() => { setLocalValue(query) }, [query])

  // Placeholder rotation — pause when input has text
  useEffect(() => {
    if (localValue) return
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length)
    }, 4500)
    return () => clearInterval(id)
  }, [localValue])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value

    // Easter egg detection
    if (value.toLowerCase().trim() === EASTER_EGG_PHRASE) {
      setLocalValue('')
      setQuery('')
      setTiltActive(true)
      setShowParticles(true)
      setTimeout(() => setTiltActive(false), 800)
      setTimeout(() => setShowParticles(false), 1000)
      return
    }

    setLocalValue(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setQuery(value)
      if (value.trim().length > 0) {
        void trackEvent('filter_change', { filter: 'query', value: value.trim() })
      }
    }, DEBOUNCE_MS)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      setQuery(localValue)
    }
  }

  return {
    localValue,
    handleChange,
    handleKeyDown,
    placeholderIndex,
    placeholders: PLACEHOLDERS,
    total,
    isStreaming,
    sageMode,
    tiltActive,
    showParticles,
  }
}
```

### AnimatedCount Component (useMotionValueEvent pattern)

```typescript
// Source: motion/react v12 — useMotionValueEvent hook (verified available)
import { useEffect, useState } from 'react'
import { useMotionValue, useSpring } from 'motion/react'

function useSpringCount(target: number) {
  const raw = useMotionValue(target)
  const spring = useSpring(raw, { stiffness: 200, damping: 25 })
  const [display, setDisplay] = useState(target)

  useEffect(() => { raw.set(target) }, [target, raw])

  useEffect(() => {
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [spring])

  return display
}
```

### motion.header Structure

```typescript
// Source: motion/react v12 API — motion.header confirmed available (verified via node -e)
import { motion, useMotionValue, useSpring } from 'motion/react'

// In Header component:
const rotateX = useMotionValue(0)
const rotate = useSpring(rotateX, { stiffness: 300, damping: 20 })

// Trigger from useHeaderSearch tiltActive:
useEffect(() => {
  if (tiltActive) {
    rotateX.set(3)
  } else {
    rotateX.set(0)
  }
}, [tiltActive, rotateX])

return (
  <motion.header
    style={{ rotate }}
    className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/20 px-6 py-3 flex items-center gap-6"
  >
    {/* radial gradient as inline style — avoids Tailwind bg conflict concerns */}
    ...
  </motion.header>
)
```

---

## Critical Architectural Discovery

### Header File Routing Reality

The existing `Header.tsx` is currently used ONLY by `App.tsx` (the `/chat` legacy route). The `/marketplace` route (`MarketplacePage.tsx`) has its own inline `<header>` block at lines 100-114:

```tsx
// MarketplacePage.tsx lines 100-114 (CURRENT — must be replaced)
<header
  className="hidden md:flex items-center gap-6 px-6 py-3 border-b border-black/8 shrink-0 sticky top-0 z-10"
  style={{ background: 'oklch(98% 0.008 279 / 0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
>
  <img src="/logo.png" alt="Tinrate" className="h-8 w-auto shrink-0" ... />
  <div className="flex-1 max-w-lg">
    <SearchInput />
  </div>
</header>
```

**Plan must include:**
1. Rewrite `Header.tsx` as the Command Center component (accepts no props — reads directly from store)
2. `MarketplacePage.tsx`: Remove inline `<header>` block, add `import Header from '../components/Header'`, render `<Header />` in its place
3. `MarketplacePage.tsx`: Remove `SearchInput` import
4. `FilterSidebar.tsx`: SearchInput is NOT currently used here (already excluded from sidebar) — no change needed to `FilterSidebar.tsx`
5. `SearchInput.tsx`: Delete file (per CONTEXT.md — "removes that component entirely from the sidebar")
6. `App.tsx`: Will now see the new `Header.tsx` (Command Center) — this may be intentional or require the old `/chat` route to get a different header stub. **Coordinate this: `/chat` probably should not show the Command Center header.** Resolution: rename old `Header.tsx` first to `ChatHeader.tsx` (used by App.tsx), then build new `Header.tsx` (used by MarketplacePage.tsx).

### SearchInput Features That Migrate to useHeaderSearch.ts

The existing `SearchInput.tsx` has these features that must be preserved or removed:

| Feature | Action |
|---------|--------|
| Debounced `setQuery` (350ms) | MIGRATE to useHeaderSearch.ts |
| Sage mode confirmation modal | REMOVE — CONTEXT.md says header search exits sage mode via `store.setQuery` (which calls `setSageMode(false)`) |
| Autocomplete suggestions dropdown | EVALUATE — not mentioned in CONTEXT.md; likely REMOVE for simplicity |
| Barrel roll easter egg (existing) | REPLACE with "tinrate" easter egg |
| `store.query` controlled input | MIGRATE (same pattern) |
| Track filter_change events | MIGRATE |

The Sage confirmation (`showSageConfirm`, `pendingQuery`) is a complex interaction pattern in `SearchInput.tsx`. The CONTEXT.md does NOT mention preserving it for the header search. Given that `store.setQuery` already calls `setSageMode(false)` via `filterSlice`, the header search can simply set the query directly without a confirmation modal — sage mode exits automatically.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` import | `motion/react` import | Motion v11/v12 rename | All project files already use correct `from 'motion/react'` |
| `useAnimation()` hook | `animate` prop with direct values | Motion v10+ | `useAnimation` is legacy; direct prop control is preferred |
| `motion.div` for all elements | `motion.header`, `motion.span`, etc. | Motion v1+ | Every HTML element has a motion equivalent — use semantic elements |

**Current versions (installed, verified):**
- `motion`: 12.34.3 (imported as `motion/react`)
- `react`: 19.2.0
- `tailwindcss`: 3.4.19
- `zustand`: 5.0.11

---

## Open Questions

1. **Does `/chat` route (App.tsx) need a separate header?**
   - What we know: `Header.tsx` is currently used by both `/chat` (`App.tsx`) — once it becomes the Command Center, `/chat` will render the full search bar and glassmorphism.
   - What's unclear: Is the `/chat` route still used / is it user-facing?
   - Recommendation: Check with user OR rename existing `Header.tsx` to `LegacyChatHeader.tsx` first, create new `Header.tsx` for marketplace only. The simplest safe choice: since the root `/` redirects to `/marketplace`, the `/chat` route is a legacy/dev path — applying the new header there is acceptable and harmless.

2. **Autocomplete suggestions in new header search?**
   - What we know: `SearchInput.tsx` fetches autocomplete from `/api/suggest`. CONTEXT.md does not mention this feature for the header.
   - What's unclear: Should autocomplete be preserved?
   - Recommendation: Omit for now — CONTEXT.md scope does not mention it. Can be added in a follow-up without rework.

3. **Mobile header — hidden md:flex pattern?**
   - What we know: Current marketplace header is `hidden md:flex` (desktop only). Mobile uses `MobileFilterSheet`.
   - What's unclear: Does the Command Center header appear on mobile?
   - Recommendation: Match existing pattern — `hidden md:flex` for the glassmorphic header; mobile toolbar row stays as-is.

---

## Sources

### Primary (HIGH confidence)
- `/Users/sebastianhamers/Documents/TCS/frontend/src/components/sidebar/EverythingIsPossible.tsx` — AnimatePresence mode="wait" crossfade pattern (exact implementation in project)
- `/Users/sebastianhamers/Documents/TCS/frontend/src/components/pilot/SageFAB.tsx` — motion.div boxShadow animation + glow pattern
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/resultsSlice.ts` — confirmed `total`, `sageMode`, `isStreaming` field locations
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/pilotSlice.ts` — confirmed `isStreaming` as in-flight signal
- `/Users/sebastianhamers/Documents/TCS/frontend/src/pages/MarketplacePage.tsx` — confirmed inline header block at lines 100-114 (the actual target)
- `/Users/sebastianhamers/Documents/TCS/frontend/src/main.tsx` — routing confirmed: `/marketplace` → `MarketplacePage`, `/chat` → `App` (uses `Header.tsx`)
- `node -e` verification — `motion/react` exports confirmed: `motion`, `AnimatePresence`, `useMotionValue`, `useSpring`, `useTransform`, `useMotionTemplate`; `motion.header` type: object (valid)
- `/Users/sebastianhamers/Documents/TCS/frontend/tailwind.config.ts` — `brand.purple: '#5128F2'` token confirmed; Tailwind v3.4.19
- `/Users/sebastianhamers/Documents/TCS/frontend/src/index.css` — OKLCH tokens, `.glass-surface` pattern, aurora CSS

### Secondary (MEDIUM confidence)
- motion.dev/docs/react-use-spring — useSpring API: accepts initial value + spring config `{ stiffness, damping, mass }` or `{ duration, bounce }`; `.set()` triggers spring animation
- motion.dev/docs/react-motion-value — useMotionValue: creates signal-like value; `.on('change', cb)` for subscribing
- motion.dev/docs/react-animation — AnimatePresence: keeps elements in DOM during exit animation; `mode="wait"` waits for exit before entering

### Tertiary (LOW confidence)
- N/A — all critical claims verified via project codebase or official docs

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified via node_modules + package.json
- Architecture: HIGH — actual source files read and routing traced
- Pitfalls: HIGH — based on reading actual code, not speculation
- Motion API patterns: MEDIUM — official docs confirm API shape, but code examples adapted from project patterns

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (motion v12 API stable; Tailwind v3 stable)
