# Phase 47: Public Explorer Polish - Research

**Researched:** 2026-02-27
**Domain:** React/Tailwind UI polish — search bar styling, view toggle, Sage double-render, mobile tap behavior, API error states
**Confidence:** HIGH

## Summary

Phase 47 is a pure frontend polish pass on the existing Explorer. No new APIs are required. All six requirements touch existing components: the Header search bar, the ExpertGrid/ExpertCard, the RootLayout Sage rendering logic, and the useExplore fetch hook. The work divides cleanly into three plans matching the phase breakdown.

The codebase already has the right infrastructure in place. `filterSlice` holds persisted state (localStorage via Zustand persist), `resultsSlice` holds `error` state that is never surfaced to the user, `RootLayout` already has the desktop/mobile Sage split — but the mobile `<div className="md:hidden">` always mounts `SageMobileSheet`, which can fire a Vaul Drawer even on desktop if CSS breakpoints are bypassed or the Drawer mounts outside Tailwind's media-query scope. The `ExpertCard` already has a tap-expand stub (`expanded` state + `handleCardClick`) that applies to ALL viewports — desktop users see the two-tap flow when they should get a direct profile open.

**Primary recommendation:** Each plan is a targeted, surgical edit. No new state management libraries, no new component libraries — work within the existing Zustand + Tailwind + Vaul stack.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Grid/list toggle:**
- Toggle placed in top-right of results area, separate from filter controls
- Default view is grid (cards) for first-time visitors
- View preference persists across page reloads (localStorage)
- Toggle uses icon + label buttons ("Grid" / "List")
- List view shows: expert name, job title, hourly rate, and domain tags per row

**Mobile tap behavior:**
- First tap on card expands it inline showing key stats (rate, experience, top tags)
- Instant expand — no animation, content appears immediately
- Second tap on the expanded card opens the full profile
- Tapping outside an expanded card collapses it back to normal
- Only one card expanded at a time

**Error states:**
- Friendly casual tone: "Oops, something went wrong. Let's try that again."
- Network-aware error messages: distinguish "Check your connection" for network errors vs generic server error message
- Retry button included in error state

**Search bar styling:**
- Solid white background — pure white, not translucent
- Thin light border, no shadow — flat and clean against the dark aurora header
- Placeholder text: "Name, company, keyword..."

### Claude's Discretion

- Error state illustration/icon choice
- Retry UX behavior (inline loading vs full reload)
- Search icon presence inside input
- Search bar border-radius (match existing UI conventions)
- Sage double-render fix approach
- Loading skeleton design for grid/list views

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | Search bar input has white background for contrast against aurora background | Header.tsx line 183: `bg-white/50` is the current input class — must change to `bg-white` with opaque border |
| EXP-02 | Search bar placeholder shows keyword prompts ("Name, company, keyword...") instead of conversational sentences | PLACEHOLDERS array in useHeaderSearch.ts still contains conversational phrases; the animated overlay spans use these — the static HTML `placeholder` attribute is empty; must update the placeholder overlay copy |
| EXP-03 | User can toggle between card grid view and compact list view | ExpertGrid uses VirtuosoGrid; list view needs a new ExpertList component + `viewMode` field added to filterSlice (persisted) + toggle button in MarketplacePage or ExpertGrid toolbar |
| EXP-04 | Sage panel renders only once on desktop (no double desktop + mobile overlay) | RootLayout.tsx: `SageMobileSheet` is always mounted (line 49 `<div className="md:hidden">`) — the Vaul Drawer renders its portal to document.body regardless of CSS visibility; fix = conditional render based on a window-width check (useMediaQuery hook or media query listener) not just CSS class |
| EXP-05 | Tap-to-expand card behavior is mobile-only, desktop clicks open profile directly | ExpertCard.tsx: `handleCardClick` has no viewport check — all devices use the two-tap flow; fix = detect pointer type or window width at click time to bypass expand on desktop |
| EXP-06 | Explorer shows friendly error message when API fails (not blank grid) | useExplore.ts calls `setError(err.message)` and `resetResults()` on failure; `error` is in ResultsSlice but MarketplacePage/ExpertGrid never reads it — must read `error` in ExpertGrid (or MarketplacePage) and render an error UI with Retry |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Component rendering | Project baseline |
| Tailwind CSS | 3.x | Styling utility classes | Project baseline |
| Zustand | 4.x | Global state + localStorage persistence | Already manages filterSlice |
| react-virtuoso | latest | VirtuosoGrid for card grid, VirtuosoList candidate for list view | Already installed |
| lucide-react | latest | Icons (LayoutGrid, List, AlertCircle, RefreshCw, WifiOff) | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-virtuoso VirtuosoList | same version as VirtuosoGrid | Compact list view with infinite scroll | Plan 47-02: list view |
| window.matchMedia / useMediaQuery pattern | browser API | Desktop vs mobile detection without third-party lib | Plans 47-03 for tap behavior and Sage double-render |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only `md:hidden` to hide SageMobileSheet | Conditional render based on screen width | CSS hides visually but Vaul Drawer portals to body regardless — must use conditional render |
| `navigator.userAgent` for mobile detection | `window.matchMedia('(pointer: coarse)')` or `window.innerWidth < 768` | pointer:coarse catches touch-first devices; innerWidth is simpler and consistent with Tailwind md breakpoint (768px) |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new files or folders needed. Changes land in existing files:

```
frontend/src/
├── components/marketplace/
│   ├── ExpertGrid.tsx          # Add error state render + viewMode prop
│   ├── ExpertCard.tsx          # Add desktop bypass to handleCardClick
│   └── ExpertList.tsx          # NEW: compact list row component (Plan 47-02)
├── store/
│   └── filterSlice.ts          # Add viewMode: 'grid' | 'list' + setViewMode action
├── layouts/
│   └── RootLayout.tsx          # Fix SageMobileSheet conditional render (EXP-04)
└── components/
    └── Header.tsx              # Fix input bg + placeholder text (EXP-01, EXP-02)
```

### Pattern 1: Search Bar Background Fix (EXP-01 + EXP-02)

**What:** Replace `bg-white/50` with `bg-white` and `border-slate-200/50` with `border-slate-200` on the `<input>` in `Header.tsx`. The animated placeholder overlay already exists — update its content to keyword-oriented copy.

**Current code (Header.tsx line 183):**
```tsx
className="w-full pl-14 pr-8 py-2.5 rounded-xl text-sm bg-white/50 border border-slate-200/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple/40 transition-colors"
```

**Target:**
```tsx
className="w-full pl-14 pr-8 py-2.5 rounded-xl text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple/40 transition-colors"
```

Note: `shadow-sm` removed per locked decision ("no shadow — flat and clean"). `border-radius: rounded-xl` kept (matches existing UI convention — aligns with Claude's discretion).

**Placeholder overlay update (useHeaderSearch.ts PLACEHOLDERS array):**

The animated overlay (Header.tsx lines 157–171) cycles through `PLACEHOLDERS`. Replace the array with a single static entry so the overlay is stable:
```tsx
// In Header.tsx, where the AnimatePresence overlay is rendered,
// replace the cycling placeholder with a static string:
// "Name, company, keyword..."
// The overlay only shows when localValue is empty, so it functions as a visual placeholder.
```

However, note that the user decision says placeholder reads "Name, company, keyword..." — this implies a stable, non-cycling placeholder. The current cycling animation should either be replaced with a static string or the PLACEHOLDERS array should be replaced with a single entry. Since useHeaderSearch returns `placeholders` array and `placeholderIndex`, the cleanest fix is to replace the PLACEHOLDERS array content in `useHeaderSearch.ts` with `['Name, company, keyword...']` — this preserves the AnimatePresence machinery without removing it (low risk).

### Pattern 2: View Mode Toggle + Zustand Persistence (EXP-03)

**What:** Add `viewMode: 'grid' | 'list'` to `filterSlice`. Persist it. Add a toolbar toggle button. Render `ExpertList` or `ExpertGrid` conditionally.

**filterSlice addition:**
```ts
// In FilterSlice interface:
viewMode: 'grid' | 'list'
setViewMode: (mode: 'grid' | 'list') => void

// In filterDefaults:
viewMode: 'grid' as const,

// In createFilterSlice:
setViewMode: (mode) => set({ viewMode: mode }),
```

**Persist via partialize** — add `viewMode` to the `partialize` object in `store/index.ts`:
```ts
partialize: (state) => ({
  query:     state.query,
  rateMin:   state.rateMin,
  rateMax:   state.rateMax,
  tags:      state.tags,
  sortBy:    state.sortBy,
  sortOrder: state.sortOrder,
  viewMode:  state.viewMode,   // ADD THIS
}),
```

**Toggle button placement** — top-right of results area. MarketplacePage has the results area at lines 121–129. Add a flex row toolbar above `<ExpertGrid>` (or inside ExpertGrid header slot) with two buttons using lucide-react `LayoutGrid` and `List` icons:
```tsx
<div className="flex justify-end px-4 pb-1">
  <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
    <button onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'active-style' : 'inactive-style'}>
      <LayoutGrid size={15} /> Grid
    </button>
    <button onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'active-style' : 'inactive-style'}>
      <List size={15} /> List
    </button>
  </div>
</div>
```

**ExpertList component** — new file. Each row shows: name, job title, hourly rate, domain tags. Uses `VirtuosoList` (same react-virtuoso package, different export) for infinite scroll parity with ExpertGrid.

```tsx
// frontend/src/components/marketplace/ExpertList.tsx
import { Virtuoso } from 'react-virtuoso'
// VirtuosoList = Virtuoso (1D list) — different from VirtuosoGrid
```

**ExpertGrid/MarketplacePage switch:**
```tsx
{viewMode === 'grid' ? (
  <ExpertGrid experts={experts} ... />
) : (
  <ExpertList experts={experts} ... />
)}
```

### Pattern 3: Sage Double-Render Fix (EXP-04)

**What:** `SageMobileSheet` mounts always because `<div className="md:hidden">` hides it visually but Vaul's `Drawer.Portal` renders content to `document.body` — the Drawer is present in the DOM even when the CSS wrapper is invisible. On desktop this means two Sage panels exist simultaneously.

**Fix approach (Claude's discretion):** Conditionally render `SageMobileSheet` only below the `md` breakpoint using a JS media query check, not a CSS class.

```tsx
// In RootLayout.tsx — replace:
<div className="md:hidden">
  <SageMobileSheet open={isOpen} onClose={() => setOpen(false)} />
</div>

// With:
const isMobile = useMediaQuery('(max-width: 767px)')
// ...
{isMobile && (
  <SageMobileSheet open={isOpen} onClose={() => setOpen(false)} />
)}
```

**useMediaQuery hook** — implement inline in RootLayout or as a small utility hook:
```tsx
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
```

This is a standard 10-line pattern — no library needed.

### Pattern 4: Desktop Bypass for Tap-to-Expand (EXP-05)

**What:** `ExpertCard.handleCardClick` currently always uses the expand-then-open two-tap flow. On desktop, a single click should open the profile directly.

**Fix:** Check `window.innerWidth >= 768` (Tailwind's `md` breakpoint) inside `handleCardClick`:
```tsx
function handleCardClick() {
  // Desktop: skip expand, open profile directly
  if (window.innerWidth >= 768) {
    void trackEvent('card_click', { ... })
    onViewProfile(expert.profile_url)
    return
  }
  // Mobile: two-tap expand behavior
  if (!expanded) {
    setExpanded(true)
  } else {
    void trackEvent('card_click', { ... })
    onViewProfile(expert.profile_url)
  }
}
```

**Collapse on outside tap:** The card already has `onBlur={() => setExpanded(false)}`. For mobile, tapping outside means another card or the grid background gets focus/click. "Only one card expanded at a time" requires lifting expanded state to the parent (ExpertGrid) or using a global `expandedUsername` in the store. The simpler approach: keep local `expanded` state in ExpertCard, and in ExpertGrid pass an `expandedKey` prop from a `useState<string|null>` in ExpertGrid, telling each card whether it is the active expanded one. Cards not matching `expandedKey` render collapsed regardless of their local state.

### Pattern 5: API Error State (EXP-06)

**What:** `error` in ResultsSlice is set but never read in the UI. ExpertGrid shows an empty grid when the API fails.

**Fix:** Read `error` from the store in ExpertGrid (or MarketplacePage). When `error` is non-null and `experts.length === 0`, render an error UI instead of the grid. Include a Retry button that calls a `retry` callback.

```tsx
// In ExpertGrid.tsx — add error prop or read from store directly:
const error = useExplorerStore((s) => s.error)
const resetResults = useExplorerStore((s) => s.resetResults)

// Retry: clear error + reset results → useExplore re-fetches automatically
// because resetResults sets loading:false + error:null,
// but that alone won't re-trigger useExplore (deps haven't changed).
// Better retry: expose a retryTrigger counter in the store, or call setQuery(query) to force re-fetch.
```

**Retry mechanism options:**
- Option A: Add a `retryTrigger: number` to ResultsSlice; `retry()` increments it; `useExplore` dep array includes it.
- Option B: Call `setError(null)` + fire a new fetch from MarketplacePage with a `retryCount` state.
- Option C (simplest): `retry` = `() => { setError(null); setLoading(true) }` — but useExplore won't re-fetch unless a dep changes. Instead: add a `forceRefetch` action that increments a counter in resultsSlice; useExplore includes it in deps.

Recommended: Option A (retryTrigger counter) — cleanest, no prop drilling, consistent with existing store pattern.

**Error UI structure:**
```tsx
if (error && experts.length === 0) {
  const isNetworkError = error.toLowerCase().includes('failed to fetch')
    || error.toLowerCase().includes('networkerror')
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <AlertCircle size={40} className="text-gray-300" />
      <p className="text-gray-600 font-medium">
        Oops, something went wrong. Let's try that again.
      </p>
      {isNetworkError && (
        <p className="text-sm text-gray-400">Check your connection and retry.</p>
      )}
      <button onClick={onRetry} className="...retry button styles...">
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **CSS-only Sage visibility control:** `md:hidden` wrapping Vaul Drawer does NOT prevent the portal from mounting in the DOM. Vaul Drawer.Portal appends to document.body unconditionally when the `open` prop is managed. Must use a JS conditional render.
- **Global window.innerWidth reads without SSR guard:** This is a client-only app (Vite + no SSR), so `window.innerWidth` is safe without guards.
- **Lifting all card expanded state to Redux/Zustand:** Overkill. A single `useState<string|null>(null)` in ExpertGrid for `activeExpandedId` is sufficient and avoids global state pollution.
- **Replacing VirtuosoGrid with a CSS grid for list view:** VirtuosoGrid's infinite scroll must be preserved. List view uses `Virtuoso` (1D list) from the same react-virtuoso package.
- **Changing PLACEHOLDERS in Header.tsx directly:** The placeholders array lives in `useHeaderSearch.ts`. Header.tsx consumes it via the hook. Edit the source, not the consumer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite-scroll list view | Custom scroll listener | `Virtuoso` from react-virtuoso (already installed) | Already used for grid; same API, same endReached prop |
| Media query subscription | Custom resize listener | 10-line `useMediaQuery` hook using `window.matchMedia` | matchMedia fires exactly once on breakpoint cross; resize listener fires too often |
| Error boundary for fetch failures | React ErrorBoundary | Inline error state in ExpertGrid (fetch errors are recoverable) | React ErrorBoundary catches render errors, not promise rejections; fetch errors are already caught in useExplore |

**Key insight:** Everything needed is already installed. Phase 47 is entirely about wiring existing infrastructure correctly, not introducing new dependencies.

---

## Common Pitfalls

### Pitfall 1: Vaul Drawer Portal Leaks to Desktop DOM

**What goes wrong:** `SageMobileSheet` mounts even on desktop because it is wrapped in `<div className="md:hidden">` — CSS display:none does not prevent Vaul's `Drawer.Portal` from appending to `document.body`. This causes two Sage panels: `SagePanel` (desktop) + `SageMobileSheet` (leaked from mobile), both responding to `isOpen`.

**Why it happens:** Vaul uses React portal to mount `Drawer.Content` directly on `document.body`, bypassing the CSS wrapper entirely.

**How to avoid:** Conditionally render `SageMobileSheet` in JS with `{isMobile && <SageMobileSheet ... />}` — not CSS.

**Warning signs:** On desktop, clicking the Sage FAB opens both the fixed panel AND a bottom sheet overlay simultaneously.

### Pitfall 2: viewMode Persist — Zustand partialize Must Be Updated

**What goes wrong:** Adding `viewMode` to filterSlice but NOT to the `partialize` selector in `store/index.ts` means the value is in-memory only and lost on page reload.

**Why it happens:** Zustand persist only serializes keys listed in `partialize`. New state fields are silently ignored unless explicitly added.

**How to avoid:** Any new persisted field needs: (1) added to FilterSlice interface, (2) added to filterDefaults, (3) added to the `partialize` return object in `store/index.ts`.

**Warning signs:** View preference resets to 'grid' on every page reload despite being set to 'list'.

### Pitfall 3: Retry Does Not Re-trigger useExplore Without a Dep Change

**What goes wrong:** Calling `setError(null)` alone does not re-trigger the `useEffect` in `useExplore` because `error` is not a dep. The grid stays empty after retry.

**Why it happens:** useExplore's useEffect deps are `[query, rateMin, rateMax, tags, sortBy, sageMode, ...]`. `error` is not in that list.

**How to avoid:** Use a `retryTrigger: number` counter in ResultsSlice. `retry()` increments it. Add `retryTrigger` to useExplore's dep array.

**Warning signs:** Retry button clicks have no effect — loading spinner never appears after pressing retry.

### Pitfall 4: Only One Card Expanded at a Time — Requires Parent State

**What goes wrong:** Each ExpertCard has its own `expanded` state. If two cards are tapped in sequence, both remain expanded simultaneously (state is isolated per card instance).

**Why it happens:** Local `useState` in ExpertCard is per-instance. No coordination exists between cards.

**How to avoid:** Add `expandedExpertId: string | null` state to ExpertGrid (or pass from MarketplacePage). Each ExpertCard receives `isExpanded` prop and an `onExpand(username)` callback instead of managing local state for this.

**Warning signs:** Multiple cards in the expanded state at once on mobile.

### Pitfall 5: Search Bar Placeholder Is Animated Overlay, Not HTML placeholder Attribute

**What goes wrong:** Changing the HTML `placeholder` attribute on the `<input>` element has no visible effect because the actual placeholder display is an absolutely-positioned `<motion.span>` overlay, not the native input placeholder.

**Why it happens:** The native placeholder is suppressed by the `value={localValue}` controlled input, and the cycling overlay renders on top when localValue is empty.

**How to avoid:** Update the `PLACEHOLDERS` array in `useHeaderSearch.ts`, not the `<input>` element's `placeholder` prop. Replace all cycling phrases with `['Name, company, keyword...']`.

**Warning signs:** After changing placeholder= on the input, the displayed text still shows old cycling phrases.

---

## Code Examples

### Verified patterns from existing codebase:

### filterSlice persistence pattern (adding a new persisted field)

```ts
// store/filterSlice.ts — add to interface + defaults
export interface FilterSlice {
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  // ...existing fields
}

const filterDefaults = {
  viewMode: 'grid' as const,
  // ...existing defaults
}

// In createFilterSlice:
setViewMode: (mode) => set({ viewMode: mode }),

// store/index.ts — partialize must include viewMode:
partialize: (state) => ({
  query:     state.query,
  rateMin:   state.rateMin,
  rateMax:   state.rateMax,
  tags:      state.tags,
  sortBy:    state.sortBy,
  sortOrder: state.sortOrder,
  viewMode:  state.viewMode,  // new
}),
```

### retryTrigger pattern for re-triggering useExplore

```ts
// store/resultsSlice.ts
export interface ResultsSlice {
  retryTrigger: number
  retry: () => void
  // ...existing
}

// In createResultsSlice:
retryTrigger: 0,
retry: () => set((s) => ({ error: null, retryTrigger: s.retryTrigger + 1 })),

// hooks/useExplore.ts — add to dep array:
const retryTrigger = useExplorerStore((s) => s.retryTrigger)
// ...
}, [query, rateMin, rateMax, tags, sortBy, sageMode, retryTrigger, ...])
```

### useMediaQuery hook (RootLayout.tsx)

```tsx
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}
```

### Desktop bypass in ExpertCard.handleCardClick

```tsx
function handleCardClick() {
  const isDesktop = window.innerWidth >= 768  // Tailwind md breakpoint
  if (isDesktop) {
    void trackEvent('card_click', {
      expert_id: expert.username,
      context,
      rank,
      active_filters: { ... },
    })
    onViewProfile(expert.profile_url)
    return
  }
  // Mobile two-tap behavior
  if (!isExpanded) {
    onExpand(expert.username)
  } else {
    void trackEvent('card_click', { ... })
    onViewProfile(expert.profile_url)
  }
}
```

Note: `expanded` local state should become `isExpanded` prop driven from ExpertGrid parent for the "one card expanded at a time" constraint.

### VirtuosoList for compact list view

```tsx
// frontend/src/components/marketplace/ExpertList.tsx
import { Virtuoso } from 'react-virtuoso'  // same package, 1D list export

export function ExpertList({ experts, loading, isFetchingMore, onEndReached, onViewProfile }: ExpertGridProps) {
  if (loading && experts.length === 0) return <SkeletonGrid />
  if (!loading && experts.length === 0) return <EmptyState />
  return (
    <Virtuoso
      data={experts}
      endReached={onEndReached}
      overscan={400}
      itemContent={(index, expert) => (
        <ExpertListRow expert={expert} onViewProfile={onViewProfile} rank={index} />
      )}
      components={{ Footer: () => isFetchingMore ? <div className="h-12 animate-pulse bg-gray-50" /> : null }}
      style={{ height: '100%' }}
    />
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `md:hidden` to hide mobile components | JS conditional render for Drawer portals | Phase 47 (this phase) | Prevents Vaul portal leaking to desktop DOM |
| All-viewport tap-to-expand on cards | Desktop direct-open, mobile two-tap | Phase 47 (this phase) | Desktop UX matches standard browsing behavior |
| Empty grid on API failure | Error state with retry | Phase 47 (this phase) | Users get recovery path instead of confusion |

---

## Open Questions

1. **Expanded card coordination — prop vs store**
   - What we know: "Only one card expanded at a time" is a locked decision; local useState per card does not coordinate
   - What's unclear: Whether to use ExpertGrid useState (lightweight) or add expandedExpertId to the Zustand store (globally accessible)
   - Recommendation: ExpertGrid-level `useState<string|null>(null)` for `activeExpandedId`, passed as prop to ExpertCard. Avoids Zustand pollution for ephemeral UI state.

2. **List view skeleton**
   - What we know: SkeletonGrid exists and is used by both ExpertGrid and (now) ExpertList; Claude has discretion on skeleton design for list view
   - What's unclear: Whether to create a separate SkeletonList or reuse SkeletonGrid
   - Recommendation: Create a simple SkeletonList (3–5 animated rows) rather than reusing the card grid skeleton — visual mismatch would be jarring.

3. **Retry button loading state**
   - What we know: Claude has discretion on retry UX (inline loading vs full reload)
   - Recommendation: Inline loading — after retry button click, show a spinner inside the button and let the existing `loading` state drive the skeleton grid. No full page reload needed.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — all findings verified against actual source files in `/Users/sebastianhamers/Documents/TCS/frontend/src/`
- `frontend/src/layouts/RootLayout.tsx` — Sage double-render root cause identified
- `frontend/src/components/marketplace/ExpertCard.tsx` — tap behavior + desktop bypass gap identified
- `frontend/src/store/filterSlice.ts` + `store/index.ts` — persistence pattern verified
- `frontend/src/hooks/useExplore.ts` — retry trigger gap identified
- `frontend/src/components/Header.tsx` — search bar classes + placeholder overlay structure verified
- `frontend/src/hooks/useHeaderSearch.ts` — PLACEHOLDERS array location confirmed

### Secondary (MEDIUM confidence)

- Vaul Drawer.Portal behavior (portal mounts to document.body regardless of CSS parent visibility) — known behavior of React portals generally; consistent with Vaul's implementation pattern
- react-virtuoso `Virtuoso` (1D list) for list view — same package as `VirtuosoGrid` (2D grid), standard usage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing packages verified in codebase
- Architecture: HIGH — all patterns derived from reading actual source files, not assumptions
- Pitfalls: HIGH — each pitfall identified from specific line-level code inspection, not speculation

**Research date:** 2026-02-27
**Valid until:** 2026-03-28 (stable UI codebase — no framework migrations in flight)
