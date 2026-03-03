# Phase 57: Admin Frontend Overhaul - Research

**Researched:** 2026-03-03
**Domain:** React + React Router v7 + TanStack Table + Tailwind — admin panel UI refactor
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Overview dashboard
- Compact at-a-glance stats row at top (total searches, clicks, gaps, new leads)
- Time period toggle (today / 7 days / etc.)
- Below stats: recent searches, recent clicks, top zero-result queries, recent leads
- All items clickable — navigate to their respective detail pages (search → searches page, click → expert, gap → gaps page, lead → leads page)

#### Experts table
- Name search as the PRIMARY filter — prominent search field
- Light visual refresh, nothing complex
- Zone filters (red/yellow/green) kept but secondary/less prominent
- Same columns: name, company, findability badge, domain tags, expandable lead clicks
- Keep existing tag filter, bio filter, sort options as secondary

#### Visual consistency
- Keep dark slate (`bg-slate-950`) + purple accent theme
- Focus on functional consistency — same card/table/form patterns on every page
- Goal: "everything works properly" with the same look, not a redesign

#### Navigation structure
- Sidebar stays as-is: 3 sections, 8 items
- Tools and Data sub-pages get real URL routes but don't promote to sidebar
- Browser back button works between sub-pages

### Claude's Discretion
- Exact time period toggle options (today/7d/30d/all)
- Pagination component design (page numbers, direct jump input)
- Responsive breakpoint behavior at tablet width
- Consistent component patterns (shared card, table, form components vs inline consistency)
- How to surface sub-page URL routes within Tools/Data pages (tabs with URL sync, nested routes, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADM-02 | Admin Tools and Data pages use URL-based routing instead of hash fragments | Nested child routes in React Router v7; `useParams` or `useMatch` in tab components |
| ADM-03 | Admin pagination upgraded with page numbers and direct page jump | TanStack Table v8 `getPaginationRowModel` + custom UI; plain `useMemo` slice for client-side pagination in ExpertsPage |
| ADM-04 | Admin pages use consistent card, table, and form component patterns | Extract shared `AdminCard`, `AdminTable`, `AdminFormInput` components from existing inline patterns |
| ADM-05 | Admin Overview dashboard redesigned with actionable metrics and clear navigation | Already partially done; needs time period toggle wired to API, and section consolidation |
| ADM-06 | Admin Experts page table layout modernized | Add name search field; promote to primary filter; demote zone/tag filters |
| ADM-07 | Admin responsive layout works on tablet-width screens | Sidebar collapse at `md` breakpoint; table horizontal scroll preserved |
| BUG-07 | Admin experts page has text search filtering by name | Client-side filter on `first_name + last_name`; mirrors `filtered` array already in ExpertsPage |
</phase_requirements>

---

## Summary

Phase 57 is a pure frontend refactor of the existing admin panel. No new backend endpoints are needed. The codebase is already using React Router v7, TanStack Table v8, and Tailwind CSS v3 — all libraries needed for this phase are already installed. The work decomposes into four distinct concerns: (1) converting hash-based sub-page routing to real URL child routes, (2) upgrading pagination UX with page numbers and a jump input, (3) extracting shared component primitives so all pages share the same card/table/form look, and (4) adding name search to the Experts table and responsive behavior to the sidebar/layout.

The most architecturally significant change is ADM-02 (URL routing for Tools and Data sub-pages). The current pattern uses `location.hash` (`#score-explainer`, `#searches`) with CSS `hidden`/`visible` toggling to preserve component state. The replacement approach is React Router v7 nested child routes (`/admin/tools/score-explainer`, `/admin/tools/search-lab`, `/admin/tools/index`, `/admin/data/searches`, `/admin/data/marketplace`), which gives each sub-page its own URL and enables browser back navigation. The sidebar entries for Tools and Data do not change.

The Overview page already has substantial content (stats grid, health widget, recent cards). The redesign per ADM-05 requires adding a time-period toggle that re-fetches parameterized data, which requires new or extended `adminFetch` calls with a `days` query param — the `adminFetch` utility already supports arbitrary query params.

**Primary recommendation:** Work in four sequential waves: (1) URL routing, (2) pagination upgrade + name search (BUG-07/ADM-03/ADM-06), (3) shared component extraction (ADM-04), (4) Overview dashboard + responsive layout (ADM-05/ADM-07).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^7.13.0 (installed) | URL-based nested routing for sub-pages | Already in use; v7 has stable `createBrowserRouter` + nested child routes |
| @tanstack/react-table | ^8.21.3 (installed) | Pagination, sorting, filtering in SearchesTable/GapsTable | Already in use; `getPaginationRowModel` covers pagination |
| tailwindcss | ^3.4.19 (installed) | Utility-class styling throughout admin | All existing admin CSS uses Tailwind classes |
| react | ^19.2.0 (installed) | Component primitives | Core framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | ^3.7.0 (installed) | Bar/line charts in Marketplace page | Already used in AdminMarketplacePage; don't add new chart libs |
| lucide-react | ^0.575.0 (installed) | Icon set | Prefer over inline SVGs in new shared components |
| vitest | ^4.0.18 (installed) | Unit tests | Test framework already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nested child routes (RR v7) | URL search params for tab state | Search params would keep the hash-replacement pattern; child routes are the correct semantic and enable `<Link>` deep-linking |
| TanStack Table pagination | Custom slice + state | TanStack already installed and used; leverage it uniformly |
| Extracting shared components | Inline consistency | User said "consistent patterns" not "new design system" — shared components are cleaner but inline consistency (matching class strings) is viable if scope is tight |

**No new packages needed.** All required libraries are already installed.

---

## Architecture Patterns

### Current Admin Structure
```
frontend/src/admin/
├── AdminApp.tsx              # Layout shell: sidebar + <Outlet />
├── LoginPage.tsx
├── RequireAuth.tsx
├── types.ts                  # All API types
├── hooks/
│   ├── useAdminData.ts       # All data-fetching hooks + adminFetch/Post/Delete
│   └── useAdminExport.ts
├── components/
│   ├── AdminSidebar.tsx      # 3 groups, 8 nav items — DO NOT CHANGE structure
│   ├── SearchesTable.tsx     # Uses TanStack Table
│   ├── GapsTable.tsx         # Plain HTML table
│   ├── StatCard.tsx          # Standalone stat card (only used in one place)
│   ├── ExpandedExpertRow.tsx
│   ├── ExportDialog.tsx
│   ├── CsvImportModal.tsx
│   └── IndexManagementPanel.tsx
└── pages/
    ├── OverviewPage.tsx      # 540 lines; local StatCard/TrendStatCard variants
    ├── ExpertsPage.tsx       # 749 lines; client-side sort/filter/pagination
    ├── SearchesPage.tsx      # Uses SearchesTable component
    ├── GapsPage.tsx          # Uses GapsTable component
    ├── LeadsPage.tsx         # Plain HTML table; no pagination
    ├── SettingsPage.tsx      # Static info cards
    ├── ToolsPage.tsx         # Hash-based tab routing (3 tabs)
    ├── DataPage.tsx          # Hash-based tab routing (2 tabs)
    ├── ScoreExplainerPage.tsx
    ├── SearchLabPage.tsx
    └── AdminMarketplacePage.tsx
```

### Router Config (main.tsx)
The admin router tree currently:
```
/admin → RequireAuth → AdminApp (Outlet)
  /admin             → OverviewPage (index)
  /admin/gaps        → GapsPage
  /admin/leads       → LeadsPage
  /admin/experts     → ExpertsPage
  /admin/settings    → SettingsPage
  /admin/tools       → ToolsPage  ← hash tabs: #score-explainer, #search-lab, #index
  /admin/data        → DataPage   ← hash tabs: #searches, #marketplace
  /admin/*           → Navigate /admin
```

### Pattern 1: URL Child Routes for Tools/Data Sub-pages (ADM-02)
**What:** Replace hash-based tab switching with React Router v7 nested child routes.
**When to use:** Any time a tab has meaningful content the user should be able to bookmark/share/back-navigate to.

Router change in `main.tsx`:
```typescript
// Source: React Router v7 docs — nested routes with index
{ path: 'tools', element: <ToolsPage />, children: [
    { index: true, element: <Navigate to="score-explainer" replace /> },
    { path: 'score-explainer', element: <ScoreExplainerPage /> },
    { path: 'search-lab',      element: <SearchLabPage /> },
    { path: 'index',           element: <div className="p-8"><IndexManagementPanel /></div> },
]},
{ path: 'data', element: <DataPage />, children: [
    { index: true, element: <Navigate to="searches" replace /> },
    { path: 'searches',    element: <SearchesPage /> },
    { path: 'marketplace', element: <AdminMarketplacePage /> },
]},
```

ToolsPage/DataPage become thin tab-nav wrappers:
```typescript
// ToolsPage renders tabs as NavLinks + <Outlet />
// NavLink handles isActive automatically via URL match
import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin/tools/score-explainer', label: 'Score Explainer' },
  { to: '/admin/tools/search-lab',      label: 'Search Lab' },
  { to: '/admin/tools/index',           label: 'Index' },
]

// Tab nav using NavLink
{TABS.map(tab => (
  <NavLink key={tab.to} to={tab.to}
    className={({ isActive }) => isActive ? ACTIVE_CLS : INACTIVE_CLS}
  >
    {tab.label}
  </NavLink>
))}
<Outlet />
```

**Critical detail:** The sub-page components (ScoreExplainerPage, SearchLabPage, AdminMarketplacePage) currently use an outer `div className="p-8 ..."` with their own padding. They need to remain self-contained — ToolsPage/DataPage wrappers should NOT add duplicate padding.

**Sidebar NavLink concern:** `/admin/tools` is a NavLink with `end={false}`. The existing `end: false` setting on the Tools nav item means it stays active for `/admin/tools/*` sub-paths. No sidebar change needed.

### Pattern 2: Pagination Upgrade (ADM-03)
**What:** Add page number buttons and a "go to page" input to all paginated tables.
**Applies to:** ExpertsPage (custom pagination), SearchesTable (TanStack Table).

For ExpertsPage (manual pagination):
```typescript
// Current: Prev / "Page X of Y" / Next
// Target: Prev | 1 | 2 | ... | N | Next | Jump: [input]
function Pagination({ page, totalPages, onPageChange }: {...}) {
  const [jumpInput, setJumpInput] = useState('')

  // Generate visible page numbers (window around current page)
  const pages = buildPageWindow(page, totalPages) // [1, '...', 4, 5, 6, '...', 20]

  return (
    <div className="flex items-center gap-2">
      <button disabled={page === 0} onClick={() => onPageChange(page - 1)}>Prev</button>
      {pages.map(p => p === '...'
        ? <span key={p}>…</span>
        : <button key={p} onClick={() => onPageChange(p - 1)}
            className={p - 1 === page ? ACTIVE_PAGE_CLS : PAGE_CLS}>{p}</button>
      )}
      <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
      <input type="number" min={1} max={totalPages}
        placeholder="Go to"
        onKeyDown={e => { if (e.key === 'Enter') onPageChange(Number(e.currentTarget.value) - 1) }}
        className="w-16 bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1"
      />
    </div>
  )
}
```

For SearchesTable (TanStack Table v8):
```typescript
// TanStack provides: table.getPageCount(), table.setPageIndex(n), table.getCanPreviousPage()
// Add page number buttons using table.getState().pagination.pageIndex
const currentPage = table.getState().pagination.pageIndex
const totalPages = table.getPageCount()
```

### Pattern 3: Name Search Filter for Experts (BUG-07/ADM-06)
**What:** Client-side name filter — search input at top of filter bar, filters `experts` array before sort/zone/tag filters.
**Why client-side:** All 530 experts are already loaded into `data?.experts` in one fetch. No backend change needed.

```typescript
// Add to ExpertsPage state:
const [nameSearch, setNameSearch] = useState('')

// Add to filter bar (FIRST, most prominent):
<input
  type="search"
  placeholder="Search by name…"
  value={nameSearch}
  onChange={e => setNameSearch(e.target.value)}
  className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2
             focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600 w-64"
/>

// Add to filtered useMemo (first filter):
const filtered = useMemo(() => {
  let result = sorted
  result = result.filter(e => (e.first_name || '').trim() || (e.last_name || '').trim())
  if (nameSearch.trim()) {
    const q = nameSearch.trim().toLowerCase()
    result = result.filter(e =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)
    )
  }
  // ... existing hideNoBio, zoneFilter, tagFilter
  return result
}, [sorted, nameSearch, hideNoBio, zoneFilter, tagFilter])

// Reset page on nameSearch change:
useEffect(() => { setPageIdx(0); setSelectedUsernames(new Set()) },
  [nameSearch, hideNoBio, zoneFilter, tagFilter, sortCol, sortDir])
```

### Pattern 4: Shared Component Extraction (ADM-04)
**What:** Extract the card/table wrapper/form input patterns that already exist across pages into shared components.

Identified inconsistencies:
- `OverviewPage` has LOCAL `StatCard` and `TrendStatCard` definitions — different from `components/StatCard.tsx`
- Form inputs: identical class strings repeated in ExpertsPage add form, SearchesPage filter, SettingsPage
- Table wrapper: `bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden` repeated in every page

Target shared components (create in `admin/components/`):
```typescript
// AdminCard.tsx — wraps bg-slate-800/60 border border-slate-700/60 rounded-xl
// AdminTableWrapper.tsx — AdminCard + overflow-hidden + overflow-x-auto
// AdminInput.tsx — standard text input with purple focus ring
// AdminPageHeader.tsx — h1 + subtitle + optional right-side button
// AdminPagination.tsx — reusable pagination with page numbers + jump input
```

**Scope guidance:** The goal is functional consistency, not a complete design system. Extracting the 4-5 most repeated patterns is sufficient. Don't over-engineer.

### Pattern 5: Overview Dashboard Time Period Toggle (ADM-05)
**What:** Add a period toggle (today/7d/30d/all) that re-fetches stats with a `days` param.

The `useAdminStats` hook currently fetches `/stats` with no params. The backend `/api/admin/stats` already exists. Research needed: does `/stats` accept a `days` param?

**Current backend knowledge (from code inspection):** `adminFetch` accepts arbitrary query params already. The `useMarketplaceDemand` hook already uses `days` param. Whether `/stats` endpoint accepts `days` param needs confirmation but the planner should assume it does (or add it as a task if it doesn't — trivial backend change).

Time period toggle implementation:
```typescript
const PERIODS = [
  { label: 'Today', days: 1 },
  { label: '7d',    days: 7 },
  { label: '30d',   days: 30 },
  { label: 'All',   days: 0 },
]
const [days, setDays] = useState(7)
```

### Pattern 6: Responsive Tablet Layout (ADM-07)
**What:** Admin panel usable at 768px+. Current layout: `flex h-screen` with `w-60 flex-shrink-0` sidebar. At 768px the sidebar takes ~31% of screen width, leaving ~69% for content. Tables use `overflow-x-auto` already.

**Approach:** The sidebar at `w-60` (240px) is fine at 768px. The primary issue is content area padding (`p-8` = 32px each side) and tables that have many columns. Key changes:
- Reduce content padding at `md` breakpoint: `p-4 md:p-8`
- Overview grid: `grid-cols-1 sm:grid-cols-2` for stat cards at tablet (already partially done with `xl:grid-cols-4`)
- ExpertsPage: The Bio column is the most "droppable" at narrow widths — hide at `md` with `hidden md:table-cell`

**Sidebar:** At exactly 768px, `w-60` sidebar + minimum content needs is tight but workable. Do NOT collapse the sidebar — user said tablet support is sufficient, not a mobile-first redesign. The constraint is 768px+, not 320px.

### Anti-Patterns to Avoid
- **Hash-fragment routing after this phase:** Do not use `location.hash` for any new tabbed UI. Use child routes.
- **Duplicating StatCard:** `OverviewPage` has local `StatCard` and `TrendStatCard` that differ from `components/StatCard.tsx`. The local variants should replace or absorb `components/StatCard.tsx` — not create a third version.
- **CSS `hidden` toggling for tabs:** The current `<div className={activeTab === 'x' ? '' : 'hidden'}>` pattern must be replaced by `<Outlet />` routing, not just kept and given a URL.
- **Global fetch on every nameSearch keystroke:** Name search is client-side filtering of the already-loaded expert list. Do not add a debounced API call.
- **Breaking component state on route transition:** ScoreExplainerPage and SearchLabPage have local state (query, results). With child routes they will unmount/remount on tab switch. The current hash pattern used CSS `hidden` to preserve state. Decision needed: is state preservation required? The user said "functional polish" — remount on tab switch is acceptable unless the UX clearly requires state preservation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table pagination | Custom prev/next only | TanStack Table `getPaginationRowModel` + custom UI layer | TanStack already installed; handles page count, state |
| Table sorting | Custom sort | ExpertsPage already has `useMemo` sort — extend, don't replace | |
| Route-based tab active state | Manual `location.pathname` comparison | React Router `NavLink` `isActive` prop | NavLink handles exact vs prefix matching automatically |
| Page number windowing | Custom algorithm | Simple `buildPageWindow` utility (5 lines) — trivial, inline it | Not complex enough to warrant a library |
| Input debounce for name search | `setTimeout` debounce | None needed — client-side filter is instant | 530 experts, no network call |

---

## Common Pitfalls

### Pitfall 1: NavLink `end` prop on Tools/Data parent routes
**What goes wrong:** The sidebar `NavLink to="/admin/tools"` with `end={false}` will match `/admin/tools/score-explainer` and stay active — correct. But if `end={true}`, the nav item goes inactive when on a sub-page.
**Why it happens:** Default NavLink matching is prefix-based; `end={true}` requires exact match.
**How to avoid:** Confirm sidebar AdminSidebar.tsx has `end: false` for Tools and Data items (it does — verified in code).
**Warning signs:** Nav item loses active highlight when navigating to sub-page.

### Pitfall 2: Child route `index` redirect causes infinite loop
**What goes wrong:** `{ index: true, element: <Navigate to="score-explainer" replace /> }` inside the tools child can loop if the parent `path: 'tools'` renders and immediately redirects to `tools/score-explainer` in a cycle.
**Why it happens:** React StrictMode double-invocation; `replace` attribute matters.
**How to avoid:** Use `replace` on the Navigate (already demonstrated in the codebase — see `RedirectWithParams`). Verified pattern: `<Navigate to="score-explainer" replace />` (relative path, not absolute).

### Pitfall 3: Pagination page index not resetting on filter change
**What goes wrong:** User filters by name, is on page 3 of 10, filter narrows to 1 page — user sees "Page 3 of 1" and empty table.
**Why it happens:** `pageIdx` state doesn't reset when filters change.
**How to avoid:** ExpertsPage already has `useEffect(() => { setPageIdx(0) }, [hideNoBio, zoneFilter, tagFilter, sortCol, sortDir])`. Add `nameSearch` to the dependency array.

### Pitfall 4: OverviewPage time-period toggle API compatibility
**What goes wrong:** The toggle calls `/api/admin/stats?days=7` but the backend ignores the `days` param and returns all-time stats.
**Why it happens:** Backend `/stats` endpoint may not accept a `days` param.
**How to avoid:** Check backend `app/routers/admin/` — if `days` is not a query param on `/stats`, add it as a Wave 0 backend task. The `useAdminStats` hook needs to accept `days` and pass it to `adminFetch`.
**Warning signs:** Trend numbers don't change when toggling the period selector.

### Pitfall 5: Shared component extraction breaks `OverviewPage` local variants
**What goes wrong:** OverviewPage defines local `StatCard` and `TrendStatCard` that are DIFFERENT from `components/StatCard.tsx`. Extracting to a shared component requires reconciling two different APIs.
**Why it happens:** The local variants have `to`, `onClick`, and `delta` props not present in the component file version.
**How to avoid:** The local OverviewPage versions are more feature-complete. Replace `components/StatCard.tsx` with the richer version, or deprecate it. Do not try to merge them — just adopt one.

### Pitfall 6: Tab content padding duplication
**What goes wrong:** ScoreExplainerPage, SearchLabPage, AdminMarketplacePage, SearchesPage each have their own `p-8` padding. If ToolsPage/DataPage wrapper also adds padding, double-padding occurs.
**Why it happens:** Each sub-page was previously embedded inside a CSS-hidden div with no wrapper padding.
**How to avoid:** Keep sub-pages self-contained with their own padding. ToolsPage/DataPage wrappers should only render the tab nav bar + `<Outlet />` with zero padding on the Outlet.

### Pitfall 7: Responsive sidebar at exactly 768px
**What goes wrong:** `w-60` sidebar (240px) + `p-8` (64px side padding) on a 768px viewport leaves 768 - 240 - 64 = 464px for content. Wide tables overflow.
**Why it happens:** Tables have many columns; `overflow-x-auto` handles it but requires the wrapper to have a fixed width.
**How to avoid:** Ensure all table wrappers use `overflow-x-auto` (most already do). Reduce content padding at tablet: `p-4 md:p-8`. Hide non-critical table columns at `md` (e.g., Bio column in ExpertsPage).

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Nested Child Routes (React Router v7)
```typescript
// Source: existing codebase pattern (main.tsx) + React Router v7 docs
// In main.tsx createBrowserRouter:
{ path: 'tools', element: <ToolsPage />, children: [
    { index: true, element: <Navigate to="score-explainer" replace /> },
    { path: 'score-explainer', element: <ScoreExplainerPage /> },
    { path: 'search-lab', element: <SearchLabPage /> },
    { path: 'index', element: <div className="p-8"><IndexManagementPanel /></div> },
]},
```

### NavLink Tab Bar (replacing hash buttons)
```typescript
// Source: existing AdminSidebar.tsx NavLink pattern
import { NavLink, Outlet } from 'react-router-dom'

const ACTIVE_TAB = 'border-b-2 border-purple-500 text-white -mb-px'
const INACTIVE_TAB = 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'

function ToolsPage() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 pt-8 pb-0">
        <h1 className="text-2xl font-bold text-white">Tools</h1>
        <p className="text-slate-500 text-sm mt-1">Search and index utilities</p>
      </div>
      <div className="px-8 mt-4 border-b border-slate-700/60 flex gap-6">
        <NavLink to="score-explainer" end
          className={({ isActive }) => `pb-3 text-sm font-medium transition-colors ${isActive ? ACTIVE_TAB : INACTIVE_TAB}`}
        >Score Explainer</NavLink>
        <NavLink to="search-lab" end
          className={({ isActive }) => `pb-3 text-sm font-medium transition-colors ${isActive ? ACTIVE_TAB : INACTIVE_TAB}`}
        >Search Lab</NavLink>
        <NavLink to="index" end
          className={({ isActive }) => `pb-3 text-sm font-medium transition-colors ${isActive ? ACTIVE_TAB : INACTIVE_TAB}`}
        >Index</NavLink>
      </div>
      <Outlet />
    </div>
  )
}
```

### TanStack Table Page Number Buttons
```typescript
// Source: TanStack Table v8 docs (verified: getPageCount, setPageIndex, getState)
// In SearchesTable or shared AdminPagination component:
const currentPage = table.getState().pagination.pageIndex  // 0-indexed
const totalPages = table.getPageCount()

// Page number window generator:
function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current < 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 4) return [1, '...', total-4, total-3, total-2, total-1, total]
  return [1, '...', current, current+1, current+2, '...', total]
}
```

### AdminCard Shared Component
```typescript
// Source: extracted from existing page patterns (bg-slate-800/60 border border-slate-700/60 rounded-xl)
// frontend/src/admin/components/AdminCard.tsx
interface AdminCardProps {
  children: React.ReactNode
  className?: string
}
export function AdminCard({ children, className = '' }: AdminCardProps) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700/60 rounded-xl ${className}`}>
      {children}
    </div>
  )
}
```

### AdminInput Shared Component
```typescript
// Source: extracted from ExpertsPage add form + SearchesPage filter inputs
// The pattern repeated 10+ times across admin pages:
// bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2
// focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600
interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export function AdminInput(props: AdminInputProps) {
  return (
    <input
      {...props}
      className={`w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg
                  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500
                  placeholder-slate-600 ${props.className ?? ''}`}
    />
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hash-fragment tab routing (`location.hash`) | URL child routes (`/admin/tools/score-explainer`) | Phase 57 | Browser back works; deep links work |
| Prev/Next only pagination | Page numbers + jump input | Phase 57 | 530-expert table becomes navigable |
| Local `StatCard` variants in OverviewPage | Single shared `StatCard` component | Phase 57 | Visual consistency across pages |
| Bio column always visible | Bio column `hidden md:table-cell` | Phase 57 | Tablet layout works at 768px |

**Deprecated/outdated after this phase:**
- `location.hash.replace('#', '')` pattern in ToolsPage/DataPage: replaced by NavLink + Outlet
- `navigate('/admin/tools#score-explainer', { replace: true })` calls: replaced by `<NavLink to="score-explainer">`
- `components/StatCard.tsx` standalone file: absorbed into richer OverviewPage local version or deleted

---

## Open Questions

1. **Does `/api/admin/stats` accept a `days` query param?**
   - What we know: `adminFetch` supports arbitrary params. The endpoint exists. `useMarketplaceDemand` uses `days`.
   - What's unclear: Whether `/stats` backend handler reads `days` from query string.
   - Recommendation: Check `app/routers/admin/` during Wave 0 of planning. If not present, add as a sub-task in the Overview wave. It's a 5-line backend change.

2. **State preservation for ScoreExplainerPage / SearchLabPage on tab switch?**
   - What we know: Current CSS `hidden` pattern preserves component state. Child routes cause unmount/remount.
   - What's unclear: Whether losing in-progress search lab state on tab switch is acceptable to the user.
   - Recommendation: Treat remount as acceptable (user said "functional polish" not "preserve every state"). Document the behavior change. If state preservation becomes an issue, use URL search params to store the lab query state.

3. **AdminMarketplacePage route — already has dedicated route `/admin/marketplace`?**
   - What we know: `main.tsx` does NOT have `/admin/marketplace` as a standalone route. `AdminMarketplacePage` is only rendered inside `DataPage` as a hash tab. After ADM-02, it becomes `/admin/data/marketplace`.
   - What's unclear: Whether the sidebar nav for "Data" correctly highlights when on `/admin/data/marketplace`.
   - Recommendation: With `end: false` on the Data navlink, it highlights for any `/admin/data/*` sub-path. Confirmed correct.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `frontend/vite.config.ts` (test.environment: 'node', globals: true) |
| Quick run command | `cd frontend && npm run test` |
| Full suite command | `cd frontend && npm run test` |
| Estimated runtime | ~2 seconds (2 existing test files) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADM-02 | Tools/Data sub-pages have real URLs and browser back works | manual-only | N/A — requires browser navigation | N/A |
| ADM-03 | Pagination shows page numbers + jump input; direct page jump works | unit | `npm run test -- --reporter=verbose` (test page number logic) | ❌ Wave 0 gap |
| ADM-04 | Shared card, table, form patterns consistent across pages | manual-only | N/A — visual consistency check | N/A |
| ADM-05 | Overview surfaces lead growth, search volume, zero-result rate; items navigate | manual-only | N/A — requires live API | N/A |
| ADM-06 | Experts name search field filters table | unit | `npm run test -- --reporter=verbose` (test filter logic) | ❌ Wave 0 gap |
| ADM-07 | Admin panel usable at 768px+ | manual-only | N/A — requires browser resize | N/A |
| BUG-07 | Admin experts page has text search filtering by name (same as ADM-06) | unit | `npm run test -- --reporter=verbose` | ❌ Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task → run: `cd frontend && npm run test`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~2 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `frontend/src/admin/pages/__tests__/ExpertsPage.nameSearch.test.ts` — covers BUG-07/ADM-06: name filter logic (`full name includes query, case insensitive`)
- [ ] `frontend/src/admin/components/__tests__/AdminPagination.test.ts` — covers ADM-03: `pageWindow()` utility produces correct page number arrays
- [ ] `frontend/src/admin/pages/__tests__/OverviewPage.periodToggle.test.ts` — covers ADM-05: period toggle state transitions (if `days` param is added to hook)

*(Visual consistency ADM-04, URL routing ADM-02, responsive ADM-07 are manual-only — no automated test can verify these within the test framework.)*

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `frontend/src/admin/**` all read verbatim
- `frontend/package.json` — exact installed library versions confirmed
- `frontend/vite.config.ts` — test configuration confirmed
- `frontend/src/main.tsx` — router tree confirmed

### Secondary (MEDIUM confidence)
- React Router v7 NavLink docs — `isActive` pattern, `end` prop behavior — consistent with codebase usage
- TanStack Table v8 — `getPaginationRowModel`, `setPageIndex`, `getPageCount` — consistent with SearchesTable.tsx usage

### Tertiary (LOW confidence)
- Backend `/api/admin/stats` `days` param support — inferred from analogous `useMarketplaceDemand(days)` hook pattern; not directly verified from backend source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed and in use
- Architecture: HIGH — entire admin codebase read; patterns identified from source
- Pitfalls: HIGH — identified from actual code inconsistencies (local vs shared StatCard, hash routing, double padding)
- Backend `days` param for `/stats`: LOW — unverified assumption

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable libraries, internal codebase)
