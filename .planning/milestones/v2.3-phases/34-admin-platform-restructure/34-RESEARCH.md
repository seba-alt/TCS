# Phase 34: Admin Platform Restructure - Research

**Researched:** 2026-02-23
**Domain:** React Router v6, React component architecture, admin UI navigation IA
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard priority**
- Layout: Small health strip at top (API speedometer + key stats), then two-column split: top zero-result queries (left) + Sage volume sparkline (right)
- Speedometer: Keep the distinctive SVG speedometer gauge for API health
- Zero-result queries card: Mini top-5 preview with "See all →" link to Gaps page — calls existing `/api/admin/events/demand` endpoint (no new backend work)
- Sage volume: Small 7-day sparkline in the right column (compact, not a full chart)

**Page consolidation**
- Searches + Marketplace merge: Combined into a single "Data" page with two tabs — Searches (query log) | Marketplace (demand/exposure insights)
- Intelligence: Stays as standalone nav item under Analytics (keeps its search performance charts and score distribution)
- Leads + Experts: Both stay under Admin section as separate items
- Re-index (Index page): Moves to Settings under "Index Management" section — `IndexPage.tsx` removed after migration

**Final sidebar structure (8 items)**
```
Analytics
  Overview
  Gaps          <- second, highest-priority signal after Overview
  Intelligence
  Data          <- merged Searches + Marketplace with tabs

Tools
  Tools         <- Search Lab / Score Explainer / Index tabs

Admin
  Experts
  Leads
  Settings
```

**Tools page**
- Default tab: Score Explainer (most diagnostic/educational)
- Tab order: Score Explainer | Search Lab | Index
- Tab visual style: Claude's discretion — pick what fits dark admin theme
- Old URL redirects: `/admin/search-lab`, `/admin/score-explainer`, `/admin/index` all redirect to `/admin/tools` (default tab, no pre-selection)

**Sidebar visual**
- Section labels: Claude's discretion — visible labels or separators, whichever fits the dark aesthetic cleanest
- Item order: Confirmed above — Gaps second in Analytics (high priority)
- Brand block: Keep as-is (Tinrate icon + name + "Admin Console" subtitle)

### Claude's Discretion
- Tab visual style for Tools page (pill vs underline)
- Sidebar section labels vs separators
- Whether "Data" page uses URL query param or hash for tab state
- How to handle the `AdminApp.tsx` route rewiring cleanly

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADM-R-01 | Sidebar consolidation — max 7 nav items across 3 sections (Analytics, Tools, Admin); re-index moves to Settings | Sidebar currently has 11 flat items in 2 sections; research shows NAV_ITEMS restructure + 3-section grouping pattern in existing codebase |
| ADM-R-02 | ToolsPage with tab navigation — Search Lab, Score Explainer, Index on one page; existing routes redirect | React Router v6 Navigate component handles redirects; URL hash tab switching is the right approach for in-page tabs |
| ADM-R-03 | Dashboard first impression — OverviewPage shows top zero-result queries card, Sage volume sparkline, API health all above the fold | `/api/admin/events/demand` already returns `DemandResponse` with `demand[]` array; `useMarketplaceDemand` hook exists and can be called with `days=30, page=1`; Recharts `LineChart`/`AreaChart` available for sparkline |
</phase_requirements>

---

## Summary

Phase 34 is a pure frontend navigation/IA refactor with no backend changes required. The existing admin app has 11 flat nav items split into two poorly-named sections ("Analytics" and "Intelligence"). The goal is to consolidate to 8 items in three clear sections: Analytics (4 items), Tools (1 item hosting 3 sub-tools as tabs), and Admin (3 items).

The key technical work breaks into four components: (1) restructuring `AdminSidebar.tsx` from a flat NAV_ITEMS array with slice-based sections to a grouped data structure with 3 sections; (2) creating a new `ToolsPage.tsx` that hosts Score Explainer, Search Lab, and Index tabs using URL hash for tab state; (3) creating a new `DataPage.tsx` that hosts Searches and Marketplace as tabs; (4) uplifting `OverviewPage.tsx` with a zero-result queries mini-table (top 5 from existing `/api/admin/events/demand`) and a 7-day Sage volume sparkline using existing hooks and Recharts.

All hooks and API endpoints needed already exist. `useMarketplaceDemand` covers the zero-result card. `useMarketplaceTrend` covers the Sage sparkline. The `IndexPage.tsx` re-index UI content moves verbatim into `SettingsPage.tsx` under a new "Index Management" section — `useIngestStatus` is already imported in SettingsPage.

**Primary recommendation:** Use URL hash (`window.location.hash` / `useEffect` on hash change) for in-page tab switching on both ToolsPage and DataPage — this keeps URLs bookmarkable and is the pattern decided for the Data page. Replace old routes with `<Navigate to="/admin/tools" replace />` and `<Navigate to="/admin/data" replace />` in `main.tsx`.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | v6 (createBrowserRouter) | Routing, redirects, `<Navigate>` | Already used throughout admin; `<Navigate replace>` is the canonical redirect approach |
| recharts | existing | Sparkline chart on OverviewPage | Already used in `AdminMarketplacePage.tsx` for `BarChart`; `LineChart` + `ResponsiveContainer` for sparkline |
| tailwindcss | existing | Tab styling, sidebar groups | All admin UI uses Tailwind dark slate palette |

### No new installs required
This phase adds zero npm dependencies. All needed libraries are present.

---

## Architecture Patterns

### Recommended File Changes

```
frontend/src/admin/
├── components/
│   └── AdminSidebar.tsx          # MODIFY: 3-section NAV_GROUPS structure
├── pages/
│   ├── OverviewPage.tsx          # MODIFY: add TopZeroResultsCard + SageSparklineCard
│   ├── SettingsPage.tsx          # MODIFY: add "Index Management" section (from IndexPage)
│   ├── ToolsPage.tsx             # CREATE: hash-tab page for Score Explainer / Search Lab / Index
│   ├── DataPage.tsx              # CREATE: hash-tab page for Searches / Marketplace
│   └── IndexPage.tsx             # DELETE: after content moved to SettingsPage
frontend/src/main.tsx             # MODIFY: add /admin/tools, /admin/data routes; add redirect routes
```

### Pattern 1: NAV_GROUPS — Grouped Sidebar Structure

**What:** Replace flat `NAV_ITEMS` array + manual `slice(0,4)` / `slice(4)` with a typed array of groups, each with a label and items array.

**When to use:** Any sidebar with labelled sections.

**Example:**
```typescript
// AdminSidebar.tsx
interface NavItem {
  to: string
  label: string
  end?: boolean
  icon: React.ReactNode
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { to: '/admin', label: 'Overview', end: true, icon: <OverviewIcon /> },
      { to: '/admin/gaps', label: 'Gaps', icon: <GapsIcon /> },
      { to: '/admin/intelligence', label: 'Intelligence', icon: <IntelIcon /> },
      { to: '/admin/data', label: 'Data', icon: <DataIcon /> },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/admin/tools', label: 'Tools', icon: <ToolsIcon /> },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/experts', label: 'Experts', icon: <ExpertsIcon /> },
      { to: '/admin/leads', label: 'Leads', icon: <LeadsIcon /> },
      { to: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
]

// Render:
{NAV_GROUPS.map((group, gi) => (
  <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
    <p className="px-3 pb-2 pt-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {group.label}
    </p>
    {group.items.map(({ to, label, end, icon }) => (
      <NavLink key={to} to={to} end={end} className={/* same active/inactive pattern */}>
        {icon}{label}
      </NavLink>
    ))}
  </div>
))}
```

### Pattern 2: URL Hash Tab Switching

**What:** Tab state driven by `window.location.hash`; tab changes call `navigate` with the hash. No full navigation, no separate routes per tab.

**When to use:** In-page tabs on ToolsPage and DataPage where bookmarkable URLs are valuable but full page reload is not wanted.

**Example:**
```typescript
// ToolsPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

type ToolTab = 'score-explainer' | 'search-lab' | 'index'

const TABS: { id: ToolTab; label: string }[] = [
  { id: 'score-explainer', label: 'Score Explainer' },
  { id: 'search-lab',      label: 'Search Lab' },
  { id: 'index',           label: 'Index' },
]

export default function ToolsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive active tab from hash; default to score-explainer
  const hashTab = location.hash.replace('#', '') as ToolTab
  const activeTab: ToolTab = TABS.some(t => t.id === hashTab) ? hashTab : 'score-explainer'

  function setTab(id: ToolTab) {
    navigate(`/admin/tools#${id}`, { replace: true })
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-slate-500 text-sm mt-1">Diagnostic and configuration tools</p>
      </div>

      {/* Tab bar — underline style suits dark admin theme */}
      <div className="border-b border-slate-700/60 flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-purple-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — render all, show/hide to preserve component state */}
      <div className={activeTab === 'score-explainer' ? '' : 'hidden'}>
        <ScoreExplainerPage />
      </div>
      <div className={activeTab === 'search-lab' ? '' : 'hidden'}>
        <SearchLabPage />
      </div>
      <div className={activeTab === 'index' ? '' : 'hidden'}>
        <IndexManagementPanel />
      </div>
    </div>
  )
}
```

**Important note on tab content mounting:** Use CSS `hidden` (not conditional rendering) to preserve component state (e.g., query input in SearchLabPage, selected search in ScoreExplainerPage). Both pages have internal `useState` that should survive tab switches.

**Alternative — conditional render:** Simpler but loses state on tab switch. Acceptable for the Index panel (stateless) but not for Search Lab or Score Explainer.

### Pattern 3: Route Redirect for Removed Pages

**What:** Replace old routes for `/admin/search-lab`, `/admin/score-explainer`, `/admin/index`, `/admin/searches`, `/admin/marketplace` with `<Navigate>` in `main.tsx`.

**When to use:** When a URL is permanently retired in favour of a consolidated page.

**Example (in main.tsx):**
```typescript
// Redirect old standalone routes to consolidated pages
{ path: 'search-lab',     element: <Navigate to="/admin/tools" replace /> },
{ path: 'score-explainer', element: <Navigate to="/admin/tools" replace /> },
{ path: 'index',          element: <Navigate to="/admin/tools" replace /> },
{ path: 'searches',       element: <Navigate to="/admin/data" replace /> },
{ path: 'marketplace',    element: <Navigate to="/admin/data" replace /> },
// Add new consolidated routes
{ path: 'tools',          element: <ToolsPage /> },
{ path: 'data',           element: <DataPage /> },
```

### Pattern 4: OverviewPage Dashboard Uplift

**What:** Three-section layout — (1) health strip: Speedometer + KPI stat cards side-by-side, (2) two-column below: zero-result queries mini-table (left) + Sage sparkline (right).

**When to use:** First-impression dashboard that needs data density without overwhelming.

**Zero-result queries card uses `useMarketplaceDemand(30, 1)` — take `data.demand.slice(0, 5)`:**
```typescript
// TopZeroResultsCard.tsx (inline in OverviewPage)
import { useMarketplaceDemand } from '../hooks/useAdminData'
import { Link } from 'react-router-dom'

function TopZeroResultsCard() {
  const { data, loading } = useMarketplaceDemand(30, 1)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Top Zero-Result Queries</h2>
        <Link to="/admin/gaps" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          See all →
        </Link>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
      ) : data?.data_since === null ? (
        <p className="text-slate-500 text-sm">No tracking data yet</p>
      ) : (data?.demand ?? []).length === 0 ? (
        <p className="text-slate-500 text-sm">No zero-result queries in the last 30 days</p>
      ) : (
        <div className="space-y-2">
          {(data?.demand ?? []).slice(0, 5).map((row, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 truncate max-w-[75%]" title={row.query_text}>
                {row.query_text}
              </span>
              <span className="text-xs text-red-400 font-mono ml-2 flex-shrink-0">{row.frequency}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Sage sparkline uses `useMarketplaceTrend()` — take last 7 days from `data.daily`:**
```typescript
// SageSparklineCard (inline in OverviewPage)
import { useMarketplaceTrend } from '../hooks/useAdminData'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

function SageSparklineCard() {
  const { data, loading } = useMarketplaceTrend()

  const last7 = (data?.daily ?? []).slice(-7)

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-1">Sage Volume</h2>
      <p className="text-xs text-slate-500 mb-4">Last 7 days</p>
      {loading ? (
        <div className="h-16 flex items-center">
          <p className="text-slate-500 text-sm animate-pulse">Loading…</p>
        </div>
      ) : data?.data_since === null ? (
        <div className="h-16 flex items-center">
          <p className="text-slate-500 text-sm">No data yet</p>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-white mb-3">
            {data?.kpis.total_queries ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1.5">queries / 14d</span>
          </div>
          <ResponsiveContainer width="100%" height={56}>
            <LineChart data={last7}>
              <Line
                type="monotone"
                dataKey="total"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
```

### Pattern 5: Index Management Section in SettingsPage

**What:** Move the "Rebuild Status" card + "About Index Rebuilds" card from `IndexPage.tsx` into a new "Index Management" section in `SettingsPage.tsx`. The `useIngestStatus` hook is already imported in `SettingsPage`.

**The SettingsPage already has `useIngestStatus`** — it has a simplified rebuild button in the FAISS section. The migration means expanding that section into the full rebuild UI from IndexPage (status badge, timestamps, rebuild button, about list).

**Key observation:** `SettingsPage.tsx` already imports `useIngestStatus` and calls `triggerRun`. The new Index Management section is an expansion of the existing FAISS section, not a from-scratch addition.

### Anti-Patterns to Avoid

- **Conditional rendering for tabs that have state:** Unmounting `<ScoreExplainerPage>` on tab switch clears `selectedId`. Use `hidden` class to keep components mounted.
- **Adding a new `data-*` parameter to the demand endpoint:** The card uses `page: 1, page_size: 5` — but the API uses 0-indexed pages. Use `page: 0, page_size: 5` (page=0 returns first page). Verify: `page` in `useMarketplaceDemand(days, page)` maps directly to the `page` query param in `GET /api/admin/events/demand`.
- **Using `<Link to="/admin/gaps">` from within ToolsPage children:** The Score Explainer currently has no links out. The "See all →" link belongs only on the OverviewPage zero-results card, pointing to `/admin/gaps`.
- **Breaking SearchesPage state:** SearchesPage reads `location.state?.email` (for navigating from Leads). When wrapping inside DataPage tabs, preserve this by forwarding `location.state` or keeping the NavLink from LeadsPage targeting `/admin/data` instead of `/admin/searches`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sparkline chart | Custom SVG path | Recharts `LineChart` with `dot={false}` | Already in project; handles data edge cases |
| Tab state from URL | Custom hash listener | `useLocation().hash` from react-router-dom | Already in project; avoids stale closure issues |
| Route redirect | Custom redirect component | React Router `<Navigate to="..." replace />` | Framework-standard pattern; handles history correctly |

**Key insight:** Every tool needed for this refactor already exists in the project. There is no new complexity to introduce — this is a pure reorganisation of existing code.

---

## Common Pitfalls

### Pitfall 1: Page-indexed vs 0-indexed demand endpoint

**What goes wrong:** Calling `useMarketplaceDemand(30, 1)` fetches page 1 (second page), returning rows 26-50. The first page is page 0.
**Why it happens:** The hook signature is `useMarketplaceDemand(days: number, page: number)` and maps directly to the `page` query param, which is 0-indexed in the backend (`OFFSET page * page_size`).
**How to avoid:** Call `useMarketplaceDemand(30, 0)` with `page_size: 5` — but the hook hardcodes `page_size: 25`. Consider calling `adminFetch` directly in the new card component with `{ days: 30, page: 0, page_size: 5 }`.
**Verified:** See `admin.py` line 1390: `LIMIT :limit OFFSET :offset` where `offset = page * page_size`.

### Pitfall 2: Leads navigation to Searches breaks after DataPage merge

**What goes wrong:** `LeadsPage.tsx` navigates to `/admin/searches` with `{ state: { email } }`. After the merge, that route redirects to `/admin/data` (no hash, no state). The Searches tab inside DataPage reads `location.state?.email` — but the redirect via `<Navigate>` does not forward state.
**Why it happens:** React Router's `<Navigate>` does not forward `location.state` from the source.
**How to avoid:** Update `LeadsPage.tsx` to navigate to `/admin/data#searches` and pass state: `navigate('/admin/data#searches', { state: { email } })`. In `DataPage.tsx`, read `location.state?.email` before passing to the Searches tab.
**Alternative:** Keep `/admin/searches` as a real route (not a redirect) while also having `/admin/data` with tabs. This avoids state-forwarding complexity but means the old URL still works independently. Simpler approach for this IA refactor.

### Pitfall 3: Mounted-but-hidden tabs trigger API calls

**What goes wrong:** Hiding tabs with CSS `hidden` keeps them mounted, which means `ScoreExplainerPage`, `SearchLabPage`, and the IndexPanel all fire their data fetches on ToolsPage load — even if the user only views Score Explainer.
**Why it happens:** All three child pages use `useEffect` hooks that fire on mount.
**How to avoid:** For the Index tab specifically (lightweight), this is fine. For ScoreExplainerPage (loads 50 searches) and SearchLabPage (no auto-fetch — only on user action), the cost is one extra network call for searches. Acceptable trade-off vs. losing component state. If performance matters, lazy-initialise ScoreExplainerPage with a `mounted` state flag.
**Recommendation:** Accept the trade-off. ScoreExplainerPage fetches 50 rows — negligible. SearchLabPage has no auto-fetch on mount, only on user action.

### Pitfall 4: Sidebar active state for /admin/tools with hash

**What goes wrong:** The NavLink `to="/admin/tools"` will be active only when the path is exactly `/admin/tools` (ignoring hash). This is correct — the hash does not affect `isActive`.
**Why it happens:** React Router's `NavLink` compares pathname only, not hash. `end={false}` for `/admin/tools` will match `/admin/tools` and `/admin/tools#score-explainer` identically.
**How to avoid:** No special handling needed. NavLink `isActive` already ignores hash — this is the expected behaviour.

### Pitfall 5: DataPage tab — "Data" NavLink matching Intelligence page

**What goes wrong:** The new Data nav item (`/admin/data`) could visually conflict with the Intelligence page if both use `end={false}`.
**Why it happens:** `end={false}` on `/admin/data` means it stays active for any path starting with `/admin/data`. This is correct and does not interfere with `/admin/intelligence` since they share no prefix.
**How to avoid:** Nothing to do — paths are distinct. Confirm `end={false}` on the Data NavLink is correct.

---

## Code Examples

### Redirect pattern in main.tsx (verified React Router v6)

```typescript
// Source: React Router v6 docs — <Navigate> component
import { Navigate } from 'react-router-dom'

// Inside the /admin children array:
{ path: 'search-lab',      element: <Navigate to="/admin/tools" replace /> },
{ path: 'score-explainer', element: <Navigate to="/admin/tools" replace /> },
{ path: 'index',           element: <Navigate to="/admin/tools" replace /> },
{ path: 'searches',        element: <Navigate to="/admin/data" replace /> },
{ path: 'marketplace',     element: <Navigate to="/admin/data" replace /> },
{ path: 'tools',           element: <ToolsPage /> },
{ path: 'data',            element: <DataPage /> },
```

### useLocation hash for tab state

```typescript
// Source: React Router v6 docs — useLocation
import { useLocation, useNavigate } from 'react-router-dom'

const location = useLocation()
const navigate = useNavigate()
const hash = location.hash.replace('#', '') // '' when no hash

// Set tab:
navigate('/admin/tools#search-lab', { replace: true })
```

### Recharts LineChart sparkline (minimal)

```typescript
// Source: Recharts docs — LineChart
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

<ResponsiveContainer width="100%" height={56}>
  <LineChart data={last7Days}>
    <Line type="monotone" dataKey="total" stroke="#a855f7" strokeWidth={2} dot={false} />
    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }} />
  </LineChart>
</ResponsiveContainer>
```

---

## Current State Audit

### Existing admin routes (main.tsx)

| Path | Component | Action |
|------|-----------|--------|
| `/admin` (index) | OverviewPage | MODIFY (uplift dashboard) |
| `/admin/searches` | SearchesPage | REDIRECT to `/admin/data` |
| `/admin/gaps` | GapsPage | KEEP (unchanged) |
| `/admin/score-explainer` | ScoreExplainerPage | REDIRECT to `/admin/tools` |
| `/admin/leads` | LeadsPage | KEEP (unchanged) |
| `/admin/experts` | ExpertsPage | KEEP (unchanged) |
| `/admin/settings` | SettingsPage | MODIFY (add Index Management section) |
| `/admin/search-lab` | SearchLabPage | REDIRECT to `/admin/tools` |
| `/admin/intelligence` | IntelligenceDashboardPage | KEEP (unchanged) |
| `/admin/index` | IndexPage | REDIRECT to `/admin/tools` |
| `/admin/marketplace` | AdminMarketplacePage | REDIRECT to `/admin/data` |

### New routes to add

| Path | Component | Notes |
|------|-----------|-------|
| `/admin/tools` | ToolsPage (new) | Tabs: Score Explainer (default) | Search Lab | Index |
| `/admin/data` | DataPage (new) | Tabs: Searches | Marketplace |

### Sidebar current state
- 11 items total in a flat `NAV_ITEMS` array
- 2 sections via `slice(0,4)` / `slice(4)` — "Analytics" (Overview, Searches, Marketplace, Gaps) and "Intelligence" (everything else including Search Lab, Index, Score Explainer, Leads, Experts, Settings)
- Becomes: 3 sections, 8 items, typed group structure

### SettingsPage current Index-related content
- Has a simplified "FAISS Index" section with a basic rebuild button and status (lines 57-96)
- The `useIngestStatus` hook is already imported
- Need to expand this section into the full `IndexPage` UI: status badge with colors, timestamps grid, rebuild button, "About Index Rebuilds" list
- OR: Create a self-contained `IndexManagementPanel` component that both DataPage and SettingsPage can import

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Flat NAV_ITEMS array with manual slice | Typed NAV_GROUPS with label + items | Phase 31 added Marketplace via slice offset tweak — this is the right time to refactor |
| Each tool = standalone nav item | Tools consolidated into tabs | Standard admin panel pattern |
| Index as separate top-level route | Index panel inside Settings | Matches "power user" placement convention |

---

## Open Questions

1. **Should LeadsPage navigation update to target `/admin/data#searches`?**
   - What we know: `LeadsPage.tsx` uses `navigate('/admin/searches', { state: { email } })` — the email pre-fills the SearchesPage filter
   - What's unclear: The current redirect from `/admin/searches` to `/admin/data` won't forward state, breaking this flow
   - Recommendation: Keep `/admin/searches` as a real route pointing to the Searches tab directly (not a redirect), OR update the LeadsPage `navigate` call to `/admin/data` with state, and read state in DataPage before passing to SearchesTab. Simplest fix: update LeadsPage navigate target.

2. **Should the OverviewPage zero-result card fetch with page_size=5 directly or use the existing hook?**
   - What we know: `useMarketplaceDemand(days, page)` hardcodes `page_size: 25` inside the hook call
   - What's unclear: Whether to add a `pageSize` param to the hook or call `adminFetch` directly in the card
   - Recommendation: Call `adminFetch<DemandResponse>('/events/demand', { days: 30, page: 0, page_size: 5 })` directly in the card component — keeps the hook simple, avoids adding a rarely-needed param

3. **IndexManagementPanel as shared component vs. duplicated content in SettingsPage?**
   - What we know: The ToolsPage "Index" tab and SettingsPage "Index Management" section need the same rebuild UI
   - What's unclear: Whether the decision is "Index tab in Tools shows the full IndexPage UI" or just a brief panel
   - Recommendation: Create `IndexManagementPanel.tsx` as a shared component imported by both. Contains the status card and about card from `IndexPage.tsx`. `IndexPage.tsx` is then deleted.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `AdminSidebar.tsx`, `main.tsx`, `OverviewPage.tsx`, `IndexPage.tsx`, `SettingsPage.tsx`, `SearchLabPage.tsx`, `ScoreExplainerPage.tsx`, `SearchesPage.tsx`, `AdminMarketplacePage.tsx`, `useAdminData.ts`, `types.ts`, `admin.py`
- All findings verified against actual file contents — no assumptions made

### Secondary (MEDIUM confidence)
- React Router v6 `<Navigate replace>` pattern — standard documented API, confirmed in use throughout `main.tsx`
- Recharts `LineChart` + `ResponsiveContainer` — already used in `AdminMarketplacePage.tsx` (BarChart), same API for LineChart

### Tertiary (LOW confidence)
- CSS `hidden` vs conditional render for mounted tabs — common React pattern; no official React docs source checked. Multiple sources agree this is the correct trade-off for preserving component state.

---

## Metadata

**Confidence breakdown:**
- Current codebase state: HIGH — directly read all relevant files
- Standard stack: HIGH — no new libraries; all tools already in project
- Architecture patterns: HIGH — derived from actual code, not assumptions
- Pitfalls: HIGH — derived from actual code analysis (page indexing verified in backend, state forwarding verified in LeadsPage)
- API shapes: HIGH — verified DemandResponse type and backend implementation

**Research date:** 2026-02-23
**Valid until:** 2026-03-25 (30 days; stable frontend IA refactor with no external dependencies)
