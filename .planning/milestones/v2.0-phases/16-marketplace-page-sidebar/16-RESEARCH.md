# Phase 16: Marketplace Page & Sidebar - Research

**Researched:** 2026-02-21
**Domain:** React faceted sidebar UI — rate range slider, tag multi-select, active filter chips, debounced fetch, sticky collapsible layout, mobile bottom-sheet
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Sidebar layout:** Collapsible left panel — desktop users can collapse it to gain more grid space
- **Collapsed state:** Icon strip showing filter category icons (not fully hidden, not just a toggle arrow)
- **Sticky sidebar:** Stays fixed to viewport as user scrolls through results
- **Visual treatment:** Light background panel (gray-50 or similar) with a thin divider separating it from the grid
- **Rate range slider:** Debounce vs on-release timing is Claude's discretion
- **Domain tag multi-select:** Visual style (checkboxes, toggleable pills, dropdown) is Claude's discretion
- **Loading state:** Skeleton cards replace the expert grid while fetch is in flight
- **Text search:** Debounce on type (~300-400ms) AND Enter key triggers immediately
- **Active filter chips:** Horizontal strip above the expert grid, below the page header
- **Chip format:** Label + x to individually dismiss (e.g. "Marketing x", "EUR 50-100 x")
- **Expert count:** "X experts found" displayed near the chip strip, updates on each fetch result
- **Clear all:** Text link at end of chip strip — only visible when at least one filter is active
- **Mobile trigger:** Toolbar button at the top of the page (not a floating FAB)
- **Mobile sheet height:** Snap points — half height and full height, with a drag handle
- **Mobile apply behavior:** Staged — user configures all filters, then taps "Apply" which closes sheet and triggers fetch
- **Mobile dismiss paths:** Backdrop tap + drag down + Apply button

### Claude's Discretion

- Rate slider debounce timing (on-release vs debounce ms)
- Exact visual style for domain tag multi-select
- Skeleton card design
- Exact icon choices for the collapsed sidebar icon strip
- Sidebar width when open

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MARKET-01 | User sees faceted sidebar with rate range slider, domain tag multi-select, text search, and active filter chips | @radix-ui/react-slider for dual-handle range; Zustand filterSlice actions (setQuery, setRateRange, toggleTag) already in place; chips are pure derived UI from filter state |
| MARKET-06 | Sidebar collapses into a bottom-sheet on mobile viewports | vaul v1.1.2 for draggable bottom-sheet with snap points; Tailwind `hidden md:block` hides desktop sidebar on mobile; staged Apply pattern is a local state machine inside the sheet |
</phase_requirements>

---

## Summary

Phase 16 builds the visible marketplace frame: a sticky collapsible sidebar with rate range slider, domain tag multi-select, text search input, active filter chips, and a mobile bottom-sheet. The Zustand `useExplorerStore` from Phase 15 already owns the filter state (query, rateMin, rateMax, tags) and provides all the setter actions. Phase 16 wires UI controls to those actions, adds a `useExplore` fetch hook that calls `/api/explore`, and connects `onRehydrateStorage` to trigger an initial fetch on page load.

The two new dependencies needed are `@radix-ui/react-slider` (v1.3.6) for the dual-handle rate range slider, and `vaul` (v1.1.2) for the mobile bottom-sheet with snap points. Both are React 19-compatible. Everything else is built with Tailwind utility classes and no additional libraries. The domain tag multi-select is best implemented as a scrollable list of toggleable pill buttons — 1744 unique tags exist in the dataset, but only the top ~30 by frequency should be shown in the sidebar; a text input inside the multi-select panel allows searching the full set.

The fetch hook uses `AbortController` to cancel in-flight requests when filters change before the previous fetch completes. Text search is debounced at 350ms with an Enter key shortcut that bypasses the debounce. The rate slider uses `onValueCommit` (fires on release) rather than `onValueChange` (fires continuously) to avoid hammering the API while dragging. Mobile apply is staged: a local draft state inside the bottom-sheet is committed to the global store only when the user taps Apply.

**Primary recommendation:** Wire filter controls directly to Zustand slice actions. Build `useExplore` as a standalone custom hook that reads from the store, calls `/api/explore` with AbortController, and writes results back to the store. This keeps `MarketplacePage` as a thin layout component.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-slider | 1.3.6 | Accessible dual-handle rate range slider | Radix primitives: unstyled, WAI-ARIA compliant, `onValueCommit` for release-only events, `minStepsBetweenThumbs` for gap enforcement |
| vaul | 1.1.2 | Mobile bottom-sheet with snap points and drag handle | Purpose-built for this exact pattern; React 19 peer dep; built on Radix Dialog; snap points, backdrop, drag dismiss built-in |
| zustand (existing) | 5.0.11 | Filter and results state | Already installed; filterSlice actions are the write interface for all sidebar controls |
| tailwindcss (existing) | 3.4.19 | Utility classes for layout, sidebar, chips, skeleton | Already configured with brand colors; `animate-pulse` for skeletons |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react (existing) | 19.2.0 | useState for local UI state (sidebar collapsed, mobile draft filters) | Local UI state that doesn't need to survive navigation |
| AbortController (built-in) | Web API | Cancel in-flight `/api/explore` fetch when filters change | Always — no separate library needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @radix-ui/react-slider | react-slider (3.9kB) | react-slider is lighter but lacks `onValueCommit` — would require manual mouse-up tracking; Radix is preferred |
| @radix-ui/react-slider | Native HTML `<input type="range">` | Native does not support dual thumbs without custom JS; not viable for a rate range slider |
| vaul | Custom CSS bottom-sheet | Custom sheet needs gesture detection, snap-point physics, backdrop, focus trap, accessibility — substantial engineering; vaul provides all of this |
| vaul | Radix Dialog + CSS | Radix Dialog lacks drag gesture and snap points out of the box |
| Toggleable pill buttons for tag select | Combobox with dropdown | 1744 tags makes a full dropdown overwhelming; a scrollable pill panel with an inline search is more scannable for a sidebar context |

**Installation:**
```bash
npm install @radix-ui/react-slider vaul
```

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── pages/
│   └── MarketplacePage.tsx      # Layout: sidebar + results area; orchestrates all children
├── components/
│   ├── sidebar/
│   │   ├── FilterSidebar.tsx    # Desktop sticky sidebar (expanded + collapsed states)
│   │   ├── RateSlider.tsx       # Radix Slider wrapper, on-release fetch
│   │   ├── TagMultiSelect.tsx   # Scrollable pill list with inline search
│   │   ├── SearchInput.tsx      # Debounced text search with Enter shortcut
│   │   └── MobileFilterSheet.tsx # Vaul drawer with staged draft state
│   └── marketplace/
│       ├── FilterChips.tsx      # Active filter chip strip + count + clear-all
│       └── SkeletonGrid.tsx     # Skeleton card grid while loading
├── hooks/
│   └── useExplore.ts            # Fetch hook: reads store, calls /api/explore, writes results
└── store/                       # Existing — no changes needed this phase
```

### Pattern 1: Sticky Collapsible Sidebar with Icon Strip

**What:** A left panel that is sticky to the viewport. Collapsed state shows a narrow icon strip (not fully hidden). Toggled via a button. Width transitions with Tailwind `transition-all`.

**When to use:** Desktop viewports (`md:` and above). Hidden completely on mobile (sidebar replaced by vaul bottom-sheet).

**Important Tailwind sticky pitfall:** `position: sticky` fails if any ancestor has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`. The page layout must use a simple flex row — do not wrap the sidebar in any overflowing container.

```typescript
// Source: Tailwind CSS sticky positioning docs + community patterns
// frontend/src/components/sidebar/FilterSidebar.tsx

export function FilterSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        hidden md:flex flex-col
        sticky top-0 h-screen
        bg-gray-50 border-r border-gray-200
        transition-all duration-200
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center h-10 w-full border-b border-gray-200"
        aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
      >
        {collapsed ? <PanelRightOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      {/* Filter controls — hidden when collapsed, replaced by icon strip */}
      {collapsed ? (
        <IconStrip />          // Category icons only — no labels
      ) : (
        <FilterControls />     // Full controls: search, rate slider, tags
      )}
    </aside>
  )
}

// Page layout — CRITICAL: no overflow on parent of sticky sidebar
// frontend/src/pages/MarketplacePage.tsx
export default function MarketplacePage() {
  return (
    <div className="flex min-h-screen">
      <FilterSidebar />           {/* sticky to viewport */}
      <main className="flex-1 overflow-y-auto">
        <FilterChips />           {/* chip strip */}
        <ResultsArea />           {/* expert grid — Phase 17 */}
      </main>
    </div>
  )
}
```

### Pattern 2: Rate Range Slider with on-Release Fetch

**What:** `@radix-ui/react-slider` with two thumbs. Uses `onValueCommit` (fires only when user releases the drag, not continuously). Local state holds the display value during drag to avoid re-renders in the global store on every pixel.

**When to use:** Always for rate range — `onValueChange` would fire hundreds of times per drag, triggering hundreds of API calls. `onValueCommit` fires once on mouse/touch release.

**Rate bounds from real data:** Min: 8 EUR, Max: 2000 EUR, Median: 120 EUR. Default bounds: 0–2000 to cover the full range.

```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/slider
// frontend/src/components/sidebar/RateSlider.tsx

import * as Slider from '@radix-ui/react-slider'
import { useFilterSlice } from '../../store'

export function RateSlider() {
  const { rateMin, rateMax, setRateRange } = useFilterSlice()
  // Local display state: updates on every drag pixel without hitting Zustand/fetch
  const [localValue, setLocalValue] = useState([rateMin, rateMax])

  // Sync local display when store resets (e.g. "Clear all")
  useEffect(() => {
    setLocalValue([rateMin, rateMax])
  }, [rateMin, rateMax])

  return (
    <div className="px-4 py-3">
      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>EUR {localValue[0]}</span>
        <span>EUR {localValue[1]}</span>
      </div>
      <Slider.Root
        min={0}
        max={2000}
        step={10}
        minStepsBetweenThumbs={1}
        value={localValue}
        onValueChange={setLocalValue}          // update display only
        onValueCommit={(val) => {              // trigger fetch only on release
          setRateRange(val[0], val[1])         // write to Zustand → triggers useExplore
        }}
        className="relative flex items-center select-none touch-none w-full h-5"
      >
        <Slider.Track className="bg-gray-200 relative grow rounded-full h-1">
          <Slider.Range className="absolute bg-brand-purple rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-white border-2 border-brand-purple rounded-full shadow focus:outline-none" />
        <Slider.Thumb className="block w-4 h-4 bg-white border-2 border-brand-purple rounded-full shadow focus:outline-none" />
      </Slider.Root>
    </div>
  )
}
```

### Pattern 3: Text Search with Debounce + Enter Key

**What:** Controlled input that debounces store writes at 350ms. Enter key triggers immediately (bypasses debounce timer). Uses `useRef` for the debounce timer to avoid re-renders.

**Recommendation:** 350ms debounce (center of the 300-400ms user-specified range). On-release for rate slider (not debounced). This gives text search the most responsive feel while protecting the API.

```typescript
// Source: usehooks-ts useDebounce pattern + AbortController best practice
// frontend/src/components/sidebar/SearchInput.tsx

import { useRef, useEffect, useState } from 'react'
import { useFilterSlice } from '../../store'

const DEBOUNCE_MS = 350

export function SearchInput() {
  const { query, setQuery } = useFilterSlice()
  const [localValue, setLocalValue] = useState(query)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from store (e.g. when "Clear all" resets query to '')
  useEffect(() => {
    setLocalValue(query)
  }, [query])

  const triggerSearch = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setQuery(value)  // write to Zustand → triggers useExplore
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalValue(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => triggerSearch(value), DEBOUNCE_MS)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      triggerSearch(localValue)  // bypasses debounce
    }
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return (
    <input
      type="search"
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Search experts..."
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
    />
  )
}
```

### Pattern 4: Domain Tag Multi-Select as Scrollable Pill List

**Recommendation:** Scrollable list of toggleable pill buttons — not a dropdown. The sidebar already has vertical space; a flat list is faster to scan than a dropdown. Show top 30 tags by frequency as the default set (covering the most common expert domains). Include a small inline search field at the top of the tag list to filter down the 1744 available tags.

**Top domain tags (by expert count):** fundraising (26), real estate (25), entrepreneurship (25), digital marketing (20), marketing strategy (20), SaaS (19), digital transformation (19), go-to-market strategy (18), brand strategy (17), venture capital (17).

**API constraint:** The `/api/explore` endpoint accepts `tags` as a comma-separated query param. Tag filter uses AND logic (expert must have ALL selected tags). This means selecting many tags narrows results aggressively — the UI should reflect this.

```typescript
// frontend/src/components/sidebar/TagMultiSelect.tsx
import { useFilterSlice } from '../../store'

const TOP_TAGS = [
  'fundraising', 'real estate', 'entrepreneurship', 'digital marketing',
  'marketing strategy', 'saas', 'digital transformation', 'go-to-market strategy',
  'brand strategy', 'venture capital', 'artificial intelligence', 'supply chain',
  'business development', 'private equity', 'change management',
  'business scaling', 'sales strategy', 'mergers & acquisitions',
  'web development', 'product development', 'e-commerce', 'ai strategy',
  'corporate finance', 'event management', 'growth marketing',
  'process optimization', 'startup scaling', 'commercial strategy',
  'leadership coaching', 'financial planning',
]

export function TagMultiSelect() {
  const { tags, toggleTag } = useFilterSlice()
  const [search, setSearch] = useState('')

  const filtered = TOP_TAGS.filter((t) =>
    t.includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <input
        type="text"
        placeholder="Filter tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-purple"
      />
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {filtered.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`
              text-xs px-2 py-1 rounded-full border transition-colors
              ${tags.includes(tag)
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-purple'}
            `}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Pattern 5: Active Filter Chips Strip

**What:** Derived from Zustand filter state. Renders a chip for each active filter. Each chip has a dismiss button. Count shows `total` from the last fetch result. "Clear all" link only visible when at least one filter is active.

```typescript
// frontend/src/components/marketplace/FilterChips.tsx
import { useFilterSlice, useResultsSlice } from '../../store'

export function FilterChips() {
  const { query, rateMin, rateMax, tags, setQuery, setRateRange, toggleTag, resetFilters } = useFilterSlice()
  const { total } = useResultsSlice()

  const defaultRateMin = 0
  const defaultRateMax = 2000

  const chips = [
    ...(query ? [{ label: `"${query}"`, onDismiss: () => setQuery('') }] : []),
    ...(rateMin !== defaultRateMin || rateMax !== defaultRateMax
      ? [{ label: `EUR ${rateMin}–${rateMax}`, onDismiss: () => setRateRange(defaultRateMin, defaultRateMax) }]
      : []),
    ...tags.map((tag) => ({ label: tag, onDismiss: () => toggleTag(tag) })),
  ]

  const hasFilters = chips.length > 0

  if (!hasFilters && total === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500 shrink-0">{total} experts found</span>
      {chips.map((chip) => (
        <span key={chip.label} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5">
          {chip.label}
          <button
            onClick={chip.onDismiss}
            aria-label={`Remove ${chip.label} filter`}
            className="hover:text-gray-900 ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      {hasFilters && (
        <button
          onClick={resetFilters}
          className="text-xs text-brand-purple hover:underline ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
```

### Pattern 6: useExplore Fetch Hook with AbortController

**What:** A custom hook that watches Zustand filter state and calls `/api/explore` on changes. Uses `AbortController` to cancel in-flight requests. Writes results, total, and cursor back to the store via `setResults`/`setLoading`/`setError`.

**This hook also satisfies the `onRehydrateStorage` requirement** from Phase 15: the store's `onRehydrateStorage` comment reads `// Phase 16+ wires: _state?.triggerSearch()`. The pattern below uses Zustand's store subscription via `useEffect` dependencies instead of the `onRehydrateStorage` hook directly, which is simpler and more testable.

```typescript
// Source: AbortController + useEffect cleanup pattern (verified Web platform standard)
// frontend/src/hooks/useExplore.ts

import { useEffect, useRef } from 'react'
import { useExplorerStore } from '../store'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function useExplore() {
  const query    = useExplorerStore((s) => s.query)
  const rateMin  = useExplorerStore((s) => s.rateMin)
  const rateMax  = useExplorerStore((s) => s.rateMax)
  const tags     = useExplorerStore((s) => s.tags)
  const sortBy   = useExplorerStore((s) => s.sortBy)

  const setLoading  = useExplorerStore((s) => s.setLoading)
  const setResults  = useExplorerStore((s) => s.setResults)
  const setError    = useExplorerStore((s) => s.setError)
  const resetResults = useExplorerStore((s) => s.resetResults)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const params = new URLSearchParams({
      query,
      rate_min: String(rateMin),
      rate_max: String(rateMax),
      tags:     tags.join(','),
      limit:    '20',
      cursor:   '0',
    })

    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/api/explore?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setResults(data.experts, data.total, data.cursor)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return  // intentional cancel — not an error
        setError(err.message ?? 'Fetch failed')
        resetResults()
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      controller.abort()  // cleanup on dependency change or unmount
    }
  }, [query, rateMin, rateMax, tags, sortBy, setLoading, setResults, setError, resetResults])
}
```

Call this hook once at the top of `MarketplacePage` — it self-manages based on filter state changes.

### Pattern 7: Mobile Bottom-Sheet (vaul)

**What:** Vaul `Drawer` with two snap points (half and full height) and a drag handle. Staged apply: filter controls inside the sheet write to local `useState` draft; Apply button commits to global store and closes the sheet.

```typescript
// Source: https://vaul.emilkowal.ski/snap-points
// frontend/src/components/sidebar/MobileFilterSheet.tsx

import { Drawer } from 'vaul'
import { useState } from 'react'
import { useFilterSlice } from '../../store'

const SNAP_POINTS = [0.5, 1] as const

export function MobileFilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { query, rateMin, rateMax, tags, setQuery, setRateRange, resetFilters } = useFilterSlice()
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0])

  // Local draft — not committed until Apply is tapped
  const [draft, setDraft] = useState({ query, rateMin, rateMax, tags })

  const handleApply = () => {
    setQuery(draft.query)
    setRateRange(draft.rateMin, draft.rateMax)
    // toggleTag is delta-based — apply full tag diff
    // simplest: use resetFilters + re-apply all draft tags via store actions
    // (Implementation detail: call store directly via useExplorerStore.getState())
    onClose()
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 bg-black/40"
          onClick={onClose}
        />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
            <span className="font-medium text-sm">Filters</span>
            <button
              className="text-sm text-brand-purple font-medium"
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
          {/* Draft filter controls here — same components, wired to draft state */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* SearchInput, RateSlider, TagMultiSelect — wired to draft, not store */}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

**Mobile toolbar trigger (locked decision — toolbar button, not FAB):**

```typescript
// In the page header / top toolbar — visible only on mobile (md:hidden)
<button
  onClick={() => setSheetOpen(true)}
  className="md:hidden flex items-center gap-1.5 text-sm border border-gray-300 rounded-md px-3 py-1.5"
>
  <FilterIcon size={16} />
  Filters {tags.length + (query ? 1 : 0) > 0 && `(${tags.length + (query ? 1 : 0)})`}
</button>
```

### Pattern 8: Skeleton Card Grid

**What:** Shown when `loading === true` in the results slice. Replaces the expert grid. Uses Tailwind `animate-pulse`.

```typescript
// frontend/src/components/marketplace/SkeletonGrid.tsx
// Source: Tailwind CSS animate-pulse (official docs: tailwindcss.com/docs/animation)

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 bg-gray-200 rounded-full w-16" />
        <div className="h-5 bg-gray-200 rounded-full w-20" />
        <div className="h-5 bg-gray-200 rounded-full w-14" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **`overflow` on sidebar parent:** Any ancestor with `overflow: hidden/auto/scroll` breaks `position: sticky`. The flex row layout must have no overflow container wrapping the sidebar.
- **`onValueChange` for rate slider:** Fires on every pixel drag — hundreds of API calls per interaction. Always use `onValueCommit`.
- **Writing mobile draft to Zustand directly:** Mobile is staged. Never write draft filters to the global store until Apply is tapped. Use local `useState` inside the sheet.
- **No AbortController:** Without abort cleanup, rapid filter changes leave stale fetch responses that can overwrite newer results with older data.
- **Re-mounting chip strip on every fetch:** Chips derive from filter state (not from API response) — they render instantly. Only the result count needs the fetch response.
- **Passing `setLoading`/`setError` etc. into `useExplore` dependency array without `useCallback`:** Since these are Zustand actions (stable references), they are safe in the dep array without `useCallback`. Zustand actions are referentially stable across renders.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dual-handle range slider | `<input type="range">` with custom JS | `@radix-ui/react-slider` | Keyboard accessibility, ARIA, thumb overlap prevention, touch support — 300+ edge cases |
| Mobile bottom-sheet with snap + drag | Custom CSS + touch event listeners | `vaul` | Gesture physics, snap-point momentum, backdrop, focus trap, iOS overscroll fix, accessibility |
| In-flight request cancellation | Race condition flag (`let cancelled = false`) | `AbortController` | Native cancellation signal propagates through fetch; avoids stale closures and memory leaks |
| Debounce implementation | Lodash debounce import | Inline `useRef` timer | No library dependency; 5-line implementation; avoids re-render on timer setup |

**Key insight:** The slider and bottom-sheet problems both look simple but contain dozens of edge cases around keyboard nav, touch events, and accessibility. Using the Radix and vaul primitives means those edge cases are already solved.

---

## Common Pitfalls

### Pitfall 1: `position: sticky` Fails Due to Ancestor Overflow

**What goes wrong:** Sidebar scrolls with the page instead of staying fixed.
**Why it happens:** `position: sticky` requires all ancestor elements to have `overflow: visible`. If any parent has `overflow: hidden`, `overflow: auto`, or `overflow: scroll`, the sticky element is contained within that ancestor and cannot stick to the viewport.
**How to avoid:** Use a simple top-level `div` with `className="flex min-h-screen"`. Never wrap the sidebar in a container with overflow. The sidebar uses `sticky top-0 h-screen overflow-y-auto` (overflowing within itself is fine).
**Warning signs:** Sidebar scrolls away when user scrolls results; CSS inspector shows `position: sticky` on element but it behaves like `position: relative`.

### Pitfall 2: Stale Fetch Results Overwriting Fresh Results

**What goes wrong:** User types quickly; an older slow response arrives after a newer fast one, overwriting the correct results with stale data.
**Why it happens:** Two concurrent fetches complete out of order. Without cancellation, both call `setResults()`.
**How to avoid:** Every `useEffect` run creates a new `AbortController`. The cleanup function calls `controller.abort()`. The catch block checks `err.name === 'AbortError'` and silently returns. This ensures only the latest fetch's response ever writes to the store.
**Warning signs:** Results flicker or revert; result count briefly shows wrong number.

### Pitfall 3: Mobile Sheet Writing to Global Store During Staging

**What goes wrong:** User is mid-configuration in the mobile sheet; the desktop results area live-updates as they toggle tags, defeating the staged UX.
**Why it happens:** Sheet controls wired directly to Zustand actions cause immediate store updates, which trigger `useExplore` re-fetch.
**How to avoid:** Sheet components use local `useState` draft mirrors of the filter state. Only `handleApply()` writes to the global store. Initialize draft from current store state when the sheet opens.
**Warning signs:** Results grid updates while the sheet is open; live debounced fetches fire from mobile.

### Pitfall 4: Tags Array Identity Causing Infinite `useExplore` Loop

**What goes wrong:** `useExplore` re-fetches in an infinite loop even when no filters change.
**Why it happens:** `tags` from `useFilterSlice()` returns an array — even if values are identical, array identity differs each render. Listing `tags` as a dep causes the effect to re-run every render.
**How to avoid:** Select `tags` directly via `useExplorerStore((s) => s.tags)` — Zustand stores the exact same array reference until `toggleTag` is called (which returns a new array via `filter`/`spread`). Do NOT go through `useShallow` + an object selector for `useExplore` deps — use individual scalar and array selectors.
**Warning signs:** Network tab shows `/api/explore` being called continuously with no user interaction.

### Pitfall 5: `onValueCommit` Not Available on Touch (iOS Safari)

**What goes wrong:** `onValueCommit` fires on desktop mouse release but not on iOS touch-end.
**Why it happens:** Radix Slider v1.3.6 handles this correctly. This pitfall applies only if building a custom slider.
**How to avoid:** Use `@radix-ui/react-slider` — this is a solved problem in their implementation.
**Warning signs:** Slider works on desktop but doesn't trigger search on mobile.

### Pitfall 6: Vaul Snap Points Skipped at High Velocity

**What goes wrong:** User flicks the sheet and it jumps from half to fully closed, skipping the full-height snap point.
**Why it happens:** Vaul's default velocity-based snapping can skip intermediate snap points.
**How to avoid:** Add `snapToSequentialPoint` prop to `Drawer.Root` to ensure snap points are traversed sequentially regardless of drag velocity.
**Warning signs:** Sheet jumps from 50% directly to closed when user drags quickly downward.

---

## Code Examples

Verified patterns from official sources:

### Install Dependencies

```bash
npm install @radix-ui/react-slider vaul
```

### @radix-ui/react-slider Range Slider (dual thumb)

```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/slider
import * as Slider from '@radix-ui/react-slider'

<Slider.Root
  min={0}
  max={2000}
  step={10}
  value={[rateMin, rateMax]}
  onValueChange={setLocalValue}    // display only during drag
  onValueCommit={(val) => setRateRange(val[0], val[1])}  // triggers fetch on release
  minStepsBetweenThumbs={1}
>
  <Slider.Track>
    <Slider.Range />
  </Slider.Track>
  <Slider.Thumb />  {/* min thumb */}
  <Slider.Thumb />  {/* max thumb */}
</Slider.Root>
```

### Vaul Bottom-Sheet with Snap Points

```typescript
// Source: https://vaul.emilkowal.ski/snap-points
import { Drawer } from 'vaul'
const snapPoints = [0.5, 1]
const [snap, setSnap] = useState(snapPoints[0])

<Drawer.Root
  snapPoints={snapPoints}
  activeSnapPoint={snap}
  setActiveSnapPoint={setSnap}
  snapToSequentialPoint
>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl">
      <div className="mx-auto w-10 h-1 rounded-full bg-gray-300 mt-3 mb-2" />
      {/* content */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### AbortController Fetch Cleanup in useEffect

```typescript
// Source: Web platform AbortController API — MDN + React docs useEffect cleanup
useEffect(() => {
  const controller = new AbortController()

  fetch(`/api/explore?${params}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setResults(data.experts, data.total, data.cursor))
    .catch(err => {
      if (err.name === 'AbortError') return  // cancelled — not an error
      setError(err.message)
    })
    .finally(() => setLoading(false))

  return () => controller.abort()  // cancel on deps change or unmount
}, [query, rateMin, rateMax, tags])
```

### Tailwind Sticky Layout (avoid overflow pitfall)

```typescript
// Source: Tailwind CSS sticky docs + community verified pattern
// Key: flex row at top level, no overflow on sidebar parent
<div className="flex min-h-screen">
  {/* Sticky sidebar — no parent overflow */}
  <aside className="sticky top-0 h-screen w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto hidden md:flex flex-col">
    {/* filter controls */}
  </aside>
  {/* Main content — scrollable independently */}
  <main className="flex-1 min-h-screen">
    {/* chips + grid */}
  </main>
</div>
```

---

## API Contract Reference

`GET /api/explore` — confirmed from Phase 14 implementation:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `query` | string | `""` | Text search; empty = pure filter mode (sort by findability) |
| `rate_min` | float | `0.0` | Inclusive lower bound |
| `rate_max` | float | `10000.0` | Inclusive upper bound |
| `tags` | string | `""` | Comma-separated; AND logic (expert must have ALL) |
| `limit` | int | `20` | Max results per page (1–100) |
| `cursor` | int | `0` | Offset for pagination |

Response shape (`ExploreResponse`):

```typescript
{
  experts: ExpertCard[]   // array of expert objects
  total: number           // pre-filter count — for "N experts found"
  cursor: number | null   // next offset; null = no more pages
  took_ms: number         // server processing time
}
```

`ExpertCard` fields:
- `username`, `firstName`, `lastName`, `jobTitle`, `company`
- `hourlyRate: number`
- `tags: string[]`
- `findabilityScore: number | null`
- `matchReason: string | null` (null when query is empty)
- `category: string | null`
- `finalScore: number`

**Rate data bounds (530 experts):** Min 8 EUR, Max 2000 EUR, Median 120 EUR. Slider defaults: 0–2000.

**Tag data:** 1744 unique tags across 530 experts. Top 10: fundraising, real estate, entrepreneurship, digital marketing, marketing strategy, SaaS, digital transformation, go-to-market strategy, brand strategy, venture capital.

**No dedicated tags endpoint exists.** Top-30 tags must be hardcoded in the sidebar or fetched from a new endpoint. Recommendation: hardcode the top-30 list derived from metadata.json at build time (list is stable).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<input type="range">` pair with custom JS for dual handle | `@radix-ui/react-slider` with two `Slider.Thumb` components | Radix UI stable (~2022) | Keyboard nav, touch, ARIA, thumb overlap handled |
| `onValueChange` for price filter (fetch on drag) | `onValueCommit` (fetch on release) | Radix UI v1.0+ | Eliminates API hammering during drag |
| CSS-only drawer / modal with `transform: translateY` | vaul with Radix Dialog primitive + snap physics | vaul v1.0 (2023) | Drag gesture + snap points + accessibility out of the box |
| `setTimeout` race condition flags for fetch cancel | `AbortController` signal passed to `fetch()` | Widely supported since 2018 | Proper cancellation propagates through the network stack |

**Deprecated/outdated:**
- `document.querySelector` event listeners for drag: superseded by vaul's built-in gesture handling.
- `useDebounce` library import for simple cases: a 5-line inline `useRef` timer is sufficient and avoids a dependency.

---

## Open Questions

1. **Icon library for collapsed sidebar icon strip**
   - What we know: CONTEXT.md marks icon choices as Claude's discretion.
   - What's unclear: No icon library is currently installed in the project (package.json has none).
   - Recommendation: Use `lucide-react` — lightest tree-shakeable option; pair well with Tailwind; install `npm install lucide-react`. Category icons for the strip: Search (text search), DollarSign (rate range), Tag (domain tags). This is 3 icons total.

2. **Tag population strategy: hardcode vs endpoint**
   - What we know: No `/api/tags` endpoint exists. 1744 unique tags — showing all is impractical.
   - What's unclear: Whether the tag list should update dynamically as experts are added.
   - Recommendation: Hardcode the top 30 tags derived from the current metadata.json. Providing dynamic tags is Phase 19+ territory (ROBUST scope). For v2.0, a static curated list is correct.

3. **Initial fetch on page load (onRehydrateStorage wiring)**
   - What we know: store/index.ts has a placeholder comment `// Phase 16+ wires: _state?.triggerSearch()`.
   - What's unclear: Whether to use `onRehydrateStorage` callback or `useEffect` in `MarketplacePage`.
   - Recommendation: Use `useExplore` hook called from `MarketplacePage` — it reads from the store and fires on mount naturally. The `onRehydrateStorage` placeholder can remain as a no-op. This avoids coupling the store to a fetch function.

---

## Sources

### Primary (HIGH confidence)

- `https://www.radix-ui.com/primitives/docs/components/slider` — Slider API: `value`, `onValueChange`, `onValueCommit`, `minStepsBetweenThumbs`, dual-thumb pattern
- `https://vaul.emilkowal.ski/snap-points` — Vaul snap points API: `snapPoints`, `activeSnapPoint`, `setActiveSnapPoint`, `snapToSequentialPoint`, `fadeFromIndex`
- `npm info vaul version` + `npm info vaul peerDependencies` — confirmed v1.1.2, React 19 compatible
- `npm info @radix-ui/react-slider version` — confirmed v1.3.6, React 19 compatible
- `/Users/sebastianhamers/Documents/TCS/app/routers/explore.py` — `/api/explore` query params confirmed
- `/Users/sebastianhamers/Documents/TCS/app/services/explorer.py` — `ExploreResponse` shape confirmed
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/filterSlice.ts` — FilterSlice actions confirmed (`setQuery`, `setRateRange`, `toggleTag`, `resetFilters`)
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/index.ts` — `onRehydrateStorage` placeholder and `useFilterSlice`/`useResultsSlice` hooks confirmed
- Tailwind CSS `animate-pulse` — official docs for skeleton loader pattern
- `position: sticky` pitfall — Tailwind community discussions #1805, #5540 + Polypane sticky failure modes article

### Secondary (MEDIUM confidence)

- WebSearch findings on vaul snap points and React 19 peer dep compatibility (cross-verified against npm registry)
- WebSearch on @radix-ui/react-slider `onValueCommit` behavior (cross-verified against official docs)
- WebSearch on AbortController + useEffect cleanup pattern (widely documented; no single authoritative tutorial required)

### Tertiary (LOW confidence)

- None — all critical claims verified from primary or secondary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack (Radix slider, vaul): HIGH — versions verified from npm registry; React 19 peer deps confirmed
- Architecture (layout, sticky, hook): HIGH — patterns verified against Tailwind docs, Radix docs, vaul docs, and existing project structure
- API contract: HIGH — read directly from source files in the project
- Filter state integration: HIGH — read directly from existing store files
- Pitfalls: HIGH — sticky overflow pitfall documented in Tailwind community; AbortController pitfall is fundamental web platform behavior; vaul snap pitfall from official docs

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (Radix and vaul are stable; no major release anticipated in 30 days)
