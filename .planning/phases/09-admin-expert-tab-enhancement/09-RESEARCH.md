# Phase 9: Admin Expert Tab Enhancement - Research

**Researched:** 2026-02-21
**Domain:** FastAPI endpoint extension + React admin table UI (Tailwind, no external component library)
**Confidence:** HIGH — all findings based on direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Merged "Name" column (First + Last in one cell, not separate columns)
- Profile URL shown as a clickable external-link icon only — no text, saves width
- Findability score column at far right (trailing summary column)
- Implied column order: Name | Bio preview | Tags | Link icon | Findability score
- Show first 2 tags per row — keeps row height uniform
- Empty tag state: blank (no indicator for untagged experts)
- Default sort: ascending findability score (worst-quality experts at top)
- All column headers are clickable to re-sort asc/desc
- Filter by color zone: Red (0–39) / Yellow (40–69) / Green (70–100) toggle buttons
- No text search on this tab — sort + zone filter is enough
- Paginated: 50 experts per page with prev/next controls
- Domain-map displayed as a separate sub-tab or collapsible section within the Expert tab
- Shows top 10 domains ranked by downvote frequency
- Clicking a domain in the map filters the expert table to show experts with that tag

### Claude's Discretion
- Tag pill visual style (color, size, shape)
- How remaining tags beyond 2 are accessible (tooltip or none)
- Domain-map display format (list vs bar chart)
- Exact spacing, typography, loading skeleton

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-01 | Admin Expert tab displays First Name and Last Name separately (replacing current Username-based display) | `_serialize_expert()` already returns `first_name`/`last_name`; DB model has both columns. Table just needs merged Name cell per locked decision. |
| ADMIN-02 | Admin Expert tab displays a bio preview truncated to ~120 characters | `bio` field already serialized in `_serialize_expert()`; frontend truncation with `slice(0, 120)` + ellipsis suffix. |
| ADMIN-03 | Admin Expert tab displays the expert's profile URL as a clickable link | `profile_url` already returned; table already has a link column — needs icon-only upgrade per locked decision. |
| ADMIN-04 | Admin Expert tab displays each expert's domain tags as visual pills | `tags` column NOT yet in `_serialize_expert()` or `ExpertRow` type — must be added to both. JSON-parsed from `Expert.tags` (stored as JSON text). |
| ADMIN-05 | Admin Expert tab displays a color-coded findability score badge per expert | `findability_score` NOT yet in `_serialize_expert()` or `ExpertRow` type — must be added. Badge: red 0–39, yellow 40–69, green 70–100. |
| ADMIN-06 | Admin Expert tab defaults to worst-first sort by findability score | Currently ordered by `last_name, first_name` in `GET /api/admin/experts`. Change default DB order to `findability_score ASC NULLS FIRST` so null-score experts (worst case) appear at top. |
| SEARCH-07 | Admin can call GET /api/admin/domain-map and receive a ranked list of expert tag domains sorted by frequency of appearance in downvoted results | New endpoint — does not exist yet. Requires loading downvoted Feedback rows, parsing expert_ids (profile URLs), looking up Expert tags, counting frequency in Python. |
</phase_requirements>

---

## Summary

Phase 9 is a focused enhancement to an already-working admin expert table. The data layer (Expert table with `tags` and `findability_score` columns, both populated by Phase 8) is complete. The gaps are: (1) backend serialization doesn't expose `tags` or `findability_score` yet, (2) the frontend type and table UI don't display them, (3) sort order is wrong (currently alphabetical), (4) the domain-map backend endpoint does not exist yet.

The work splits cleanly into four deliverables corresponding to four plans: backend serialization fix, backend domain-map endpoint, frontend type/hook update, and frontend table overhaul. Each is independently verifiable. The domain-map endpoint is the most algorithmically novel piece — it requires in-Python aggregation over JSON-stored tags from Feedback downvote rows, since SQLite cannot natively unnest JSON arrays.

**Primary recommendation:** Extend `_serialize_expert()` first (adds `tags` + `findability_score` to the API response), then update `ExpertRow` in types.ts, then rebuild the table UI with sort/filter/pagination state, then add the domain-map endpoint and a collapsible section in ExpertsPage.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current | Backend endpoints | Already in use |
| SQLAlchemy | current | DB queries | Already in use |
| React | current | Frontend UI | Already in use |
| Tailwind CSS | current | Styling | All admin UI uses Tailwind utility classes |
| TypeScript | current | Type safety | All frontend files are `.tsx`/`.ts` |

### No new dependencies needed
This phase adds no new libraries. Everything required is already installed.

---

## Architecture Patterns

### Existing Pattern: `_serialize_expert()` + typed response hook

The codebase serializes DB models to dicts in a dedicated `_serialize_*` helper. Adding new fields means editing `_serialize_expert()` in `app/routers/admin.py` and the `ExpertRow` interface in `frontend/src/admin/types.ts`.

```python
# Current (app/routers/admin.py line 103)
def _serialize_expert(e: Expert) -> dict:
    return {
        "username": e.username,
        "first_name": e.first_name,
        # ... (no tags or findability_score yet)
    }
```

```python
# Required addition — json is already imported at top of admin.py
def _serialize_expert(e: Expert) -> dict:
    return {
        "username": e.username,
        "first_name": e.first_name,
        "last_name": e.last_name,
        "job_title": e.job_title,
        "company": e.company,
        "bio": e.bio,
        "hourly_rate": e.hourly_rate,
        "profile_url": e.profile_url,
        "category": e.category,
        "tags": json.loads(e.tags or "[]"),        # NEW — parsed list
        "findability_score": e.findability_score,  # NEW — float or null
    }
```

### Pattern: Client-side sort + filter + pagination

All 1,558 experts fit comfortably in memory. The pattern is: fetch all once via `useAdminExperts`, then apply sort/filter/pagination in React state with `useMemo`. No API-level pagination parameters are added.

```typescript
// Sort application (client-side, inside useMemo)
const sorted = useMemo(() => {
  return [...experts].sort((a, b) => {
    // For findability score sort: treat null as -1 so null sorts before 0
    const aScore = a.findability_score ?? -1
    const bScore = b.findability_score ?? -1
    return sortDir === 'asc' ? aScore - bScore : bScore - aScore
  })
}, [experts, sortCol, sortDir])

const filtered = useMemo(() => {
  let result = sorted
  if (zoneFilter) result = result.filter(e => scoreZone(e.findability_score) === zoneFilter)
  if (tagFilter) result = result.filter(e => e.tags.includes(tagFilter))
  return result
}, [sorted, zoneFilter, tagFilter])

const pageData = filtered.slice(pageIdx * 50, (pageIdx + 1) * 50)
```

### Pattern: Domain-map backend endpoint

The `Feedback.expert_ids` column stores a JSON list of strings. Confirmed from `frontend/src/components/ChatMessage.tsx` line 70:

```typescript
expertIds={message.experts?.map((e) => e.profile_url ?? e.name) ?? []}
```

Each string is `profile_url` (if present) or the expert's display name (fallback). For the domain-map, lookup by `Expert.profile_url.in_(url_set)` will match the URL-based entries. Name-only entries (fallback case, rare) will miss the lookup — this is acceptable since they represent experts without a profile URL (low findability score) and the signal is statistical, not exact.

Since SQLite cannot unnest JSON, aggregation runs in Python:

```python
@router.get("/domain-map")
def get_domain_map(db: Session = Depends(get_db)):
    """
    Return top-10 expert tag domains by frequency in downvoted results.
    Joins downvoted Feedback rows to Expert tags via profile_url lookup.

    Response: {"domains": [{"domain": str, "count": int}]}
    """
    from collections import Counter

    # Only fetch expert_ids column to minimize data transfer
    downvote_expert_ids = db.scalars(
        select(Feedback.expert_ids).where(Feedback.vote == "down")
    ).all()

    url_set: set[str] = set()
    for raw in downvote_expert_ids:
        for entry in json.loads(raw or "[]"):
            # Values are profile_url (preferred) or display name (fallback)
            # Only profile URLs will match Expert.profile_url lookup
            url_set.add(entry)

    if not url_set:
        return {"domains": []}

    experts = db.scalars(
        select(Expert).where(Expert.profile_url.in_(list(url_set)))
    ).all()

    tag_counter: Counter = Counter()
    for expert in experts:
        for tag in json.loads(expert.tags or "[]"):
            tag_counter[tag.lower().strip()] += 1

    return {
        "domains": [
            {"domain": d, "count": c}
            for d, c in tag_counter.most_common(10)
        ]
    }
```

### Pattern: Sortable column header

Follow the existing Tailwind + inline-SVG style in the codebase. A sort indicator (up/down arrow) in the column header, toggled by click. Clicking the same column reverses direction:

```typescript
function SortHeader({
  col, label, current, dir, onClick
}: {
  col: string; label: string; current: string; dir: 'asc'|'desc'; onClick: (col: string) => void
}) {
  const active = current === col
  return (
    <th
      className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300"
      onClick={() => onClick(col)}
    >
      {label}
      {active && <span className="ml-1">{dir === 'asc' ? '\u2191' : '\u2193'}</span>}
    </th>
  )
}

// Sort handler (toggle direction if same col, reset to asc if new col)
function handleSort(col: string) {
  if (col === sortCol) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  } else {
    setSortCol(col)
    setSortDir('asc')
  }
}
```

### Pattern: Color-coded score badge

Zone logic extracted to a pure helper so it is shared between badge and zone filter:

```typescript
function scoreZone(score: number | null): 'red' | 'yellow' | 'green' | 'none' {
  if (score === null || score === undefined) return 'none'
  if (score < 40) return 'red'
  if (score < 70) return 'yellow'
  return 'green'
}

const ZONE_STYLES: Record<string, string> = {
  red:    'bg-red-500/20 text-red-400 border border-red-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  green:  'bg-green-500/20 text-green-400 border border-green-500/30',
  none:   'bg-slate-700/40 text-slate-500',
}

function ScoreBadge({ score }: { score: number | null }) {
  const zone = scoreZone(score)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ZONE_STYLES[zone]}`}>
      {score !== null ? score : '\u2014'}
    </span>
  )
}
```

### Pattern: Tag pills (2 max per row)

```typescript
function TagPills({ tags }: { tags: string[] }) {
  const visible = tags.slice(0, 2)
  const remaining = tags.length - visible.length
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map(tag => (
        <span key={tag} className="px-1.5 py-0.5 bg-slate-700/60 text-slate-300 text-xs rounded-md border border-slate-600/40">
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining}</span>
      )}
    </div>
  )
}
```

### Pattern: Zone filter toggle buttons

Three toggle buttons (Red / Yellow / Green). Clicking the active zone deselects it (returns to "All"):

```typescript
const ZONES = [
  { key: 'red',    label: 'Red',    style: 'border-red-500/50 text-red-400' },
  { key: 'yellow', label: 'Yellow', style: 'border-yellow-500/50 text-yellow-400' },
  { key: 'green',  label: 'Green',  style: 'border-green-500/50 text-green-400' },
] as const

// In JSX:
{ZONES.map(z => (
  <button
    key={z.key}
    onClick={() => setZoneFilter(zoneFilter === z.key ? null : z.key)}
    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
      zoneFilter === z.key
        ? z.style + ' bg-slate-800'
        : 'border-slate-700 text-slate-500 hover:border-slate-500'
    }`}
  >
    {z.label}
  </button>
))}
```

### Pattern: Domain-map collapsible section

Use a `showDomainMap` boolean state with a toggle button. Data fetched lazily on first open. When a domain is clicked, set `tagFilter` state to filter the expert table:

```typescript
const [showDomainMap, setShowDomainMap] = useState(false)
const { data: domainData, loading: domainLoading, fetchData: fetchDomainMap } = useAdminDomainMap()

function handleToggleDomainMap() {
  setShowDomainMap(v => !v)
  if (!domainData) fetchDomainMap()  // lazy fetch on first open
}
```

### Pattern: Pagination (50 per page, prev/next)

```typescript
const [pageIdx, setPageIdx] = useState(0)

// Reset page whenever filters or sort change
useEffect(() => { setPageIdx(0) }, [zoneFilter, tagFilter, sortCol, sortDir])

const totalPages = Math.ceil(filtered.length / 50)
const pageData = filtered.slice(pageIdx * 50, (pageIdx + 1) * 50)
```

```tsx
<div className="flex items-center gap-3 text-sm text-slate-400">
  <button
    disabled={pageIdx === 0}
    onClick={() => setPageIdx(p => p - 1)}
    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg"
  >
    Prev
  </button>
  <span>Page {pageIdx + 1} of {totalPages}</span>
  <button
    disabled={pageIdx >= totalPages - 1}
    onClick={() => setPageIdx(p => p + 1)}
    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-lg"
  >
    Next
  </button>
</div>
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON tag aggregation in SQL | SQLite JSON_EACH queries | Python Counter in the endpoint | SQLite JSON_EACH is version-dependent; Python is simpler and fast enough for <=1,558 experts |
| Sorting library | Custom sort algorithm | Native JS `.sort()` with `useMemo` | Array.sort on 1,558 items is instant; no library needed |
| Pagination component | External pagination lib | Inline prev/next buttons | Consistent with existing admin UI patterns; no extra deps |
| External chart for domain-map | Recharts/D3 | Simple ranked list | Consistent with existing dashboard; no new dep |

---

## Common Pitfalls

### Pitfall 1: `_serialize_expert()` returns tags as raw JSON string
**What goes wrong:** `e.tags` is stored as `'["crypto","tax law"]'` (a string). If serialized without `json.loads()`, the frontend receives a string, not an array. `TagPills` would crash or show nothing.
**How to avoid:** Always `json.loads(e.tags or "[]")` in `_serialize_expert()`. Note: `json` is already imported in `admin.py`.
**Warning sign:** Frontend receives `tags: '["crypto"]'` (string) instead of `tags: ["crypto"]` (array).

### Pitfall 2: `findability_score` is `None` for experts created before Phase 8 batch run
**What goes wrong:** Many legacy experts have `findability_score = null`. Score badge must handle `null` gracefully — don't render `NaN` or crash.
**How to avoid:** `scoreZone()` must handle `null` explicitly. Sort must treat `null` scores as `-1` (sorts to top in ascending mode, which is correct — they are unscored, treat as worst).
**Warning sign:** Experts with no score disappear from Red zone filter but should be surfaced.

### Pitfall 3: Domain-map `expert_ids` entries are profile URLs (not usernames)
**What goes wrong:** Looking up experts by `Expert.username.in_(url_set)` returns nothing because the stored values are URLs.
**How to avoid:** Use `Expert.profile_url.in_(list(url_set))` for the lookup query. Confirmed: `ChatMessage.tsx` line 70 shows `e.profile_url ?? e.name` — the primary value is the profile URL.
**Warning sign:** Domain-map always returns `{"domains": []}` even when downvotes exist.

### Pitfall 4: Sort/filter state not reset on filter change
**What goes wrong:** User is on page 3, switches to "Red" zone filter — still on page 3 of the red subset, possibly showing an empty page.
**How to avoid:** `useEffect` that resets `pageIdx` to 0 whenever `zoneFilter`, `tagFilter`, `sortCol`, or `sortDir` changes.

### Pitfall 5: Column count mismatch in empty-state row
**What goes wrong:** The existing table empty-state uses `colSpan={6}` (6 columns). Phase 9 changes the column set. If `colSpan` is not updated, the empty row renders incorrectly.
**How to avoid:** New column set is Name | Bio | Tags | Link | Score = 5 columns. Update empty-state `colSpan={5}`.

### Pitfall 6: Text search input left in place
**What goes wrong:** CONTEXT.md says "No text search on this tab". The current ExpertsPage has a text search input, `search` state, and a `filtered` variable that references it. These must all be removed.
**How to avoid:** Delete `search` state, `setSearch`, and the search `<input>`. The `filtered` derivation becomes zone + tag filter only. The "Auto-classify all" button and "Add Expert" button in the actions bar remain.

### Pitfall 7: Auto-classify button removed accidentally
**What goes wrong:** The actions bar currently has: search input + auto-classify button + add expert button. When removing the search input, the auto-classify button must be kept — it is still useful for the admin.
**How to avoid:** Remove only the `<input type="text">` and its associated state/handler. Keep the auto-classify button and result message.

### Pitfall 8: Domain-map endpoint missing `Feedback` import at module level
**What goes wrong:** `admin.py` imports `Expert, Feedback` from `app.models` but only uses `Feedback` in the new endpoint — the import is already present (line 39: `from app.models import Conversation, Expert, Feedback`).
**How to avoid:** No additional import needed. Confirm `Feedback` is in the existing import line before adding the endpoint.

---

## Code Examples

### Backend: Updated GET /api/admin/experts query (ADMIN-06 default sort)

```python
# Change from (last_name, first_name) to findability_score ASC NULLS FIRST
# SQLite natively sorts NULLs first in ASC — .nulls_first() is explicit/safe
experts = db.scalars(
    select(Expert).order_by(Expert.findability_score.asc().nulls_first())
).all()
```

### Frontend: Updated ExpertRow type (types.ts)

```typescript
export interface ExpertRow {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  bio: string
  hourly_rate: number
  profile_url: string
  category: string | null
  tags: string[]                    // NEW — parsed from JSON, always an array
  findability_score: number | null  // NEW — null if not yet computed
}
```

### Frontend: New types and hook in useAdminData.ts

```typescript
// Add to types.ts (or inline in useAdminData.ts)
export interface DomainMapEntry {
  domain: string
  count: number
}

export interface DomainMapResponse {
  domains: DomainMapEntry[]
}

// Add hook to useAdminData.ts
export function useAdminDomainMap() {
  const [data, setData] = useState<DomainMapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<DomainMapResponse>('/domain-map')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error, fetchData }
}
```

Note: `loading` starts as `false` and `fetchData` is exposed (not auto-triggered) because the domain-map section loads lazily on first open.

### Backend: Full domain-map endpoint (SEARCH-07)

```python
@router.get("/domain-map")
def get_domain_map(db: Session = Depends(get_db)):
    """
    Return top-10 expert tag domains by frequency in downvoted results.
    Joins downvoted Feedback rows to Expert tags via profile_url lookup.

    Response: {"domains": [{"domain": str, "count": int}]}
    """
    from collections import Counter

    # Fetch only expert_ids column from downvoted feedback rows
    downvote_expert_ids = db.scalars(
        select(Feedback.expert_ids).where(Feedback.vote == "down")
    ).all()

    # Parse URLs/names from each row's JSON list
    url_set: set[str] = set()
    for raw in downvote_expert_ids:
        for entry in json.loads(raw or "[]"):
            url_set.add(entry)

    if not url_set:
        return {"domains": []}

    # Look up experts by profile_url — name-only fallback entries will not match (acceptable)
    experts = db.scalars(
        select(Expert).where(Expert.profile_url.in_(list(url_set)))
    ).all()

    # Count tag frequency across all matched experts
    tag_counter: Counter = Counter()
    for expert in experts:
        for tag in json.loads(expert.tags or "[]"):
            tag_counter[tag.lower().strip()] += 1

    return {
        "domains": [
            {"domain": d, "count": c}
            for d, c in tag_counter.most_common(10)
        ]
    }
```

---

## Implementation Sequence

The work has a clean dependency order:

1. **Backend Plan A — Serialization + sort fix**
   - Update `_serialize_expert()` to include `tags` (parsed) and `findability_score`
   - Change `GET /api/admin/experts` default order to `findability_score ASC NULLS FIRST`
   - Covers: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06

2. **Backend Plan B — Domain-map endpoint**
   - Add `GET /api/admin/domain-map` to `router` (auth-gated, uses existing `_require_admin` dep)
   - Covers: SEARCH-07

3. **Frontend Plan A — Type + hook update**
   - Update `ExpertRow` in `types.ts`: add `tags: string[]` and `findability_score: number | null`
   - Add `DomainMapEntry`, `DomainMapResponse` interfaces to `types.ts`
   - Add `useAdminDomainMap` hook to `useAdminData.ts`

4. **Frontend Plan B — Table overhaul (ExpertsPage.tsx)**
   - Remove `search` state, `setSearch`, and search `<input>` from actions bar
   - Add `sortCol` (default: `'score'`), `sortDir` (default: `'asc'`), `zoneFilter`, `tagFilter`, `pageIdx` state
   - Add `useMemo` for sorted + filtered + paged derivations
   - Add `useEffect` to reset `pageIdx` on filter/sort change
   - New column set: Name | Bio preview | Tags | Link icon | Score (5 columns, update colSpan)
   - Replace existing 6 column headers with sortable headers using `SortHeader` component
   - Inline `ScoreBadge`, `TagPills`, `SortHeader` helper components (or move to `components/`)
   - Add zone filter toggle buttons in actions bar
   - Add pagination controls below table
   - Add domain-map collapsible section below table (lazy fetch, click-to-filter)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Sort by `last_name, first_name` | Sort by `findability_score ASC NULLS FIRST` | Worst-quality profiles surface at top for review |
| No `tags`/`findability_score` in API response | Added to `_serialize_expert()` | Frontend can render Phase 8 enrichment data |
| Text search on expert name/company | Zone filter (Red/Yellow/Green) + tag filter from domain-map | Quality-gate workflow instead of lookup workflow |
| No domain-map endpoint | `GET /api/admin/domain-map` | Admin sees which expert domains are causing downvotes |

---

## Open Questions

1. **Null `findability_score` sort behavior with SQLAlchemy + SQLite**
   - What we know: SQLite natively sorts NULLs first in ASC order. SQLAlchemy's `.nulls_first()` modifier generates `NULLS FIRST` in the SQL.
   - What's unclear: Whether SQLite accepts the `NULLS FIRST` clause (it was added in SQLite 3.30.0 / 2019). Railway's Python environment should have a recent SQLite version.
   - Recommendation: Use `.order_by(Expert.findability_score.asc().nulls_first())`. If Railway SQLite is older than 3.30.0, fall back to a `case` expression: `order_by(case((Expert.findability_score == None, -1), else_=Expert.findability_score))`.
   - Risk level: LOW — Railway containers run recent Linux with modern SQLite.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `app/routers/admin.py` — existing endpoints, serialization helper, auth pattern, import of `json`, `Feedback`
- Direct codebase inspection: `app/models.py` — Expert model with `tags: Text`, `findability_score: Float`; Feedback model comment "JSON list of profile_url|name"
- Direct codebase inspection: `frontend/src/admin/pages/ExpertsPage.tsx` — current table implementation (6 columns, text search, CategoryDropdown)
- Direct codebase inspection: `frontend/src/admin/hooks/useAdminData.ts` — hook patterns for new hooks, `adminFetch` function
- Direct codebase inspection: `frontend/src/admin/types.ts` — existing `ExpertRow` interface (missing `tags` and `findability_score`)
- Direct codebase inspection: `app/routers/feedback.py` — confirms `expert_ids` is `list[str]` from frontend
- Direct codebase inspection: `frontend/src/components/ChatMessage.tsx` line 70 — confirms `expert_ids` values are `profile_url ?? name` (profile URL preferred, name fallback)
- Direct codebase inspection: `app/services/tagging.py` — confirms findability score formula and tag format (lowercase, stripped strings)

### Secondary (MEDIUM confidence)
- SQLite NULLS FIRST support: added in SQLite 3.30.0 (2019-10-04). Railway environments use recent Linux distributions with SQLite 3.31+.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — codebase is the source of truth, no external libraries involved
- Architecture: HIGH — all patterns verified directly in existing admin page code
- Domain-map query: HIGH — `expert_ids` format confirmed from ChatMessage.tsx source; lookup strategy verified
- Pitfalls: HIGH — inferred from exact code paths and data model inspection
- Sort null behavior: MEDIUM — SQLite version dependency, low risk on Railway

**Research date:** 2026-02-21
**Valid until:** No expiry — based on codebase, not external docs
