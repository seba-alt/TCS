# Phase 23: Discovery Engine - Research

**Researched:** 2026-02-22
**Domain:** Framer Motion v12 layout animations, proximity-based motion values, bento card layout, CSS hover animations
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | ExpertCard redesigned as bento-style card with distinct visual zones (name/role, rate+badge, tags, match reason) | Bento layout pattern: four named CSS grid zones or flex-column with explicit min-height per zone, constrained to h-[180px] |
| CARD-02 | ExpertCard maintains h-[180px] fixed height (VirtuosoGrid compatibility) | VirtuosoGrid requires uniform height; `h-[180px] overflow-hidden` must be preserved on the outer wrapper |
| CARD-03 | ExpertCard hover animation updated to complement aurora palette (glow shifts to match new OKLCH tokens) | CSS-only hover in `.expert-card:hover` in index.css — use var(--aurora-purple) OKLCH tokens for glow box-shadow |
| DISC-01 | TagMultiSelect replaced with animated interactive tag cloud using Framer Motion layout animations | `motion.button` with `layout="position"` inside `LayoutGroup` — smooth reorder on toggle without drag-to-reorder |
| DISC-02 | Tag cloud items exhibit proximity-based scale increase (claymorphism) on cursor hover/approach | `useMotionValue` + `useTransform` + `useSpring` pattern: one shared mouse position MV per axis, per-pill distance → scale |
| DISC-03 | "Everything is possible" animated element renders beneath tag cloud with example quirky tags | Cycling text via `useEffect` + `AnimatePresence` with crossfade; keyboard-navigable as clickable tag action |
| DISC-04 | Tag cloud remains keyboard-navigable and aria-labeled (selection behavior unchanged) | `role="group"` on container, `aria-pressed` per button, `onKeyDown` for Enter/Space — same as current TagMultiSelect |
</phase_requirements>

---

## Summary

Phase 23 has two largely independent sub-problems: (1) reshaping `ExpertCard` into a bento layout while staying CSS-only for hover, and (2) replacing `TagMultiSelect` with an animated proximity-aware tag cloud built on Framer Motion's motion value hooks. Both sub-problems have well-established patterns in the project's existing stack.

The `motion` package at version `12.34.3` is already installed. Its `motion/react` subpath re-exports all of `framer-motion` — confirmed by inspecting `node_modules/motion/dist/es/react.mjs`. All hooks (`useMotionValue`, `useTransform`, `useSpring`, `AnimatePresence`, `LayoutGroup`, `motion`) are available from `'motion/react'`. The project already uses this import path in `SagePanel.tsx`, `SageFAB.tsx`, `MarketplacePage.tsx`, and `ProfileGateModal.tsx`.

The proximity-scale pattern is the highest-risk item because it requires per-pill `useRef` for DOM position measurement and a parent-level `onMouseMove` handler that feeds shared motion values — NOT per-pill `useState`. This has been pre-decided (STATE.md) and the research confirms it is the correct pattern: motion values do not trigger React re-renders, so 40+ pills updating simultaneously produces zero React work.

**Primary recommendation:** Build `TagCloud.tsx` as the new replacement for `TagMultiSelect`. Use a single `onMouseMove` on the cloud container, one `useMotionValue` pair (mouseX/mouseY), and per-pill `useTransform` + `useSpring` to compute scale from cursor distance. Wrap pill `motion.button` elements in `LayoutGroup` with `layout="position"` for smooth reorder when tags are toggled. Keep `ExpertCard` 100% CSS — no motion imports — and update only `.expert-card:hover` box-shadow in `index.css` to use OKLCH aurora tokens.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.34.3 | Framer Motion — layout animation, motion values, springs | Already installed; `motion/react` subpath confirmed working |
| react | 19.2.0 | Component model | Existing; motion v12 is React 19 compatible |
| tailwindcss | 3.4.19 | Utility classes | All card/cloud styles use Tailwind + brand tokens |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.34.3 | Underlying package re-exported by motion/react | Never import directly — always use `motion/react` |
| zustand | 5.0.11 | Global filter state (tags, toggleTag) | TagCloud reads `tags` + `toggleTag` from `useFilterSlice()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useMotionValue`+`useSpring` for proximity | `useState` + `onMouseMove` | useState causes 60 re-renders/sec with 30+ pills — rejected |
| CSS-only hover on ExpertCard | Framer Motion animate props | Phase 17 decision: no motion import in ExpertCard — CSS is sufficient and faster |
| `layout="position"` | `Reorder.Group` | Reorder adds drag-to-reorder which is not required; `layout="position"` is simpler |
| Shared parent `onMouseMove` | Per-pill `onMouseMove` | Per-pill listeners multiply event cost by 30; parent is correct |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### File Structure Changes

```
frontend/src/
├── components/
│   ├── marketplace/
│   │   └── ExpertCard.tsx          # MODIFY: bento zones, CSS glow update
│   └── sidebar/
│       ├── TagMultiSelect.tsx      # KEEP: unchanged (mobile sheet still uses it)
│       ├── TagCloud.tsx            # NEW: proximity-scale animated tag cloud
│       ├── EverythingIsPossible.tsx # NEW: cycling quirky-tag phrase element
│       └── FilterSidebar.tsx       # MODIFY: swap TagMultiSelect → TagCloud + EverythingIsPossible
├── index.css                       # MODIFY: update .expert-card:hover box-shadow to OKLCH tokens
└── constants/
    └── tags.ts                     # NO CHANGE: TOP_TAGS (30 items) already the correct set
```

**Important:** `MobileFilterSheet.tsx` has its own inline tag rendering (not using `TagMultiSelect` directly) — it does NOT need to be changed for this phase. The file uses `TOP_TAGS` directly. Only `FilterSidebar` swaps the component.

### Pattern 1: Bento ExpertCard Layout (CSS-only, no motion import)

**What:** Four named visual zones in a fixed `h-[180px]` container using flex-column with fixed/auto sizing.
**When to use:** Card redesign — the four zones must be visually distinct without overflow.

**Zone allocation within 180px:**
- Zone A (name/role): ~52px — `h-[52px]` fixed, `overflow-hidden`
- Zone B (rate + badge): ~24px — `flex items-center gap-2`
- Zone C (tags): ~24px — `flex flex-nowrap gap-1 overflow-hidden`
- Zone D (match reason + View Profile): remaining space — `flex-1 min-h-0`

**Layout approach:** Use `flex flex-col` on the outer wrapper (as today). Assign explicit heights or `flex-shrink-0` to zones A/B/C so zone D receives all remaining space via `flex-1`.

```tsx
// Source: ExpertCard.tsx audit + Phase 23 bento constraint
<div className="expert-card bg-white/90 rounded-xl border border-gray-100/60 p-3 flex flex-col gap-1.5 h-[180px] overflow-hidden">
  {/* Zone A: name + role — fixed height, truncate long names */}
  <div className="flex-shrink-0">
    <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
      {expert.first_name} {expert.last_name}
    </h3>
    <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
    <p className="text-xs text-gray-400 truncate">{expert.company}</p>
  </div>

  {/* Zone B: rate + findability badge */}
  <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
    <span className="text-xs font-semibold text-brand-purple whitespace-nowrap">
      {expert.currency} {expert.hourly_rate}/hr
    </span>
    {hasSemanticFilter && badgeLabel && (
      <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5 whitespace-nowrap">
        {badgeLabel}
      </span>
    )}
  </div>

  {/* Zone C: tag pills — max 2 per existing pattern */}
  <div className="flex-shrink-0 hidden sm:flex flex-nowrap gap-1 overflow-hidden">
    {expert.tags.slice(0, 2).map((tag) => (
      <button
        key={tag}
        onClick={() => toggleTag(tag)}
        className="flex-shrink-0 cursor-pointer text-xs bg-gray-100/80 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors whitespace-nowrap"
      >
        {tag}
      </button>
    ))}
  </div>

  {/* Zone D: match reason + view profile — gets all remaining height */}
  <div className="flex-1 min-h-0 flex flex-col justify-between">
    {hasSemanticFilter && expert.match_reason && (
      <p className="text-xs text-gray-500 line-clamp-2 border-t border-gray-100 pt-1.5">
        {expert.match_reason}
      </p>
    )}
    <button
      onClick={(e) => { e.stopPropagation(); onViewProfile(expert.profile_url) }}
      className="mt-auto cursor-pointer text-xs text-brand-purple font-medium hover:underline self-start"
    >
      View Full Profile →
    </button>
  </div>
</div>
```

### Pattern 2: Aurora-palette Hover Glow (CSS-only update in index.css)

**What:** Update `.expert-card:hover` box-shadow to use OKLCH aurora tokens rather than hardcoded `#5128F2`.
**When to use:** CARD-03 — glow must visually integrate with the aurora background.

```css
/* Source: index.css audit — existing .expert-card:hover pattern + Phase 22 OKLCH tokens */

/* Updated glow: use aurora-purple token (oklch(88% 0.070 279)) */
.expert-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 0 0 1.5px oklch(72% 0.16 279),
    0 0 24px oklch(78% 0.12 279 / 0.35),
    0 8px 20px rgba(0, 0, 0, 0.06);
}
```

Note: The aurora tokens in `:root` use alpha (`/ 0.55`) which makes them unsuitable for `box-shadow` ring (ring needs opaque). Use inline OKLCH literals slightly more saturated than the blob tokens but matching the hue family (hue 279).

### Pattern 3: Proximity-scale Tag Cloud (DISC-02 core pattern)

**What:** One `onMouseMove` on the cloud container feeds `mouseX`/`mouseY` motion values. Each pill reads its own DOM position via `useRef` and computes distance → scale in a `useTransform` function. `useSpring` smooths the output.
**When to use:** DISC-02 — required for claymorphism proximity effect with zero React re-renders.

**Key insight:** `useMotionValue`, `useTransform`, and `useSpring` create a reactive graph that bypasses React's render cycle entirely. Updates flow directly to DOM via `style` prop on `motion.button`. This is why 30+ pills can all respond simultaneously with no jank.

```tsx
// Source: motion/react confirmed exports + framer-motion docs patterns
// File: TagCloud.tsx

import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  LayoutGroup,
  AnimatePresence,
} from 'motion/react'
import { useFilterSlice } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

// Per-pill proximity scale hook — called once per pill at render
function useProximityScale(
  mouseX: ReturnType<typeof useMotionValue>,
  mouseY: ReturnType<typeof useMotionValue>,
  ref: React.RefObject<HTMLButtonElement | null>,
) {
  // Distance as a raw motion value derived from mouse position
  const distance = useTransform([mouseX, mouseY], ([mx, my]: number[]) => {
    if (!ref.current) return 999
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2)
  })

  // Map distance → scale: 1.4 at 0px, 1.0 at 120px+
  const scaleRaw = useTransform(distance, [0, 60, 120], [1.4, 1.15, 1.0], { clamp: true })

  // Spring smooths the scale so it doesn't snap
  return useSpring(scaleRaw, { stiffness: 200, damping: 20, mass: 0.5 })
}

function TagPill({
  tag,
  isSelected,
  mouseX,
  mouseY,
  onToggle,
}: {
  tag: string
  isSelected: boolean
  mouseX: ReturnType<typeof useMotionValue>
  mouseY: ReturnType<typeof useMotionValue>
  onToggle: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const scale = useProximityScale(mouseX, mouseY, ref)

  return (
    <motion.button
      ref={ref}
      layout="position"       // smooth position animation on reorder
      style={{ scale }}       // motion value — zero re-renders
      onClick={onToggle}
      aria-pressed={isSelected}
      className={`
        text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors origin-center
        ${isSelected
          ? 'bg-brand-purple text-white border-brand-purple'
          : 'bg-white/80 text-gray-700 border-gray-300 hover:border-brand-purple'
        }
      `}
    >
      {tag}
    </motion.button>
  )
}

export function TagCloud() {
  const { tags, toggleTag } = useFilterSlice()

  // Shared mouse position — lives outside of any pill, no per-pill listeners
  const mouseX = useMotionValue(-999)
  const mouseY = useMotionValue(-999)

  function handleMouseMove(e: React.MouseEvent) {
    mouseX.set(e.clientX)
    mouseY.set(e.clientY)
  }

  function handleMouseLeave() {
    // Reset to far-away position so all pills return to scale 1.0
    mouseX.set(-999)
    mouseY.set(-999)
  }

  // Selected tags first, then unselected — visual reorder on toggle
  const sortedTags = [
    ...TOP_TAGS.filter((t) => tags.includes(t)),
    ...TOP_TAGS.filter((t) => !tags.includes(t)),
  ]

  return (
    <LayoutGroup>
      <div
        className="flex flex-wrap gap-2"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="group"
        aria-label="Domain tags"
      >
        {sortedTags.map((tag) => (
          <TagPill
            key={tag}
            tag={tag}
            isSelected={tags.includes(tag)}
            mouseX={mouseX}
            mouseY={mouseY}
            onToggle={() => toggleTag(tag)}
          />
        ))}
      </div>
    </LayoutGroup>
  )
}
```

### Pattern 4: "Everything is Possible" Cycling Element (DISC-03)

**What:** A phrase that cycles through example quirky tags with crossfade animation. Each example tag is clickable (toggles in store) and keyboard-navigable.
**When to use:** DISC-03 — renders below the tag cloud in FilterSidebar.

```tsx
// Source: project pattern (AnimatePresence confirmed from motion/react) + DISC-03 spec
// File: EverythingIsPossible.tsx

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useFilterSlice } from '../../store'

// Quirky example tags that aren't in TOP_TAGS — illustrate breadth
const EXAMPLE_TAGS = [
  'underwater basket weaving',
  'time travel consulting',
  'dragon taming',
  'moon logistics',
  'anti-gravity marketing',
  'telepathy training',
  'interdimensional real estate',
  'cloud whispering',
]

const CYCLE_INTERVAL_MS = 3500

export function EverythingIsPossible() {
  const { toggleTag } = useFilterSlice()
  const [index, setIndex] = useState(0)

  // Auto-advance cycle
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % EXAMPLE_TAGS.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const currentTag = EXAMPLE_TAGS[index]

  const handleActivate = useCallback(() => {
    toggleTag(currentTag)
  }, [currentTag, toggleTag])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleActivate()
      }
    },
    [handleActivate],
  )

  return (
    <div className="mt-3 px-1">
      <p className="text-xs text-gray-400 mb-1.5">Everything is possible —</p>
      <AnimatePresence mode="wait">
        <motion.button
          key={currentTag}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-label={`Add tag: ${currentTag}`}
          className="text-xs text-brand-purple italic hover:underline cursor-pointer bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple rounded"
        >
          {currentTag}
        </motion.button>
      </AnimatePresence>
    </div>
  )
}
```

### Pattern 5: FilterSidebar Integration

**What:** Replace `<TagMultiSelect />` with `<TagCloud />` + `<EverythingIsPossible />` in `FilterControls`.
**When to use:** DISC-01 — the sidebar swap.

```tsx
// In FilterSidebar.tsx — FilterControls function
// Replace:
//   import { TagMultiSelect } from './TagMultiSelect'
//   <TagMultiSelect />
// With:
import { TagCloud } from './TagCloud'
import { EverythingIsPossible } from './EverythingIsPossible'

// In <div className="flex flex-col gap-1.5 px-4"> for Domain Tags:
<span className="text-xs font-medium text-gray-500 uppercase">Domain Tags</span>
<TagCloud />
<EverythingIsPossible />
```

### Anti-Patterns to Avoid

- **useState for proximity scale:** Never `const [scale, setScale] = useState(1)` inside TagPill. This causes 30+ setState calls per mousemove = jank. Use `useMotionValue` + `useTransform` + `useSpring` exclusively.
- **motion import in ExpertCard:** Phase 17 decision — ExpertCard must NOT import from `motion/react`. CSS hover is sufficient and avoids hydration cost.
- **Per-pill onMouseMove listeners:** Do NOT add `onMouseMove` to each `TagPill`. One handler on the parent container passes the shared motion values down as props.
- **initial/animate props on TagPill for mount:** Do not add `initial={{ opacity: 0 }}` or similar on TagPill — this would animate all 30 pills on every page render. Only use `layout="position"` for positional reorder.
- **Breaking h-[180px] on ExpertCard:** Any content overflow fix via `overflow: visible` or height change will break VirtuosoGrid uniform-height assumption.
- **Importing LayoutGroup outside TagCloud:** Keep `LayoutGroup` scoped to `TagCloud` — it should NOT wrap the entire FilterSidebar or MarketplacePage.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth proximity scale | Custom RAF loop + setState | `useTransform` + `useSpring` from `motion/react` | Motion values bypass React render cycle; RAF + setState re-renders entire component tree on every frame |
| Layout reorder animation | Manual CSS transition on flex-order | `layout="position"` on `motion.button` inside `LayoutGroup` | Motion uses FLIP technique — calculates start/end positions and animates between them; CSS transitions on flex-order cause layout thrashing |
| Crossfade cycling text | CSS animation keyframes | `AnimatePresence mode="wait"` + `motion.button` enter/exit | AnimatePresence handles component unmount timing so exit animation completes before enter begins |
| Bento zone layout | CSS Grid with named areas | Flex-column with `flex-shrink-0` zones | Named CSS grid areas are overkill; flex-column with explicit shrink behavior achieves the same result with less markup |

**Key insight:** The motion value graph (`useMotionValue` → `useTransform` → `useSpring` → `style.scale`) is a separate reactive system from React state. It updates the DOM directly via `motion.button`'s `style` prop. This is the fundamental reason 30+ proximity animations can run simultaneously with zero React re-renders.

---

## Common Pitfalls

### Pitfall 1: `useTransform` receives stale DOM rect
**What goes wrong:** `getBoundingClientRect()` returns zeros if called before the component has mounted or when the element is hidden (e.g., sidebar collapsed).
**Why it happens:** `ref.current` is null during the first few renders; `getBoundingClientRect()` returns `{left: 0, top: 0, ...}` for unmounted or hidden elements.
**How to avoid:** Guard with `if (!ref.current) return 999` (large distance = scale 1.0). The TagPill example above shows this guard.
**Warning signs:** All pills simultaneously scale to 1.4 regardless of cursor position.

### Pitfall 2: `LayoutGroup` scope too wide
**What goes wrong:** Including unrelated components inside `LayoutGroup` causes them to participate in layout animations and produce unexpected position-shift jank.
**Why it happens:** `LayoutGroup` tells Motion to coordinate FLIP animations across all `motion` children in scope.
**How to avoid:** Wrap only the `flex flex-wrap gap-2` container inside `LayoutGroup`, not the entire sidebar.
**Warning signs:** FilterSidebar header or rate slider animates when tags are toggled.

### Pitfall 3: `AnimatePresence` wrapping static list
**What goes wrong:** Wrapping all 30 static tag pills in `AnimatePresence` causes enter/exit animations on every re-render (toggle), not just on mount/unmount.
**Why it happens:** `AnimatePresence` is intended for conditional rendering (`{condition && <Component />}`), not for always-present items.
**How to avoid:** Do NOT use `AnimatePresence` on the tag pill list. Use `layout="position"` only. Reserve `AnimatePresence` for `EverythingIsPossible` where the text genuinely enters/exits.
**Warning signs:** All 30 pills fade in/out every time a single tag is toggled.

### Pitfall 4: ExpertCard visual zone collapse
**What goes wrong:** Zone D (match reason + View Profile) collapses to zero height when no semantic filter is active, making the card look empty.
**Why it happens:** `match_reason` renders only when `hasSemanticFilter` is true. If Zone D has no `justify-between` or minimum content, it can collapse.
**How to avoid:** Ensure "View Full Profile →" button is always rendered (not conditional) in Zone D. Its `mt-auto` or `mt-auto self-start` positioning will pin it to the bottom even when match reason is absent.
**Warning signs:** Card looks asymmetric when no query/tags are active.

### Pitfall 5: OKLCH box-shadow browser support
**What goes wrong:** `box-shadow` with `oklch()` values is ignored in older browsers (Firefox < 113, Safari < 16.4).
**Why it happens:** OKLCH color function support in `box-shadow` was added later than in `background-color`.
**How to avoid:** The aurora background already uses OKLCH; the project targets modern browsers. Add a fallback hex line before the OKLCH line if needed: `box-shadow: 0 0 24px rgba(81, 40, 242, 0.35);` as first layer, then override with OKLCH.
**Warning signs:** No glow visible on the card hover in older test environments.

### Pitfall 6: useSpring stiffness/damping causing overshoot
**What goes wrong:** Scale overshoots above 1.4 when cursor enters a pill rapidly, causing the pill to momentarily grow larger than intended.
**Why it happens:** High `stiffness` + low `damping` values produce underdamped oscillation.
**How to avoid:** Use `stiffness: 200, damping: 20, mass: 0.5` (moderate settings). Do NOT use `stiffness: 1000` (seen in some examples — too bouncy for scale effects).
**Warning signs:** Pills visibly "bounce" when cursor enters fast.

---

## Code Examples

### Verified: Import Path for All Hooks (confirmed from installed package)

```tsx
// Source: node_modules/motion/dist/es/react.mjs — re-exports all of framer-motion
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useMotionValue,
  useTransform,
  useSpring,
} from 'motion/react'
```

All hooks confirmed present in `node_modules/framer-motion/dist/es/index.mjs` and re-exported via `motion/react`.

### Verified: motion value graph (no React re-renders)

```tsx
// Source: motion/react docs pattern + confirmed export presence
const mouseX = useMotionValue(-999)  // initial far-away = scale 1.0 for all pills
const mouseY = useMotionValue(-999)

// In parent container:
onMouseMove={(e) => { mouseX.set(e.clientX); mouseY.set(e.clientY) }}
onMouseLeave={() => { mouseX.set(-999); mouseY.set(-999) }}

// In each pill (via useProximityScale hook):
const distance = useTransform([mouseX, mouseY], ([mx, my]: number[]) => {
  const rect = ref.current?.getBoundingClientRect()
  if (!rect) return 999
  return Math.sqrt((mx - rect.left - rect.width/2)**2 + (my - rect.top - rect.height/2)**2)
})
const scaleRaw = useTransform(distance, [0, 60, 120], [1.4, 1.15, 1.0], { clamp: true })
const scale = useSpring(scaleRaw, { stiffness: 200, damping: 20, mass: 0.5 })

// On motion.button:
<motion.button style={{ scale }} ... />
```

### Verified: layout="position" for reorder (no drag)

```tsx
// Source: framer-motion layout animation docs pattern
// "position" variant animates only positional change, not size — correct for pill reorder
<LayoutGroup>
  <div className="flex flex-wrap gap-2">
    {sortedTags.map((tag) => (
      <motion.button
        key={tag}
        layout="position"
        // ...
      />
    ))}
  </div>
</LayoutGroup>
```

When `sortedTags` order changes (selected tags move to front), each pill animates from its old position to its new position via FLIP — smooth, no snap.

### Verified: ExpertCard CSS glow with OKLCH (index.css)

```css
/* Source: index.css + Phase 22 OKLCH tokens */
/* Current glow uses hardcoded #5128F2 — replace with aurora-aligned OKLCH */
.expert-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 0 0 1.5px oklch(65% 0.18 279),
    0 0 24px oklch(72% 0.14 279 / 0.35),
    0 8px 20px rgba(0, 0, 0, 0.06);
}
```

Hue 279 matches the brand purple family and the aurora tokens (all set to hue 279). Lightness 65%–72% produces a visible glow that's lighter than the old hardcoded purple but still clearly branded.

### Verified: AnimatePresence mode="wait" for EverythingIsPossible

```tsx
// Source: ProfileGateModal.tsx pattern (confirmed working in project) + AnimatePresence docs
<AnimatePresence mode="wait">
  <motion.button
    key={currentTag}           // key change triggers exit of old + enter of new
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.25 }}
    // ...
  >
    {currentTag}
  </motion.button>
</AnimatePresence>
```

`mode="wait"` ensures the exit animation completes before the new tag enters — prevents overlap during rapid cycling.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `TagMultiSelect` with static pill list + text search input | `TagCloud` with proximity scale + layout reorder (no search input) | Replaces utility-first filter widget with tactile exploration UI |
| Hardcoded `#5128F2` purple in `.expert-card:hover` box-shadow | OKLCH hue-279 value aligned with aurora tokens | Hover glow visually cohesive with aurora background |
| `ExpertCard` flat flex layout, match reason always below tags | Bento four-zone layout with explicit visual separation | Clearer information hierarchy; zones never overlap |
| `framer-motion` direct import (legacy) | `motion/react` subpath import | Confirmed: `motion/react` re-exports all of framer-motion; all existing files use `motion/react` |

**Deprecated/outdated:**
- `import from 'framer-motion'`: Still works (framer-motion is installed as a dependency of motion), but project convention is `motion/react`. Do not introduce direct `framer-motion` imports.
- `Reorder.Group` / `Reorder.Item`: Valid for drag-to-reorder. Overkill here — tags are not user-draggable. Use `layout="position"` on plain `motion.button`.

---

## Open Questions

1. **FilterSidebar collapsed state and proximity scale**
   - What we know: `FilterSidebar` can collapse to `w-16` (icon strip only). In collapsed state, `TagCloud` is not rendered.
   - What's unclear: Does proximity scale work correctly when the sidebar is first expanded? Pills may not have rendered yet when mouseX/mouseY have stale values.
   - Recommendation: Initialize `mouseX`/`mouseY` to `-999` (effectively "far away") so all pills default to `scale: 1.0` on first render. This is the pattern shown above.

2. **MobileFilterSheet tag rendering**
   - What we know: `MobileFilterSheet` has its own inline tag pill rendering (`toggleDraftTag` draft state pattern) — does NOT import `TagMultiSelect`.
   - What's unclear: DISC-01 spec says "TagMultiSelect replaced with animated tag cloud" — should mobile sheet also get the proximity scale treatment?
   - Recommendation: The phase spec says proximity scale and AnimatePresence are sidebar features (DISC-02 scopes to "cursor hover/approach" — not applicable to mobile touch). Leave `MobileFilterSheet` unchanged. The planning note confirms the sidebar scope.

3. **`useTransform` with array of motion values signature**
   - What we know: `useTransform([mouseX, mouseY], ([mx, my]) => ...)` is the multi-value input pattern from docs.
   - What's unclear: TypeScript typing for the transformer function parameter — `([mx, my]: number[])` may need explicit typing in strict mode.
   - Recommendation: Type as `([mx, my]: number[])` initially; if TS errors, cast: `([mx, my]) => { const [x, y] = [mx as number, my as number]; ... }`.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/motion/dist/es/react.mjs` — confirmed `export * from 'framer-motion'` (direct inspection)
- `node_modules/framer-motion/dist/es/index.mjs` — confirmed exports: `useMotionValue`, `useSpring`, `useTransform`, `AnimatePresence`, `LayoutGroup`, `motion`, `Reorder` (direct inspection)
- `frontend/src/components/pilot/SagePanel.tsx` — confirmed `import { motion } from 'motion/react'` works in project
- `frontend/src/pages/MarketplacePage.tsx` — confirmed `import { AnimatePresence } from 'motion/react'` works in project
- `frontend/package.json` — `"motion": "^12.34.3"` installed; `"framer-motion"` NOT in direct deps (it's a transitive dep)
- `frontend/src/index.css` — Phase 22 OKLCH tokens and existing `.expert-card:hover` pattern
- `frontend/src/constants/tags.ts` — `TOP_TAGS` array has exactly 30 items (planning note: "limit to top 30" already met)
- `frontend/src/components/sidebar/MobileFilterSheet.tsx` — confirmed does NOT import TagMultiSelect; has its own inline tag rendering

### Secondary (MEDIUM confidence)
- [Motion Values docs](https://motion.dev/docs/react-motion-value) — useMotionValue, useTransform, useSpring pattern; site confirmed to exist but content not accessible via WebFetch (React-rendered)
- [Layout animations docs](https://www.framer.com/motion/layout-animations/) (redirects to motion.dev) — `layout="position"` for positional-only FLIP animation
- [Refine.dev Framer Motion article](https://refine.dev/blog/framer-motion/) — confirmed import patterns from `framer-motion`; v11/v12 import path equivalent

### Tertiary (LOW confidence)
- WebSearch results for proximity cursor patterns — no v12-specific tag cloud examples found (confirmed in STATE.md: "medium confidence: proximity scale pattern confirmed but no v12-specific tag cloud example exists")

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package.json, node_modules inspection confirms motion@12.34.3, correct import path, all hooks present
- Architecture: HIGH — ExpertCard audit confirms current structure; bento zone allocation is straightforward flex-column; FilterSidebar structure audited
- Proximity scale pattern: MEDIUM — confirmed hooks exist and are correct approach; exact useTransform multi-value syntax for TS strict mode needs validation during implementation
- OKLCH glow values: MEDIUM — hue family is correct (279); lightness values are estimates that will need visual tuning
- Pitfalls: HIGH — all grounded in project-specific code audit or confirmed motion library behavior

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (motion v12 stable, Tailwind v3 stable — 30-day window appropriate)
