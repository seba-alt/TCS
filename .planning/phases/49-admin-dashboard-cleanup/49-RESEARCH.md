# Phase 49: Admin Dashboard Cleanup - Research

**Researched:** 2026-02-27
**Domain:** React Router v7 (redirects/catch-all), React component deletion, FastAPI endpoint audit
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No admin pages are removed — all 8 current pages stay (Overview, Gaps, Intelligence, Data, Tools, Experts, Leads, Settings)
- Remove all 5 legacy redirect routes: search-lab, score-explainer, index, searches, marketplace
- Any unknown `/admin/*` route redirects to the overview page (graceful fallback, not 404)
- Clean up corresponding backend endpoints for removed legacy routes if any exist
- Surface recent leads and recent searches directly on the overview page
- Overview data loads on page visit only — no auto-refresh/polling
- Stat cards from Phase 48 (Total Leads, Expert Pool, Top Searches, Conversion Rate) sit at the top
- Recent leads + recent searches sections below the stats, with "View all" links to their respective pages

### Claude's Discretion
- Recent leads section format (compact table vs activity feed)
- Number of recent items to show before "View all" link
- Layout and visual design of the consolidated overview
- Whether any orphaned backend background tasks need cleanup

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADM-04 | Unused admin tools removed, sidebar simplified for current configuration | Frontend: remove 5 redirect routes from main.tsx (lines 105-109), add catch-all `*` Navigate; Backend: no matching endpoints for the removed route paths exist — only the route-level redirects in the router need deletion. Overview page augmented with recent leads + recent searches panels using existing hooks. |
</phase_requirements>

## Summary

Phase 49 is a cleanup and consolidation task. The scope is narrower than originally anticipated: the 5 "legacy redirect" routes in `main.tsx` (search-lab, score-explainer, index, searches, marketplace) are `<Navigate>` components with no corresponding page file — they already point to existing pages (tools, data). Removing them means deleting the 5 `{ path: '...', element: <Navigate ... /> }` route entries and adding a single `{ path: '*', element: <Navigate to="/admin" replace /> }` catch-all inside the `/admin` children array.

There are no dead backend endpoints corresponding to the removed frontend redirect routes. The backend already has live endpoints called `/api/admin/searches` (used by DataPage), `/api/admin/compare` (used by SearchLabPage inside ToolsPage), etc. None of these need to be removed. The only backend concern is the `_compute_tsne_background` task in `main.py` and the `/api/admin/embedding-map` endpoint, which back `IntelligenceDashboardPage` — that page is being **kept**, so those stay untouched.

The overview page consolidation requires adding two new data-fetching sections to `OverviewPage.tsx`: a "Recent Leads" strip (pulling from the existing `/api/admin/leads` endpoint via `useAdminLeads()`) and a "Recent Searches" strip (pulling from `/api/admin/searches` via `useAdminSearches()`), each showing N items with a "View all" link.

**Primary recommendation:** Single atomic PR touching `main.tsx` (route cleanup + catch-all), `OverviewPage.tsx` (new sections), and no backend file changes required.

## Standard Stack

### Core (already in use — no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | v7 (in use) | Routing, Navigate component, catch-all `path: '*'` | Already integrated; `<Navigate>` is the idiomatic redirect |
| React hooks (useEffect, useState) | n/a | Data fetching on page visit | Already used in OverviewPage; `adminFetch` utility already available |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `adminFetch` / `useAdminLeads` / `useAdminSearches` | internal | Type-safe data fetching with Bearer auth | Already exists in `useAdminData.ts` — no new hooks needed |
| `Link` from react-router-dom | v7 | "View all" navigation links | Already used in OverviewPage for "See all →" links |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<Navigate to="/admin" replace />` catch-all | 404 page | Navigate is correct — 404 is confusing for admin routes that may have existed; redirect to overview is friendlier |
| `useAdminLeads()` hook in OverviewPage | Inline `adminFetch` call in `useEffect` | Both work; use `adminFetch` directly (same pattern as `TopZeroResultsCard` component) to avoid re-fetching on tab switch |

**Installation:** No new packages required.

## Architecture Patterns

### Current Route Structure (relevant excerpt from `frontend/src/main.tsx`)
```
/admin (RequireAuth → AdminApp)
  ├── index → OverviewPage
  ├── gaps → GapsPage
  ├── leads → LeadsPage
  ├── experts → ExpertsPage
  ├── settings → SettingsPage
  ├── intelligence → IntelligenceDashboardPage
  ├── tools → ToolsPage
  ├── data → DataPage
  ├── search-lab → Navigate to /admin/tools   ← DELETE
  ├── score-explainer → Navigate to /admin/tools  ← DELETE
  ├── index → Navigate to /admin/tools   ← DELETE
  ├── searches → Navigate to /admin/data   ← DELETE
  ├── marketplace → Navigate to /admin/data  ← DELETE
  └── (no catch-all — results in 404 for unknown paths)  ← ADD * → Navigate /admin
```

### Pattern 1: React Router v7 Catch-All Inside Nested Route
**What:** Add `{ path: '*', element: <Navigate to="/admin" replace /> }` as the last child of the `/admin` route's children array.
**When to use:** Any unknown `/admin/xyz` URL, bookmark to a removed route, or typo.
**Example:**
```tsx
// In the /admin children array (after all named routes):
{ path: '*', element: <Navigate to="/admin" replace /> },
```
Note: `<Navigate>` (not `<RedirectWithParams>`) is correct here — no query params need preservation for unknown admin routes.

### Pattern 2: Overview Page Section (mirrors existing TopZeroResultsCard)
**What:** Each new section is a self-contained function component that fetches its own data via `adminFetch` in a `useEffect`, rendering a loading/empty/data state.
**When to use:** Any overview panel that loads on mount, no polling.
**Example (matches existing `TopZeroResultsCard` pattern):**
```tsx
function RecentLeadsCard() {
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<LeadsResponse>('/leads')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = (data?.leads ?? []).slice(0, 5)  // N = 5 (Claude's discretion)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Recent Leads</h2>
        <Link to="/admin/leads" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          View all →
        </Link>
      </div>
      {/* compact table rows */}
    </div>
  )
}
```

### Pattern 3: Recent Searches (mirrors same approach)
```tsx
function RecentSearchesCard() {
  const [data, setData] = useState<SearchesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch<SearchesResponse>('/searches', { page: 0, page_size: 5 })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rows = data?.rows ?? []
  // ...
}
```

### Anti-Patterns to Avoid
- **Removing unused page files without removing their lazy imports:** `SearchLabPage`, `ScoreExplainerPage`, `SearchesPage`, `AdminMarketplacePage` are still page files that exist on disk. They are NOT imported in `main.tsx` (only the 5 redirect `<Navigate>` entries are removed, not actual page components). Do not delete those files — they are used by `ToolsPage` and `DataPage` internally, or they could be left as-is. Verify usage before deletion.
- **Adding polling to the overview:** Decision is load-on-visit only — do not add `setInterval` in overview data-fetch hooks.
- **Using `<Navigate>` in the catch-all without `replace`:** Omitting `replace` creates history entry for the unknown URL; `replace: true` prevents back-button loops.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redirect from removed routes | Custom redirect component | `<Navigate to="..." replace />` | Already in codebase; handles all cases |
| Catch-all 404 handling | Custom 404 page or complex logic | `{ path: '*', element: <Navigate to="/admin" replace /> }` | One line; consistent with existing redirect pattern |
| Fetching leads/searches for overview | New hook | `adminFetch<T>()` directly in useEffect | Matches existing `TopZeroResultsCard` pattern in the same file |

**Key insight:** This phase is almost entirely deletion. The only net-new code is the catch-all route entry and two new card components in OverviewPage.tsx.

## Common Pitfalls

### Pitfall 1: Deleting page files that are still imported elsewhere
**What goes wrong:** `SearchLabPage.tsx`, `ScoreExplainerPage.tsx`, `SearchesPage.tsx`, `AdminMarketplacePage.tsx` exist as page files. Main.tsx does NOT directly import them (they were consolidated into ToolsPage/DataPage in a prior phase), but we should verify they are not imported inside `ToolsPage.tsx` or `DataPage.tsx` before deletion.
**Why it happens:** Cleanup phases miss internal component composition.
**How to avoid:** Grep for each file name before deleting. Research finding: these pages appear to be standalone (each has their own imports), but cross-check with ToolsPage and DataPage.
**Warning signs:** Build error "Module not found" after deletion.

### Pitfall 2: Catch-all route placement
**What goes wrong:** Adding `{ path: '*', element: ... }` before named routes causes all navigation to redirect to overview.
**Why it happens:** React Router matches routes in order; `*` must be last.
**How to avoid:** Always add `path: '*'` as the final entry in the children array.
**Warning signs:** All admin links redirect to overview instead of their correct page.

### Pitfall 3: Overview page loads all leads (potentially slow)
**What goes wrong:** `GET /api/admin/leads` returns ALL leads — grouped by email from the full conversations table. For large datasets this could be slow on page load.
**Why it happens:** The endpoint has no pagination; it processes all conversations and groups in Python.
**How to avoid:** Use `slice(0, N)` client-side on the result (already the data is fetched, just display fewer rows). Do not add a new paginated endpoint — complexity is not justified for a cleanup phase; N=5 rows.
**Warning signs:** Slow overview page load with many leads.

### Pitfall 4: `path: 'index'` collision
**What goes wrong:** One of the redirect routes is `{ path: 'index', element: <Navigate to="/admin/tools" replace /> }`. The index route in React Router has special meaning when used with the `index: true` boolean property, but `path: 'index'` is just a regular string path matching the literal segment `/admin/index` — not the index route. Deleting this entry is safe; it won't affect `{ index: true, element: <OverviewPage /> }`.
**Why it happens:** The word "index" is overloaded in React Router.
**How to avoid:** Confirm: the entry to delete is `{ path: 'index', element: <Navigate ... /> }` (has `path` property), not `{ index: true, element: <OverviewPage /> }` (has `index: true` boolean).

## Code Examples

### Route Cleanup (verified from codebase)
Current state in `frontend/src/main.tsx` lines 105-109:
```tsx
// These 5 entries are removed:
{ path: 'search-lab',      element: <Navigate to="/admin/tools" replace /> },
{ path: 'score-explainer', element: <Navigate to="/admin/tools" replace /> },
{ path: 'index',           element: <Navigate to="/admin/tools" replace /> },
{ path: 'searches',        element: <Navigate to="/admin/data" replace /> },
{ path: 'marketplace',     element: <Navigate to="/admin/data" replace /> },

// This 1 entry is added (last in children array):
{ path: '*', element: <Navigate to="/admin" replace /> },
```

### Available Data Shapes for Overview Additions

**LeadRow** (from `frontend/src/admin/types.ts`):
```typescript
interface LeadRow {
  email: string
  total_searches: number
  last_search_at: string | null
  gap_count: number
  recent_queries: string[]
}
```

**SearchRow** (from `frontend/src/admin/types.ts`):
```typescript
interface SearchRow {
  id: number
  email: string
  query: string
  created_at: string
  response_type: string
  match_count: number
  top_match_score: number | null
  is_gap: boolean
  gap_resolved: boolean
  source: string
}
```

### Backend: No Changes Required
Audit result: there are NO backend endpoints at paths corresponding to the 5 removed frontend routes (`/api/admin/search-lab`, `/api/admin/score-explainer`, `/api/admin/index`, `/api/admin/marketplace`). The existing `/api/admin/searches` endpoint is actively used by DataPage and is NOT removed. No backend file changes needed.

The `_compute_tsne_background` task in `app/main.py` backs `IntelligenceDashboardPage` — that page is retained, so the task stays.

## Verification of Page File Usage

Before the planner touches page files, these cross-checks are required:

**Pages currently routed in `main.tsx`** (8 active — confirmed):
- OverviewPage, GapsPage, LeadsPage, ExpertsPage, SettingsPage, IntelligenceDashboardPage, ToolsPage, DataPage

**Pages NOT routed in `main.tsx`** (exist as files but not imported by main.tsx):
- `SearchLabPage.tsx` — likely composed inside ToolsPage (needs grep confirmation)
- `ScoreExplainerPage.tsx` — likely composed inside DataPage or a tab in ToolsPage
- `SearchesPage.tsx` — likely a tab/section inside DataPage
- `AdminMarketplacePage.tsx` — likely a tab/section inside DataPage

**Action for planner:** Grep for these filenames inside `ToolsPage.tsx` and `DataPage.tsx` before any deletion decisions. The CONTEXT.md only asks for removal of the redirect route entries, NOT the page files themselves.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy redirect routes (5 entries in main.tsx) | These will be removed; catch-all added | Phase 49 | Cleaner router config, graceful fallback for unknown paths |
| Overview shows aggregate stats only | Overview adds recent leads + recent searches sections below stats | Phase 49 | Single-screen signal without sub-page navigation |

## Open Questions

1. **Are SearchLabPage, ScoreExplainerPage, SearchesPage, AdminMarketplacePage composed inside ToolsPage/DataPage?**
   - What we know: These 4 files exist in `frontend/src/admin/pages/` but are not imported in `main.tsx`
   - What's unclear: Whether they are imported by ToolsPage.tsx or DataPage.tsx as sub-tabs
   - Recommendation: The plan task must grep for their imports before any file deletion; they are almost certainly used internally. The CONTEXT.md only requires removing the 5 redirect routes from `main.tsx`, not deleting these files.

2. **Number of recent items to surface on overview (Claude's discretion)**
   - What we know: Existing TopZeroResultsCard shows 5 items
   - Recommendation: Use 5 for both recent leads and recent searches — consistent with existing pattern.

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `frontend/src/main.tsx` lines 49-114 — exact route entries verified
- Direct codebase read: `frontend/src/admin/pages/OverviewPage.tsx` — existing component patterns
- Direct codebase read: `frontend/src/admin/hooks/useAdminData.ts` — available hooks confirmed
- Direct codebase read: `frontend/src/admin/types.ts` — LeadRow and SearchRow shapes confirmed
- Direct codebase read: `app/routers/admin.py` — all backend endpoints audited; no orphaned endpoints for removed routes
- Direct codebase read: `app/main.py` lines 105-174 — tsne background task confirmed as backing IntelligenceDashboardPage (kept)

### Secondary (MEDIUM confidence)
- React Router v7 catch-all pattern: `{ path: '*', ... }` is standard documented behavior; `<Navigate replace>` within it is the correct idiom

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything is in the existing codebase, no new libraries
- Architecture: HIGH — verified from direct file reads; patterns already in use
- Pitfalls: HIGH — identified from actual code state (page file usage, catch-all ordering)

**Research date:** 2026-02-27
**Valid until:** Stable — this is a one-time cleanup with no external dependencies
