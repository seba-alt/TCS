# Phase 17: Expert Grid & Cards - Research

**Researched:** 2026-02-21
**Domain:** Virtualized grid (react-virtuoso), entry animations (framer-motion / motion), expert card layout, infinite scroll with cursor pagination
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card visual design**
- Primary visual hierarchy: name (large) + job title — person-first, company is secondary
- Findability badge: text label only — words like "Top Match", "Good Match", not a numeric score
- Card style: elevated with drop shadow and rounded corners — white card, clear separation from background
- Match reason snippet: appear when an active search query is present, hidden during unfiltered browsing

**Grid layout & density**
- Desktop: 3 columns
- Card height: fixed height — content truncates to keep grid uniform
- Mobile: 2 compact columns (not full-width single column)
- Gap between cards: standard 16-20px

**Entry animations**
- Animation type: slide up + fade (cards rise slightly from below as they appear)
- Stagger: sequential — each card animates with a ~40-80ms delay after the previous
- Duration per card: medium, 250-350ms
- On filter re-fetch: instant replace (old cards snap out), new cards stagger in fresh

**Loading & empty states**
- Initial grid load: skeleton cards with shimmer — maintains layout shape while data fetches
- Infinite scroll trigger: skeleton row appears at bottom while next page loads
- End of list: no indicator — scroll simply stops, no "you've reached the end" message
- Zero results: illustration + message + suggestion to try the AI co-pilot (Phase 17 shows placeholder CTA)

### Claude's Discretion
- Exact shadow values, border-radius, typography scale — match existing TCS design system
- Skeleton card design — use standard shimmer pattern
- Match reason snippet layout and truncation behavior
- Exact stagger timing within the 40-80ms guidance
- Tablet breakpoint column count (2 or 3)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MARKET-02 | Expert grid renders via `react-virtuoso` with cursor-based pagination and scroll restoration | VirtuosoGrid API (endReached, data, itemContent, listClassName, itemClassName), appendResults action in Zustand, cursor tracking in useExplore |
| MARKET-03 | Expert cards display name, title, company, hourly rate, domain tag pills, findability badge, and match reason snippet | ExpertCard Pydantic model field list, field naming fix (snake_case API → camelCase store), missing fields (profile_url, currency) need adding to Expert interface |
| MARKET-04 | Clicking a domain tag pill on a card adds that tag to sidebar filters and re-fetches | `toggleTag` action already in FilterSlice — pill onClick calls `toggleTag(tag)` |
| MARKET-05 | Cards animate on mount via Framer Motion; `AnimatePresence` used only on sidebar and modal transitions | motion package v12, variants with staggerChildren, no exit prop on card items |
</phase_requirements>

---

## Summary

Phase 17 replaces the placeholder in `MarketplacePage.tsx` (the `div` that says "grid coming in Phase 17") with a fully functional virtualized expert grid. The three technical pillars are: (1) `VirtuosoGrid` from `react-virtuoso` for virtualized multi-column rendering with infinite scroll, (2) the `motion` package for staggered slide-up/fade entry animations, and (3) a new `ExpertCard` component for the marketplace that uses the v2.0 `Expert` type from the results slice.

Two pre-existing gaps must be fixed before the card can render correctly. First, the `Expert` interface in `resultsSlice.ts` uses camelCase field names (`firstName`, `jobTitle`, `hourlyRate`, `findabilityScore`, `matchReason`) but the FastAPI `/api/explore` endpoint returns snake_case (`first_name`, `job_title`, `hourly_rate`, `findability_score`, `match_reason`). No `alias_generator` is configured on the backend. The `useExplore` hook passes raw API data directly without transformation, so all camelCase fields are currently `undefined`. Phase 17 must either fix the `Expert` type to snake_case OR add a mapping step in `useExplore`. The project convention (admin types use snake_case) suggests snake_case is correct. Second, the `Expert` interface is missing `profile_url` and `currency` fields that the API does return and that cards need.

For infinite scroll, `resultsSlice.ts` only has `setResults` (replace), not `appendResults` (append). A new `appendResults` action must be added and `useExplore` must be extended to handle the "load next page" trigger from `VirtuosoGrid.endReached`.

**Primary recommendation:** Use `VirtuosoGrid` with Tailwind `listClassName`/`itemClassName` for the grid layout, `motion` package for animations, fix the snake_case field names in `Expert` interface and `useExplore` mapping, and add `appendResults` to the results slice.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-virtuoso | 4.18.1 | Virtualized list/grid — only renders visible items | Handles variable-height items, built-in endReached, no manual height measurement |
| motion (formerly framer-motion) | 12.34.3 | Entry animations — stagger, AnimatePresence | Project decision from STATE.md; AnimatePresence for sidebar/modal; entry-only on cards |

### Already Installed (no install needed)

| Library | Version | Purpose |
|---------|---------|---------|
| zustand | 5.0.11 | State — filter/results slices already built |
| tailwindcss | 3.4.19 | Styling — design tokens (`brand-purple`) and responsive grid classes |
| lucide-react | 0.575.0 | Icons — available for card elements |

### Not Yet Installed (install required)

| Library | Version | Purpose |
|---------|---------|---------|
| react-virtuoso | 4.18.1 | Virtualized grid |
| motion | 12.34.3 | Animations |

**Installation:**
```bash
npm install react-virtuoso motion
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-virtuoso | react-window | react-window requires fixed item heights; expert cards have variable content |
| react-virtuoso | tanstack-virtual | Lower-level API; react-virtuoso is more ergonomic with built-in endReached |
| motion | CSS transitions only | CSS can't do stagger orchestration without JS delay calculations |

---

## Architecture Patterns

### File Layout for Phase 17

```
frontend/src/
├── components/
│   └── marketplace/
│       ├── ExpertGrid.tsx        # NEW — VirtuosoGrid wrapper, infinite scroll logic
│       ├── ExpertCard.tsx        # NEW — marketplace card (replaces old chat ExpertCard)
│       ├── SkeletonGrid.tsx      # EXISTING — already built in Phase 16
│       ├── EmptyState.tsx        # NEW — zero-results illustration + co-pilot CTA
│       └── FilterChips.tsx       # EXISTING — unchanged
├── hooks/
│   └── useExplore.ts             # MODIFY — add appendResults, cursor tracking, endReached handler
├── store/
│   └── resultsSlice.ts           # MODIFY — add appendResults action, fix Expert type (snake_case)
├── pages/
│   └── MarketplacePage.tsx       # MODIFY — replace placeholder div with <ExpertGrid />
```

### Pattern 1: VirtuosoGrid with Tailwind CSS Grid Layout

**What:** `VirtuosoGrid` renders only visible grid items. Layout is controlled entirely by CSS classes on the list container and items — Virtuoso does not generate grid CSS itself.

**Critical:** Use `padding` on items, NOT `margin`. Virtuoso measures `contentRect` which excludes margins, causing scroll height miscalculation when margins are used. Use `pb-4 pr-4` on items and `p-4` on the container instead.

**Critical:** The `endReached` bug on VirtuosoGrid: if the initial dataset fills less than the viewport height, `endReached` does NOT fire (won't fix per maintainer). Mitigation: `overscan={200}` forces more items into viewport calculation, reducing cases where this triggers. Alternatively, always load 20 items on initial fetch (API default is 20).

**Example:**
```tsx
// Source: https://virtuoso.dev/react-virtuoso/api-reference/virtuoso-grid/ + verified via research
import { VirtuosoGrid } from 'react-virtuoso'

<VirtuosoGrid
  data={experts}
  endReached={handleEndReached}
  overscan={200}
  listClassName="grid grid-cols-2 md:grid-cols-3 gap-4 p-4"
  itemClassName="min-h-0"
  computeItemKey={(_, expert) => expert.username}
  itemContent={(_, expert) => (
    <ExpertCard expert={expert} />
  )}
  components={{
    Footer: () => isFetchingMore ? <SkeletonRow /> : null,
  }}
/>
```

**Tailwind grid class notes:**
- `grid-cols-2` = mobile 2 columns (matches CONTEXT.md decision)
- `md:grid-cols-3` = desktop 3 columns (768px+ breakpoint)
- `gap-4` = 16px gap between cards (within 16-20px range from CONTEXT.md)
- Padding on listClassName, not margin on items

### Pattern 2: Framer Motion Entry Animation (No Exit)

**What:** Cards slide up (~12px) and fade in on mount. Each card in a batch is staggered 40-60ms after the previous. When filters change, old cards snap out instantly (no exit animation) and new cards stagger in.

**Key constraint from STATE.md:** "AnimatePresence exit animations excluded from react-virtuoso items; entry-only `animate` prop on cards." Do NOT put an `exit` prop on the card motion component — this would cause Virtuoso to hold DOM nodes until exit animation completes, breaking virtualization.

**Package name:** Import from `motion/react` (new package name) or `framer-motion` (still works, same code, v12.34.3). Use `motion/react` for new code.

**Stagger implementation — two approaches:**

Approach A (variants with staggerChildren on wrapper — not suitable for virtualized lists because VirtuosoGrid controls the render tree):

```tsx
// NOT recommended for VirtuosoGrid — parent cannot control children stagger
const containerVariants = {
  animate: { transition: { staggerChildren: 0.05 } }
}
```

Approach B (index-based delay on each card — recommended for VirtuosoGrid):

```tsx
// Source: framer-motion stagger docs pattern, adapted for virtualized context
import { motion } from 'motion/react'

function ExpertCard({ expert, index }: { expert: Expert; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,           // 300ms — within 250-350ms range
        delay: Math.min(index * 0.05, 0.4),  // 50ms stagger, capped at 400ms
        ease: 'easeOut',
      }}
      // NO exit prop — entry-only per STATE.md constraint
    >
      {/* card content */}
    </motion.div>
  )
}
```

**On filter re-fetch:** When filters change, `resetResults()` is called before the new fetch, emptying `experts`. This causes VirtuosoGrid to unmount all items. When new results arrive, cards are freshly mounted with `index` starting at 0, so stagger begins fresh. No AnimatePresence needed on cards — the re-mount IS the "snap out".

**Delay cap:** `Math.min(index * 0.05, 0.4)` — for the first 20 cards: cards 0-7 animate within 350ms, all visible cards complete within 400ms. Without a cap, card 19 would wait 950ms.

### Pattern 3: Infinite Scroll — Results Slice Extension

**What:** Current `setResults` replaces the array. Infinite scroll needs `appendResults` to extend it. The `useExplore` hook currently only fetches page 1. An `endReached` callback from VirtuosoGrid triggers fetch of the next cursor page.

**Results slice additions:**
```typescript
// In ResultsSlice interface — add:
isFetchingMore: boolean
appendResults: (experts: Expert[], cursor: number | null) => void
setFetchingMore: (v: boolean) => void

// In createResultsSlice — add:
isFetchingMore: false,
appendResults: (newExperts, cursor) =>
  set((state) => ({
    experts: [...state.experts, ...newExperts],
    cursor,
  })),
setFetchingMore: (v) => set({ isFetchingMore: v }),
```

**useExplore hook — add endReached handler (separate from filter-change effect):**
```typescript
// The existing useEffect handles filter changes (replaces results).
// Add a separate function for loading the next page:
const loadNextPage = useCallback(async () => {
  if (!cursor || isFetchingMore || loading) return
  setFetchingMore(true)
  const params = new URLSearchParams({ ..., cursor: String(cursor) })
  const data = await fetch(...)
  appendResults(data.experts, data.cursor)
  setFetchingMore(false)
}, [cursor, isFetchingMore, loading, ...])
// Pass loadNextPage to ExpertGrid as onEndReached
```

### Pattern 4: Expert Type Fix (snake_case alignment)

**What:** The current `Expert` interface in `resultsSlice.ts` uses camelCase but the API returns snake_case. Phase 17 MUST fix this, because card rendering depends on these fields.

**API response fields (from ExpertCard Pydantic model in `app/services/explorer.py`):**
```python
username: str
first_name: str
last_name: str
job_title: str
company: str
hourly_rate: float
currency: str          # MISSING from current Expert type
profile_url: str       # MISSING from current Expert type
tags: list[str]
findability_score: float | None
category: str | None   # not needed on card but should be typed
match_reason: str | None
final_score: float     # not needed on card
```

**Fix — update Expert interface to snake_case:**
```typescript
export interface Expert {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  currency: string       // Add
  profile_url: string    // Add
  tags: string[]
  findability_score: number | null
  match_reason: string | null
  // Omit faiss_score, bm25_score, final_score, category — not needed in UI
}
```

**No mapping in useExplore needed** — raw API data passes directly with `setResults(data.experts, ...)` and this works because JSON is already snake_case.

### Pattern 5: Findability Badge Label

**What:** The findability badge shows a text label ("Top Match", "Good Match") based on `findability_score`. The score range is 50-100 (from Phase 14 decisions: neutral at 75, boost range ±20%).

**Recommended thresholds (Claude's discretion):**
```typescript
function findabilityLabel(score: number | null): string | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'
  if (score >= 75) return 'Good Match'
  return null   // below 75: no badge shown
}
```

This shows a badge for roughly the top half of experts (scores 75-100 out of 50-100 range). Experts at neutral (75) get "Good Match"; experts with positive boost (88+) get "Top Match".

### Anti-Patterns to Avoid

- **Using `margin` on VirtuosoGrid items:** Breaks scroll height calculation. Use `padding` on items and containers only.
- **Adding `exit` prop to card motion components:** Holds nodes in DOM during exit animation, breaking VirtuosoGrid virtualization. Entry-only animations only.
- **Relying on VirtuosoGrid `endReached` with small initial datasets:** Bug (won't fix) — if initial 20 results don't fill viewport height, endReached may not fire. Mitigation: always return 20 items minimum or use `overscan`.
- **Using `staggerChildren` on VirtuosoGrid's container:** VirtuosoGrid controls the render tree — parent variants can't orchestrate stagger through VirtuosoGrid's internal List component. Use per-item index delay instead.
- **Using old chat ExpertCard component (`src/components/ExpertCard.tsx`):** That component uses the old `Expert` type from `types.ts` (with `name`, `title`, `hourly_rate` as string, `why_them`). The marketplace card needs its own component in `components/marketplace/ExpertCard.tsx`.
- **Calling `setResults` for infinite scroll page loads:** `setResults` replaces — only use it for filter changes. Use `appendResults` for next-page loads.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized scrolling grid | Custom intersection observer + DOM recycling | `react-virtuoso` `VirtuosoGrid` | ResizeObserver integration, scroll restoration, variable heights — hundreds of edge cases |
| Staggered entry animations | `setTimeout` array + CSS class toggle | `motion` with per-item delay | Interruption handling, easing, composability — CSS setTimeout approach breaks on re-render |
| Infinite scroll trigger detection | IntersectionObserver on last item | `VirtuosoGrid.endReached` callback | Built into Virtuoso — handles all edge cases of "near bottom" detection |
| Skeleton card shimmer | Custom keyframe animation | Tailwind `animate-pulse` (already used in SkeletonGrid) | Already implemented in Phase 16; consistent with existing SkeletonCard |

**Key insight:** Virtuoso's value is not just rendering speed — it's the scroll height calculation, ResizeObserver integration, and scroll restoration that would each take days to hand-roll correctly.

---

## Common Pitfalls

### Pitfall 1: Margin vs Padding on VirtuosoGrid Items

**What goes wrong:** Cards appear to render but user can't scroll to the last row — the scroll bar stops too early. Or the last row of cards is partially cut off.

**Why it happens:** Virtuoso measures `contentRect` (excludes CSS margins) to calculate total scroll height. If items have `margin-bottom` or `gap` via margin, the scroll height is under-estimated.

**How to avoid:** Apply spacing via `padding` on items (`pb-4 pr-4`) and `padding` on the List container (`p-4`). Use Tailwind `gap-*` on the grid container (which uses padding-based gap via CSS grid, not margin).

**Warning signs:** Scroll bar stops before last row; user can only reach second-to-last row.

### Pitfall 2: Exit Animations on Virtualized Items

**What goes wrong:** React-virtuoso unmounts items as they scroll off screen. If items have `exit` animations, Framer Motion holds them in the DOM during exit — VirtuosoGrid loses control of the DOM, causing layout corruption or memory leak.

**Why it happens:** `AnimatePresence` wraps children and defers DOM removal until exit animation completes. VirtuosoGrid does not expect items to remain in DOM after unmount.

**How to avoid:** Never put an `exit` prop on card motion components. Only `initial` and `animate`. Confirmed in STATE.md: "AnimatePresence exit animations excluded from react-virtuoso items".

**Warning signs:** Grid layout breaks after scrolling down and back up; DOM node count grows unboundedly.

### Pitfall 3: snake_case vs camelCase Field Mismatch

**What goes wrong:** Expert cards render with `undefined` for name, job title, rate — blank cards with correct layout but no content.

**Why it happens:** The current `Expert` interface has `firstName` but the API returns `first_name`. No alias_generator is configured on the backend. The mismatch was never caught because Phase 16 only accessed `experts.length`.

**How to avoid:** Fix `Expert` interface to snake_case. Check by `console.log(data.experts[0])` in useExplore after the fetch. Verify `first_name`, not `firstName`, is the key.

**Warning signs:** Cards render with empty name/title fields; no TypeScript errors (because TypeScript sees the wrong field as `string` but runtime gets `undefined`).

### Pitfall 4: setResults vs appendResults on Filter Change

**What goes wrong:** After a filter change, existing experts are not cleared — new results are appended to old ones, mixing results from different filter states.

**Why it happens:** If `appendResults` is wired to both filter-change fetches and next-page fetches, old results persist.

**How to avoid:** Filter-change effect calls `resetResults()` before fetching (already done in Phase 16 pattern via `resetResults` in catch). Ensure the filter-change effect uses `setResults` and the endReached handler uses `appendResults`. Never mix them.

**Warning signs:** Grid shows 40 experts when only 20 should match; experts from previous filters appear mixed with new results.

### Pitfall 5: VirtuosoGrid endReached Not Firing on Small Datasets

**What goes wrong:** If the first page (20 items) doesn't fill the viewport, the user can see all items without scrolling. In this case, `endReached` never fires, so the next page is never loaded — even if more items exist.

**Why it happens:** VirtuosoGrid calls `endReached` only when the last rendered item is scrolled into view. If all items are visible without scroll, no scroll event fires.

**How to avoid:** Use `overscan={200}` to tell VirtuosoGrid to pre-render 200px beyond the visible area — this helps trigger `endReached` earlier. Additionally, design the empty state to not rely on `endReached` for first load. The API always returns 20 items; on typical screens (1080px height, 200px card) this fills ~5 rows × 3 cols = 15 slots, leaving 5 to second page — usually enough to trigger scroll.

**Warning signs:** Grid shows 20 items, total says 530, but no more cards load on scroll.

---

## Code Examples

Verified patterns from research:

### VirtuosoGrid Responsive Grid

```tsx
// Source: react-virtuoso API reference (virtuoso.dev/react-virtuoso/api-reference/virtuoso-grid/)
// Pattern: listClassName controls grid CSS; itemClassName scopes item wrapper
import { VirtuosoGrid } from 'react-virtuoso'
import type { Expert } from '../../store/resultsSlice'
import { ExpertCard } from './ExpertCard'

interface ExpertGridProps {
  experts: Expert[]
  onEndReached: () => void
  isFetchingMore: boolean
}

export function ExpertGrid({ experts, onEndReached, isFetchingMore }: ExpertGridProps) {
  return (
    <VirtuosoGrid
      data={experts}
      endReached={onEndReached}
      overscan={200}
      // listClassName: CSS grid with 2 cols mobile, 3 cols desktop, 16px gap
      listClassName="grid grid-cols-2 md:grid-cols-3 gap-4 p-4"
      // itemClassName: min-h-0 prevents grid blowout; padding handled by parent gap
      itemClassName="min-h-0"
      computeItemKey={(_, expert) => expert.username}
      itemContent={(index, expert) => (
        <ExpertCard expert={expert} index={index} />
      )}
      components={{
        // Footer renders skeleton row while fetching next page
        Footer: () => isFetchingMore
          ? <div className="col-span-full p-4"><SkeletonRow /></div>
          : null,
      }}
    />
  )
}
```

### Motion Card — Entry Only, No Exit

```tsx
// Source: motion.dev docs stagger pattern + STATE.md constraint (entry-only on virtualized items)
import { motion } from 'motion/react'

interface ExpertCardProps {
  expert: Expert
  index: number   // Used for stagger delay
}

export function ExpertCard({ expert, index }: ExpertCardProps) {
  const badgeLabel = findabilityLabel(expert.findability_score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.05, 0.4),  // 50ms stagger, max 400ms total
        ease: 'easeOut',
      }}
      // NO exit prop — entry-only per STATE.md architectural decision
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 h-full"
    >
      {/* Name — primary hierarchy */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">
          {expert.first_name} {expert.last_name}
        </h3>
        <p className="text-xs text-gray-500 truncate">{expert.job_title}</p>
        <p className="text-xs text-gray-400 truncate">{expert.company}</p>
      </div>

      {/* Rate + Findability badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-brand-purple">
          {expert.currency} {expert.hourly_rate}/hr
        </span>
        {badgeLabel && (
          <span className="text-xs bg-green-50 text-green-700 rounded-full px-2 py-0.5">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Domain tag pills */}
      <div className="flex flex-wrap gap-1">
        {expert.tags.slice(0, 3).map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
      </div>

      {/* Match reason — only when present (active search query) */}
      {expert.match_reason && (
        <p className="text-xs text-gray-500 line-clamp-2 border-t border-gray-50 pt-2">
          {expert.match_reason}
        </p>
      )}
    </motion.div>
  )
}
```

### Tag Pill — onClick adds to sidebar filters

```tsx
// Source: CONTEXT.md locked decision — pill click adds tag to sidebar, triggers re-fetch
// Mechanism: toggleTag in filterSlice already handles add/remove; useExplore re-fetches on tags change
import { useExplorerStore } from '../../store'

function TagPill({ tag }: { tag: string }) {
  const toggleTag = useExplorerStore((s) => s.toggleTag)

  return (
    <button
      onClick={() => toggleTag(tag)}
      className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 hover:bg-brand-purple hover:text-white transition-colors"
    >
      {tag}
    </button>
  )
}
```

No additional wiring needed — `toggleTag` updates the Zustand filter slice, `useExplore` watches `tags` in its dependency array, and re-fetches automatically. The filter chip strip (FilterChips) will also show the newly added tag.

### Findability Badge Label Logic

```typescript
// Source: Phase 14 decisions — findability_score range 50-100, neutral at 75
function findabilityLabel(score: number | null): 'Top Match' | 'Good Match' | null {
  if (score === null) return null
  if (score >= 88) return 'Top Match'   // significant positive boost territory
  if (score >= 75) return 'Good Match'  // neutral and above
  return null                            // below neutral: no badge
}
```

### appendResults in ResultsSlice

```typescript
// Add to ResultsSlice interface:
isFetchingMore: boolean
appendResults: (experts: Expert[], cursor: number | null) => void
setFetchingMore: (v: boolean) => void

// Add to createResultsSlice:
isFetchingMore: false,
appendResults: (newExperts, cursor) =>
  set((state) => ({
    experts: [...state.experts, ...newExperts],
    cursor,
  })),
setFetchingMore: (v) => set({ isFetchingMore: v }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package (`motion/react` import) | 2024 (v11 rebranding) | Same API, new package name. `framer-motion` still works (v12.34.3) — safe to install either |
| `react-window` (fixed heights required) | `react-virtuoso` (variable heights) | 2020+ | react-virtuoso handles variable-height items via ResizeObserver; no manual height measurement |
| Custom scroll listeners for infinite scroll | `VirtuosoGrid.endReached` callback | Built-in | Zero-config infinite scroll trigger |

**Deprecated/outdated:**
- Old `ExpertCard` at `src/components/ExpertCard.tsx`: Uses old `Expert` type from `types.ts` (chat-era type with `name`, `title`, `hourly_rate` as string). Marketplace needs a new `ExpertCard` at `src/components/marketplace/ExpertCard.tsx` using the v2.0 type from `resultsSlice.ts`.

---

## Open Questions

1. **VirtuosoGrid endReached with small initial dataset (< viewport height)**
   - What we know: Known bug (won't fix per maintainer) — endReached doesn't fire if no scrollbar appears
   - What's unclear: Whether the initial 20-item response will consistently fill viewport height on all screen sizes
   - Recommendation: Set `overscan={200}`, rely on API always returning 20 items per page, and accept that on very large screens the user may need to resize or the next page may not load until a filter change resets. Flag as known limitation.

2. **Fixed card height implementation**
   - What we know: CONTEXT.md says "fixed height — content truncates to keep grid uniform"
   - What's unclear: The exact pixel height to use — this is Claude's discretion
   - Recommendation: Set `h-[180px]` on the card (enough for name, title, rate, 3 tags, optional match reason truncated) and use `overflow-hidden` with `line-clamp-*` for text overflow. Adjust based on visual review.

3. **Scroll restoration on browser back/forward**
   - What we know: VirtuosoGrid supports `restoreStateFrom` prop for scroll restoration
   - What's unclear: Whether Phase 17 should implement this (it's not in MARKET-02 success criteria)
   - Recommendation: Skip for Phase 17. MARKET-02 says "scroll restoration" but since this is SPA navigation without route changes, restoration is a Phase 19/ROBUST concern. Note as a known gap.

---

## Sources

### Primary (HIGH confidence)
- GitHub: petyosi/react-virtuoso v4.18.1 — version confirmed, VirtuosoGrid API props
- virtuoso.dev/react-virtuoso/api-reference/virtuoso-grid/ — VirtuosoGrid props documentation
- `app/services/explorer.py` (ExpertCard Pydantic model) — authoritative API response shape
- `frontend/src/store/resultsSlice.ts` — current Expert type and gap analysis

### Secondary (MEDIUM confidence)
- github.com/motiondivision/motion CHANGELOG — confirmed v12.34.3 as of 2026-02-20
- motion.dev installation docs — confirmed `npm install motion` and `import { motion } from 'motion/react'`
- github.com/petyosi/react-virtuoso/issues/924 — endReached bug confirmed "not planned" / wontfix
- WebSearch + multiple sources — VirtuosoGrid `padding` vs `margin` constraint (verified via multiple community reports + grid scroll height behavior)

### Tertiary (LOW confidence)
- Findability badge thresholds (88/75) — derived from Phase 14 decisions (score range 50-100, neutral at 75). Thresholds are Claude's recommendation not externally sourced.
- Fixed card height of `h-[180px]` — estimate; requires visual testing during implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-virtuoso v4.18.1 confirmed on GitHub; motion v12.34.3 confirmed on CHANGELOG
- Architecture: HIGH — VirtuosoGrid API verified; snake_case mismatch verified by source inspection; appendResults gap confirmed by code review
- Pitfalls: HIGH for margin/padding, exit animation, snake_case bugs (all confirmed via code/docs); MEDIUM for endReached small dataset (confirmed bug, mitigation is reasonable)
- Badge thresholds and card height: LOW — Claude's recommendation, needs visual validation

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (react-virtuoso and motion are stable; 30 days)
