# Phase 7: Analytics Dashboard — Research

**Researched:** 2026-02-20
**Domain:** Admin dashboard UI (React/Tailwind), analytics query layer (FastAPI/SQLAlchemy 2.0), CSV export, admin auth
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard structure:**
- Sidebar nav layout — left sidebar with nav items, main content area changes per section
- Summary/overview section with key stats cards visible at the top (total searches, match rate, gap count, export button)
- Dedicated `/admin` route, separate from main app — not integrated into main user nav
- Claude decides the exact sidebar sections based on data shape (e.g., Overview / Searches / Gaps)

**Data tables & display:**
- Searches table columns: query text, timestamp, user email, match count, top match score, gap flag
- Full filter panel: filter by date range, user, gap flag, match score threshold
- Click to expand row — expanded row shows full expert match list inline (names, scores)
- Pagination — 25 or 50 rows per page (admin selectable)

**Gap tracking:**
- Gap definition: Claude decides threshold based on existing scoring system (e.g., top match score below a meaningful threshold)
- Gaps surfaced in two places: (1) flagged rows in the searches table with a gap badge, AND (2) a dedicated Gaps section in the sidebar
- Dedicated Gaps section shows: gap query text, frequency count (how many times searched), best match attempt (what the closest expert was even though it wasn't good enough)
- Admin can mark a gap as resolved after taking action (e.g., manually adding experts or improving the system)
- "Send to test lab / search improver" integration is Phase 8 scope — deferred

**CSV export:**
- Separate Export CSV button per section (searches export and gaps export are independent)
- At export time, a dialog asks: "Export filtered results or all data?" — user chooses
- CSV includes a metadata header section before data columns: export date, filter applied, total row count
- Filename format: `searches-YYYY-MM-DD.csv` and `gaps-YYYY-MM-DD.csv`

### Claude's Discretion
- Exact sidebar section names and grouping
- Gap score threshold value
- Summary card metrics and layout
- Loading states, empty states, error handling
- Exact filter UI (dropdowns vs date pickers vs chips)

### Deferred Ideas (OUT OF SCOPE)
- "Send to test lab / search improver" action on gaps — connects Phase 7 gaps to Phase 8 test lab; belongs in Phase 8 scope
</user_constraints>

---

## Summary

Phase 7 adds an admin-only analytics dashboard accessible at `/admin`, completely separate from the main chat UI. The backend must expose new `GET /api/admin/*` endpoints that query the existing SQLite database (conversations, feedback tables) to surface aggregate stats and paginated row-level data. The frontend adds a new React app subtree rooted at `/admin` using react-router-dom v7 (to be installed — no router currently exists in the project).

The heaviest frontend work is the Searches table: it needs filtering (date range, user, gap flag, match score), expandable rows showing expert matches parsed from the JSON `response_experts` column, and configurable pagination (25/50 rows). TanStack Table v8 (`@tanstack/react-table` 8.21.3) is the right choice — headless, no conflicting UI opinions, integrates cleanly with the existing Tailwind-only design system. Client-side pagination/filtering is appropriate at the dataset sizes expected (thousands of rows).

The gap threshold decision directly affects which conversations are labeled "gaps." Based on the existing `SIMILARITY_THRESHOLD = 0.60` in `retriever.py`, a gap should be defined as any `match` response where the top expert score stored in `response_experts` is below **0.60** — this is already the system's definition of a low-confidence result, so it is semantically consistent. The `response_experts` JSON column stores expert dicts but does not currently store individual FAISS scores. The analytics endpoint will need to derive gap status from the conversation's `response_type` and the score stored in the `response_experts` field — **critical finding: scores are not currently persisted to the database; Phase 7 must either add score persistence or proxy gap detection via `response_type === "clarification"` combined with match count**.

**Primary recommendation:** Add `@tanstack/react-table` + `react-router-dom` to the frontend; add a new `app/routers/admin.py` with `GET /api/admin/stats`, `GET /api/admin/searches`, `GET /api/admin/gaps`, `POST /api/admin/gaps/{id}/resolve`, and two `GET /api/admin/export/searches.csv` + `GET /api/admin/export/gaps.csv` endpoints, guarded by a single `X-Admin-Key` header dependency.

---

## Critical Finding: Gap Score Availability

**The FAISS similarity score is not persisted to the database today.** Looking at the current data flow:

1. `retriever.py` returns `RetrievedExpert` objects with `.score` fields (float, cosine similarity)
2. `chat.py` builds `experts_payload` from `llm_response.experts` — these are `LLMExpert` dataclass instances from `llm.py`, NOT `RetrievedExpert`. The score is dropped before DB write.
3. `Conversation.response_experts` stores: `[{name, title, company, hourly_rate, profile_url, why_them}]` — **no score**.

**Implications for gap definition:**

- Option A (Recommended): **Store the top FAISS score on the Conversation row** — add `top_match_score: float | None` column, populated in `chat.py` before DB commit. Cleanest. Enables the exact gap badge behavior the user described. Requires a schema change (new column, `Base.metadata.create_all` handles it automatically for SQLite).
- Option B (Fallback): Use `response_type == "clarification"` as a proxy for gap detection. Misses the case where the LLM returned a "match" but scores were borderline weak. Less accurate.
- Option C: Re-derive gap from expert count — if `response_experts` has 0 entries AND `response_type == "match"`, that indicates something went wrong; not a reliable gap signal.

**Recommendation: Option A — add `top_match_score Float nullable` to `Conversation`, populate in `chat.py`.** This is a one-line schema addition and a two-line code change, and it unblocks accurate gap tracking for all future conversations. Historical rows will have `NULL` score and can be treated as unknown (not flagged as gap by default).

---

## Standard Stack

### Core — No New Backend Libraries Needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.129.* (already installed) | Admin API endpoints | Existing project standard |
| SQLAlchemy | 2.0.* (already installed) | Analytics queries — `select`, `func.count`, `group_by`, `filter`, `limit`, `offset` | Existing project standard |
| Python `csv` + `io.StringIO` | stdlib | CSV generation | No extra library needed; StreamingResponse wraps it |

### Core — New Frontend Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-router-dom` | 7.13.0 (latest) | `/admin` route separation, nested layout routes | Industry standard; v7 has no meaningful API change from v6 for this use case |
| `@tanstack/react-table` | 8.21.3 (latest) | Headless table with client-side pagination, filtering, column visibility | Zero UI opinions — works with existing Tailwind; handles 10k+ rows client-side |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS v3 | Already installed | All admin UI styling | Sidebar, cards, table, badges — no component library needed |
| `react-dom` | Already installed | No extra install | Already present |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-table` | Plain HTML `<table>` | Plain table can't paginate/filter without significant custom logic — do not hand-roll |
| `@tanstack/react-table` | AG Grid / MUI DataGrid | AG Grid is heavy and has a commercial license; MUI conflicts with Tailwind-only design |
| `react-router-dom` | Manual hash routing / `location.pathname` guard | Would require rewriting App.tsx with ad-hoc routing; router is cleaner and future-proof for Phase 8 |
| `APIKeyHeader` secret | Full JWT auth | JWT is massively over-engineered for a single-admin internal tool; a shared secret in an env var is sufficient |

**Installation:**
```bash
# Frontend
npm install react-router-dom @tanstack/react-table
# (inside /frontend directory)

# Backend — no new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
app/
├── routers/
│   ├── admin.py          # NEW — all /api/admin/* endpoints
│   └── ...               # existing routers unchanged
├── models.py             # ADD top_match_score column to Conversation
└── main.py               # ADD: app.include_router(admin.router)
```

**Frontend additions:**
```
frontend/src/
├── admin/                # NEW admin subtree
│   ├── AdminApp.tsx      # Root admin layout (sidebar + outlet)
│   ├── pages/
│   │   ├── OverviewPage.tsx
│   │   ├── SearchesPage.tsx
│   │   └── GapsPage.tsx
│   ├── components/
│   │   ├── AdminSidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── SearchesTable.tsx
│   │   ├── GapsTable.tsx
│   │   ├── ExportDialog.tsx
│   │   └── ExpandedExpertRow.tsx
│   └── hooks/
│       ├── useAdminData.ts      # fetch wrapper for /api/admin/* with X-Admin-Key header
│       └── useAdminExport.ts
├── main.tsx              # MODIFY: add router, render <AdminApp> at /admin
└── ...                   # existing files unchanged
```

### Pattern 1: React Router v7 — Admin Route Isolation

**What:** Mount the admin app as a parallel route tree. The main chat UI lives at `/`, the admin dashboard at `/admin/*`. Both share the same React entry point.

**When to use:** When admin has a completely different layout (sidebar vs chat column) and must never share nav with the user-facing app.

**Example:**
```typescript
// frontend/src/main.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import AdminApp from './admin/AdminApp'
import OverviewPage from './admin/pages/OverviewPage'
import SearchesPage from './admin/pages/SearchesPage'
import GapsPage from './admin/pages/GapsPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/admin',
    element: <AdminApp />,      // AdminApp renders <Outlet /> for children
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'searches', element: <SearchesPage /> },
      { path: 'gaps', element: <GapsPage /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

```typescript
// frontend/src/admin/AdminApp.tsx
import { Outlet, NavLink } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'

export default function AdminApp() {
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
```

**Note:** React Router v7 changed the package name — import from `react-router-dom` still works (it re-exports everything). The `createBrowserRouter` + `RouterProvider` pattern is the same as v6.

### Pattern 2: TanStack Table v8 — Client-Side Pagination + Filtering

**What:** Fetch all data from `/api/admin/searches` once (or in large batches), manage filtering/pagination entirely in the browser via TanStack Table's built-in models.

**When to use:** Admin datasets (thousands of rows) fit comfortably in memory. Client-side avoids round-trips on every filter change, making the UX snappy.

**Example:**
```typescript
// Source: TanStack Table v8 docs — tanstack.com/table/v8/docs/guide/pagination
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

const columns: ColumnDef<SearchRow>[] = [
  { accessorKey: 'query', header: 'Query' },
  { accessorKey: 'email', header: 'User' },
  { accessorKey: 'created_at', header: 'Timestamp' },
  { accessorKey: 'match_count', header: 'Matches' },
  { accessorKey: 'top_match_score', header: 'Top Score' },
  {
    accessorKey: 'is_gap',
    header: 'Gap',
    cell: ({ getValue }) =>
      getValue() ? <span className="...">Gap</span> : null,
  },
]

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  initialState: { pagination: { pageSize: 25 } },
})

// Pagination controls:
// table.getCanPreviousPage(), table.getCanNextPage()
// table.previousPage(), table.nextPage()
// table.setPageSize(50)
// table.getState().pagination.pageIndex
```

**Global filter (search by email/query text):**
```typescript
table.setGlobalFilter(filterValue)
// Requires globalFilterFn: 'includesString' (default)
```

**Column filter for date range:**
```typescript
// Custom filter function for date range
table.getColumn('created_at')?.setFilterValue([startDate, endDate])
// filterFn: 'inDateRange' — write a custom filterFn that checks row.created_at between [start, end]
```

### Pattern 3: Expandable Row for Expert Matches

**What:** When admin clicks a row, it expands inline to show the JSON-parsed expert list from `response_experts`.

**How:** Manage a `Set<number>` of expanded row IDs in component state. On row click, toggle the ID. Render an extra `<tr>` below the row with `colSpan={columns.length}` when the row ID is in the set.

```typescript
const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

function toggleRow(id: number) {
  setExpandedRows(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
```

**Note:** TanStack Table v8 has a built-in `getExpandedRowModel()` — use it if the expand logic becomes complex. For simple show/hide it's fine to manage state manually and avoid the extra API surface.

### Pattern 4: FastAPI Admin Auth — APIKeyHeader

**What:** All `/api/admin/*` endpoints depend on a single `verify_admin_key` FastAPI dependency. The key is passed as an `X-Admin-Key` header. The secret value lives in an env var (`ADMIN_SECRET`).

**Source:** FastAPI security docs — fastapi.tiangolo.com/tutorial/security

```python
# app/routers/admin.py
import os
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

router = APIRouter(prefix="/api/admin", tags=["admin"])

_api_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

def _require_admin(key: str | None = Security(_api_key_header)) -> None:
    secret = os.getenv("ADMIN_SECRET", "")
    if not secret or key != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

# All admin routes use: dependencies=[Depends(_require_admin)]
```

**Frontend: send key from env var:**
```typescript
// frontend/src/vite-env.d.ts — add VITE_ADMIN_KEY
// fetch call:
headers: {
  'Content-Type': 'application/json',
  'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY ?? '',
}
```

**CORS note:** The existing CORS middleware only allows `GET` and `POST`. Admin routes use `GET` (data fetch, CSV export) and `POST` (mark gap resolved). Both are already allowed. No CORS change needed.

### Pattern 5: FastAPI CSV StreamingResponse

**What:** Return a CSV file that triggers a browser download. Use Python's stdlib `csv.DictWriter` + `io.StringIO` for in-memory generation, wrapped in FastAPI's `StreamingResponse`.

```python
# Source: FastAPI StreamingResponse pattern — slingacademy.com/article/how-to-return-a-csv-file-in-fastapi
import csv
import io
from datetime import date
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

@router.get("/export/searches.csv", dependencies=[Depends(_require_admin)])
def export_searches_csv(db: Session = Depends(get_db)):
    rows = db.execute(select(Conversation).order_by(Conversation.created_at.desc())).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    # Metadata header (comment rows before data)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow(["# Total rows", len(rows)])
    writer.writerow([])  # blank separator
    # Column headers
    writer.writerow(["id", "email", "query", "created_at", "response_type", "match_count", "top_match_score", "is_gap"])
    for r in rows:
        experts = json.loads(r.response_experts)
        writer.writerow([r.id, r.email, r.query, r.created_at.isoformat(), r.response_type, len(experts), r.top_match_score, ...])

    buf.seek(0)
    filename = f"searches-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
```

### Pattern 6: SQLAlchemy 2.0 Analytics Queries

**What:** Use `select()`, `func.count()`, `func.avg()`, `group_by()`, `filter()` with the existing `Session` / `get_db()` dependency pattern.

```python
from sqlalchemy import select, func, and_

# Total searches
total = db.scalar(select(func.count()).select_from(Conversation))

# Match rate (conversations with response_type == "match")
matches = db.scalar(
    select(func.count()).select_from(Conversation).where(Conversation.response_type == "match")
)
match_rate = matches / total if total else 0.0

# Paginated searches with filters
stmt = (
    select(Conversation)
    .where(
        and_(
            Conversation.created_at >= start_date,
            Conversation.created_at <= end_date,
        )
    )
    .order_by(Conversation.created_at.desc())
    .limit(page_size)
    .offset(page_index * page_size)
)
rows = db.execute(stmt).scalars().all()
```

**Gap aggregation (for Gaps section):**
```python
# Group gap queries by normalized text, count occurrences, order by frequency
# "Gap" = top_match_score < GAP_THRESHOLD or top_match_score IS NULL with clarification type
from sqlalchemy import case

GAP_THRESHOLD = 0.60  # matches SIMILARITY_THRESHOLD in retriever.py

gap_stmt = (
    select(
        Conversation.query,
        func.count(Conversation.id).label("frequency"),
        func.max(Conversation.top_match_score).label("best_score"),
    )
    .where(
        (Conversation.top_match_score < GAP_THRESHOLD) |
        (Conversation.response_type == "clarification")
    )
    .group_by(Conversation.query)
    .order_by(func.count(Conversation.id).desc())
)
```

### Anti-Patterns to Avoid

- **Loading all rows into frontend state for filtering, then fetching again for CSV export:** Inconsistent results if data changes between loads. Use the same backend endpoint for both, parameterized by a `filtered=true|false` query param.
- **Storing ADMIN_SECRET in the frontend bundle in production:** `VITE_ADMIN_KEY` is visible in the built JS. This is acceptable for an internal tool (not public-facing admin), but document it clearly. Do not deploy this admin UI publicly.
- **Using `@app.on_event` for lifespan:** Already correctly using `asynccontextmanager lifespan` — do not regress.
- **Parsing `response_experts` JSON in the DB query layer (SQLite JSON functions):** SQLite's JSON functions are limited and version-dependent. Parse JSON in Python after fetching rows — it's simpler and already consistent with how the rest of the codebase handles these columns.
- **react-router-dom default export:** v7 has no default export for `BrowserRouter` in some configurations. Always use named imports: `import { createBrowserRouter, RouterProvider } from 'react-router-dom'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table pagination + filtering | Custom pagination state + filter logic | `@tanstack/react-table` v8 | TanStack handles edge cases: filter resets page index, page boundary math, column visibility toggling |
| CSV download trigger | `document.createElement('a')` + Blob URL | FastAPI `StreamingResponse` with `Content-Disposition` | Backend generates correctly, no browser blob size limits, consistent with auth headers |
| URL routing for `/admin` | `window.location.pathname` checks | `react-router-dom` `createBrowserRouter` | Router handles back/forward, nested layouts, Outlet pattern — ad-hoc breaks on refresh |
| Date range picker from scratch | Custom calendar component | Native `<input type="date">` or Tailwind-styled wrapper | Native date inputs work on all modern browsers including mobile; no extra library needed for admin tool |

**Key insight:** TanStack Table's value is in combining pagination + filtering + sorting with automatic state synchronization (e.g., filter change resets page to 0). Building this from scratch reliably is a 2-3 day project.

---

## Common Pitfalls

### Pitfall 1: Scores Not in Database

**What goes wrong:** The analytics endpoint tries to filter by `top_match_score` but the column doesn't exist. Gaps cannot be detected accurately.

**Why it happens:** `chat.py` drops the FAISS score when converting `RetrievedExpert` to `LLMExpert` — the LLM service works with its own expert dataclass and the score was never part of the DB schema.

**How to avoid:** Add `top_match_score: Mapped[float | None]` to `Conversation` in `models.py`. In `chat.py`, capture the top candidate score from `candidates[0].score` (already available from `retrieve()`) and store it before `db.commit()`. `Base.metadata.create_all` will add the column to SQLite automatically on next startup (SQLite does not enforce schema rigidly for new nullable columns via `CREATE TABLE IF NOT EXISTS`).

**Warning signs:** If you skip this, the Gaps section will be forced to rely solely on `response_type == "clarification"`, which is less accurate and misses the "weak match" gap category the user described.

### Pitfall 2: `Base.metadata.create_all` Does Not Migrate Existing Columns

**What goes wrong:** Adding `top_match_score` to `Conversation` and restarting the server does NOT add the column to the existing `conversations` table if the table already exists. `create_all` is `CREATE TABLE IF NOT EXISTS` — it only creates new tables, not new columns.

**Why it happens:** No Alembic in this project (intentional decision from Phase 2). `create_all` is idempotent at the table level, not the column level.

**How to avoid:** Run a one-time migration at startup for this specific column addition. Pattern used in this project: add to the lifespan function:
```python
# One-time column migration for top_match_score (safe to leave in permanently)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE conversations ADD COLUMN top_match_score REAL"))
        conn.commit()
    except Exception:
        pass  # Column already exists — ignore
```
This is idempotent: SQLite raises an error if the column exists, which is caught and ignored.

### Pitfall 3: CORS Method Restriction

**What goes wrong:** The export CSV endpoint or gap resolve endpoint gets CORS-blocked because the allowed methods list is too narrow.

**Why it happens:** `main.py` has `allow_methods=["GET", "POST"]`. The gap resolve action uses `POST` (fine). CSV export uses `GET` (fine). No CORS change needed — but verify before assuming.

**How to avoid:** Keep CSV export as `GET` (not `POST` with body). Keep gap resolve as `POST`. Both are already allowed.

### Pitfall 4: Vite Build Exposes Admin Key

**What goes wrong:** `VITE_ADMIN_KEY` is embedded in the compiled JavaScript bundle and visible to anyone who inspects the source.

**Why it happens:** Vite replaces `import.meta.env.VITE_*` at build time — the value is literally in the JS.

**How to avoid:** For Phase 7 scope (internal tool), this is acceptable — document it. The admin UI is not publicly promoted. If the dashboard is ever publicly accessible, move to cookie-based session auth. For now: use a strong random secret (32+ chars), rotate it if compromised, and do not share the Vercel deploy URL publicly.

### Pitfall 5: TanStack Table Filter Doesn't Reset Page Index

**What goes wrong:** User filters the table, gets page 3 of results, then changes filter. Page 3 of the new filtered set is empty (or out of range).

**Why it happens:** Page index state is not reset when filter changes.

**How to avoid:** Use TanStack Table's built-in behavior: `autoResetPageIndex: true` (default in v8 when using `getFilteredRowModel`). This resets page to 0 when filter state changes. Verify this is working — it is the default but worth a manual check.

### Pitfall 6: `response_experts` JSON Parse Failures

**What goes wrong:** Parsing `response_experts` column as JSON fails for clarification-type rows (which store `"[]"` — valid) or corrupted rows.

**Why it happens:** `chat.py` always stores `json.dumps(experts_payload)` so the column should always be valid JSON. But if rows were corrupted during development testing, silent parse failures could break the analytics endpoint.

**How to avoid:** Wrap all `json.loads(row.response_experts)` calls in try/except, default to `[]` on failure. Log a warning for corrupted rows.

---

## Code Examples

### Backend: Admin stats endpoint

```python
# app/routers/admin.py
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation

GAP_THRESHOLD = 0.60

@router.get("/stats", dependencies=[Depends(_require_admin)])
def get_stats(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Conversation)) or 0
    match_count = db.scalar(
        select(func.count()).select_from(Conversation)
        .where(Conversation.response_type == "match")
    ) or 0
    gap_count = db.scalar(
        select(func.count()).select_from(Conversation)
        .where(
            (Conversation.top_match_score < GAP_THRESHOLD) |
            (Conversation.response_type == "clarification")
        )
    ) or 0
    match_rate = round(match_count / total, 3) if total else 0.0
    return {
        "total_searches": total,
        "match_count": match_count,
        "match_rate": match_rate,
        "gap_count": gap_count,
    }
```

### Backend: Conversation model addition

```python
# app/models.py — add to Conversation class
top_match_score: Mapped[float | None] = mapped_column(nullable=True)
```

```python
# app/routers/chat.py — capture score before DB commit
top_score = candidates[0].score if candidates else None
conversation = Conversation(
    ...
    top_match_score=top_score,
)
```

### Frontend: useAdminData hook pattern

```typescript
// frontend/src/admin/hooks/useAdminData.ts
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? ''
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/admin${path}`, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  })
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`)
  return res.json() as Promise<T>
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  useEffect(() => {
    adminFetch<AdminStats>('/stats').then(setStats).catch(console.error)
  }, [])
  return stats
}
```

### Frontend: CSV export trigger (browser download)

```typescript
// Trigger download from GET endpoint (auth header required — cannot use <a href>)
async function downloadCsv(section: 'searches' | 'gaps', filtered: boolean) {
  const params = filtered ? '?filtered=true' : ''
  const res = await fetch(`${API_URL}/api/admin/export/${section}.csv${params}`, {
    headers: { 'X-Admin-Key': ADMIN_KEY },
  })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${section}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Note:** A plain `<a href>` tag cannot send custom headers. When the auth key is required, you must fetch with headers and create a Blob URL client-side, as shown above.

### Backend: Gap resolve endpoint

```python
# app/routers/admin.py
class GapResolveRequest(BaseModel):
    resolved: bool = True

@router.post("/gaps/{gap_id}/resolve", dependencies=[Depends(_require_admin)])
def resolve_gap(gap_id: int, body: GapResolveRequest, db: Session = Depends(get_db)):
    # Requires a Gap model or a resolved flag on Conversation
    # See Open Questions below for schema decision
    ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-table` v7 (class-based) | `@tanstack/react-table` v8 (headless hooks) | 2022 | Headless — bring your own UI; much lighter bundle |
| `@app.on_event("startup")` | `asynccontextmanager lifespan` | FastAPI 0.90 (2022) | Already using correct pattern — don't regress |
| SQLAlchemy `Query` API (`session.query(Model)`) | SQLAlchemy 2.0 `select()` statement API | 2023 | Project already uses 2.0 style in routers — maintain consistency |
| `EventSource` for SSE | `fetch` ReadableStream | Ongoing | Already correctly using fetch for POST SSE — admin uses plain GET/POST, no SSE needed |

**Deprecated/outdated:**
- `react-table` (without @tanstack prefix): deprecated; replaced by `@tanstack/react-table`
- `createRoot` without `RouterProvider`: The project currently uses `createRoot` without a router (single-page app). Phase 7 must add the router without breaking the existing chat app at `/`.

---

## Open Questions

1. **Gap resolve: where does the `resolved` flag live?**
   - What we know: The user wants a lightweight status toggle for gaps.
   - What's unclear: Gaps aren't a separate table — they're derived from `Conversation` rows matching gap criteria. Adding a `gap_resolved` boolean to `Conversation` is the simplest path, but it conflates two concerns (conversation record vs. gap management action).
   - Recommendation: Add `gap_resolved: Mapped[bool]` (default `False`) to `Conversation`. It's nullable, added via the same `ALTER TABLE` migration pattern as `top_match_score`. When admin marks a gap resolved, set `gap_resolved = True` on all conversations with that query text. Simple, no new table needed.

2. **Export "filtered vs. all" dialog: how does the filter state reach the backend?**
   - What we know: The export dialog asks "Export filtered results or all data?" Filter state lives in the frontend TanStack Table instance.
   - What's unclear: If "filtered", the backend needs to re-run the same filter query. Either the frontend sends current filter params in the export request, or client-side the table's filtered rows are serialized to CSV without a backend call.
   - Recommendation: Send filter params (date range, email, gap_flag, score_threshold) as query string params to the export endpoint. Backend applies the same filters it uses for the searches endpoint. This is consistent and avoids shipping all data to the browser just to filter it for CSV.

3. **Pagination: client-side vs server-side for the table?**
   - What we know: Dataset size is unknown. Railway SQLite DB on a single container could have thousands of rows after months of use.
   - What's unclear: At what row count does client-side become slow?
   - Recommendation: Start with client-side (fetch all rows, TanStack handles pagination/filtering). TanStack Table is tested to 100k+ rows for pagination. If fetch latency becomes an issue, switch to server-side (`manualPagination: true`, `manualFiltering: true`) — the API endpoints are already designed to support `limit`/`offset` params. This is a forward-compatible design.

4. **`VITE_ADMIN_KEY` in Vercel environment?**
   - What we know: Vercel deploys the frontend; Railway runs the backend. `VITE_*` vars are set in Vercel project settings.
   - What's unclear: The ADMIN_KEY must be set in both Vercel (for frontend embed) and Railway (for backend validation).
   - Recommendation: Document in the plan that both env vars must be set and must match. The plan should include a human verification step for this.

---

## Sources

### Primary (HIGH confidence)
- Official TanStack Table v8 docs — tanstack.com/table/v8 — pagination, filtering, sorting guides
- `npm show @tanstack/react-table version` → 8.21.3 (verified live)
- `npm show react-router-dom version` → 7.13.0 (verified live)
- FastAPI official docs — fastapi.tiangolo.com/tutorial/security — APIKeyHeader pattern
- SQLAlchemy 2.0 official docs — docs.sqlalchemy.org/en/20 — select(), func.count(), group_by()
- Python stdlib docs — docs.python.org/3/library/csv.html — csv.DictWriter, StringIO

### Secondary (MEDIUM confidence)
- Multiple WebSearch results for TanStack Table v8 client-side pagination confirming 100k+ row handling
- FastAPI StreamingResponse CSV pattern — slingacademy.com verified against FastAPI docs
- React Router v7 nested routes — robinwieruch.de (authoritative React tutorial author)

### Tertiary (LOW confidence)
- None — all critical findings verified with official sources or live npm registry

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified live via npm; no new experimental libraries
- Architecture: HIGH — all patterns derived from existing codebase conventions + official docs
- Gap score pitfall: HIGH — verified by reading `chat.py`, `retriever.py`, and `models.py` directly
- CORS pitfall: HIGH — verified by reading `main.py` directly
- Pitfalls: HIGH — all grounded in codebase observation, not speculation

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable libraries — TanStack Table v8 and React Router v7 change slowly)
