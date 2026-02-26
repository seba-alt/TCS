# Phase 38: Browse UI - Research

**Researched:** 2026-02-24
**Domain:** React frontend — Netflix-style landing page with horizontal scroll rows, glassmorphic cards, hero carousel, photo/monogram fallback, and navigation to Explorer
**Confidence:** HIGH

## Summary

The backend Browse API (`GET /api/browse`) is fully implemented and returns the exact shape the frontend needs: a `featured` array of top experts and a `rows` array of category rows, each with `title`, `slug`, `experts`, and `total`. The frontend `BrowsePage.tsx` is currently a placeholder stub. This phase is pure frontend work: build the page UI, a horizontal scroll row component, a glassmorphic browse card component, and a hero carousel—all using existing project libraries (motion 12.34, Tailwind, lucide-react, react-router-dom 7.13).

Navigation from Browse to Explorer for "See All" is achieved by pushing to `/explore` with a URL query param (`?q=CategoryName` via `useNavigate`). This hits the existing `useExplore` hook which reads `?q` on mount. For "Explore All Experts" the navigation is simply `/explore` with no params. The `navigationSource` Zustand field must be set to `'browse'` before navigation so `MarketplacePage` does not reset the Sage panel and does not call `resetPilot()`.

Scroll behaviour (snap, hidden scrollbar) is pure CSS — `scroll-snap-type: x mandatory`, `scroll-snap-align: start`, and hiding the scrollbar with webkit/Firefox utilities. The project already uses `animate-pulse` (Tailwind) for skeletons. Motion (Framer Motion v12) is installed for the hero carousel fade/slide and card expand animation. No new npm packages are required.

**Primary recommendation:** Build entirely within the existing stack—no new dependencies. CSS scroll snap handles horizontal rows; motion/react handles hero carousel and card expand. The backend data contract is stable and already live.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card design**
- Compact cards (~160px wide), fitting 5-6 visible per row on desktop
- Frosted glass overlay: semi-transparent blur on bottom portion of card where name + rate appear, photo fills the full card behind
- Hover behavior: card expands slightly (scale up) revealing a tag row below existing info; other cards shift to accommodate
- Name + hourly rate visible in the frosted overlay area at all times
- Tags hidden by default, revealed on hover via the card expand animation

**Monogram fallback**
- Claude's discretion — pick a style that fits the glassmorphic card aesthetic (gradient, solid color, etc.)

**Featured expert banner (hero)**
- Auto-rotating carousel cycling through 3-5 featured experts with fade/slide transitions
- Medium height (~300px) — hero has breathing room but first category row peeks above the fold
- Includes "Explore All Experts" CTA button
- On mobile: same carousel but reduced height (~180px)

**Page spacing**
- Spacious gaps between category rows (48-64px)
- Premium, uncluttered feel — rows breathe

**Category rows**
- Row order top-to-bottom: Most Clicked → Trending → Highest Findability → Recently Joined
- Descriptive row labels: "Most Popular Experts", "Trending Now", "Top Rated Experts", "Recently Joined"
- Scroll indicators: fade edges on left/right hinting more content (no arrow buttons)
- "See All" appears in two places: inline with row title (right-aligned) AND as a special end-of-row card at the scroll end
- Snap scroll behavior, no visible scrollbar

**Skeleton loading**
- Per-card skeleton placeholders while data loads — no blank rows at any point

**Mobile behavior**
- Category rows stay horizontal with touch-swipe (same pattern as desktop)
- Tap-to-expand replaces hover: tap a card to expand and show tags, tap again or elsewhere to collapse
- Expanded card action (what second tap on expanded card does): Claude's discretion — pick the most natural interaction pattern

### Claude's Discretion
- Monogram fallback visual style
- Expanded card tap action on mobile
- Exact skeleton placeholder design
- Loading skeleton animation style
- Card border radius and shadow values
- Transition/animation timing and easing
- Error state handling (failed data fetch)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BROWSE-01 | User sees a Netflix-style Browse page as the landing experience at `/` with horizontal category rows | BrowsePage.tsx is a stub at `/`; backend `/api/browse` returns rows + featured; build the page |
| BROWSE-02 | User can horizontally scroll through 4-6 category rows (trending tags, recently joined, most clicked, highest findability) with snap scroll and skeleton loading | CSS `scroll-snap-type: x mandatory` + per-card skeleton via `animate-pulse`; backend rows come from DB categories |
| BROWSE-03 | User sees glassmorphic expert cards with large photos or monogram fallback, name + rate overlay, and hover reveals tags | `.glass-surface` CSS class already defined in `index.css`; `photo_url` field is `/api/photos/{username}` or `null`; `<img onError>` fallback pattern for monogram |
| BROWSE-04 | User can click "See All" on any category row to navigate to Explorer filtered by that category | `useNavigate` to `/explore?q={categoryTitle}` + `setNavigationSource('browse')` before navigate |
| PHOTO-03 | Frontend displays monogram initials fallback when no photo is available for an expert | `photo_url` is `null` when no photo; render `<img>` + `onError` handler or conditional logic to show styled initials div |
| NAV-02 | User can click "Explore All Experts" button on Browse page to navigate to Explorer with all experts visible | `useNavigate('/explore')` with no params + `setNavigationSource('browse')` |
</phase_requirements>

---

## Standard Stack

### Core (already installed — zero new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component rendering | Project foundation |
| motion/react | 12.34.3 | Hero carousel animations, card expand | Already used in Header, MarketplacePage |
| react-router-dom | 7.13.0 | `useNavigate`, routing | Already installed and used |
| zustand | 5.0.11 | `useNavigationSlice` — set browse source before navigate | Already installed |
| Tailwind CSS | 3.4.19 | Utility classes, animate-pulse skeleton, glass-surface | Already configured |
| lucide-react | 0.575.0 | Icons (ChevronRight for "See All", etc.) | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Scroll Snap | Native (no lib) | Horizontal row scroll with snap | Use native CSS — no library needed |
| `animate-pulse` (Tailwind) | Tailwind built-in | Skeleton loading animation | Already used in SkeletonGrid.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native CSS scroll snap | embla-carousel / swiper | Libraries add ~30KB; CSS snap is sufficient and already used in similar projects |
| motion/react AnimatePresence | CSS transitions | motion/react is already installed and used; cleaner fade/slide API |
| `onError` monogram fallback | react-avatar library | Unnecessary dep; `onError` + styled div is trivial |

**Installation:** None required — all dependencies are present.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── pages/
│   └── BrowsePage.tsx          # Replace stub — full Browse page
├── components/browse/           # New folder for browse-specific components
│   ├── BrowseCard.tsx           # Glassmorphic card (~160px wide, photo + overlay)
│   ├── BrowseRow.tsx            # Horizontal scroll row + "See All" end card
│   ├── HeroBanner.tsx           # Auto-rotating carousel of featured experts
│   ├── SkeletonBrowseCard.tsx   # Per-card skeleton (matches BrowseCard dimensions)
│   └── SkeletonBrowseRow.tsx    # Row of N skeleton cards
└── hooks/
    └── useBrowse.ts             # Fetch /api/browse, return { featured, rows, loading, error }
```

### Pattern 1: Fetch /api/browse in a dedicated hook

**What:** One `useBrowse` hook fetches `GET /api/browse?per_row=10` and returns `{ featured, rows, loading, error }`.
**When to use:** Called once on `BrowsePage` mount. No Zustand for browse data — it's page-local state.

```typescript
// useBrowse.ts — no Zustand (page-local only)
import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface BrowseCard {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  category: string | null
  tags: string[]
  photo_url: string | null  // "/api/photos/{username}" or null
  profile_url: string
}

export interface BrowseRow {
  title: string
  slug: string
  experts: BrowseCard[]
  total: number
}

export interface BrowseData {
  featured: BrowseCard[]
  rows: BrowseRow[]
}

export function useBrowse() {
  const [data, setData] = useState<BrowseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/api/browse?per_row=10`, { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message ?? 'Fetch failed')
        setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return { data, loading, error }
}
```

### Pattern 2: Horizontal Scroll Row with CSS Snap

**What:** A flex container with `overflow-x: auto`, `scroll-snap-type: x mandatory`. Each card has `scroll-snap-align: start`. Scrollbar hidden with webkit + Firefox utilities. Fade overlay achieved with absolute-positioned gradient divs on left/right edges.
**When to use:** `BrowseRow` component, applied to the cards container div.

```tsx
// BrowseRow inner scroll container — Tailwind classes
<div
  className="
    flex gap-3 overflow-x-auto
    scroll-snap-type-x-mandatory           // needs custom Tailwind or inline style
    pb-2                                    // space for partial scrollbar if visible
    [scrollbar-width:none]                 // Firefox
    [-ms-overflow-style:none]              // IE/Edge
    [&::-webkit-scrollbar]:hidden          // Chrome/Safari
  "
  style={{ scrollSnapType: 'x mandatory' }}
>
  {cards.map(card => (
    <div key={card.username} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
      <BrowseCard expert={card} />
    </div>
  ))}
  {/* End-of-row "See All" card */}
  <SeeAllCard rowTitle={title} total={total} slug={slug} />
</div>
```

**CSS scroll snap note:** `scroll-snap-type` and `scroll-snap-align` are not Tailwind utility classes in v3. Use inline styles (`style={{ scrollSnapType: 'x mandatory', scrollSnapAlign: 'start' }}`) or add custom utilities to `tailwind.config.ts`. Inline styles are simpler and avoid config changes.

**Hiding the scrollbar:** In Tailwind v3 arbitrary properties work:
```tsx
className="[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
```

**Fade edge overlay:** Two absolute `<div>`s with `pointer-events-none` and `bg-gradient-to-{r,l}` from page background color to transparent, positioned at left and right edges of the row container (which must be `relative`).

### Pattern 3: Glassmorphic BrowseCard

**What:** ~160px wide card. Photo fills card height. Bottom frosted-glass overlay shows name + rate. Tags appear below on hover via motion `whileHover` scale + height expansion.

```tsx
// BrowseCard.tsx — motion for hover expand
import { motion } from 'motion/react'

export function BrowseCard({ expert }: { expert: BrowseCard }) {
  const [imgError, setImgError] = useState(false)
  const initials = `${expert.first_name[0]}${expert.last_name[0]}`.toUpperCase()

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden cursor-pointer"
      style={{ width: 160, minHeight: 220 }}
      whileHover={{ scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      layout  // enables smooth height expansion for sibling shift
    >
      {/* Photo or monogram */}
      {expert.photo_url && !imgError ? (
        <img
          src={expert.photo_url}
          alt={`${expert.first_name} ${expert.last_name}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <MonogramFallback initials={initials} />
      )}

      {/* Frosted glass overlay — bottom portion */}
      <div className="absolute bottom-0 left-0 right-0 glass-surface p-2">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {expert.first_name} {expert.last_name}
        </p>
        <p className="text-xs text-brand-purple font-medium">
          €{expert.hourly_rate}/hr
        </p>
      </div>

      {/* Tags revealed on hover — motion AnimatePresence or whileHover */}
      {/* Use CSS group-hover or motion variants */}
    </motion.div>
  )
}
```

**Note on `layout` prop:** Motion's `layout` prop enables smooth layout animation when sibling card heights change during hover-expand. Apply to both the card and its parent row container.

### Pattern 4: Hero Carousel

**What:** `AnimatePresence` from `motion/react` with `mode="wait"` cycling through the `featured` array. Auto-advance with `setInterval`, paused on hover. Fade or cross-fade transition.

```tsx
// HeroBanner.tsx
import { AnimatePresence, motion } from 'motion/react'

export function HeroBanner({ featured }: { featured: BrowseCard[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setIndex(i => (i + 1) % featured.length), 4000)
    return () => clearInterval(id)
  }, [paused, featured.length])

  const current = featured[index]

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: 300 }}          // 180px on mobile via Tailwind responsive
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.username}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {/* background photo */}
          {/* overlay with name, CTA */}
        </motion.div>
      </AnimatePresence>
      {/* "Explore All Experts" button */}
    </div>
  )
}
```

### Pattern 5: Browse → Explorer Navigation

**What:** Before navigating to Explorer, set `navigationSource` to `'browse'` in Zustand so `MarketplacePage` does NOT call `resetPilot()`.
**For "See All":** Navigate to `/explore?q={encodeURIComponent(row.title)}` — `useUrlSync` picks up `q` on mount and sets the query filter, triggering a filtered fetch.
**For "Explore All Experts":** Navigate to `/explore` with no params, ensuring `resetFilters()` is called before navigation so Explorer shows all 530 experts.

```tsx
// Inside BrowsePage or passed down as callback
const navigate = useNavigate()
const setNavigationSource = useExplorerStore(s => s.setNavigationSource)
const resetFilters = useExplorerStore(s => s.resetFilters)

function handleSeeAll(rowTitle: string) {
  setNavigationSource('browse')
  navigate(`/explore?q=${encodeURIComponent(rowTitle)}`)
}

function handleExploreAll() {
  setNavigationSource('browse')
  resetFilters()     // ensure no stale filters
  navigate('/explore')
}
```

**Critical ordering:** `setNavigationSource` BEFORE `navigate()` — the store update must happen synchronously before React Router triggers the MarketplacePage mount, which reads `navigationSource` in a `useEffect`.

### Pattern 6: Monogram Fallback

**What:** When `photo_url` is null or `<img>` fires `onError`, render a styled div with the expert's initials. Gradient background derived from the initials (deterministic hashing for consistent color per expert).

```tsx
function MonogramFallback({ initials }: { initials: string }) {
  // Simple hash to pick from a palette of brand-aligned gradients
  const gradients = [
    'from-purple-500 to-indigo-600',
    'from-violet-500 to-purple-700',
    'from-indigo-400 to-purple-500',
    'from-purple-600 to-pink-500',
  ]
  const idx = initials.charCodeAt(0) % gradients.length
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradients[idx]} flex items-center justify-center`}>
      <span className="text-white text-2xl font-bold tracking-wider select-none">
        {initials}
      </span>
    </div>
  )
}
```

### Pattern 7: Skeleton Loading — Per-Card

**What:** Show skeleton cards in the correct row layout BEFORE data arrives. Render `N` skeleton placeholders (6-8 per row) using `animate-pulse`.

```tsx
function SkeletonBrowseCard() {
  return (
    <div
      className="animate-pulse rounded-xl bg-gray-200 flex-shrink-0"
      style={{ width: 160, height: 220 }}
    />
  )
}

// SkeletonBrowseRow — used while loading=true
function SkeletonBrowseRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBrowseCard key={i} />
      ))}
    </div>
  )
}
```

The `BrowsePage` renders `N` `SkeletonBrowseRow` components (matching the expected number of category rows) while `loading === true`, so no blank rows appear.

### Anti-Patterns to Avoid
- **Using Zustand for browse data:** Browse data is page-local; Zustand is for cross-page filter/navigation state only. Don't add a browse slice.
- **Setting navigationSource AFTER navigate():** Race condition — `MarketplacePage` may mount before the store update, reading stale `'direct'` and calling `resetPilot()`.
- **Using `overflow-hidden` on a parent of a `backdrop-filter` element:** Already documented in `index.css` — the `.glass-surface` class uses `::before` pseudo-element to work around this. BrowseCard must inherit this pattern.
- **Blocking render until all images load:** Render cards immediately with the monogram; swap to photo when `<img>` loads. Never block the skeleton-to-content transition on image fetch.
- **motion `layout` without stable keys:** `AnimatePresence` and layout animations require stable `key` props. Use `expert.username` as the key on all animated card elements.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Horizontal scroll snap | Custom drag/pointer events | CSS `scrollSnapType` + `scrollSnapAlign` | Browser-native, GPU-composited, works with touch |
| Carousel/fade transition | Custom opacity state machine | `AnimatePresence mode="wait"` from motion/react | Already installed; handles enter/exit cleanly |
| Skeleton animation | Custom keyframe CSS | Tailwind `animate-pulse` | Already used in SkeletonGrid; consistent project pattern |
| Glassmorphic card surface | Custom backdrop-filter CSS | `.glass-surface` CSS class in `index.css` | Already defined with correct `::before` workaround |

**Key insight:** The project already has aurora background, glass-surface CSS, motion library, and skeleton utilities. Browse UI assembles these; it builds almost nothing from scratch.

---

## Common Pitfalls

### Pitfall 1: backdrop-filter + overflow:hidden conflict
**What goes wrong:** Glassmorphic card `backdrop-filter` stops working when any ancestor has `overflow:hidden`.
**Why it happens:** Chrome clips the blur effect at the overflow boundary.
**How to avoid:** Follow the existing `.glass-surface` pattern: put `backdrop-filter` on a `::before` pseudo-element (absolute, `z-index: -1`). BrowseCard has `overflow-hidden` on the card root — so the frosted overlay CANNOT use `.glass-surface` directly. Instead: set the overlay as a sibling element (not a child inside the overflow-hidden container), or use an alternative: semi-transparent bg without backdrop-filter (e.g., `bg-black/40` or `bg-white/80`) which still reads as "frosted glass" visually.
**Warning signs:** The blur effect works in isolation but disappears when placed inside the card.

**Resolution:** For the card overlay, use `bg-gradient-to-t from-black/70 to-transparent` (no backdrop-filter) — this is the standard Netflix card pattern. Save `.glass-surface` for floating panels and headers, not inside overflow-hidden cards.

### Pitfall 2: navigationSource set after navigate()
**What goes wrong:** `MarketplacePage` mounts and reads `navigationSource === 'direct'`, calls `resetPilot()`, even though Browse triggered the navigation.
**Why it happens:** `useNavigate()` triggers a synchronous route change; the Zustand store update must precede it.
**How to avoid:** Always call `setNavigationSource('browse')` in the same event handler tick BEFORE calling `navigate()`.

### Pitfall 3: motion layout shift when cards expand on hover
**What goes wrong:** Adding the tag row on hover causes the row container to overflow vertically; neighboring cards jump.
**Why it happens:** The horizontal row has fixed height, expanding a card changes the layout.
**How to avoid:** Add `layout` prop to each card and the row container. The row container should NOT have a fixed height — it should expand naturally. Alternatively, absolutely-position the tag expansion below the card so it overlaps, not pushing siblings.

### Pitfall 4: Hero carousel starts with undefined featured[0]
**What goes wrong:** While loading=true, `featured` is empty; accessing `featured[0]` throws.
**Why it happens:** Rendering HeroBanner before data arrives.
**How to avoid:** Render a `SkeletonHeroBanner` (gradient placeholder) when `loading === true`. Only mount HeroBanner when `featured.length > 0`.

### Pitfall 5: "See All" sends category name as `q` param, but Explorer filters by text query
**What goes wrong:** Category names like "Marketing Experts" work as text queries but may return mismatched results if the category has a non-obvious name.
**Why it happens:** `/api/explore?q=Marketing Experts` runs a semantic + BM25 search, which is not the same as `WHERE category = 'Marketing Experts'`.
**How to avoid:** This is by design per the requirements — BROWSE-04 says "navigate to Explorer filtered by that category". Using `?q={categoryTitle}` is the correct approach for this phase. The Explorer does not support a `category` filter param (no `category` param in `/api/explore`). This is acceptable scope — note it for the planner.
**Alternative:** If exact category filtering is required, the planner may add a `category` query param to `/api/explore`. This is an open question — see Open Questions below.

---

## Code Examples

### API Response Shape (from browse.py)
```typescript
// GET /api/browse?per_row=10
{
  featured: BrowseCard[],  // top 5 by findability_score
  rows: [
    {
      title: string,           // e.g. "Marketing Experts"
      slug: string,            // e.g. "marketing-experts"
      experts: BrowseCard[],   // up to per_row experts
      total: number,           // total experts in this category
    },
    // ...
    {
      title: "Recently Added",
      slug: "recently-added",
      experts: BrowseCard[],
      total: number,           // total experts in DB
    }
  ]
}

// BrowseCard shape (from _serialize_browse_card in browse.py)
{
  username: string,
  first_name: string,
  last_name: string,
  job_title: string,
  company: string,
  hourly_rate: number,
  category: string | null,
  tags: string[],
  photo_url: string | null,   // "/api/photos/{username}" or null
  profile_url: string,
}
```

### Hiding scrollbar cross-browser (Tailwind v3 arbitrary)
```tsx
className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
```

### Scroll snap inline styles (Tailwind v3 has no built-in snap utilities in base v3.4)
```tsx
// Container
<div style={{ scrollSnapType: 'x mandatory' }} className="flex overflow-x-auto gap-3">
  {/* Card wrapper */}
  <div style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
    <BrowseCard ... />
  </div>
</div>
```
**Note:** Tailwind v3.4 does include `snap-*` utilities (`snap-x`, `snap-mandatory`, `snap-start`). Use those instead of inline styles:
```tsx
<div className="flex overflow-x-auto gap-3 snap-x snap-mandatory">
  <div className="snap-start shrink-0">
    <BrowseCard ... />
  </div>
</div>
```

### Fade edge overlay (gradient cue, no arrow buttons)
```tsx
{/* Row container must be relative */}
<div className="relative">
  {/* Left fade */}
  <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-[var(--aurora-bg)] to-transparent z-10" />
  {/* Right fade */}
  <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-[var(--aurora-bg)] to-transparent z-10" />
  {/* Scroll container */}
  <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 ...">
    ...
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom scroll libraries (Swiper, Embla) | Native CSS scroll snap | CSS snap widely supported since 2020 | No library needed; native touch support |
| `framer-motion` package | `motion/react` (rebranded) | v11+ (2024) | Import from `'motion/react'`, not `'framer-motion'` |
| `React.FC` for component typing | Explicit function signatures | React 18+ best practice | Project already uses explicit function signatures |

**Deprecated/outdated:**
- `framer-motion` import path: project uses `motion/react` (v12.34.3 installed) — do NOT import from `framer-motion`
- Tailwind `snap-*` utilities require Tailwind v3.2+; project is on v3.4.19 — all snap utilities are available

---

## Open Questions

1. **"See All" filtering: text query vs. exact category filter**
   - What we know: `/api/explore` accepts `query` (text search) but NOT a `category` param. The `useUrlSync` hook reads `?q=` on mount and sets the text query. Navigating to `/explore?q=Marketing+Experts` runs a semantic+BM25 search.
   - What's unclear: Does the user need exact category membership filtering (only experts WHERE category = X), or is a text-query approximation sufficient?
   - Recommendation: Per BROWSE-04 as written ("navigate to Explorer filtered by that category"), text query is acceptable for this phase. If exact is needed, the planner should add a `category` URL param + backend support as a sub-task. Flag this for the planner as a decision point.

2. **Row order discrepancy: CONTEXT.md vs. backend**
   - What we know: CONTEXT.md specifies row order "Most Clicked → Trending → Highest Findability → Recently Joined". The current `/api/browse` backend returns rows ordered by category expert COUNT descending, not by the named categories. There are no "Most Clicked", "Trending" etc. categories in the DB — these are UI labels for whatever categories exist.
   - What's unclear: Does the planner expect the backend to serve pre-labeled rows, or does the frontend map category data to display labels?
   - Recommendation: The backend serves categories by count (largest → smallest) + a "Recently Added" special row. The frontend should display the category name as returned (`row.title`) with the descriptive display label defined in CONTEXT.md being aspirational UX copy. The planner should decide: (a) use row titles as-is from the backend, or (b) add a frontend mapping layer. Flag this for the planner.

3. **Mobile "expanded card" second-tap action (Claude's discretion)**
   - Recommendation: On second tap of an already-expanded card, navigate to the expert's `profile_url` (open in new tab). This is the most natural "I want more info" action — the expanded state served its purpose (show tags), and the user's continued interest signals intent to view the full profile.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `frontend/src/pages/BrowsePage.tsx` — confirmed placeholder stub
- Codebase direct read: `app/routers/browse.py` — confirmed API shape, `featured` + `rows`
- Codebase direct read: `frontend/src/index.css` — confirmed `.glass-surface`, aurora design tokens, `snap-*` Tailwind v3 available
- Codebase direct read: `frontend/src/store/navigationSlice.ts` — confirmed `setNavigationSource` action
- Codebase direct read: `frontend/src/hooks/useUrlSync.ts` — confirmed `?q=` param read on mount
- Codebase direct read: `frontend/package.json` — confirmed all dependencies (motion 12.34.3, react-router-dom 7.13, tailwindcss 3.4.19)
- Codebase direct read: `frontend/tailwind.config.ts` — confirmed brand colors and content paths

### Secondary (MEDIUM confidence)
- Tailwind v3.4 scroll snap utilities (`snap-x`, `snap-mandatory`, `snap-start`) — inferred from version; project on 3.4.19 which includes these
- motion/react v12 `AnimatePresence`, `layout`, `whileHover` APIs — based on installed version + project usage patterns in Header.tsx and MarketplacePage.tsx

### Tertiary (LOW confidence)
- None — all key findings are from direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and existing imports
- Architecture: HIGH — confirmed by reading all relevant source files; patterns follow existing project conventions
- Pitfalls: HIGH — most are discovered from reading existing code (glass-surface pattern, navigationSource ordering)

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable stack)
