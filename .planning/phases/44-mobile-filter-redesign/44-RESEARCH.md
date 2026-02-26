# Phase 44: Mobile Filter Redesign - Research

**Researched:** 2026-02-26
**Domain:** React mobile UI / Tailwind / Zustand / Vaul
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inline filter layout:**
- Filters sit in a horizontal scrollable row directly below the full-width search bar, above the expert grid
- Always visible without scrolling — no toggle/collapse needed
- Two dropdown buttons in the row: "Tags" and "Sort" (no rate range on mobile)
- Each is a compact dropdown button that opens a popover/menu on tap

**Tag selection pattern:**
- Tapping "Tags" opens a tag picker (Claude's discretion on format — scrollable checklist popover or full-screen picker, whichever works best for 18+ tags)
- Selected tags appear as removable "X" chips below the filter row
- Filters apply instantly on each tag toggle (debounced to prevent API spam)
- A prominent "Clear all" button appears when any tag is selected

**Rate range:**
- Rate range filter is removed from mobile entirely (no "More" button, not hidden anywhere)

**Sort dropdown:**
- Default: relevance
- Options: Relevance, Rate low-high, Rate high-low, Alphabetical (Name)

**Active filter feedback:**
- "Tags" button shows badge count e.g. "Tags (3)" when tags are selected
- Result count e.g. "24 experts" displayed near filter row or top of grid
- Empty state: "No experts match your filters" with prominent "Clear filters" button

### Claude's Discretion

- Tag picker format (scrollable checklist popover vs full-screen modal — pick what works best for 18+ tags on mobile)
- Exact positioning and sizing of the clear-all button (must be prominent)
- Dropdown animation/transition style
- Debounce timing for instant filter apply
- Loading state while filters update

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOB-01 | Mobile filters use inline dropdown-style controls instead of Vaul bottom-sheet | Replace `MobileFilterSheet.tsx` (Vaul `Drawer`) with a new inline filter row component. Zustand `filterSlice` + `useExplore` already reactively fetch on state change — debounced `toggleTag` calls will trigger re-fetches automatically. No API changes needed. |
| MOB-02 | Search bar takes full viewport width on mobile | `Header.tsx` currently wraps the search bar in `flex-1 max-w-2xl` — on mobile this already grows but is constrained by the logo. The fix is either hiding the logo on mobile or restructuring Header for mobile to make the search full-width (e.g., `w-full` without the logo sharing the row). |
</phase_requirements>

---

## Summary

Phase 44 replaces the existing `MobileFilterSheet` (a Vaul drawer) with an always-visible inline filter row on mobile. The change is contained entirely to the React frontend with no backend impact. The Zustand `filterSlice` already has all required actions (`toggleTag`, `setSortBy`, `resetFilters`), and `useExplore` already re-fetches on every store change — so the new inline controls just need to call the same actions the desktop sidebar already calls.

The `sortBy` field exists in `filterSlice` (`'relevance' | 'rate_asc' | 'rate_desc'`) but the API does not yet consume it — this is the existing behavior (useExplore lists it in its dep array for future use). The Sort dropdown should write to `filterSlice.setSortBy` using the existing field; the API wiring is already partially in place.

For the tag picker, a full-screen modal overlay (not a popover anchored to the button) is recommended given 30 available tags on a small screen. A popover positioned absolutely below a button is prone to clipping at viewport edges on mobile. A full-screen sheet (using plain div + fixed positioning, NOT Vaul) is simpler to implement, avoids z-index collisions with the Sage FAB, and gives users enough space to read all 30 tags. Vaul package must stay installed because `SageMobileSheet` continues to use it.

**Primary recommendation:** Build a new `MobileInlineFilters` component that renders inline on mobile only (`md:hidden`), remove the `MobileFilterSheet` import and usage from `MarketplacePage`, and add a debounced wrapper around `toggleTag` calls to prevent API hammering.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component model | Already in project |
| Tailwind CSS | 3.4.19 | Utility styling, responsive breakpoints | Already in project |
| Zustand | 5.0.11 | Filter state (`filterSlice`) | Already in project — all filter actions exist |
| motion/react | 12.34.3 | Dropdown open/close animation | Already in project — used throughout |
| vaul | 1.1.2 | SageMobileSheet only — must NOT be removed | Already in project, `SageMobileSheet` depends on it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-slider | 1.3.6 | Already used by desktop RateSlider | Not needed for mobile (rate removed) |
| lucide-react | 0.575.0 | Icons (ChevronDown, X, Tag, ArrowUpDown) | For dropdown button icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled full-screen tag picker | Radix Dialog or Headless UI Combobox | Neither is installed; hand-rolled with `fixed inset-0` is 20 lines and sufficient |
| Plain `useState` for open/close | Zustand | Local component state is correct — open/closed is ephemeral UI, not filter state |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── components/
│   ├── sidebar/
│   │   └── MobileFilterSheet.tsx     ← DELETE (replaced)
│   └── marketplace/
│       ├── MobileInlineFilters.tsx   ← NEW: the inline filter row + tag picker
│       ├── FilterChips.tsx           ← MODIFY: hide rate chip on mobile (rate removed)
│       └── EmptyState.tsx            ← MODIFY or REUSE: add "No experts match" empty state
└── pages/
    └── MarketplacePage.tsx           ← MODIFY: remove MobileFilterSheet, add MobileInlineFilters
```

### Pattern 1: Inline Filter Row (Mobile Only)

**What:** A horizontally scrollable row of compact dropdown buttons rendered only on mobile (`md:hidden`), positioned below the full-width search bar and above the expert grid. Each button manages its own `isOpen` local state. Calling `toggleTag` or `setSortBy` directly on the Zustand store triggers `useExplore` re-fetch automatically.

**When to use:** Always on mobile (the row is always visible, no toggle needed).

**Example:**
```tsx
// MobileInlineFilters.tsx — skeleton pattern
import { useState, useCallback } from 'react'
import { useExplorerStore, useFilterSlice, useResultsSlice } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

export function MobileInlineFilters() {
  const { tags, sortBy, toggleTag, setSortBy, resetFilters } = useFilterSlice()
  const { total } = useResultsSlice()
  const loading = useExplorerStore((s) => s.loading)

  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  // Debounce: prevent API hammer on rapid tag taps
  // Use useCallback + setTimeout pattern (no extra deps)
  const debouncedToggleTag = useDebouncedToggle(toggleTag, 150)

  return (
    <div className="md:hidden flex flex-col shrink-0">
      {/* Filter row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto">
        {/* Tags button */}
        <button onClick={() => setTagPickerOpen(true)} className="...">
          {tags.length > 0 ? `Tags (${tags.length})` : 'Tags'}
        </button>
        {/* Sort button */}
        <button onClick={() => setSortOpen(true)} className="...">
          Sort
        </button>
        {/* Result count */}
        <span className="ml-auto text-xs text-gray-500 shrink-0">
          {total} experts
        </span>
      </div>

      {/* Active tag chips row */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap px-4 py-2 border-b border-gray-100">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 ...">
              {tag}
              <button onClick={() => toggleTag(tag)}>×</button>
            </span>
          ))}
          {/* Prominent Clear all — must jump out */}
          <button onClick={resetFilters} className="bg-brand-purple text-white ...">
            Clear all
          </button>
        </div>
      )}

      {/* Full-screen tag picker (fixed overlay, not Vaul) */}
      {tagPickerOpen && (
        <TagPickerSheet
          selectedTags={tags}
          onToggle={debouncedToggleTag}
          onClose={() => setTagPickerOpen(false)}
        />
      )}

      {/* Sort picker (small bottom sheet or simple absolute menu) */}
      {sortOpen && (
        <SortSheet sortBy={sortBy} onSelect={setSortBy} onClose={() => setSortOpen(false)} />
      )}
    </div>
  )
}
```

### Pattern 2: Debounce for Instant Filter Apply Without API Hammering

**What:** Wrap `toggleTag` in a local debounce so rapid successive taps accumulate before triggering the store update (which triggers `useExplore`). The `useExplore` hook already cancels the previous request with `AbortController` — so even without debouncing, API responses are deduplicated. But debouncing prevents initiating many sequential requests.

**Recommended approach:** 150–300ms debounce. This is short enough to feel instant, but prevents a rapid 3-tap sequence from sending 3 separate API calls.

**Example:**
```ts
// Simple debounce hook — no external deps
function useDebounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay]) as T
}
```

**Alternative:** Because `useExplore` already uses `AbortController`, debouncing is a UX nicety but not strictly required for correctness. The planner may choose to skip the debounce and rely on AbortController alone (which is the existing desktop behavior).

### Pattern 3: Full-Screen Tag Picker (No Vaul)

**What:** A fixed overlay covering the entire screen, containing a scrollable checklist of all 30 tags with checkboxes, a tag search input, and a close button. Uses `fixed inset-0 z-50 bg-white flex flex-col` — no external library needed.

**Why not a popover:** 30 tags at mobile font sizes require substantial vertical space. A popover anchored to the "Tags" button would be taller than the viewport. A full-screen sheet matches native mobile conventions (e.g., iOS action sheets) and avoids z-index conflicts.

**Why not Vaul:** Vaul is reserved for `SageMobileSheet` — using it for the tag picker would create two Vaul instances that could conflict. A plain fixed overlay is simpler and lighter.

### Pattern 4: Sort Bottom Sheet (Simple)

**What:** A small fixed panel at the bottom of the screen with 4 sort options. Simpler than the tag picker — just a list of buttons. Can use `fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl` with a drag handle for visual consistency. Does NOT need Vaul.

### Anti-Patterns to Avoid

- **Keeping the Vaul filter drawer open as a fallback:** The drawer must be fully removed from `MarketplacePage`. Otherwise the "Filters" button in the mobile toolbar remains and two filter interfaces coexist.
- **Putting debounce in `filterSlice`:** Store actions must remain synchronous. Debounce belongs at the call site in the component.
- **Calling `setSortBy` without implementing sort on the API:** `sortBy` writes to Zustand and triggers `useExplore` via its dep array, but `/api/explore` doesn't yet consume `sortBy`. The dropdown should still be wired — the store and trigger are in place, and the API wiring is a separate future task. The Sort dropdown UX works correctly even before API-side sort is implemented.
- **Using `useShallow` for tags array in `useExplore`:** The existing hook avoids this deliberately (see comment: "Pitfall 4: tags via useShallow returns new object ref each render → infinite loop"). Do not change this pattern.
- **Removing `vaul` from `package.json`:** `SageMobileSheet` uses it. Removing it breaks Sage.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce timing | Custom debounce with complex queuing | Simple `useRef` + `setTimeout` hook | Edge cases: flush on unmount, cancel on re-render. The simple pattern covers all this project needs. |
| Tag search/filter within picker | Complex fuzzy search | `tag.includes(searchTerm.toLowerCase())` | Already used in `MobileFilterSheet` — copy exact pattern. |
| Sort option state | New Zustand slice | Existing `filterSlice.setSortBy` + `sortBy` field | Field already exists with type `'relevance' | 'rate_asc' | 'rate_desc'` |

**Key insight:** The entire filter data model already exists in Zustand. This phase is purely a UI replacement — no new state management primitives are needed.

---

## Common Pitfalls

### Pitfall 1: Breaking the Sage Mobile Sheet

**What goes wrong:** Changing `vaul` import paths, removing the package, or introducing a second `Drawer.Root` that conflicts with `SageMobileSheet`.
**Why it happens:** Both `MobileFilterSheet` and `SageMobileSheet` use `vaul` — developer removing filter sheet might also remove vaul.
**How to avoid:** Delete only `MobileFilterSheet.tsx`. Confirm `vaul` remains in `package.json`. The `SageMobileSheet` in `RootLayout` must not be touched.
**Warning signs:** Sage FAB stops opening the chat sheet on mobile.

### Pitfall 2: Mobile Toolbar Remnant

**What goes wrong:** The `md:hidden` mobile toolbar in `MarketplacePage` still renders the old "Filters" button (the `SlidersHorizontal` button that opened `MobileFilterSheet`).
**Why it happens:** The toolbar is a separate div from `MobileFilterSheet` — deleting the sheet component does not remove the trigger button.
**How to avoid:** The entire mobile toolbar div (lines ~99–130 in `MarketplacePage.tsx`) must be replaced or restructured. The new `MobileInlineFilters` component subsumes the toolbar's role.
**Warning signs:** Two filter UIs visible at once, or an orphaned "Filters" button that does nothing.

### Pitfall 3: Header Search Bar Width on Mobile

**What goes wrong:** `Header.tsx` renders the search bar inside `flex-1 max-w-2xl` alongside the logo. On small screens, the logo takes up ~40–48px, leaving the search bar narrower than full width.
**Why it happens:** Both logo and search share the same flex row with no breakpoint separation.
**How to avoid:** For MOB-02, either (a) hide the logo on mobile with `hidden md:block` on the logo wrapper and restructure the mobile header to show full-width search, or (b) use `w-full` on the search wrapper on mobile with the logo absolutely positioned. Option (a) is cleaner given the existing header structure.
**Warning signs:** Search bar on mobile still has logo beside it, not spanning full width.

### Pitfall 4: FilterChips Rate Chip Appearing on Mobile

**What goes wrong:** `FilterChips` shows an `EUR 0–5000` chip only when rate deviates from defaults, but `FilterChips` is shared between mobile and desktop. Since mobile no longer allows setting rate, the rate chip should never appear on mobile — and it won't, because mobile never calls `setRateRange`. However, if the store has a persisted non-default rate from a previous desktop session, a rate chip could appear on mobile with no way to dismiss it except "Clear all".
**How to avoid:** This is an edge case — no code change required. `resetFilters` (exposed as "Clear all") resets rate to defaults. Document this in the plan but no special handling is needed.

### Pitfall 5: z-index Conflict Between Tag Picker and Sage FAB

**What goes wrong:** Sage FAB (`SageFAB`) renders at a high z-index in `RootLayout`. If the tag picker overlay uses `z-50` and the FAB uses a higher z-index, the FAB bleeds through the overlay.
**Why it happens:** `RootLayout` wraps `Outlet` — `MarketplacePage` renders inside the Outlet, so its `fixed` overlays are siblings to `RootLayout`'s fixed elements.
**How to avoid:** Use `z-50` for the tag picker overlay. Check the Sage FAB's z-index in `SageFAB.tsx` and ensure the picker is equal or higher. If the FAB is at `z-40` or `z-50`, `z-50` for the picker is sufficient.

---

## Code Examples

Verified patterns from existing codebase:

### Existing toggleTag call (desktop TagCloud)
```tsx
// Source: frontend/src/components/sidebar/TagCloud.tsx
const toggleTag = useExplorerStore((s) => s.toggleTag)
// ...
onToggle={() => toggleTag(tag)
```

### Existing setSortBy signature (filterSlice)
```ts
// Source: frontend/src/store/filterSlice.ts
setSortBy: (sortBy: FilterSlice['sortBy']) => void
// Valid values: 'relevance' | 'rate_asc' | 'rate_desc'
setSortBy: (sortBy) => set({ sortBy }),  // sort does NOT exit sage mode
```

### Existing MobileFilterSheet tag toggle (draft pattern to remove)
```tsx
// Source: frontend/src/components/sidebar/MobileFilterSheet.tsx — BEING DELETED
// The new pattern calls toggleTag directly (no draft buffer):
const toggleTag = useExplorerStore((s) => s.toggleTag)
// On each tap → toggleTag(tag) → store updates → useExplore fires
```

### AbortController in useExplore (existing deduplication)
```ts
// Source: frontend/src/hooks/useExplore.ts
const controller = new AbortController()
controllerRef.current = controller
// Abort any in-flight request from the previous effect run
if (controllerRef.current) controllerRef.current.abort()
// This means: even without debounce, rapid tag toggles only surface the LAST response.
```

### Mobile-only Tailwind pattern used in project
```tsx
// Source: frontend/src/pages/MarketplacePage.tsx
<div className="md:hidden flex items-center ...">  {/* mobile only */}
<div className="hidden md:flex ...">               {/* desktop only */}
```

### brand-purple color token
```ts
// Source: frontend/tailwind.config.ts
brand: { purple: '#5128F2' }
// Usage: className="bg-brand-purple text-white"
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Vaul Drawer for mobile filters (MobileFilterSheet) | Inline dropdown row (this phase) | Removes a two-step interaction (open drawer → apply); filters always visible |
| Draft buffer in MobileFilterSheet (apply on "Apply" tap) | Direct Zustand store writes per tap | Instant filter feedback; debounce handles API rate |

**Deprecated/outdated (in this project):**
- `MobileFilterSheet.tsx`: Replaced by `MobileInlineFilters.tsx`. File should be deleted.
- Mobile "Filters" button in `MarketplacePage` toolbar: Replaced by the inline filter row.

---

## Open Questions

1. **Sort implemented client-side or API-side?**
   - What we know: `sortBy` is in `filterSlice` and in `useExplore`'s dep array; `/api/explore` does NOT currently consume it.
   - What's unclear: Should sort be implemented API-side in this phase, or left as a UI-only control that writes to store but doesn't change results yet?
   - Recommendation: Wire the Sort dropdown UI to `setSortBy` (store + URL sync already handle it). Confirm with the user whether API-side sort is in scope. If not in scope, add a comment in code noting the API wiring is future work.

2. **Should the mobile toolbar row (with "Experts" h1 and Saved button) be preserved?**
   - What we know: The current mobile toolbar in `MarketplacePage` renders an `h1 "Experts"`, a Saved button, and the Filters button. The new inline filter row replaces the Filters button but the h1 and Saved button may still be wanted.
   - Recommendation: Preserve the Saved button behavior. The h1 can be dropped if the filter row makes the page's purpose obvious. Planner should decide layout structure.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to `true` in `.planning/config.json` — this section is omitted.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `frontend/src/components/sidebar/MobileFilterSheet.tsx`: Existing filter drawer being replaced
- Direct codebase read — `frontend/src/pages/MarketplacePage.tsx`: Current mobile toolbar and sheet wiring
- Direct codebase read — `frontend/src/store/filterSlice.ts`: Confirmed `sortBy`, `toggleTag`, `setSortBy`, `resetFilters` all exist
- Direct codebase read — `frontend/src/hooks/useExplore.ts`: AbortController deduplication, dep array behavior, sortBy in deps
- Direct codebase read — `frontend/src/components/pilot/SageMobileSheet.tsx`: Confirmed Vaul must stay
- Direct codebase read — `frontend/src/layouts/RootLayout.tsx`: Confirmed Sage FAB + SageMobileSheet render independently
- Direct codebase read — `frontend/src/components/Header.tsx`: Current search bar layout (flex-1 max-w-2xl, logo in same row)
- Direct codebase read — `frontend/src/constants/tags.ts`: 30 TOP_TAGS available
- Direct codebase read — `frontend/package.json`: vaul 1.1.2, motion 12.34.3, lucide-react 0.575.0, tailwindcss 3.4.19
- Direct codebase read — `frontend/tailwind.config.ts`: `brand-purple: #5128F2`
- Direct codebase read — `frontend/vite.config.ts`: Vitest config, `environment: 'node'`, no DOM environment set up

### Secondary (MEDIUM confidence)
- Pattern inference from `useHeaderSearch.ts`: Custom open/close state for dropdowns is the established project pattern (no Radix Dropdown/Popover used)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by direct package.json + import inspection
- Architecture: HIGH — patterns derived from existing components in same codebase
- Pitfalls: HIGH — all pitfalls identified by reading actual code (MobileFilterSheet lines, MarketplacePage wiring, RootLayout z-index chain)

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — stable stack, no external dependency changes expected)
