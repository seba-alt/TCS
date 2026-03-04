# Phase 65: Admin Enhancements - Research

**Researched:** 2026-03-04
**Domain:** React state management / UI accordion pattern / Vercel Speed Insights
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Expansion behavior**
- Accordion pattern: only one card can be expanded at a time — expanding one collapses the other
- Expanded card has a max height with internal scrolling (card doesn't grow unbounded)
- All data is already loaded client-side — no additional API fetch needed on expand

**Expanded list presentation**
- Top Experts rows: rank number (#1, #2...) + expert name + click count
- Top Searches rows: rank number + search query + frequency count
- No trend indicators — keep it simple with rank + label + count
- Uniform styling throughout the list — no visual distinction for top 5 vs rest

**Control placement & style**
- "See All" appears as a text link in the card header (top-right area)
- When expanded, "See All" toggles to "Show less" in the same header position
- No count shown in the link (just "See All", not "See All (47)")
- Text link style — subtle, not a button

**Speed Insights**
- Install `@vercel/speed-insights` and add the component to the app

### Claude's Discretion
- Expansion animation approach (smooth vs instant)
- Period toggle behavior during expansion (visible/locked)
- Max height value for expanded cards
- Exact styling and spacing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMOV-01 | Admin can expand Top Experts card to see all experts ranked by click volume (not just top 5) | Accordion state pattern, data already in ExposureResponse, no limit applied server-side |
| ADMOV-02 | Admin can expand Top Searches card to see all search queries ranked by frequency (not just top 5) | Accordion state pattern, top-queries endpoint accepts `limit` param — must increase to 50 |
| ADMOV-03 | Admin can collapse expanded cards back to top 5 view | Toggle boolean state, "Show less" control in header |
| ANLYT-01 | Vercel Speed Insights active on the frontend | Already installed and wired — `SpeedInsights` component is live in App.tsx |
</phase_requirements>

---

## Summary

Phase 65 is a frontend-only feature except for one API adjustment. The two "See All" cards live inside `OverviewPage.tsx` as `TopExpertsCard` and `TopQueriesCard`. Both are self-contained function components that fetch their own data and slice it to 5 items. The accordion expansion is pure client-side state — no new API calls on expand because the underlying data endpoints already return all data (exposure returns the full unsliced ranking; top-queries needs its `limit` parameter raised from 5 to 50).

Vercel Speed Insights is **already completely done**. The package `@vercel/speed-insights` v1.3.1 is installed (`package.json`), and `<SpeedInsights />` is already rendered in `App.tsx` (line 111). ANLYT-01 requires only verification that data is appearing in the Vercel dashboard — zero code changes needed.

The primary work is refactoring `TopExpertsCard` and `TopQueriesCard` to support accordion toggle, shared accordion state in their parent (`OverviewPage`), and a scrollable expanded view.

**Primary recommendation:** Lift a single `expandedCard: 'experts' | 'queries' | null` state to `OverviewPage`, pass it as a prop to both cards, and implement scroll with `overflow-y-auto max-h-[360px]` inside the expanded body.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useState | 19.2.0 (already in project) | Accordion toggle state | Project already uses React 19 extensively |
| Tailwind CSS | 3.4.19 (already in project) | Styling expanded rows | All admin components use Tailwind, no CSS modules |
| `@vercel/speed-insights` | 1.3.1 (already installed) | Frontend performance tracking | Already in package.json and wired in App.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `motion` (Framer Motion v12) | 12.34.3 (already installed) | Smooth expansion animation | Claude's discretion — available if smooth animation desired |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lifting state to OverviewPage | Local state in each card | Local state can't enforce accordion (one-expanded-at-a-time) without cross-component communication |
| CSS overflow scroll | Virtualized list (react-virtuoso) | Virtualization not needed — max 50 rows is negligible for DOM |

**Installation:** No installation required — all packages already present.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are within:

```
frontend/src/admin/
├── pages/
│   └── OverviewPage.tsx   # primary change — accordion state + card prop threading
```

Optionally extract cards to components if they grow large, but current pattern (all cards as functions inside OverviewPage.tsx) is established and should be preserved.

### Pattern 1: Lifted Accordion State

**What:** A single `expandedCard` state value lives in `OverviewPage`. Each card receives `isExpanded` and `onToggle` props.

**When to use:** Required when two components must coordinate — only one can be open.

**Example:**
```tsx
// In OverviewPage
const [expandedCard, setExpandedCard] = useState<'experts' | 'queries' | null>(null)

function toggleCard(card: 'experts' | 'queries') {
  setExpandedCard(prev => (prev === card ? null : card))
}

// Passed to cards
<TopExpertsCard days={days} isExpanded={expandedCard === 'experts'} onToggle={() => toggleCard('experts')} />
<TopQueriesCard days={days} isExpanded={expandedCard === 'queries'} onToggle={() => toggleCard('queries')} />
```

### Pattern 2: Card Header with "See All" / "Show less" Toggle

**What:** The existing card header row gets a text-link on the right. It toggles label based on `isExpanded`.

**Example:**
```tsx
// In TopExpertsCard / TopQueriesCard header
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <TrendingUp className="w-4 h-4 text-purple-400" />
    <h2 className="text-sm font-semibold text-white">Top Clicks</h2>
  </div>
  {rows.length > 0 && (
    <button
      onClick={onToggle}
      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
    >
      {isExpanded ? 'Show less' : 'See All'}
    </button>
  )}
</div>
```

Using `<button>` (not `<Link>`) because this is a toggle action, not navigation.

### Pattern 3: Scrollable Expanded Body

**What:** When `isExpanded` is true, show all rows in a scrollable container instead of sliced top 5.

**Example:**
```tsx
const displayedRows = isExpanded ? allRows : allRows.slice(0, 5)

// Body container — conditional scroll wrapper
<div className={isExpanded ? 'overflow-y-auto max-h-[360px]' : ''}>
  <div className="space-y-2">
    {displayedRows.map((row, i) => ( /* row JSX */ ))}
  </div>
</div>
```

`max-h-[360px]` is a reasonable default (fits ~10-12 rows at current row height of ~28px). This is Claude's discretion to tune.

### Pattern 4: Data Fetching Adjustment for TopQueriesCard

**What:** The current call fetches `limit: 5`. For expansion to show up to 50, the fetch must request more data upfront.

**Current:**
```tsx
adminFetch<TopQueriesResponse>('/analytics/top-queries', { days, limit: 5 })
```

**Required:**
```tsx
adminFetch<TopQueriesResponse>('/analytics/top-queries', { days, limit: 50 })
```

Then slice `rows.slice(0, 5)` for the collapsed view, show all for expanded.

**For TopExpertsCard:** The `/events/exposure` endpoint already returns **all experts** with no limit parameter — it's an unbounded query. The current code slices to 5 with `.slice(0, 5)`. No API change needed — just remove the slice when expanded.

### Anti-Patterns to Avoid

- **Fetching on expand:** Context.md says all data is already loaded client-side. Do not add a second fetch triggered by expansion.
- **Using `<Link>` for the toggle:** "See All" here is not navigation (no dedicated route). Use `<button>` with text-link styling.
- **Expanding the card's outer div height unbounded:** The decision specifies max height + internal scroll, not full-height expansion.
- **State in each card:** Two separate boolean states cannot enforce the accordion constraint without prop drilling or context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth animation | Custom CSS transition | `motion` (already installed) | Framer Motion v12 handles layout animations correctly with `AnimatePresence` |
| Speed Insights tracking | Custom performance logging | `@vercel/speed-insights` (already live) | Already wired in App.tsx — Vercel SDK handles Core Web Vitals automatically |
| Scroll container | Custom scroll management | Native CSS `overflow-y-auto` + `max-h-*` | No virtualization needed for ≤50 rows |

**Key insight:** Speed Insights is already done. TopExpertsCard data is already fully loaded. Only TopQueriesCard needs its fetch limit bumped from 5 to 50.

---

## Common Pitfalls

### Pitfall 1: TopQueriesCard Fetches Only 5 Items Currently

**What goes wrong:** "See All" expands but shows the same 5 rows because the API was called with `limit: 5`.

**Why it happens:** `adminFetch('/analytics/top-queries', { days, limit: 5 })` — limit is a query parameter the backend respects (LIMIT clause in SQL).

**How to avoid:** Change `limit: 5` to `limit: 50` in the fetch call. Display slice(0, 5) in collapsed state, all rows in expanded state.

**Warning signs:** Expanded card shows exactly 5 items.

### Pitfall 2: Period Toggle Re-Fetch Resets Expanded State

**What goes wrong:** User expands a card, changes the period toggle, card collapses because `days` change triggers re-fetch and component re-renders.

**Why it happens:** `isExpanded` state is not preserved across `days` changes if it's managed inside the card component.

**How to avoid:** Since accordion state lives in `OverviewPage` (parent of both cards AND the period toggle), the `expandedCard` state survives `days` prop changes. The card just re-fetches data internally and renders the expanded rows with the new data.

**Warning signs:** Card collapses when switching periods while expanded.

### Pitfall 3: "See All" Visible When No Data

**What goes wrong:** "See All" link shows when there are 0 rows or exactly 5 rows — no point expanding.

**Why it happens:** Rendering the toggle unconditionally.

**How to avoid:** Conditionally render "See All" only when `allRows.length > 5`. When 5 or fewer results, no toggle needed.

### Pitfall 4: Speed Insights Already Done — Don't Touch It

**What goes wrong:** Modifying App.tsx to "add" SpeedInsights when it's already there, potentially breaking or duplicating it.

**Why it happens:** ANLYT-01 says "install and add" — but it's already done.

**How to avoid:** Read `App.tsx` before touching it. The `<SpeedInsights />` component is on line 111. The package is in `package.json` at v1.3.1. ANLYT-01 is satisfied by verifying data appears in the Vercel dashboard — this is a manual check, not a code task.

---

## Code Examples

Verified from codebase inspection:

### Current TopExpertsCard fetch (no limit — returns all)
```tsx
// frontend/src/admin/pages/OverviewPage.tsx (line 275)
adminFetch<ExposureResponse>('/events/exposure', { days })
  .then(setData)

// Sliced to 5 for display (line 281)
const rows = (data?.exposure ?? []).slice(0, 5)
```

### Current TopQueriesCard fetch (limited to 5)
```tsx
// frontend/src/admin/pages/OverviewPage.tsx (line 324)
adminFetch<TopQueriesResponse>('/analytics/top-queries', { days, limit: 5 })
  .then(setData)

// All returned rows displayed (line 330)
const rows = data?.queries ?? []
```

### Backend exposure endpoint — no LIMIT applied (returns all)
```python
# app/routers/admin/events.py (line 110)
# No LIMIT in the SQL query — returns full ranking
rows = db.execute(_text("""
    SELECT ... FROM user_events
    WHERE event_type = 'card_click'
    GROUP BY json_extract(payload, '$.expert_id')
    HAVING total_clicks > 0
    ORDER BY total_clicks DESC
"""), {"cutoff": cutoff}).all()
```

### Backend top-queries endpoint — LIMIT is the `limit` param
```python
# app/routers/admin/analytics.py (line 347)
@router.get("/analytics/top-queries")
def get_top_queries(days: int = 0, limit: int = 5, db: Session = Depends(get_db)):
    # LIMIT :limit — can be changed by passing limit=50 from frontend
```

### SpeedInsights — already live
```tsx
// frontend/src/App.tsx (line 8, line 111)
import { SpeedInsights } from '@vercel/speed-insights/react'
// ...
<SpeedInsights />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated route for "See All" (`/admin/top-experts`) | In-card expansion | Phase 65 decision | Preserves period toggle context, simpler UX |
| SpeedInsights not installed | Already installed and live | Pre-Phase 65 | ANLYT-01 is code-complete, needs dashboard verification only |

---

## Open Questions

1. **ANLYT-01 verification mechanism**
   - What we know: `<SpeedInsights />` is mounted in App.tsx. The package is installed. Vercel automatically receives data when users visit the deployed URL.
   - What's unclear: Whether the Vercel dashboard already shows data (depends on whether real user traffic has hit the deployed site since the component was added).
   - Recommendation: Treat ANLYT-01 as already code-complete. The plan should include a manual verification step: visit vercel.com/dashboard and confirm Speed Insights data appears. No code task required.

2. **Accordion animation**
   - What we know: `motion` (Framer Motion v12) is installed. The project has no existing usage of it in admin components (no `from 'motion'` imports found in src/).
   - What's unclear: Whether the user wants smooth animation. This is Claude's discretion.
   - Recommendation: Use a simple CSS `transition-all duration-200` on the container height, or skip animation entirely for simplicity. Avoid Framer Motion for a one-off accordion — it adds complexity with no pattern established in admin components.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test block: `{ environment: 'node', globals: true }`) |
| Quick run command | `npm run test` (from `frontend/`) |
| Full suite command | `npm run test` (from `frontend/`) |
| Estimated runtime | ~5 seconds (no test files exist in project src/) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMOV-01 | TopExpertsCard shows all experts when expanded | manual-only | n/a — DOM interaction in browser | ❌ No test infrastructure for admin components |
| ADMOV-02 | TopQueriesCard shows up to 50 queries when expanded | manual-only | n/a — requires live API | ❌ No test infrastructure for admin components |
| ADMOV-03 | Collapse returns to top 5 view, period toggle preserved | manual-only | n/a — stateful UI flow | ❌ No test infrastructure for admin components |
| ANLYT-01 | Speed Insights data in Vercel dashboard | manual-only | n/a — third-party dashboard check | ❌ No automated check possible |

**Justification for manual-only:** The admin panel has no existing test infrastructure (no `__tests__/` or `*.test.tsx` files in `frontend/src/admin/`). The Vitest config uses `environment: 'node'` which cannot render React components. All four requirements are UI state or third-party verification. Setting up jsdom + testing-library for a one-phase accordion would be disproportionate scope.

### Nyquist Sampling Rate
- **Minimum sample interval:** After each task → manual browser check of the affected card
- **Full suite trigger:** `npm run test` from `frontend/` before final commit (even though no tests exist, confirms no regressions in type checking)
- **Phase-complete gate:** Manual verification of all 4 success criteria in browser before `/gsd:verify-work`
- **Estimated feedback latency per task:** ~2 minutes (browser reload + visual check)

### Wave 0 Gaps
None — no test files to create. All validation is manual browser testing.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `frontend/src/admin/pages/OverviewPage.tsx` — full card component code
- Direct codebase inspection — `app/routers/admin/events.py` — exposure endpoint (no LIMIT)
- Direct codebase inspection — `app/routers/admin/analytics.py` — top-queries endpoint (LIMIT param)
- Direct codebase inspection — `frontend/src/App.tsx` — SpeedInsights already mounted
- Direct codebase inspection — `frontend/package.json` — all packages confirmed installed

### Secondary (MEDIUM confidence)
- Vercel Speed Insights docs pattern — `<SpeedInsights />` component from `@vercel/speed-insights/react` is the documented integration method

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json, all component code read directly
- Architecture: HIGH — accordion pattern derived from actual component structure, no speculation
- Pitfalls: HIGH — identified from direct code reading (limit: 5 in fetch call, SpeedInsights already present)

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (stable — no external dependencies, all findings from local codebase)
