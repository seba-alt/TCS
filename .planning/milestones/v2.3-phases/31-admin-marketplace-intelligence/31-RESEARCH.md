# Phase 31: Admin Marketplace Intelligence - Research

**Researched:** 2026-02-22
**Domain:** FastAPI SQL aggregation + React/Recharts admin dashboard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- New admin page `MarketplacePage.tsx` at `/admin/marketplace` — does NOT modify existing `GapsPage.tsx` or any other admin page
- Two new backend endpoints under `_require_admin` dep: `GET /api/admin/events/demand` and `GET /api/admin/events/exposure`
- Both endpoints return `data_since` field (timestamp of earliest event or null) for cold-start display
- Build empty state UI BEFORE data-loading logic (cold-start pitfall)
- `AdminSidebar.tsx` gains a Marketplace nav entry
- SQL aggregations use standard `GROUP BY + ORDER BY COUNT DESC` with existing SQLAlchemy `text()` pattern
- Demand table default time window: last 30 days
- Demand table columns: query text, frequency, last seen date, unique users count
- Demand table default sort: frequency descending
- Demand table pagination: top 25 rows per page with pagination controls
- Exposure "Appears" = impression count (grid or Sage panel)
- Exposure context breakdown: inline sub-columns, e.g. "Clicks: 12 grid / 3 sage"
- Exposure default sort: most clicks first
- Exposure: show only experts with at least one appearance or click
- Exposure expert rows: clickable, opens expert's public card URL
- Chart Y-axis: total daily Sage queries, stacked by outcome (successful vs zero-result)
- Chart default date range: last 14 days
- Chart interactivity: hover tooltips only, no click-through
- Chart headline KPIs above it: total queries for period, zero-result rate, change vs prior period
- Demand table: exportable as CSV
- Exposure table: exportable as CSV
- Time range selector: dropdown (7d / 30d / 90d / all time), applies to both tables
- Chart stays at 14 days by default regardless of time range selector

### Claude's Discretion

- Whether zero-result Sage queries and underserved filter combos appear in one table or two separate sections
- Exact CSV column names and formatting
- Whether the time range selector also affects the chart or only the tables
- KPI "change vs prior period" calculation (same window length, rolling)

### Deferred Ideas (OUT OF SCOPE)

- None
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-01 | Admin Marketplace page shows unmet demand table (zero-result Sage queries sorted by frequency + underserved filter combos) | Backend: `demand` endpoint aggregates `user_events` WHERE event_type='sage_query' AND payload zero_results=true. Frontend: paginated table with CSV export. |
| INTEL-02 | Admin Marketplace page shows expert exposure distribution (appears + click counts per expert, grid vs Sage context breakdown) | Backend: `exposure` endpoint aggregates `user_events` WHERE event_type='card_click', GROUP BY expert_id + context. Frontend: sortable table with inline context sub-columns. |
| INTEL-03 | Admin Marketplace page shows daily Sage usage trend (Recharts BarChart) | Recharts 3.7.0 BarChart with stacked bars (hit / zero-result). Data derived from `sage_query` events grouped by day. |
| INTEL-04 | Admin Marketplace page shows cold-start empty state with tracking start timestamp when `user_events` table is empty | Both endpoints return `data_since: string \| null`. Frontend checks this field BEFORE rendering data — shows timestamp + "insights appear after ~50 page views" message when null. |
</phase_requirements>

---

## Summary

Phase 31 builds a read-only admin analytics page on top of the `user_events` table created in Phase 30. The implementation has three backend queries and one new frontend page — no schema migrations, no new tables. All necessary infrastructure (the `user_events` table, the `_require_admin` dependency, the admin routing convention) already exists.

The most important constraint is the **cold-start empty state**: both backend endpoints return a `data_since` field (ISO timestamp of earliest event, or `null` if the table is empty). The frontend must render the empty-state UI path before the data-loading path, so there is never a blank or broken tab on fresh deployments.

The second critical constraint is **payload shape awareness**. The `user_events.payload` column is a JSON string. Extracting fields from it requires SQLite JSON functions (`json_extract`) or Python-side post-processing. Research confirms `json_extract` is available in SQLite 3.9+ (Railway uses SQLite 3.43+ as of 2024). The established pattern in `admin.py` uses `sqlalchemy.text()` for raw SQL queries with date aggregation — this same pattern applies here.

**Primary recommendation:** Use `sqlalchemy.text()` for both new endpoints (matching the existing `intelligence-stats` endpoint pattern), use `json_extract(payload, '$.field')` for payload field extraction, build the empty state check first in the React component, and use Recharts `BarChart` with `stackId` for the stacked daily trend chart.

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x (project uses) | ORM + raw SQL via `text()` | Established pattern in `admin.py` |
| FastAPI | 0.100+ (project uses) | REST endpoints | All admin endpoints use it |
| recharts | ^3.7.0 | Charting | Already installed, used in IntelligenceDashboardPage |
| React Router v7 | project uses | Admin page routing | Route already wired in `main.tsx` |

### No New Installs Required

All libraries needed for this phase are already in the project. No `npm install` or `pip install` steps are needed.

---

## Architecture Patterns

### Established Backend Pattern: `sqlalchemy.text()` with date aggregation

Source: `app/routers/admin.py`, `get_intelligence_stats()` function (lines 362–378)

```python
from sqlalchemy import text as _text
from datetime import datetime, timedelta

cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
rows = db.execute(_text("""
    SELECT
        strftime('%Y-%m-%d', created_at) AS day,
        COUNT(*) AS total
    FROM user_events
    WHERE date(created_at) >= :cutoff
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY day
"""), {"cutoff": cutoff}).all()
```

This is the confirmed project pattern. Both new endpoints must follow it.

### Payload Extraction via `json_extract`

The `user_events.payload` column stores JSON as TEXT. SQLite `json_extract` extracts fields:

```sql
-- Extract zero_results boolean from sage_query payload
SELECT
    json_extract(payload, '$.query_text') AS query_text,
    COUNT(*) AS frequency,
    MAX(created_at) AS last_seen,
    COUNT(DISTINCT session_id) AS unique_users
FROM user_events
WHERE event_type = 'sage_query'
  AND json_extract(payload, '$.zero_results') = 1
  AND date(created_at) >= :cutoff
GROUP BY json_extract(payload, '$.query_text')
ORDER BY frequency DESC
LIMIT 25 OFFSET :offset
```

**Verified payload shapes from Phase 30 tracking.ts and call sites:**

`sage_query` payload:
```json
{ "query_text": "string", "function_called": "search_experts|apply_filters", "result_count": 0, "zero_results": true }
```

`card_click` payload:
```json
{ "expert_id": "username_string", "context": "grid|sage_panel", "rank": 1, "active_filters": {...} }
```

`filter_change` payload:
```json
{ "filter": "tag|rate", "value": "string|[min,max]" }
```

### Demand Endpoint Pattern

```python
@router.get("/events/demand")
def get_demand(
    days: int = 30,
    page: int = 0,
    page_size: int = 25,
    db: Session = Depends(get_db)
):
    from sqlalchemy import text as _text
    # Step 1: check cold start
    earliest = db.scalar(_text("SELECT MIN(created_at) FROM user_events"))
    data_since = earliest  # None if table empty

    # Step 2: zero-result queries aggregated
    cutoff_clause = "AND date(created_at) >= :cutoff" if days > 0 else ""
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else ""

    rows = db.execute(_text(f"""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency,
            MAX(created_at) AS last_seen,
            COUNT(DISTINCT session_id) AS unique_users
        FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          {cutoff_clause}
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
        LIMIT :limit OFFSET :offset
    """), {"cutoff": cutoff, "limit": page_size, "offset": page * page_size}).all()

    return {
        "data_since": data_since,
        "demand": [...],
        "page": page,
        "page_size": page_size,
    }
```

### Exposure Endpoint Pattern

The `card_click` events have `expert_id` (username string) and `context` ("grid" or "sage_panel"). Aggregation pivots on context:

```sql
SELECT
    json_extract(payload, '$.expert_id') AS expert_id,
    SUM(CASE WHEN json_extract(payload, '$.context') = 'grid' THEN 1 ELSE 0 END) AS grid_clicks,
    SUM(CASE WHEN json_extract(payload, '$.context') = 'sage_panel' THEN 1 ELSE 0 END) AS sage_clicks,
    COUNT(*) AS total_clicks
FROM user_events
WHERE event_type = 'card_click'
  AND date(created_at) >= :cutoff
GROUP BY json_extract(payload, '$.expert_id')
HAVING total_clicks > 0
ORDER BY total_clicks DESC
```

**Note on "appears" (impressions):** Phase 30 tracks `card_click` events but NOT impression events (when an expert card renders on screen). The `card_click` payload does not contain impression data. Therefore, the exposure table shows **click counts** broken down by context. The word "appears" in INTEL-02 likely maps to what the card_click event captures — experts that appear AND were clicked. The endpoint should note this distinction. The `data_since` cold-start field still applies.

### Frontend Hook Pattern

Source: `useAdminData.ts` (lines 99–115) — `useAdminGaps` as the template

```typescript
export function useMarketplaceDemand(days: number, page: number) {
  const [data, setData] = useState<DemandResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<DemandResponse>('/events/demand', { days, page, page_size: 25 })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [days, page])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
```

Both hooks follow the same structure. Add to `useAdminData.ts`.

### Recharts BarChart Pattern (stacked)

Source: IntelligenceDashboardPage.tsx (ScatterChart) + recharts 3.7.0 docs.

```tsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'

// Data shape from backend:
// [{ date: "2026-02-08", hits: 12, zero_results: 3 }, ...]

<ResponsiveContainer width="100%" height={240}>
  <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
    <Tooltip
      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
      labelStyle={{ color: '#e2e8f0' }}
    />
    <Legend wrapperStyle={{ fontSize: '11px' }} />
    <Bar dataKey="hits" name="Matched" stackId="a" fill="#a855f7" />
    <Bar dataKey="zero_results" name="Zero Results" stackId="a" fill="#ef4444" />
  </BarChart>
</ResponsiveContainer>
```

`stackId="a"` is the Recharts stacking mechanism — bars with the same `stackId` stack vertically.

### Route Registration Pattern

Source: `main.tsx` (line 54)

```tsx
// In main.tsx — add alongside existing admin routes:
import AdminMarketplacePage from './admin/pages/AdminMarketplacePage.tsx'

// Inside the admin children array:
{ path: 'marketplace', element: <AdminMarketplacePage /> },
```

### AdminSidebar Extension Pattern

Source: `AdminSidebar.tsx` (lines 7–110)

Add to `NAV_ITEMS` array. The sidebar divides items into "Analytics" (slice 0-3) and "Intelligence" (slice 3+). Marketplace belongs in Analytics (it reads behavioral data, not tuning parameters):

```tsx
{
  to: '/admin/marketplace',
  label: 'Marketplace',
  end: false,
  icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
},
```

The `NAV_ITEMS.slice(0, 3)` → Analytics and `NAV_ITEMS.slice(3)` → Intelligence logic in the sidebar means inserting at index 3 (after Gaps, before Intelligence) places it in the Analytics section. Alternatively, insert at index 2 (after Searches, before Gaps). Either is valid.

### CSV Export Pattern

Source: `useAdminExport.ts` and `admin.py` export endpoints.

For Marketplace, the export is triggered directly (no ExportDialog needed — no filter complexity). Pattern: a dedicated `GET /api/admin/export/demand.csv` and `exposure.csv` endpoint in `admin.py`, triggered from the page via `useAdminExport`-style function, or inline in the hook.

Simpler alternative used by existing pages: add `format=csv` query param to the demand/exposure endpoints, return `StreamingResponse`. This avoids adding two more endpoint functions. However, the existing pattern uses separate `/export/` paths — follow that to stay consistent.

### Cold-Start Empty State Pattern

```tsx
// ALWAYS check data_since FIRST before rendering data sections
const isEmpty = !loading && data?.data_since === null

if (isEmpty) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-8 text-center space-y-2">
      <p className="text-slate-300 font-medium">No tracking data yet</p>
      <p className="text-slate-500 text-sm">
        Tracking started — insights appear after approximately 50 page views.
      </p>
    </div>
  )
}
```

**This must be rendered BEFORE the table/chart components are mounted.** Not after.

### Existing `adminFetch` with Query Params

Source: `useAdminData.ts` (lines 20–37)

`adminFetch` already handles query params via `Record<string, string | number | boolean | undefined>`. Pass `days`, `page`, `page_size` as plain numbers — they are converted to strings automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON field extraction from TEXT column | Python post-processing loop | `json_extract()` in SQL | SQLite 3.9+ built-in, runs in DB engine before data is loaded into Python |
| Stacked bar chart | Custom SVG or D3 | `recharts` BarChart with `stackId` | Already installed, matches project style |
| CSV download | Fetch + manual blob | Existing `StreamingResponse` pattern in `admin.py` | All existing exports use this — consistency matters |
| Time range filtering | Custom date parsing | SQLite `date(created_at) >= :cutoff` | Proven in `get_intelligence_stats()` |
| Admin auth on new endpoints | Custom middleware | `router` (with `_require_admin` dep) from existing `admin.py` | Pattern: `router.get("/events/demand")` automatically gets auth |

**Key insight:** The `user_events` table is designed for these aggregations. The composite index `ix_user_events_type_created` on `(event_type, created_at)` means filtering by type and date is indexed. Do not add new indexes.

---

## Common Pitfalls

### Pitfall 1: Cold-Start Blank State (CRITICAL)

**What goes wrong:** Component mounts, fetches both endpoints, both return empty arrays, tables render with "No rows" messages and no explanation. Admin sees a broken-looking empty tab.

**Why it happens:** Data-loading logic renders first, empty state is an afterthought.

**How to avoid:** Check `data_since === null` FIRST in the render tree. Return the cold-start UI block before the table/chart JSX. Build this branch before writing any table rendering code.

**Warning signs:** If you find yourself writing `data.demand.length === 0 ? <EmptyMessage> : <Table>`, you are doing it wrong — that is the data-loading path, not the cold-start path.

### Pitfall 2: `json_extract` Boolean Comparison in SQLite

**What goes wrong:** `WHERE json_extract(payload, '$.zero_results') = true` returns zero rows.

**Why it happens:** SQLite stores JSON booleans as integers (1/0) when using `json_extract`. The comparison must use `= 1` not `= true`.

**How to avoid:** Use `json_extract(payload, '$.zero_results') = 1` for boolean fields.

**Warning signs:** Query returns 0 rows even when events with `zero_results: true` exist.

### Pitfall 3: `adminFetch` vs direct `/api/admin/events/demand` path

**What goes wrong:** Hook calls `adminFetch('/events/demand')` but the backend registers the route as `GET /api/admin/events/demand`.

**Why it happens:** `adminFetch` prepends `/api/admin` automatically (line 24 of `useAdminData.ts`). The FastAPI router uses `prefix="/api/admin"`. So the path passed to `adminFetch` is just `/events/demand`.

**How to avoid:** Pass `/events/demand` and `/events/exposure` to `adminFetch` — not the full path.

### Pitfall 4: Router prefix collision

**What goes wrong:** Adding `router.get("/events/demand")` to `admin.py` conflicts with the existing `events.py` router (which handles `POST /api/events`).

**Why it happens:** Different routers at different prefixes — `admin.py` is prefixed at `/api/admin`, `events.py` is at `/api`. These do not conflict.

**How to avoid:** Add both new endpoints to `admin.py` using the existing `router` object (line 199: `router = APIRouter(prefix="/api/admin", dependencies=[Depends(_require_admin)])`).

### Pitfall 5: "Appears" Metric Misunderstanding

**What goes wrong:** Planner describes "appears" as impression count, but Phase 30 only tracked `card_click` events — not impressions. An expert appears 50 times but is only clicked 3 times. The exposure endpoint cannot return an impression count.

**Why it happens:** The CONTEXT.md spec uses "appears" but Phase 30 did not instrument impression events.

**How to avoid:** The exposure endpoint returns click counts only, broken down by context (grid vs sage_panel). Document clearly in the endpoint docstring. The UI labels should say "Clicks" not "Appears" unless the planner decides to use a different label.

### Pitfall 6: Page-level `days` state affects both tables and chart

**What goes wrong:** Time range dropdown set to 90d also changes the chart to 90d, breaking the spec (chart stays at 14d by default).

**How to avoid:** Chart uses a fixed `days=14` parameter regardless of the page-level time range selector. Only the demand and exposure tables consume the dropdown state.

### Pitfall 7: Pagination total count with `json_extract` filter

**What goes wrong:** Paginated demand table needs a total count for pagination UI, but running two queries (count + page) with `json_extract` in WHERE is easy to forget.

**How to avoid:** The backend demand endpoint must return a `total` count field (count of all zero-result query groups, not just the page). Run a `COUNT(DISTINCT ...)` query before the paginated query.

---

## Code Examples

### Exact `json_extract` for `zero_results` boolean

```python
# Source: SQLite json_extract docs + verified payload shape from tracking.ts
rows = db.execute(_text("""
    SELECT
        json_extract(payload, '$.query_text') AS query_text,
        COUNT(*) AS frequency,
        MAX(created_at) AS last_seen,
        COUNT(DISTINCT session_id) AS unique_users
    FROM user_events
    WHERE event_type = 'sage_query'
      AND json_extract(payload, '$.zero_results') = 1
      AND date(created_at) >= :cutoff
    GROUP BY json_extract(payload, '$.query_text')
    ORDER BY frequency DESC
    LIMIT :limit OFFSET :offset
"""), {"cutoff": cutoff, "limit": page_size, "offset": page * page_size}).all()
```

### Exposure pivot query

```python
# Source: project pattern from admin.py + SQLite CASE expressions
rows = db.execute(_text("""
    SELECT
        json_extract(payload, '$.expert_id') AS expert_id,
        COUNT(*) AS total_clicks,
        SUM(CASE WHEN json_extract(payload, '$.context') = 'grid' THEN 1 ELSE 0 END) AS grid_clicks,
        SUM(CASE WHEN json_extract(payload, '$.context') = 'sage_panel' THEN 1 ELSE 0 END) AS sage_clicks
    FROM user_events
    WHERE event_type = 'card_click'
      AND date(created_at) >= :cutoff
    GROUP BY json_extract(payload, '$.expert_id')
    HAVING total_clicks > 0
    ORDER BY total_clicks DESC
"""), {"cutoff": cutoff}).all()
```

### Daily Sage query trend (stacked by outcome)

```python
# For the BarChart data — no pagination, fixed 14 days
rows = db.execute(_text("""
    SELECT
        strftime('%Y-%m-%d', created_at) AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN json_extract(payload, '$.zero_results') = 1 THEN 1 ELSE 0 END) AS zero_results,
        SUM(CASE WHEN json_extract(payload, '$.zero_results') = 0 THEN 1 ELSE 0 END) AS hits
    FROM user_events
    WHERE event_type = 'sage_query'
      AND date(created_at) >= :cutoff
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY day
"""), {"cutoff": cutoff_14d}).all()
```

### `data_since` cold-start check

```python
# Both endpoints: check earliest event first
from sqlalchemy import text as _text
earliest_row = db.execute(_text(
    "SELECT MIN(created_at) FROM user_events"
)).scalar()
data_since = earliest_row  # None if table empty, ISO string otherwise
```

### TypeScript types for new endpoints (add to `types.ts`)

```typescript
// Demand table row
export interface DemandRow {
  query_text: string
  frequency: number
  last_seen: string     // ISO datetime string
  unique_users: number
}

export interface DemandResponse {
  data_since: string | null  // null = cold start (no events yet)
  demand: DemandRow[]
  total: number
  page: number
  page_size: number
}

// Exposure table row
export interface ExposureRow {
  expert_id: string        // username
  total_clicks: number
  grid_clicks: number
  sage_clicks: number
  profile_url?: string     // for clickable row linking to public card
}

export interface ExposureResponse {
  data_since: string | null
  exposure: ExposureRow[]
}

// Daily trend for BarChart
export interface DailyTrendRow {
  day: string         // YYYY-MM-DD
  total: number
  hits: number
  zero_results: number
}

export interface MarketplaceTrendResponse {
  data_since: string | null
  daily: DailyTrendRow[]
  kpis: {
    total_queries: number
    zero_result_rate: number
    prior_period_total: number    // for change calculation
  }
}
```

### CSV export via `StreamingResponse` (demand table)

```python
@router.get("/export/demand.csv")
def export_demand_csv(days: int = 30, db: Session = Depends(get_db)):
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    rows = db.execute(_text("""
        SELECT
            json_extract(payload, '$.query_text') AS query_text,
            COUNT(*) AS frequency,
            MAX(created_at) AS last_seen,
            COUNT(DISTINCT session_id) AS unique_users
        FROM user_events
        WHERE event_type = 'sage_query'
          AND json_extract(payload, '$.zero_results') = 1
          AND date(created_at) >= :cutoff
        GROUP BY json_extract(payload, '$.query_text')
        ORDER BY frequency DESC
    """), {"cutoff": cutoff}).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Days window", days])
    writer.writerow([])
    writer.writerow(["query_text", "frequency", "last_seen", "unique_users"])
    for r in rows:
        writer.writerow([r.query_text, r.frequency, r.last_seen, r.unique_users])

    filename = f"demand-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
```

---

## Architecture Decision: One Table or Two for Demand

The CONTEXT.md leaves this to Claude's discretion: "Whether zero-result Sage queries and underserved filter combos are in one table or two separate sections."

**Recommendation: Two separate sections, visually grouped on the same page.**

The zero-result query table is pure SQL: `event_type = 'sage_query' AND zero_results = 1`. The "underserved filter combos" come from `filter_change` events — a different event type requiring a separate query. They have different columns (filter name + value vs query text) and cannot share table columns. Two sections with a clear visual divider (section header + description text) is cleaner than a combined table with mixed content.

---

## KPI "Change vs Prior Period" Implementation

For the chart headline KPI: "change vs prior period" = total queries in window vs total queries in the same-length window immediately before it.

```python
# For a 14-day window:
current_cutoff = (datetime.utcnow() - timedelta(days=14)).strftime("%Y-%m-%d")
prior_cutoff = (datetime.utcnow() - timedelta(days=28)).strftime("%Y-%m-%d")

current_total = db.scalar(_text("""
    SELECT COUNT(*) FROM user_events
    WHERE event_type = 'sage_query'
      AND date(created_at) >= :cutoff
"""), {"cutoff": current_cutoff})

prior_total = db.scalar(_text("""
    SELECT COUNT(*) FROM user_events
    WHERE event_type = 'sage_query'
      AND date(created_at) >= :prior AND date(created_at) < :cutoff
"""), {"prior": prior_cutoff, "cutoff": current_cutoff})
```

Frontend calculates the delta percentage: `((current - prior) / prior * 100).toFixed(1)` with guard for `prior === 0`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom analytics tables per feature | Single `user_events` JSON-payload table | Phase 30 | Flexible schema, requires json_extract for queries |
| Separate Python loops for aggregation | SQLite aggregation with json_extract | Phase 31 design | Faster — DB engine handles grouping before Python sees data |

---

## Open Questions

1. **Profile URL for exposure table rows**
   - What we know: `card_click` payload stores `expert_id` (username string). Expert `profile_url` is in the `experts` DB table.
   - What's unclear: Should the exposure endpoint JOIN with the experts table to return `profile_url` and display name? Or should the frontend look it up separately?
   - Recommendation: JOIN with `experts` table in the exposure query to return `first_name`, `last_name`, `profile_url` alongside click counts. Simple LEFT JOIN, adds one pass. Avoids N+1 in the frontend.

2. **Filter combos "underserved" definition**
   - What we know: `filter_change` events have `filter: "tag"|"rate"` and `value`.
   - What's unclear: "Underserved" is not defined precisely. A conservative interpretation: filter combinations that appear frequently in user sessions but are followed by zero-result Sage queries. This requires a session-level join.
   - Recommendation: For Phase 31, implement a simpler version — just the top N most-used filter values (regardless of outcome). Tag "most searched tag terms that users apply." This is actionable without complex session correlation.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `app/routers/admin.py` — confirmed `sqlalchemy.text()` pattern, `_require_admin` dep, `StreamingResponse` CSV export pattern
- Direct code inspection of `app/models.py` — confirmed `UserEvent` schema, `payload` as TEXT, composite index on `(event_type, created_at)`
- Direct code inspection of `frontend/src/tracking.ts` + call sites — confirmed payload shapes for all three event types
- Direct code inspection of `frontend/src/admin/hooks/useAdminData.ts` — confirmed `adminFetch` pattern, prepends `/api/admin`
- Direct code inspection of `frontend/src/main.tsx` — confirmed route structure for admin pages
- Direct code inspection of `frontend/src/admin/components/AdminSidebar.tsx` — confirmed NAV_ITEMS slice(0,3)/slice(3) split
- `frontend/package.json` — confirmed `recharts: ^3.7.0` installed

### Secondary (MEDIUM confidence)
- SQLite json_extract behavior (booleans stored as 1/0) — established SQLite behavior, cross-verified with known SQLite JSON spec

### Tertiary (LOW confidence)
- None — all findings grounded in direct code inspection of the actual project files

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all patterns confirmed in existing codebase
- Payload shapes: HIGH — read directly from tracking.ts and call sites
- SQL aggregation: HIGH — json_extract pattern confirmed, same approach as existing admin stats queries
- Pitfalls: HIGH — cold-start pitfall documented in STATE.md, others confirmed by code analysis

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable tech, no external dependencies being added)
