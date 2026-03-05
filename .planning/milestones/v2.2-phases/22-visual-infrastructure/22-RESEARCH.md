# Phase 22: Visual Infrastructure - Research

**Researched:** 2026-02-22
**Domain:** CSS aurora animation, glassmorphism, OKLCH design tokens, accessibility contrast, graceful degradation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aurora palette & mood**
- Color family: cool aurora — blues, cyans, teals, violets anchored to brand purple `#5128F2`
- Visibility: subtle atmosphere — barely-there, content dominates; aurora never competes with UI
- Base background: deep purple-tinted near-black (~`#05050a`) so the aurora sits naturally on brand
- Blob structure: radial gradient blobs that drift are preferred over a smooth wash

**Glass surface style**
- Blur: light frosted — `backdrop-filter: blur(4px)` (`blur-sm` equivalent)
- Tint: brand-purple/8 — dark surface with a subtle `#5128F2` tint at ~8% opacity
- Border: subtle `white/10` 1px border recommended

**Animation character**
- Cycle duration: slow — 15–25s per full drift cycle
- Behavior: pause animation when tab is hidden (`visibilitychange`); respect `prefers-reduced-motion` (freeze gradient, keep static fallback)
- Loop: seamless — no visible reset or jump at cycle boundary

**Fallback aesthetic (unsupported browsers)**
- backdrop-filter unsupported: opaque surface in the same brand-purple-tinted dark tone as the glass tint
- Animation/gradient unsupported: static version of the aurora gradient (same colors, frozen)
- Design standard: fallback must look like a first-class design choice, not a degraded state

### Claude's Discretion
- Exact OKLCH values for each aurora color stop
- Specific blur value (may land between `blur-sm` and `blur-md` depending on rendered result)
- Border width and exact opacity on glass surfaces
- Whether SagePanel gets a distinct glass treatment vs sidebar/search
- Whether to implement aurora as CSS `@keyframes` on `background-position` or via SVG filter approach
- Exact anchor point for the base background color (dark purple-tinted black)
- Cursor interaction implementation (purely ambient recommended)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | Marketplace renders with OKLCH-defined aurora mesh gradient background and slow ambient CSS keyframe animation | OKLCH custom properties defined in `:root`, CSS `@keyframes` on multi-layer `radial-gradient` background-position; tailwind.config extend animation pattern |
| VIS-02 | FilterSidebar renders with glassmorphism surface (backdrop-filter: blur, translucent bg, subtle border) | backdrop-filter + `-webkit-backdrop-filter` via Tailwind `backdrop-blur-sm`; `before:` pseudo-element hack for overflow:hidden ancestor; `@supports` fallback |
| VIS-03 | SearchInput renders with glassmorphism surface matching sidebar style | Same glass class as VIS-02; SearchInput currently uses `bg-white border-gray-300` — needs token-driven glass replacement |
| VIS-04 | SagePanel renders with glassmorphism surface | SagePanel currently `bg-white shadow-2xl` fixed panel — needs glass treatment; ancestor audit required (fixed positioning context) |
| VIS-05 | All glass surfaces maintain legibility (contrast ≥ 4.5:1) and degrade gracefully on unsupported browsers | `@supports (backdrop-filter: blur(1px))` pattern; contrast audit against sampled aurora gradient mid-point; WCAG 4.5:1 for normal text |
</phase_requirements>

---

## Summary

Phase 22 delivers three interlocking CSS systems: (1) an OKLCH token layer as CSS custom properties, (2) a pure-CSS animated aurora mesh gradient background, and (3) glassmorphism surfaces on FilterSidebar, SearchInput, and SagePanel. All three systems are implemented without new npm packages — Tailwind v3 already provides the required utilities, and OKLCH is natively supported in all modern browsers (91.7% global coverage as of early 2026).

The single highest-risk implementation detail is the `overflow: hidden` / `backdrop-filter` conflict. Tailwind v3.4.5 now always emits `-webkit-backdrop-filter` alongside `backdrop-filter`, so Safari support is automatic. However, when any ancestor element in the React component tree has `overflow: hidden`, the blur effect silently breaks. The codebase already contains this exact risk: `FilterSidebar` uses `overflow-y-auto` inside a `flex flex-col h-screen` container. The mitigation is the `before:` pseudo-element hack documented in planning notes — move `backdrop-filter` to a `::before` absolutely positioned layer, keeping the outer element `overflow: hidden` clean.

The aurora implementation should use a multi-layer `radial-gradient` with animated `background-position` (not background-size, not opacity crossfade). This technique animates GPU composited properties efficiently, creates organic blob drift, and loops seamlessly by using position values that bring blobs back to start without a visible jump. OKLCH tokens are defined in `index.css` `:root` only — NOT in `tailwind.config.ts` — preserving the existing Tailwind brand values.

**Primary recommendation:** Implement aurora as animated multi-layer `radial-gradient` in `index.css` using OKLCH custom properties. Apply glass surfaces via a shared `.glass-surface` CSS class with `before:` pseudo-element hack for backdrop-filter. Define `@supports` fallback inline for non-supporting browsers. Add `visibilitychange` listener in a small `AuroraBackground` React wrapper component.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v3.4.19 (already installed) | Utility classes, `backdrop-blur-sm`, `bg-white/10` | Already in project; v3.4.5+ emits `-webkit-backdrop-filter` automatically |
| CSS Custom Properties | Native (no library) | OKLCH token definitions in `:root` | No runtime cost, cascade-friendly, works with Tailwind utilities |
| CSS `@keyframes` | Native | Aurora animation loop | GPU-accelerated `background-position` animation, no JS dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostCSS (autoprefixer) | Already installed (devDep) | Vendor prefixes for legacy properties | Already runs in build; Tailwind v3.4.5+ handles `-webkit-backdrop-filter` itself |
| Existing `motion/react` | v12.34.3 (already installed) | `useEffect` for `visibilitychange` pause | Use React's `useEffect` to toggle a CSS class that sets `animation-play-state: paused` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `@keyframes` on background-position | Framer Motion animated gradients | Framer Motion adds JS bundle overhead; pure CSS is cheaper and sufficient for ambient motion |
| CSS custom properties for OKLCH tokens | Tailwind JS config extension | Tailwind config creates compiled utilities; OKLCH values in config don't persist as custom properties for cascade use; CSS-only tokens are simpler and more flexible |
| `before:` pseudo-element for backdrop-filter | Direct `backdrop-blur-sm` on element | Direct application breaks when ancestor has `overflow: hidden`; pseudo-element workaround is cross-browser reliable |
| Static gradient fallback | Solid background fallback | Static gradient with same colors looks intentional; solid color looks broken |

**Installation:** No new packages required. All capabilities are in the existing stack.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── index.css                    # OKLCH :root tokens + @keyframes aurora-drift + .glass-surface class
├── components/
│   ├── AuroraBackground.tsx     # Wrapper: visibilitychange listener, prefers-reduced-motion, renders aurora div
│   ├── sidebar/
│   │   ├── FilterSidebar.tsx    # Add .glass-surface class; ancestor audit required
│   │   └── SearchInput.tsx      # Add .glass-surface class; replace bg-white border-gray-300
│   └── pilot/
│       └── SagePanel.tsx        # Add .glass-surface class; currently bg-white shadow-2xl
└── pages/
    └── MarketplacePage.tsx      # Wrap content in AuroraBackground
```

### Pattern 1: OKLCH Token Definitions in index.css

**What:** All aurora and glass OKLCH values as CSS custom properties scoped to `:root`. No Tailwind JS config changes.
**When to use:** Always — tokens must be available to both Tailwind utility classes (via arbitrary value syntax) and custom CSS classes.

```css
/* Source: MDN oklch() docs, Evil Martians OKLCH guide */
:root {
  /* Aurora palette — cool blues, cyans, teals, violets anchored to brand purple #5128F2 */
  /* Brand purple #5128F2 = oklch(49.0% 0.270 279.0) */
  --aurora-bg:        oklch(7% 0.020 279);   /* deep purple-tinted near-black base */
  --aurora-purple:    oklch(49% 0.270 279);  /* brand purple blob */
  --aurora-violet:    oklch(42% 0.200 295);  /* blue-violet blob */
  --aurora-blue:      oklch(45% 0.175 250);  /* deep blue blob */
  --aurora-cyan:      oklch(55% 0.155 220);  /* cyan-blue blob */
  --aurora-teal:      oklch(52% 0.135 195);  /* teal blob */

  /* Glass surface tokens */
  --glass-bg:         oklch(12% 0.020 279 / 0.85); /* dark purple-tinted, semi-opaque */
  --glass-tint:       oklch(49% 0.270 279 / 0.08); /* brand purple at 8% */
  --glass-border:     oklch(100% 0 0 / 0.10);       /* white at 10% */

  /* Fallback (no backdrop-filter support) */
  --glass-fallback-bg: oklch(14% 0.022 279);        /* opaque version of glass-bg */
}
```

**Note:** The planner should verify final OKLCH values rendered on screen match the intended subtle atmosphere. Values above are starting points computed from the brand hex; final tuning happens in the browser.

### Pattern 2: Aurora Background CSS Animation

**What:** Multi-layer `radial-gradient` on a full-viewport `position: fixed` div behind content. Background-position animated with `@keyframes`.
**When to use:** This is the primary aurora implementation technique.

```css
/* Source: Aceternity UI aurora pattern, Dalton Walsh aurora technique */
@keyframes aurora-drift {
  0% {
    background-position:
      15% 30%,
      75% 20%,
      40% 70%,
      85% 60%,
      25% 80%;
  }
  50% {
    background-position:
      35% 50%,
      55% 45%,
      65% 30%,
      20% 75%,
      70% 55%;
  }
  100% {
    background-position:
      15% 30%,
      75% 20%,
      40% 70%,
      85% 60%,
      25% 80%;
  }
}

.aurora-bg {
  background-color: var(--aurora-bg);
  background-image:
    radial-gradient(ellipse 60% 40% at 15% 30%, oklch(49% 0.270 279 / 0.35) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 75% 20%, oklch(42% 0.200 295 / 0.25) 0%, transparent 70%),
    radial-gradient(ellipse 55% 45% at 40% 70%, oklch(45% 0.175 250 / 0.30) 0%, transparent 70%),
    radial-gradient(ellipse 45% 40% at 85% 60%, oklch(55% 0.155 220 / 0.20) 0%, transparent 70%),
    radial-gradient(ellipse 65% 50% at 25% 80%, oklch(52% 0.135 195 / 0.25) 0%, transparent 70%);
  background-size: 200% 200%;
  animation: aurora-drift 20s ease-in-out infinite;
  position: fixed;
  inset: 0;
  z-index: -1;
}

/* Static fallback: same gradient, no animation */
@media (prefers-reduced-motion: reduce) {
  .aurora-bg {
    animation: none;
    background-position: 15% 30%, 75% 20%, 40% 70%, 85% 60%, 25% 80%;
  }
}

/* Paused state (applied via JS on visibilitychange) */
.aurora-bg.aurora-paused {
  animation-play-state: paused;
}
```

### Pattern 3: Glass Surface CSS Class

**What:** Shared `.glass-surface` class using `before:` pseudo-element trick to bypass `overflow: hidden` ancestor conflicts.
**When to use:** Applied to FilterSidebar wrapper, SearchInput container, SagePanel wrapper.

```css
/* Source: tailwindlabs/tailwindcss discussion #15103, Josh Comeau backdrop-filter guide */

/* The problem: backdrop-filter breaks when any ancestor has overflow: hidden.
   The solution: move backdrop-filter to an absolutely-positioned ::before pseudo-element.
   The ::before is not affected by overflow clipping on its parent because it paints
   on top of the stacking context independently. */

.glass-surface {
  position: relative;
  /* Opaque fallback for unsupported browsers */
  background-color: var(--glass-fallback-bg);
}

/* Glass backdrop via pseudo-element — avoids overflow:hidden ancestor conflict */
.glass-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: var(--glass-tint);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  pointer-events: none;
  z-index: -1;
}

/* Progressive enhancement: show glass when supported */
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .glass-surface {
    background-color: transparent; /* let ::before handle bg */
    border: 1px solid var(--glass-border);
  }
}
```

**CRITICAL:** The `::before` approach requires `position: relative` on the glass container and `z-index: -1` on `::before`. The border is on the outer element (not pseudo), so it renders above the blur layer. `border-radius: inherit` on `::before` ensures rounded corners match the container.

### Pattern 4: AuroraBackground React Component

**What:** Thin wrapper component that adds `visibilitychange` listener to pause/resume the aurora CSS animation.
**When to use:** Rendered once in `MarketplacePage` wrapping the entire page layout.

```tsx
// Source: MDN Document visibilitychange event, CSS-Tricks animation-play-state guide
import { useEffect, useRef } from 'react'

export function AuroraBackground({ children }: { children: React.ReactNode }) {
  const auroraRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleVisibilityChange() {
      if (!auroraRef.current) return
      if (document.hidden) {
        auroraRef.current.classList.add('aurora-paused')
      } else {
        auroraRef.current.classList.remove('aurora-paused')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <div className="relative min-h-screen">
      <div ref={auroraRef} className="aurora-bg" aria-hidden="true" />
      {children}
    </div>
  )
}
```

**Note:** `aria-hidden="true"` on the aurora div prevents screen readers from announcing a decorative background element.

### Pattern 5: Applying Glass Classes in Tailwind

**What:** Combine `.glass-surface` CSS class with Tailwind utility classes for spacing/sizing.
**When to use:** For each of the three glass components.

```tsx
// FilterSidebar — BEFORE ancestor audit:
// Current: bg-gray-50 border-r border-gray-200
// AFTER: glass-surface + override border color
<aside className={`
  glass-surface
  hidden md:flex flex-col
  sticky top-0 h-screen
  border-r
  transition-all duration-200
  ${collapsed ? 'w-16' : 'w-64'}
`}>

// SearchInput container — BEFORE:
// Current: border border-gray-300 rounded-md
// AFTER: glass-surface on the wrapper div
<div className="glass-surface relative rounded-md">
  <input className="..." />
</div>

// SagePanel — BEFORE:
// Current: bg-white shadow-2xl
// AFTER: glass-surface replaces bg-white; keep shadow-2xl for depth
<motion.div className="glass-surface fixed bottom-0 right-0 z-40 h-full w-full md:w-[380px] shadow-2xl flex flex-col">
```

### Anti-Patterns to Avoid

- **Putting OKLCH tokens in tailwind.config.ts:** Tailwind compiles config values into utility classes; CSS custom properties defined in config do not persist as actual `--var` tokens in the cascade. OKLCH tokens belong in `index.css :root` only.
- **Applying `backdrop-filter` directly to `overflow: hidden` containers:** In Chrome, overflow clipping happens before filter application, breaking the effect. Always use the `::before` pseudo-element pattern.
- **Animating `background-size` for the aurora:** Animating background-size causes repaints; animating `background-position` is cheaper (composited).
- **Applying aurora as a React inline style with JS animation:** Pure CSS `@keyframes` requires zero JS after initial render; `motion` library would add unnecessary overhead for a static ambient effect.
- **Using `opacity: 0` on the gradient blobs directly:** Opacity at the gradient level (via color stop alpha) is better than element-level opacity which would also hide content.
- **Measuring contrast against white:** WCAG audit must sample text color against the actual rendered aurora surface color, not a white background.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser prefix for backdrop-filter | Manual `-webkit-` prefix in Tailwind classes | Tailwind v3.4.5+ automatically emits `-webkit-backdrop-filter` for all `backdrop-blur-*` utilities | Already baked into project's Tailwind version (v3.4.19) |
| Feature detection for backdrop-filter | JS-based feature detection | CSS `@supports (backdrop-filter: blur(1px))` | Native, zero runtime cost, works in all modern browsers |
| Animation pause on tab hide | Intersection Observer / visibility polling | `document.addEventListener('visibilitychange')` + CSS `animation-play-state: paused` | Standard browser API, minimal JS |
| OKLCH color conversion at runtime | JS OKLCH library | Native CSS `oklch()` function | Supported in 91.7% global browsers; no library needed |

**Key insight:** All visual effects in this phase are pure CSS capabilities — no new npm packages, no canvas, no WebGL. The implementation cost is CSS authoring, not library integration.

---

## Common Pitfalls

### Pitfall 1: backdrop-filter Silently Fails with overflow:hidden Ancestor

**What goes wrong:** The blur effect disappears entirely on Chrome. No error, no warning — just no visual effect. The element renders with its background but no blur.

**Why it happens:** Chrome applies `overflow: hidden` clipping before the filter composite step. The `backdrop-filter` sees an already-clipped context with no content to blur.

**How to avoid:** Before writing any glass class, audit the full ancestor chain in DevTools. Run: open DevTools → select the glass element → check Computed tab for `overflow` on every ancestor up to `body`. If any ancestor has `overflow: hidden` or `overflow: clip`, use the `::before` pseudo-element pattern instead of applying `backdrop-filter` directly to the element.

**Current codebase risk areas:**
- `FilterSidebar` has `overflow-y-auto` on the inner `FilterControls` div — the sidebar `<aside>` itself does NOT have `overflow: hidden`, but the inner scroll container does. Apply glass to the `<aside>`, not the scroll container.
- `SagePanel` is `position: fixed` — this creates its own stacking context which is usually safe, but verify the parent `AnimatePresence` wrapper does not have `overflow` set.

**Warning signs:** Glass effect works in Firefox/Safari but not Chrome = overflow ancestor conflict.

### Pitfall 2: Tailwind Purging Custom Class

**What goes wrong:** `.glass-surface` class defined in `index.css` is removed by Tailwind's content scanner during production build.

**Why it happens:** Tailwind v3 scans `content` paths for class names. CSS-defined classes are NOT purged (only unused Tailwind utilities are). Custom CSS classes like `.glass-surface` defined in `index.css` are always preserved regardless of purge settings.

**How to avoid:** Define `.glass-surface` in `index.css` (already in content path). This is safe — Tailwind purging only targets its own generated utilities, not hand-written CSS.

### Pitfall 3: Seamless Loop Jump

**What goes wrong:** At the 100% → 0% keyframe boundary, the background visibly jumps/resets.

**Why it happens:** The 0% and 100% keyframe positions differ, causing a discontinuous snap.

**How to avoid:** The `0%` and `100%` keyframes in `aurora-drift` MUST be identical. The animation eases between 0% → 50% (drift apart) → 100% (return to start = same as 0%) creating a smooth breathing motion with `ease-in-out` timing.

**Warning signs:** Visible flash or snap every 20 seconds — check that 0% and 100% background-position values match exactly.

### Pitfall 4: Text Contrast Failure on Aurora

**What goes wrong:** Text on glass surfaces passes contrast when tested against white but fails against the actual aurora background color.

**Why it happens:** Standard contrast checkers default to white background. The aurora is a dark purple gradient — text needs to be measured against the average dark color under the glass, not white.

**How to avoid:** Use browser DevTools color picker to sample the actual rendered glass surface color (taking into account the semi-transparent glass tint over the aurora gradient). Then check the sampled color against the text color using WebAIM contrast checker. With a dark glass surface (`oklch(7-14%)`) and light text (`oklch(90%+)`), contrast should be well above 4.5:1.

**Concrete audit approach:** In Chrome DevTools, use the "Inspect" tool → Accessibility panel → "Contrast ratio" for text elements rendered over the glass surface. Chrome's accessibility checker samples the actual rendered background.

### Pitfall 5: OKLCH Not Cascading to Tailwind Arbitrary Values

**What goes wrong:** Trying to use `bg-[var(--glass-bg)]` in Tailwind and it not working as expected, or the glass token not affecting child components.

**Why it happens:** CSS custom properties cascade normally through the DOM. Tailwind arbitrary value syntax `bg-[var(--glass-bg)]` works correctly IF the property is defined in `:root` or an ancestor. The common mistake is defining tokens in a scoped CSS block instead of `:root`.

**How to avoid:** Define ALL aurora and glass tokens in `:root {}` in `index.css`. Tailwind arbitrary value syntax can then consume them: `bg-[var(--aurora-bg)]`, `border-[var(--glass-border)]`.

### Pitfall 6: SagePanel backdrop-filter in Fixed Stacking Context

**What goes wrong:** SagePanel's `position: fixed` creates a new stacking context. The backdrop-filter on a fixed element blurs content visible THROUGH the fixed panel, which is correct behavior — but if the panel's blur radius is too high, it blurs the aurora background AND the text behind it, creating a muddy effect.

**Why it happens:** Fixed elements sit above all stacking contexts. The blur captures all rendered content behind the element.

**How to avoid:** Keep blur at `blur(4px)` as specified. Do not increase blur radius. The subtle tint (`/8 opacity`) combined with 4px blur creates the frosted effect without muddying the aurora.

---

## Code Examples

### Full index.css Structure

```css
/* Source: MDN OKLCH docs, Tailwind v3 @keyframes extension pattern */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ===== OKLCH Design Tokens ===== */
:root {
  /* Aurora colors — cool palette from brand purple #5128F2 = oklch(49.0% 0.270 279.0) */
  --aurora-bg:        oklch(7% 0.020 279);
  --aurora-purple:    oklch(49% 0.270 279);
  --aurora-violet:    oklch(42% 0.200 295);
  --aurora-blue:      oklch(45% 0.175 250);
  --aurora-cyan:      oklch(55% 0.155 220);
  --aurora-teal:      oklch(52% 0.135 195);

  /* Glass tokens */
  --glass-tint:        oklch(49% 0.270 279 / 0.08);
  --glass-border:      oklch(100% 0 0 / 0.10);
  --glass-fallback-bg: oklch(14% 0.022 279);
}

/* ===== Aurora Animation ===== */
@keyframes aurora-drift {
  0%, 100% {
    background-position:
      15% 30%,
      75% 20%,
      40% 70%,
      85% 60%,
      25% 80%;
  }
  33% {
    background-position:
      30% 50%,
      60% 40%,
      60% 35%,
      30% 80%,
      65% 60%;
  }
  66% {
    background-position:
      20% 60%,
      80% 50%,
      50% 55%,
      70% 40%,
      40% 70%;
  }
}

.aurora-bg {
  background-color: var(--aurora-bg);
  background-image:
    radial-gradient(ellipse 60% 40% at 50% 50%, var(--aurora-purple) 0%, transparent 70%),
    radial-gradient(ellipse 50% 35% at 50% 50%, var(--aurora-violet) 0%, transparent 70%),
    radial-gradient(ellipse 55% 45% at 50% 50%, var(--aurora-blue) 0%, transparent 70%),
    radial-gradient(ellipse 45% 40% at 50% 50%, var(--aurora-cyan) 0%, transparent 70%),
    radial-gradient(ellipse 65% 50% at 50% 50%, var(--aurora-teal) 0%, transparent 70%);
  background-size: 200% 200%;
  animation: aurora-drift 20s ease-in-out infinite;
}

.aurora-paused {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .aurora-bg {
    animation: none;
    background-position: 15% 30%, 75% 20%, 40% 70%, 85% 60%, 25% 80%;
  }
}

/* ===== Glass Surface ===== */
.glass-surface {
  position: relative;
  background-color: var(--glass-fallback-bg);
}

.glass-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: var(--glass-tint);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  pointer-events: none;
  z-index: -1;
}

@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .glass-surface {
    background-color: transparent;
  }
}

/* ===== Existing styles (preserve) ===== */
.expert-card {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.06);
}

.expert-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 0 0 1.5px #5128F2,
    0 0 24px rgba(81, 40, 242, 0.25),
    0 8px 20px rgba(0, 0, 0, 0.08);
}
```

### OKLCH Color Alpha in CSS

```css
/* OKLCH supports alpha as 4th value with slash separator */
/* Source: MDN oklch() docs */
background-color: oklch(49% 0.270 279 / 0.08);  /* brand purple at 8% opacity */
border-color: oklch(100% 0 0 / 0.10);            /* white at 10% opacity */
```

### Tailwind Config: Custom Animation (if extending via config)

```typescript
// tailwind.config.ts — ONLY if aurora @keyframes need Tailwind animation class
// Preferred: define @keyframes in index.css and use class="aurora-bg" directly
// If you want animate-aurora-drift utility class:
export default {
  theme: {
    extend: {
      keyframes: {
        'aurora-drift': {
          '0%, 100%': { backgroundPosition: '15% 30%, 75% 20%, 40% 70%, 85% 60%, 25% 80%' },
          '50%': { backgroundPosition: '35% 50%, 55% 45%, 65% 30%, 20% 75%, 70% 55%' },
        }
      },
      animation: {
        'aurora-drift': 'aurora-drift 20s ease-in-out infinite',
      }
    }
  }
} satisfies Config
```

**Decision:** The CONTEXT.md mandates OKLCH tokens NOT in Tailwind config. The animation `@keyframes` itself can live in either `index.css` or `tailwind.config`. Since the aurora uses CSS custom property values inside gradient functions (which Tailwind config does not support natively), define both `@keyframes` and `.aurora-bg` in `index.css` and skip the Tailwind config extension entirely.

### backdrop-filter Check in DevTools

The Tailwind v3.4.19 installed in this project already emits both properties for `backdrop-blur-sm`:
```css
/* Generated by Tailwind v3.4.19 backdrop-blur-sm */
.backdrop-blur-sm {
  --tw-backdrop-blur: blur(4px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur) ...;
  backdrop-filter: var(--tw-backdrop-blur) ...;
}
```
This means Tailwind utility classes can be used for blur if preferred over the `.glass-surface::before` pattern — but only when there is NO `overflow: hidden` ancestor conflict.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `rgb()` / `hsl()` color tokens | `oklch()` native CSS | CSS Color 4 spec (2023), universal browser support 2024 | Perceptually uniform; equal chroma changes = equal perceived change |
| `backdrop-filter` on element directly | `::before` pseudo-element pattern for overflow:hidden conflicts | Ongoing browser issue (not fixed in spec) | Reliable cross-browser glass effect even with layout overflow |
| Manual `-webkit-backdrop-filter` prefix | Tailwind v3.4.5+ auto-emits prefix | July 2024 (PR #13997) | No more missing Safari blur |
| `background-size` animation for gradient movement | `background-position` animation | Best practice established ~2022 | `background-position` animates on GPU without repaints |
| `@supports` as extra effort | `@supports` as standard fallback gate | Well supported since Firefox 22, Chrome 28 | Essential for progressive enhancement of glass effects |

**Deprecated/outdated:**
- `filter: blur()` on parent for frost effect: causes everything inside to blur, not just the background. Use `backdrop-filter` on the element itself or its `::before`.
- Animating `opacity` to crossfade between gradient layers: works but requires two DOM elements and is more complex than single `background-position` animation.

---

## Open Questions

1. **Exact OKLCH opacity values for aurora blobs at "subtle atmosphere" level**
   - What we know: Each blob gradient color stop needs alpha transparency; blobs are overlapping radial gradients on a dark base
   - What's unclear: The exact alpha at which "subtle" means barely visible without being invisible — this requires browser testing, as OKLCH chroma interacts with opacity differently than sRGB
   - Recommendation: Start with alpha 0.25-0.35 per blob; adjust during implementation based on visual result. The planner should note this as a "tune in browser" step in the implementation plan.

2. **SagePanel ancestor chain: does `AnimatePresence` introduce overflow:hidden?**
   - What we know: SagePanel is `position: fixed` which creates its own stacking context — backdrop-filter on fixed elements should work without the pseudo-element hack in most cases
   - What's unclear: Whether `motion.div` or `AnimatePresence` wrapper applies any overflow/clip that could interfere
   - Recommendation: Audit in DevTools on first implementation. If blur fails, apply `::before` pseudo-element pattern as fallback.

3. **Contrast measurement tooling for aurora-backed surfaces**
   - What we know: Chrome DevTools Accessibility panel → Contrast ratio shows measured contrast against actual rendered background; WebAIM contrast checker requires hex input
   - What's unclear: Whether Chrome's DevTools contrast measurement correctly samples a gradient background (vs a flat color) behind a glass surface
   - Recommendation: Use Chrome DevTools Accessibility panel as primary audit tool; manually sample the aurora color behind the glass surface using the color picker, then verify in WebAIM as secondary check.

---

## Sources

### Primary (HIGH confidence)
- MDN: `backdrop-filter` — https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter — browser support, stacking context behavior
- MDN: `oklch()` — https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch — syntax, browser compatibility
- Tailwind CSS v3.4.5 changelog (PR #13997) — https://github.com/tailwindlabs/tailwindcss/pull/13997 — confirms `-webkit-backdrop-filter` auto-emission in v3.4.5+
- Tailwind v3 Animation docs — https://v3.tailwindcss.com/docs/animation — `theme.extend.keyframes` pattern
- Can I Use: oklch() — https://caniuse.com/mdn-css_types_color_oklch — 91.72% global support

### Secondary (MEDIUM confidence)
- Josh Comeau: Next-level frosted glass — https://www.joshwcomeau.com/css/backdrop-filter/ — mask-image vs overflow:hidden workarounds; `::before` pseudo-element pattern verified against MDN stacking context docs
- Aceternity UI aurora implementation — https://ui.aceternity.com/components/aurora-background — `background-position` animation technique, confirmed as pure CSS approach
- Dalton Walsh aurora CSS background — https://daltonwalsh.com/blog/aurora-css-background-effect/ — multi-layer radial gradient + hue-rotate technique
- Evil Martians OKLCH guide — https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl — OKLCH token design system patterns
- tailwindlabs/tailwindcss discussion #15103 — https://github.com/tailwindlabs/tailwindcss/discussions/15103 — backdrop-blur ancestor issue confirmation

### Tertiary (LOW confidence, needs validation)
- Specific OKLCH values for aurora blobs — derived computationally from brand purple; require visual validation in browser
- `::before` pseudo-element handling for SagePanel `position: fixed` — theoretical; requires DevTools ancestor audit during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; OKLCH and backdrop-filter are native CSS with verified browser support
- Architecture patterns: HIGH — `::before` pseudo-element pattern, `@keyframes background-position` animation, and `@supports` fallback are all well-documented, cross-browser approaches
- OKLCH token values: MEDIUM — brand purple computed mathematically; aurora blob values are initial approximations requiring visual tuning
- Pitfalls: HIGH — overflow:hidden conflict, Tailwind v3.4.5 webkit fix, and seamless loop technique are all verified against official sources

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (CSS specs are stable; Tailwind patch versions may add features but not break existing patterns)
