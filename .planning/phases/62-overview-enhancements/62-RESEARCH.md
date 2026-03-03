# Phase 62: Overview Enhancements - Research

**Researched:** 2026-03-03
**Domain:** FastAPI analytics endpoints + React admin dashboard cards
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card layout & placement**
- New cards appear in a new row below the existing overview stats
- 3-column equal-width grid on desktop (all three side by side)
- Full-width vertical stack on mobile
- Each card has a title header with a small icon

**Ranking presentation**
- Each card shows a top 5 ranked list
- Display as numbered rows with count (e.g., "1. Expert Name — 42 clicks")
- Expert names in the top experts card are clickable links to their profile in the admin panel
- Search queries in the top queries card are display-only (no click interaction)

**Unmet demand display**
- Card titled "Unmet Demand" — positive, action-oriented framing
- Shows frequency count next to each zero-result query (e.g., "blockchain — 7 searches")
- Sorted by frequency (most-searched gaps first)
- Same card styling as the other two cards (no special accent or emphasis)

**Empty/low data states**
- Cards with no data show a short inline message (e.g., "No activity today") — card stays visible
- Unmet demand card empty state is positive: "All searches returned results" with a subtle checkmark
- Cards with fewer than 5 items show only what's available (no placeholder padding)
- Skeleton loader while data is being fetched (placeholder lines, no spinner)

### Claude's Discretion
- Exact icon choices for each card header
- Skeleton loader design details
- Card border/shadow styling to match existing admin cards
- Exact wording of empty state messages

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OVER-01 | Overview page shows top experts by card click volume in the selected period | `GET /api/admin/events/exposure` already returns experts ranked by `total_clicks` with period scoping via `days` param — expose top 5 on frontend |
| OVER-02 | Overview page shows top search queries by frequency in the selected period | `GET /api/admin/analytics-summary` returns `recent_searches` (recency, not frequency); a new backend query aggregating `user_events` by `query_text` count is needed |
| OVER-03 | Overview page shows zero-result queries as unmet demand signals in the selected period | `GET /api/admin/events/demand` already returns zero-result queries ranked by frequency with `days` param — expose top 5 on frontend |
</phase_requirements>

---

## Summary

Phase 62 adds three ranked-list cards to the existing `OverviewPage.tsx` in a new third row below the existing 2x2 detail grid. The page already has a `days` state variable (Today=1 / 7d=7 / 30d=30 / All=0) that drives all data fetching — the new cards must consume that same `days` value.

**Backend coverage is partial.** Two of three requirements are already served by existing endpoints:
- OVER-01 (top experts by clicks) → `GET /api/admin/events/exposure?days=N` returns all experts ranked by `total_clicks`. Only the top-5 slice is needed.
- OVER-03 (unmet demand / zero-result queries) → `GET /api/admin/events/demand?days=N&page_size=5` returns zero-result queries ranked by frequency.

OVER-02 (top search queries by frequency) has NO existing endpoint that aggregates `query_text` by count for a time window. The current `analytics-summary` endpoint returns the 10 most recent searches (recency order, not frequency). A new query aggregating `user_events WHERE event_type='search_query'` grouped by `json_extract(payload, '$.query_text')` ordered by `COUNT(*) DESC` is required.

**Frontend pattern is clear and consistent.** The existing `OverviewPage.tsx` already contains four section cards that use `AdminCard` + `adminFetch` + local `useState`/`useEffect` for data fetching. The three new cards follow the same component pattern. No new hooks in `useAdminData.ts` are strictly required (inline `adminFetch` is acceptable, as used in `TopZeroResultsCard` and `RecentLeadsCard`).

**Primary recommendation:** Add one new backend endpoint (`GET /api/admin/analytics/top-queries`) and wire three new frontend card components into `OverviewPage.tsx`, all driven by the existing `days` prop.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | (existing) | Backend endpoint | Project standard, no change |
| SQLAlchemy raw text | (existing) | SQLite JSON path queries | Matches pattern in `analytics.py` and `events.py` |
| React | ^19.2.0 | Frontend components | Project standard |
| Tailwind CSS | ^3.4.19 | Styling | Project standard — all admin UI |
| lucide-react | ^0.575.0 | Icons in card headers | Already installed in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AdminCard | (local component) | Card wrapper | Use for all three new cards — matches existing look |
| adminFetch | (local utility) | Authenticated API calls | Standard for all admin data fetching |
| Link (react-router-dom) | ^7.13.0 | Expert profile links | OVER-01 requires clickable expert names |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline fetch in component | New hook in useAdminData.ts | Existing cards (TopZeroResultsCard, RecentLeadsCard) use inline fetch — stay consistent |
| New analytics endpoint | Reuse exposure/demand endpoints | OVER-01 and OVER-03 reuse existing; OVER-02 genuinely needs new endpoint |

**Installation:** No new packages needed. `lucide-react` is already installed.

---

## Architecture Patterns

### Recommended File Changes
```
app/routers/admin/
└── analytics.py          # Add GET /analytics/top-queries endpoint

frontend/src/admin/
└── pages/OverviewPage.tsx  # Add three new card components + new grid row
```

No new files required. All changes are additions to two existing files.

### Pattern 1: Existing Section Card Pattern (copy this)
**What:** Self-contained component with local state, useEffect for fetch, renders inside AdminCard
**When to use:** For all three new cards — matches TopZeroResultsCard and RecentLeadsCard

```tsx
// Source: existing OverviewPage.tsx TopZeroResultsCard pattern
function TopExpertsCard({ days }: { days: number }) {
  const [data, setData] = useState<ExposureResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch<ExposureResponse>('/events/exposure', { days })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [days])   // ← re-fetches when period toggle changes

  const rows = (data?.exposure ?? []).slice(0, 5)

  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Top Experts</h2>
      </div>
      {/* skeleton | empty | ranked list */}
    </AdminCard>
  )
}
```

### Pattern 2: Skeleton Loader (replace existing "Loading..." pattern)
**What:** Placeholder lines matching card height during fetch — no spinner
**When to use:** Mandatory for all three new cards (user decision)

```tsx
// Skeleton — 5 placeholder rows
{loading && (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-5 bg-slate-700/50 rounded animate-pulse" />
    ))}
  </div>
)}
```

### Pattern 3: Numbered Ranked Row
**What:** "1. Name — 42 clicks" layout
**When to use:** All three cards require this ranked presentation

```tsx
{rows.map((row, i) => (
  <div key={i} className="flex items-center gap-2">
    <span className="text-xs text-slate-500 w-4 flex-shrink-0">{i + 1}.</span>
    <span className="text-sm text-slate-300 truncate flex-1">{row.label}</span>
    <span className="text-xs text-slate-500 font-mono flex-shrink-0">{row.count}</span>
  </div>
))}
```

### Pattern 4: New Backend Endpoint for OVER-02
**What:** Aggregate `query_text` frequency from `user_events` for a time window
**When to use:** OVER-02 only — no existing endpoint covers this

```python
# Source: analytics.py pattern with raw SQL (matches existing _text usage)
@router.get("/analytics/top-queries")
def get_top_queries(days: int = 0, limit: int = 5, db: Session = Depends(get_db)):
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S") if days > 0 else "2000-01-01"
    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency
        FROM user_events
        WHERE event_type = 'search_query'
          AND (json_extract(payload, '$.query_text') IS NOT NULL
               AND json_extract(payload, '$.query_text') != '')
          AND created_at >= :cutoff
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
        LIMIT :limit
    """), {"cutoff": cutoff, "limit": limit}).all()
    return {
        "queries": [{"query_text": r.query_text, "frequency": r.frequency} for r in rows]
    }
```

### Pattern 5: Period Toggle Wiring
**What:** Pass `days` prop from parent `OverviewPage` down into each new card
**When to use:** Critical — all three cards MUST re-fetch when `days` changes

The existing `days` state at the top of `OverviewPage` drives `useAdminStats(days)` and `useAnalyticsSummary(days)`. The new cards must receive `days` as a prop (or read it from parent context) and include it in their `useEffect` dependency array.

The existing `TopZeroResultsCard` is **hardcoded to 30 days** — this is a current limitation. For Phase 62, all three new cards must be period-aware (receive `days` prop), unlike the existing card.

### Pattern 6: 3-Column Grid Layout
**What:** Desktop 3-column equal-width, mobile single-column stack
**When to use:** The new third row below the existing `xl:grid-cols-2` detail row

```tsx
{/* New ranked insights row */}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <TopExpertsCard days={days} />
  <TopQueriesCard days={days} />
  <UnmetDemandCard days={days} />
</div>
```

### Pattern 7: Expert Profile Link in Admin Panel
**What:** Expert name links to admin expert detail
**When to use:** OVER-01 — expert names in top experts card must be clickable

Check current expert routing in `AdminApp.tsx` to confirm the route path. Based on the existing `ExpertsPage` pattern, links likely go to `/admin/experts?username=X` or a detail page. Verify before implementing.

### Anti-Patterns to Avoid
- **Hardcoded days=30 in new cards:** The existing `TopZeroResultsCard` does this — it's wrong for Phase 62. All three new cards must be period-aware.
- **Using loading spinner:** User decision specifies skeleton loader (placeholder lines), not a spinner or "Loading..." text.
- **Placeholder padding:** Do not pad to 5 rows when fewer items exist. Show only available items.
- **Fetching in parent and passing down:** Fetch inside each card component (matches existing pattern for detail section cards).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticated API calls | Custom fetch wrapper | `adminFetch` from useAdminData.ts | Handles 401 redirect, Bearer token, error normalization |
| Card shell/border styling | Custom div | `AdminCard` component | Consistent `bg-slate-800/60 border border-slate-700/60 rounded-xl` |
| Icons | SVG hand-drawn | lucide-react (already installed) | TrendingUp, Search, AlertCircle are good matches |
| Expert name resolution | Frontend name lookup | Backend already resolves in `/events/exposure` | `expert_name` field already populated by backend batch-lookup |

**Key insight:** Backend already does expert name resolution — `ExposureResponse.exposure[].expert_name` is a full name string. No frontend lookup needed.

---

## Common Pitfalls

### Pitfall 1: Period Toggle Mismatch
**What goes wrong:** New cards show stale data after period toggle click.
**Why it happens:** `days` not included in `useEffect` dependency array, or card receives no `days` prop.
**How to avoid:** All three new card components must accept `days: number` as a prop and list it in `useEffect([days])`.
**Warning signs:** Clicking "Today" still shows 30d data in new cards.

### Pitfall 2: OVER-02 Uses Wrong Existing Endpoint
**What goes wrong:** Top Queries card shows "recent" searches (last 10 by time), not "top" searches (highest frequency).
**Why it happens:** Mistaking `analytics-summary.recent_searches` for a frequency ranking.
**How to avoid:** Build the new `GET /analytics/top-queries` endpoint that GROUPs by query_text and ORDERs by COUNT DESC.
**Warning signs:** Card shows different queries every refresh; count values are always 1.

### Pitfall 3: Expert Link Route Wrong
**What goes wrong:** Clicking expert name navigates to 404.
**Why it happens:** Assuming expert detail route without verifying actual router config.
**How to avoid:** Check `AdminApp.tsx` route definitions before hardcoding link href.
**Warning signs:** Link renders but navigation shows blank page or 404.

### Pitfall 4: Empty State for Unmet Demand Card
**What goes wrong:** Shows generic "No activity" instead of the decided positive message.
**Why it happens:** Copy-pasting generic empty state from other cards.
**How to avoid:** Unmet Demand empty state is specifically: "All searches returned results" with a checkmark. Implement separately.
**Warning signs:** Empty state text doesn't match the positive framing decision.

### Pitfall 5: `days=0` Handling in New Endpoint
**What goes wrong:** "All" period (days=0) applies wrong date cutoff.
**Why it happens:** `0` days interpreted as "no history" instead of "all history".
**How to avoid:** Match existing pattern — `cutoff = "2000-01-01"` when `days == 0`. Verify in `/events/demand` (line 68 of events.py): `cutoff = ... if days > 0 else "2000-01-01"`.
**Warning signs:** "All" period shows empty results.

---

## Code Examples

### Existing `/events/exposure` response (OVER-01 data source)
```python
# Source: app/routers/admin/events.py get_exposure()
return {
    "data_since": data_since,
    "exposure": [
        {
            "expert_id": r.expert_id,           # username
            "expert_name": r.expert_name,        # "First Last" — already resolved
            "total_clicks": r.total_clicks,      # use this for ranking
            "grid_clicks": r.grid_clicks,
            "sage_clicks": r.sage_clicks,
        }
        for r in rows
    ],
}
```
Frontend: call `adminFetch<ExposureResponse>('/events/exposure', { days })` and slice `.exposure.slice(0, 5)`.

### Existing `/events/demand` response (OVER-03 data source)
```python
# Source: app/routers/admin/events.py get_demand()
return {
    "data_since": data_since,  # null = no data yet
    "demand": [{"query_text": r.query_text, "frequency": r.frequency, ...}],
    ...
}
```
Frontend: call `adminFetch<DemandResponse>('/events/demand', { days, page: 0, page_size: 5 })` and read `.demand`.

### New endpoint needed for OVER-02
```python
# Add to app/routers/admin/analytics.py
@router.get("/analytics/top-queries")
def get_top_queries(days: int = 0, limit: int = 5, db: Session = Depends(get_db)):
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S") if days > 0 else "2000-01-01"
    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency
        FROM user_events
        WHERE event_type = 'search_query'
          AND json_extract(payload, '$.query_text') IS NOT NULL
          AND json_extract(payload, '$.query_text') != ''
          AND created_at >= :cutoff
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
        LIMIT :limit
    """), {"cutoff": cutoff, "limit": limit}).all()
    return {"queries": [{"query_text": r.query_text, "frequency": r.frequency} for r in rows]}
```
Frontend: call `adminFetch<{queries: {query_text: string; frequency: number}[]}>('/analytics/top-queries', { days, limit: 5 })`.

### Frontend grid layout addition
```tsx
// Add after the existing "Detail sections — 2x2 grid" block in OverviewPage
{/* Ranked insights row */}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <TopExpertsCard days={days} />
  <TopQueriesCard days={days} />
  <UnmetDemandCard days={days} />
</div>
```

### TypeScript types needed
```ts
// Add to frontend/src/admin/types.ts

export interface TopQueryRow {
  query_text: string
  frequency: number
}

export interface TopQueriesResponse {
  queries: TopQueryRow[]
}
```
`ExposureResponse` and `DemandResponse` already exist in `types.ts` — no new types needed for OVER-01 and OVER-03.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded 30d in TopZeroResultsCard | New cards use period-aware `days` prop | New cards are more correct; existing card could be upgraded later (out of scope) |
| "Loading..." text for loading state | Skeleton placeholder lines | Better UX during fetch |

**Existing limitation:** The current `TopZeroResultsCard` in `OverviewPage.tsx` (line 92) calls `adminFetch` with hardcoded `{ days: 30, page: 0, page_size: 5 }` — it does NOT respect the period toggle. This is pre-existing behavior; do not change it in Phase 62.

---

## Open Questions

1. **Expert profile link route**
   - What we know: There is an `ExpertsPage` at `/admin/experts`. Expert rows have a `username` field.
   - What's unclear: Is there a per-expert detail route (e.g., `/admin/experts/:username`) or does the experts page use inline expand?
   - Recommendation: Read `AdminApp.tsx` route config before building expert links. If no detail page exists, link to `/admin/experts` with a `?highlight=username` param or simply do not make the name a link and instead display plaintext (confirm with user if needed).

2. **`/analytics/top-queries` route placement**
   - What we know: `analytics.py` uses `@router.get("/analytics-summary")` (hyphenated, not nested).
   - What's unclear: Should new endpoint be `/analytics/top-queries` (nested) or `/analytics-top-queries` (flat)?
   - Recommendation: Use `/analytics/top-queries` for clarity. The `router` in analytics.py is included without a prefix by `admin/__init__.py`, so full path becomes `GET /api/admin/analytics/top-queries`. This is consistent with `/events/demand` nesting pattern.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test.environment: 'node') |
| Quick run command | `cd /Users/sebastianhamers/Documents/TCS/frontend && npm run test` |
| Full suite command | `cd /Users/sebastianhamers/Documents/TCS/frontend && npm run test` |
| Estimated runtime | ~3 seconds |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVER-01 | Top experts card fetches from `/events/exposure` with `days` param and slices top 5 | unit (logic) | `npm run test -- --reporter=verbose` | ❌ Wave 0 gap |
| OVER-02 | New endpoint aggregates `query_text` frequency correctly, respects `days=0` as all-time | unit (logic) | `npm run test -- --reporter=verbose` | ❌ Wave 0 gap |
| OVER-03 | Unmet demand card fetches from `/events/demand` with period; empty state shows positive message | unit (logic) | `npm run test -- --reporter=verbose` | ❌ Wave 0 gap |
| All | Period toggle drives re-fetch in all three new cards | unit (logic) | `npm run test -- --reporter=verbose` | ❌ Wave 0 gap |

Note: Frontend tests in this project test pure logic functions (not React rendering — no @testing-library/react installed, environment is `node` not `jsdom`). Tests should extract and test logic inline (e.g., empty state conditions, data slicing logic, URL param construction), matching the pattern of `FilterChips.test.ts` and `useExplore.test.ts`.

### Nyquist Sampling Rate
- **Minimum sample interval:** After each committed task → run: `cd /Users/sebastianhamers/Documents/TCS/frontend && npm run test`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~3 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `frontend/src/admin/pages/OverviewPage.test.ts` — covers OVER-01/02/03 logic: data slicing, period wiring, empty state conditions
- [ ] Backend testing: no pytest infrastructure exists — backend validation is manual (HTTP calls to local dev server)

*(No test framework install needed — vitest already installed and configured)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `app/routers/admin/analytics.py`, `app/routers/admin/events.py` — confirmed existing endpoints and SQL patterns
- Direct codebase inspection — `frontend/src/admin/pages/OverviewPage.tsx` — confirmed existing card pattern, period toggle, grid layout
- Direct codebase inspection — `frontend/src/admin/hooks/useAdminData.ts` — confirmed `adminFetch`, `ExposureResponse`, `DemandResponse` types
- Direct codebase inspection — `frontend/src/admin/types.ts` — confirmed TypeScript interface shapes
- Direct codebase inspection — `frontend/vite.config.ts`, `package.json` — confirmed vitest setup and available packages
- Direct codebase inspection — `app/routers/admin/__init__.py` — confirmed router assembly pattern

### Secondary (MEDIUM confidence)
- None needed — all findings from direct codebase inspection

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json and codebase
- Architecture: HIGH — patterns confirmed from reading actual production code
- Pitfalls: HIGH — identified from direct reading of existing code (TopZeroResultsCard hardcoded days, missing period-awareness)
- Validation: HIGH — vitest confirmed installed and configured, test pattern confirmed from existing test files

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase, 30-day validity)
