# Architecture Research

**Domain:** AI-powered Expert Marketplace — v2.3 Sage Evolution & Marketplace Intelligence
**Researched:** 2026-02-22
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Context: Subsequent Milestone Research

This document answers the five concrete integration questions for v2.3. The v2.2 system is ground truth. All components not explicitly listed in the "Modified/New" table below remain unchanged. This document focuses exclusively on the three new feature areas: Sage `search_experts`, user event tracking, and the Admin Gaps tab for marketplace intelligence.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vercel)                               │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ ExpertGrid   │  │  SagePanel   │  │ FilterSidebar│  │  AdminApp   │ │
│  │ (VirtuosoGrid│  │  (380px FAB) │  │  (sidebar +  │  │  (/admin/   │ │
│  │  h-[180px])  │  │  SageMessage │  │  vaul sheet) │  │  Marketplace│ │
│  │              │  │  + SageExpert│  │              │  │  Page NEW)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │         │
│  ┌──────▼─────────────────▼─────────────────▼─────────────┐  │         │
│  │              useExplorerStore (Zustand)                  │  │         │
│  │  filterSlice: query, rateMin, rateMax, tags, sortBy      │  │         │
│  │  resultsSlice: experts[], total, cursor, loading         │  │         │
│  │  pilotSlice: messages[], isOpen, isStreaming             │  │         │
│  │  (PilotMessage now has optional experts?: Expert[])      │  │         │
│  └──────┬──────────────────────────────────────────────────┘  │         │
│         │                                                       │         │
│  ┌──────▼───────────┐  ┌─────────────────┐  ┌────────────────┐│         │
│  │   useExplore     │  │    useSage      │  │ useAdminData   ││         │
│  │  (filter-driven  │  │  Gemini 2-turn  │  │ adminFetch()   ││         │
│  │   GET /explore)  │  │  search_experts │  │ + Marketplace  ││         │
│  │  UNCHANGED       │  │  + apply_filters│  │   hooks (NEW)  ││         │
│  └──────┬───────────┘  └────────┬────────┘  └───────┬────────┘│         │
│         │                        │                    │                   │
│  ┌──────▼────────────────────────▼────────────────┐  │                   │
│  │     tracking.ts (NEW)                           │  │                   │
│  │     trackEvent() — fire-and-forget POST         │  │                   │
│  │     called from filterSlice, ExpertCard, useSage│  │                   │
│  └──────────────────────────────────────────────────┘  │                  │
└───────────────────────────────────────────────────────────────────────────┘
          │  HTTP/JSON             │  HTTP/JSON         │  HTTP/JSON
          ▼                        ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Railway)                               │
│                                                                          │
│  GET /api/explore      POST /api/pilot (MODIFIED)   POST /api/events     │
│  ┌─────────────────┐  ┌──────────────────────────┐  ┌─────────────────┐ │
│  │ explorer.py     │  │ pilot_service.py          │  │ events.py (NEW) │ │
│  │ run_explore()   │  │ search_experts +          │  │ INSERT INTO     │ │
│  │ UNCHANGED       │◄─┤ apply_filters functions   │  │ user_events     │ │
│  └─────────────────┘  │ run_explore() direct call │  └─────────────────┘ │
│                        └──────────────────────────┘                       │
│                                                                          │
│  GET /api/admin/events/demand                                            │
│  GET /api/admin/events/exposure   (new endpoints in admin.py)            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     SQLite (Railway volume)                       │    │
│  │  conversations  feedback  email_leads  newsletter_subscribers    │    │
│  │  experts  settings  experts_fts (FTS5)                          │    │
│  │  user_events (NEW)                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │            FAISS in-memory (530 vectors) — UNCHANGED            │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | File | Status |
|-----------|----------------|------|--------|
| `useExplorerStore` | Global state hub — filter, results, pilot slices | `store/index.ts` | UNCHANGED |
| `filterSlice` | Filter fields + actions; calls `trackEvent()` after each set | `store/filterSlice.ts` | MODIFIED |
| `resultsSlice` | Expert results array, pagination cursor, loading state | `store/resultsSlice.ts` | UNCHANGED |
| `pilotSlice` | Sage conversation messages; `PilotMessage.experts` field added | `store/pilotSlice.ts` | MODIFIED |
| `useExplore` | Reactive filter watcher; fires GET /api/explore on filter change | `hooks/useExplore.ts` | UNCHANGED |
| `useSage` | Handles `data.experts` + `data.filters`; tracks sage_query events | `hooks/useSage.ts` | MODIFIED |
| `ExpertCard` | Marketplace card; triggers `trackEvent(card_click)` on click | `components/marketplace/ExpertCard.tsx` | MODIFIED |
| `SagePanel` | 380px panel; renders `SageMessage` with optional expert list | `components/pilot/SagePanel.tsx` | UNCHANGED |
| `SageMessage` | Renders text content; now renders `SageExpertCard` list if `experts` present | `components/pilot/SageMessage.tsx` | MODIFIED |
| `SageExpertCard` | Compact expert card for Sage panel (no bento constraints) | `components/pilot/SageExpertCard.tsx` | NEW |
| `tracking.ts` | `trackEvent()` fire-and-forget utility; `keepalive: true` | `src/lib/tracking.ts` | NEW |
| `pilot_service.py` | Two-turn Gemini; `search_experts` + `apply_filters` functions; calls `run_explore()` | `services/pilot_service.py` | MODIFIED |
| `pilot.py` (router) | Injects `db` + `app.state` into `run_pilot()` | `routers/pilot.py` | MODIFIED |
| `events.py` (router) | `POST /api/events` — inserts `UserEvent`; no auth required | `routers/events.py` | NEW |
| `models.py` | Adds `UserEvent` SQLAlchemy model | `app/models.py` | MODIFIED |
| `admin.py` | Adds `/events/demand` + `/events/exposure` aggregation endpoints | `routers/admin.py` | MODIFIED |
| `MarketplacePage.tsx` | New admin page — exposure distribution + demand signals | `admin/pages/MarketplacePage.tsx` | NEW |

---

## Feature 1: Sage `search_experts` Function

### The Critical Difference From `apply_filters`

`apply_filters` mutates the Zustand store; `useExplore` reactively fires GET /api/explore when the store changes. Filter args are the payload — no results come back from the backend.

`search_experts` must do three things simultaneously:
1. Call the actual search pipeline and get real expert results
2. Give those results to Sage to narrate in chat
3. Sync the main grid to show the same search (so the user can browse the full result set)

This requires the backend to call `run_explore()` and return the expert list in the `/api/pilot` response — not just filter arguments.

### Data Flow

```
User types in SageInput: "Find me a blockchain expert under €200/hr"
    │
    ▼
useSage.handleSend(text)
    │ addMessage (user) → pilotSlice
    │ setStreaming(true)
    │
    │ POST /api/pilot { message, history, current_filters }
    ▼
pilot.py injects db + app.state → run_pilot(message, history, current_filters, db, app_state)
    │
    │ Turn 1: Gemini sees search_experts FunctionDeclaration
    │         Extracts args: { query: "blockchain", rate_max: 200 }
    │         Returns FunctionCall(name="search_experts", args={...})
    │
    ▼
pilot_service calls run_explore() directly (service import — no HTTP)
    │ run_explore(query="blockchain", rate_max=200, limit=5, cursor=0, db=db, app_state=app_state)
    │ Returns ExploreResponse: { experts: [top 5], total: N, cursor: ... }
    │
    │ Turn 2: Gemini receives function response with expert summary strings
    │         Generates Sage's natural language narrative
    │
    ▼
PilotResponse: {
    filters: { query: "blockchain", rate_max: 200 },   ← filter diff for grid sync
    experts: [ ExpertCard, ... ],                       ← NEW: top 5 for Sage display
    message: "Found 12 blockchain experts under €200/hr. Here are the top matches..."
}
    │
    ▼
useSage receives response
    ├── validateAndApplyFilters(data.filters)
    │       filterSlice.setQuery("blockchain") + setRateRange(0, 200)
    │       useExplore reacts → GET /api/explore?query=blockchain&rate_max=200
    │       setResults(experts, total, cursor) → ExpertGrid re-renders with full 20-item page
    │
    └── addMessage({ content: data.message, experts: data.experts })
            pilotSlice.messages updates
            SageMessage renders SageExpertCard list (top 5 with narrative)

[Grid shows full paginated results] [Sage panel shows top 5 with narrative]
```

### Grid Sync Mechanism

Grid sync reuses the existing reactive mechanism — no new code. When `useSage` calls `validateAndApplyFilters()` with `{ query: "blockchain", rate_max: 200 }`, the filterSlice updates, `useExplore`'s dependency array `[query, rateMin, rateMax, tags, sortBy]` triggers, and the grid re-fetches automatically.

The key design decision: the pilot response carries both `filters` (for grid sync) and `experts` (for Sage display). These are different views of the same query: Sage shows top 5 with narrative context; the grid shows the full paginated result set.

### Backend Changes

**`pilot.py` router** — inject `db` and `app.state`:

```python
# BEFORE
@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(body: PilotRequest) -> PilotResponse:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_pilot(
            message=body.message,
            history=[h.model_dump() for h in body.history],
            current_filters=body.current_filters,
        ),
    )

# AFTER
@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(
    request: Request,
    body: PilotRequest,
    db: Session = Depends(get_db),
) -> PilotResponse:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_pilot(
            message=body.message,
            history=[h.model_dump() for h in body.history],
            current_filters=body.current_filters,
            db=db,
            app_state=request.app.state,
        ),
    )
```

**`PilotResponse`** — add experts field:

```python
class PilotResponse(BaseModel):
    filters: dict | None
    experts: list[dict] | None = None   # NEW: ExpertCard dicts from run_explore()
    message: str
```

**`pilot_service.py`** — add `search_experts` declaration and handler:

```python
from app.services.explorer import run_explore, ExpertCard as ExploreExpertCard

SEARCH_EXPERTS_DECLARATION = types.FunctionDeclaration(
    name="search_experts",
    description=(
        "Search the expert marketplace for professionals matching the user's request. "
        "Use this when the user wants to find experts, not just adjust filters. "
        "Returns real expert results that will appear in Sage's chat and in the main grid."
    ),
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Semantic search query."},
            "rate_min": {"type": "number", "description": "Minimum hourly rate."},
            "rate_max": {"type": "number", "description": "Maximum hourly rate."},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (AND logic).",
            },
        },
        "required": ["query"],
    },
)

# In run_pilot(), update tool to include both declarations:
tool = types.Tool(function_declarations=[APPLY_FILTERS_DECLARATION, SEARCH_EXPERTS_DECLARATION])

# In the function call handler:
if fn_call.name == "search_experts":
    args = fn_call.args
    explore_result = run_explore(
        query=args.get("query", ""),
        rate_min=args.get("rate_min", 0.0),
        rate_max=args.get("rate_max", 10000.0),
        tags=args.get("tags", []),
        limit=5,          # Top 5 for Sage display; grid gets full set via filter sync
        cursor=0,
        db=db,
        app_state=app_state,
    )
    experts_for_sage = [e.model_dump() for e in explore_result.experts]
    filters_applied = {  # Also sync the grid
        "query": args.get("query", ""),
        "rate_min": args.get("rate_min", 0.0),
        "rate_max": args.get("rate_max", 10000.0),
        "tags": args.get("tags", []),
    }
    # Build summary string for Turn 2 Gemini context
    expert_summaries = "\n".join(
        f"- {e['first_name']} {e['last_name']}: {e['job_title']} @ {e['company']} "
        f"({e['currency']} {e['hourly_rate']}/hr)"
        for e in experts_for_sage
    )
    function_response = {
        "result": "success",
        "total_found": explore_result.total,
        "experts": expert_summaries,
    }
    # Turn 2: generate Sage narrative referencing the actual experts...
```

### Frontend Changes

**`pilotSlice.ts`** — `PilotMessage` gains optional `experts` field:

```typescript
export interface PilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  experts?: Expert[]   // NEW: populated when Sage did a search_experts call
}
```

**`useSage.ts`** — handle `data.experts`:

```typescript
// After receiving pilot response:
if (data.filters && typeof data.filters === 'object') {
  validateAndApplyFilters(data.filters as Record<string, unknown>)
}

addMessage({
  id: `${Date.now()}-assistant`,
  role: 'assistant',
  content: data.message ?? "Here's what I found!",
  experts: data.experts?.slice(0, 5) ?? undefined,  // NEW
  timestamp: Date.now(),
})
```

**New component: `SageExpertCard.tsx`** — compact card for Sage panel. Intentionally different from marketplace `ExpertCard`: no `h-[180px]` constraint, no CSS hover animation, no bento zones. Simple name/title/rate/tag layout optimized for the narrow 380px panel.

**`SageMessage.tsx`** — render expert list when present:

```tsx
// After the text bubble, if message.experts exists:
{message.experts && message.experts.length > 0 && (
  <div className="mt-2 space-y-2">
    {message.experts.map(expert => (
      <SageExpertCard key={expert.username} expert={expert} />
    ))}
  </div>
)}
```

---

## Feature 2: User Event Tracking

### SQLite `user_events` Table Schema

A single table with discriminated `event_type` column handles all three event types. Using one table (not three) because admin gap queries aggregate across event types; cross-event analysis (e.g., "what filters changed before a card click?") is simpler with a single table.

```sql
CREATE TABLE user_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type       TEXT    NOT NULL,   -- 'card_click' | 'sage_query' | 'filter_change'
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- card_click fields
    expert_username  TEXT,          -- which expert was clicked
    context          TEXT,          -- 'grid' | 'sage_panel'

    -- sage_query fields
    query_text       TEXT,          -- raw user message to Sage
    function_called  TEXT,          -- 'apply_filters' | 'search_experts' | null
    result_count     INTEGER,       -- experts returned (search_experts only)

    -- filter_change fields
    filter_field     TEXT,          -- 'query' | 'rate_range' | 'tags' | 'reset'
    filter_value     TEXT           -- JSON-serialized value(s) for the field
);

CREATE INDEX idx_user_events_type_ts ON user_events (event_type, created_at);
CREATE INDEX idx_user_events_expert  ON user_events (expert_username)
    WHERE expert_username IS NOT NULL;
```

Sparse columns (NULL for irrelevant event types) are intentional. SQLite handles NULLs efficiently; no wasted storage.

### SQLAlchemy Model

Add to `app/models.py`:

```python
class UserEvent(Base):
    """
    User behavior events for marketplace intelligence.
    Single table with sparse nullable columns per event_type.

    event_type values:
        'card_click'     — expert card click; expert_username + context populated
        'sage_query'     — Sage send; query_text + function_called + result_count
        'filter_change'  — filter state changed; filter_field + filter_value (JSON)

    No FK constraints — consistent with existing models.py style.
    Auto-created by Base.metadata.create_all at startup.
    """
    __tablename__ = "user_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    # card_click
    expert_username: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    context: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # sage_query
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    function_called: Mapped[str | None] = mapped_column(String(30), nullable=True)
    result_count: Mapped[int | None] = mapped_column(nullable=True)
    # filter_change
    filter_field: Mapped[str | None] = mapped_column(String(30), nullable=True)
    filter_value: Mapped[str | None] = mapped_column(Text, nullable=True)
```

No `ALTER TABLE` or migration script needed. `Base.metadata.create_all()` in `main.py` lifespan creates missing tables idempotently on next Railway deploy.

### Backend Ingestion Endpoint

New router: `app/routers/events.py`. No auth required — public, like `/api/explore`.

```python
"""POST /api/events — user behavior event ingestion. No auth required."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import UserEvent

router = APIRouter()

class EventRequest(BaseModel):
    event_type: str
    expert_username: str | None = None
    context: str | None = None
    query_text: str | None = None
    function_called: str | None = None
    result_count: int | None = None
    filter_field: str | None = None
    filter_value: str | None = None

@router.post("/api/events", status_code=202)
def record_event(body: EventRequest, db: Session = Depends(get_db)):
    """
    Fire-and-forget event ingestion. Returns 202 (no body) immediately.
    Frontend does not await a meaningful response.
    """
    db.add(UserEvent(**body.model_dump()))
    db.commit()
    return None
```

Register in `main.py` alongside existing routers. `status_code=202` signals "accepted but not processed further" — semantically correct and reduces frontend expectations.

### Frontend Tracking Utility

New file: `frontend/src/lib/tracking.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export function trackEvent(payload: Record<string, unknown>): void {
  // keepalive: true ensures event fires even if user navigates away immediately
  // No error handling — analytics loss on failure is acceptable
  fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* silent */ })
}
```

`trackEvent` is a plain module function (not a hook). It can be called from Zustand slice actions, event handlers, and `useCallback` — anywhere without hook rules constraints.

### Tracking Integration Points

| Event | Where Called | Code Location | Fields |
|-------|-------------|---------------|--------|
| `card_click` (grid) | `ExpertCard.tsx` onClick on "View Full Profile" | `components/marketplace/ExpertCard.tsx` | `expert_username`, `context: 'grid'` |
| `card_click` (sage) | `SageExpertCard.tsx` onClick | `components/pilot/SageExpertCard.tsx` | `expert_username`, `context: 'sage_panel'` |
| `sage_query` | `useSage.ts` after pilot response received | `hooks/useSage.ts` | `query_text`, `function_called`, `result_count` |
| `filter_change` | `filterSlice.ts` set actions | `store/filterSlice.ts` | `filter_field`, `filter_value` |

**Filter tracking pattern** — tracking lives in `filterSlice.ts` set actions (not in UI components). This ensures tracking fires regardless of whether the change came from the sidebar, URL sync, or Sage:

```typescript
// filterSlice.ts (modified)
import { trackEvent } from '../lib/tracking'

setQuery: (q) => {
  set({ query: q })
  if (q) trackEvent({ event_type: 'filter_change', filter_field: 'query', filter_value: q })
},
setRateRange: (min, max) => {
  set({ rateMin: min, rateMax: max })
  trackEvent({ event_type: 'filter_change', filter_field: 'rate_range',
                filter_value: JSON.stringify({ min, max }) })
},
setTags: (tags) => {
  set({ tags })
  trackEvent({ event_type: 'filter_change', filter_field: 'tags',
                filter_value: JSON.stringify(tags) })
},
resetFilters: () => {
  set({ ...filterDefaults })
  trackEvent({ event_type: 'filter_change', filter_field: 'reset', filter_value: 'true' })
},
```

Do not track `setQuery('')` (empty string clears) to avoid noise — add a `if (q)` guard as shown.

**Sage query tracking in `useSage.ts`** — after pilot response:

```typescript
// After receiving pilot response:
trackEvent({
  event_type: 'sage_query',
  query_text: text.trim(),
  function_called: data.filters ? (data.experts ? 'search_experts' : 'apply_filters') : null,
  result_count: data.experts?.length ?? null,
})
```

---

## Feature 3: Admin Gaps Tab — Unmet Demand + Exposure

### Existing vs New Gaps

The current `GapsPage.tsx` + `GET /api/admin/gaps` endpoint surfaces **chat-API gaps** (queries where `conversations.top_match_score < 0.60`). This is unrelated to the new marketplace intelligence data from `user_events`.

The v2.3 intelligence view is a **new admin page**: `MarketplacePage.tsx` at `/admin/marketplace`. It does not modify the existing GapsPage — it adds a sibling page. Add a sidebar entry in `AdminSidebar.tsx`.

### Admin Aggregation Queries

**Unmet Demand — Sage searches with poor results:**

```sql
SELECT
    query_text,
    COUNT(*)           AS query_count,
    AVG(result_count)  AS avg_result_count,
    MIN(created_at)    AS first_seen,
    MAX(created_at)    AS last_seen
FROM user_events
WHERE event_type = 'sage_query'
  AND function_called = 'search_experts'
  AND (result_count IS NULL OR result_count < 3)
GROUP BY query_text
ORDER BY query_count DESC
LIMIT 50;
```

**Unmet Demand — Most searched filter terms:**

```sql
SELECT
    filter_value        AS search_term,
    COUNT(*)            AS frequency,
    MAX(created_at)     AS last_seen
FROM user_events
WHERE event_type = 'filter_change'
  AND filter_field = 'query'
  AND filter_value != ''
  AND filter_value IS NOT NULL
GROUP BY filter_value
ORDER BY frequency DESC
LIMIT 50;
```

**Expert Exposure Distribution:**

```sql
SELECT
    e.username,
    e.first_name || ' ' || e.last_name  AS name,
    e.job_title,
    e.findability_score,
    COUNT(ue.id)                        AS click_count
FROM experts e
LEFT JOIN user_events ue
    ON ue.expert_username = e.username
    AND ue.event_type = 'card_click'
GROUP BY e.username
ORDER BY click_count DESC;
```

**Click source breakdown (grid vs Sage panel):**

```sql
SELECT
    expert_username,
    SUM(CASE WHEN context = 'grid'       THEN 1 ELSE 0 END) AS grid_clicks,
    SUM(CASE WHEN context = 'sage_panel' THEN 1 ELSE 0 END) AS sage_clicks,
    COUNT(*) AS total_clicks
FROM user_events
WHERE event_type = 'card_click'
GROUP BY expert_username
ORDER BY total_clicks DESC
LIMIT 100;
```

**Daily Sage usage trend:**

```sql
SELECT
    DATE(created_at)    AS day,
    COUNT(*)            AS sage_queries,
    SUM(CASE WHEN function_called = 'search_experts' THEN 1 ELSE 0 END) AS search_calls,
    SUM(CASE WHEN function_called = 'apply_filters'  THEN 1 ELSE 0 END) AS filter_calls
FROM user_events
WHERE event_type = 'sage_query'
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

### New Admin Endpoints

Add to `admin.py` under the existing auth-gated `router`:

```python
@router.get("/events/demand")
def get_demand_signals(db: Session = Depends(get_db)):
    """Unmet demand: Sage searches with few results + most-searched filter terms."""
    # Run SQL aggregations above
    return {
        "sage_gaps": [...],          # query_text, query_count, avg_result_count
        "filter_terms": [...],       # search_term, frequency, last_seen
    }

@router.get("/events/exposure")
def get_exposure_distribution(db: Session = Depends(get_db)):
    """Expert click counts, grid vs Sage panel breakdown, vs findability score."""
    # Run SQL aggregations above
    return {
        "experts": [...],            # username, name, click_count, findability_score
        "daily_trend": [...],        # day, sage_queries, search_calls, filter_calls
    }
```

### Frontend Admin Page

New file: `frontend/src/admin/pages/MarketplacePage.tsx`

Two sections:
1. **Demand Signals** — table of Sage searches with poor results + most-searched filter terms
2. **Expert Exposure** — sortable table of experts by click count vs findability score; highlights over- and under-exposed experts

New hook in `useAdminData.ts`:

```typescript
export function useMarketplaceEvents() {
  // Parallel fetch: demand + exposure
  const [demand, setDemand] = useState<DemandResponse | null>(null)
  const [exposure, setExposure] = useState<ExposureResponse | null>(null)
  ...
  useEffect(() => {
    Promise.all([
      adminFetch<DemandResponse>('/events/demand'),
      adminFetch<ExposureResponse>('/events/exposure'),
    ]).then(([d, e]) => { setDemand(d); setExposure(e) })
  }, [])
}
```

New types in `admin/types.ts`:

```typescript
export interface DemandRow {
  query_text: string
  query_count: number
  avg_result_count: number | null
  last_seen: string
}

export interface FilterTermRow {
  search_term: string
  frequency: number
  last_seen: string
}

export interface ExposureRow {
  username: string
  name: string
  job_title: string
  click_count: number
  grid_clicks: number
  sage_clicks: number
  findability_score: number | null
}
```

---

## Recommended Project Structure (v2.3 delta only)

```
app/
├── models.py               MODIFIED — add UserEvent model
├── main.py                 MODIFIED — register events.router
├── routers/
│   ├── pilot.py            MODIFIED — inject db + app.state into run_pilot()
│   ├── admin.py            MODIFIED — add /events/demand, /events/exposure endpoints
│   └── events.py           NEW — POST /api/events (public, no auth)
└── services/
    └── pilot_service.py    MODIFIED — add SEARCH_EXPERTS_DECLARATION; call run_explore();
                                       accept db + app_state params; return experts in response

frontend/src/
├── lib/
│   └── tracking.ts         NEW — trackEvent() fire-and-forget utility
├── store/
│   ├── filterSlice.ts      MODIFIED — call trackEvent() in set actions
│   └── pilotSlice.ts       MODIFIED — PilotMessage.experts?: Expert[] field
├── hooks/
│   └── useSage.ts          MODIFIED — handle data.experts; call trackEvent(sage_query)
├── components/
│   ├── marketplace/
│   │   └── ExpertCard.tsx  MODIFIED — call trackEvent(card_click) on profile click
│   └── pilot/
│       ├── SageMessage.tsx MODIFIED — render SageExpertCard list when experts present
│       └── SageExpertCard.tsx  NEW — compact expert card for 380px Sage panel
└── admin/
    ├── pages/
    │   └── MarketplacePage.tsx  NEW — demand signals + exposure distribution
    ├── components/
    │   ├── AdminSidebar.tsx     MODIFIED — add Marketplace nav entry
    │   ├── DemandTable.tsx      NEW — sage gaps + filter terms tables
    │   └── ExposureTable.tsx    NEW — expert click distribution table
    ├── hooks/
    │   └── useAdminData.ts      MODIFIED — add useMarketplaceEvents() hook
    └── types.ts                 MODIFIED — add DemandRow, FilterTermRow, ExposureRow
```

### Files Completely Unchanged

`app/routers/chat.py`, `app/routers/feedback.py`, `app/routers/email_capture.py`, `app/routers/health.py`, `app/routers/explore.py`, `app/routers/suggest.py`, `app/routers/newsletter.py`, `app/services/embedder.py`, `app/services/explorer.py`, `app/services/retriever.py`, `app/services/search_intelligence.py`, `app/services/tagging.py`, `app/database.py`, `app/config.py`, `frontend/src/store/index.ts`, `frontend/src/store/resultsSlice.ts`, `frontend/src/store/nltrStore.ts`, `frontend/src/components/pilot/SagePanel.tsx`, `frontend/src/hooks/useExplore.ts`, `frontend/src/admin/pages/GapsPage.tsx`.

---

## Architectural Patterns

### Pattern 1: Zustand Snapshot in Async Handlers

**What:** Use `useExplorerStore.getState()` (snapshot) inside `async` functions instead of reactive selectors.
**When to use:** Any async handler in `useSage`, `useExplore`, or similar hooks that reads store state mid-flight.
**Trade-offs:** Snapshot is slightly stale if state changes during async wait, but prevents stale closures and re-render loops.

```typescript
// CORRECT — snapshot at call time
const handleSend = useCallback(async (text: string) => {
  const storeState = useExplorerStore.getState()  // snapshot
  const currentFilters = { query: storeState.query, ... }
}, [isStreaming, addMessage, setStreaming])
```

### Pattern 2: Service-to-Service Call (No HTTP Self-Call)

**What:** `pilot_service.py` imports and calls `run_explore()` directly rather than making HTTP request to `/api/explore`.
**When to use:** When one backend service needs results from another in the same process (Railway single-container).
**Trade-offs:** Tighter coupling, but avoids network overhead, auth complications, and double error handling.

```python
# CORRECT — direct import
from app.services.explorer import run_explore

result = run_explore(query=..., db=db, app_state=app_state)

# WRONG — HTTP self-call
import httpx
result = httpx.get("http://localhost:8000/api/explore?query=...")
```

`pilot.py` must pass `db` (from `Depends(get_db)`) and `app_state` (from `request.app.state`) down to `run_pilot()`. This is a dependency injection change — `run_pilot` signature gains two new params.

### Pattern 3: Fire-and-Forget Tracking

**What:** Post analytics events without blocking user interaction or awaiting response.
**When to use:** All `trackEvent()` calls. Never on critical paths.
**Trade-offs:** No retry on failure; analytics loss is acceptable. `keepalive: true` handles navigation.

```typescript
// CORRECT — synchronous dispatch, async fetch ignored
setQuery: (q) => {
  set({ query: q })                     // state update is synchronous
  trackEvent({ event_type: 'filter_change', filter_field: 'query', filter_value: q })
}

// WRONG — awaiting blocks the action
setQuery: async (q) => {
  set({ query: q })
  await trackEvent(...)   // never do this
}
```

### Pattern 4: Discriminated Single Table for Events

**What:** One `user_events` table with `event_type` column and sparse nullable fields per type.
**When to use:** When multiple event types share common fields (`id`, `created_at`) and admin queries benefit from cross-type analytics.
**Trade-offs:** Sparse NULLs use minimal space in SQLite. Cross-event queries (GROUP BY event_type, date range filtering) work on one table. At this scale, simpler than 3-table JOIN architecture.

### Pattern 5: Individual Zustand Selectors (Not useShallow)

**What:** Subscribe to each store field individually, never via `useShallow` with an object selector.
**When to use:** Always in this codebase. The `tags` array causes identity pitfalls with `useShallow` (new array ref every render triggers `useExplore` infinite loop).
**Trade-offs:** More verbose. Correct for referential stability.

---

## Data Flow

### Sage Search + Grid Sync Flow

```
[User types in SageInput]
    │
    ▼
useSage.handleSend(text)
    │ addMessage (user) → pilotSlice
    │ setStreaming(true)
    │
    │ POST /api/pilot { message, history, current_filters }
    ▼
pilot_service.run_pilot(message, history, current_filters, db, app_state)
    │ Turn 1: Gemini sees search_experts FunctionDeclaration
    │         → FunctionCall(search_experts, { query: "blockchain", rate_max: 200 })
    │ run_explore(query, rate_max, limit=5) → ExploreResponse(experts=[5], total=12)
    │ Turn 2: Gemini receives expert summaries → narrative response
    │
    ▼
PilotResponse { filters: {...}, experts: [5 ExpertCards], message: "..." }
    │
    ├── validateAndApplyFilters(data.filters)
    │       filterSlice.setQuery("blockchain") + setRateRange(0, 200)
    │           ↓
    │       useExplore re-fetches GET /api/explore?query=blockchain&rate_max=200
    │       setResults(20 experts, total=12, cursor=null) → ExpertGrid re-renders
    │
    ├── addMessage({ content, experts: data.experts.slice(0,5) })
    │       SageMessage renders SageExpertCard × 5
    │
    └── trackEvent({ sage_query, query_text, function_called: 'search_experts', result_count: 5 })
```

### Event Tracking Flow

```
[User clicks "View Full Profile" on ExpertCard]
    │
    ├── onViewProfile(url) → ProfileGateModal (EXISTING — unchanged)
    └── trackEvent({ event_type: 'card_click', expert_username, context: 'grid' })
            │ fetch POST /api/events (keepalive: true, no await)
            ▼
        events.py: db.add(UserEvent(...)); db.commit()
        → user_events table INSERT
```

### Admin Gaps Query Flow

```
[Admin opens /admin/marketplace]
    │
    ▼
MarketplacePage renders → useMarketplaceEvents()
    │ Promise.all([
    │   GET /api/admin/events/demand,
    │   GET /api/admin/events/exposure
    │ ])
    ▼
admin.py runs SQL aggregations
    │ Sage gaps: GROUP BY query_text WHERE result_count < 3
    │ Filter terms: GROUP BY filter_value WHERE filter_field='query'
    │ Exposure: LEFT JOIN experts ON expert_username GROUP BY username
    ▼
DemandTable + ExposureTable render
```

---

## Build Order (Dependency Graph)

The three v2.3 features have dependencies that constrain sequencing:

```
Phase A — SQLite UserEvent model + POST /api/events
    → Nothing depends on this except B and C.
    → Can ship alone. Table auto-created on next deploy.

Phase B — Event tracking (trackEvent utility + filterSlice + ExpertCard + useSage)
    → Depends on Phase A (endpoint must exist before tracking fires)
    → Ship: tracking.ts, filterSlice changes, ExpertCard click, useSage sage_query event

Phase C — Admin Marketplace Intelligence page
    → Depends on Phase A + B (needs events in DB to be useful)
    → Ship: MarketplacePage, DemandTable, ExposureTable, admin endpoints, types

Phase D — Sage search_experts function
    → Independent: no dependency on A/B/C
    → Highest-value user-facing feature
    → Ship: pilot_service changes, pilot.py injection, PilotMessage.experts,
             useSage experts handling, SageMessage rendering, SageExpertCard
```

**Recommended sequence: D → A → B → C**

Rationale: `search_experts` (D) is the primary user-facing capability and unblocks immediately without tracking infrastructure. Shipping D first means the feature is live while A/B/C are being built. Doing A before B ensures events endpoint exists when tracking code ships. C ships last — it needs events accumulated in the DB to display meaningful data.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Gemini 2.5 Flash | Add `SEARCH_EXPERTS_DECLARATION` to `types.Tool`; two-turn pattern unchanged | Both declarations in same `Tool` object; Gemini selects the appropriate function |
| Railway SQLite | `UserEvent` added to `models.py`; `Base.metadata.create_all()` handles table creation | No migration script; auto-created on next Railway deploy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `useSage` ↔ `useExplorerStore` | `useExplorerStore.getState()` snapshot for async reads; `validateAndApplyFilters()` for writes | UNCHANGED pattern; extend to handle `data.experts` from `search_experts` response |
| `pilot_service` ↔ `explorer` | Direct Python import + function call via `run_explore()` | NEW: `run_pilot()` must receive `db` and `app_state` params injected by `pilot.py` router |
| `filterSlice` → `tracking.ts` | Synchronous call after `set()` inside slice actions | NEW: side-effect in slice actions; tracking is not reactive |
| `ExpertCard` → `tracking.ts` | Direct call in onClick handler | NEW: no hook, no effect — inline in event handler |
| `useSage` → `tracking.ts` | Direct call after pilot response | NEW: tracks `sage_query` events post-send |
| `admin.py` ↔ `user_events` | SQLAlchemy SELECT + GROUP BY via `text()` | NEW: two new aggregation endpoints under existing auth-gated `router` |

---

## Anti-Patterns

### Anti-Pattern 1: HTTP Self-Call for search_experts

**What people do:** `pilot_service.py` makes an HTTP request to `http://localhost:8000/api/explore` to fetch experts.
**Why it's wrong:** Network latency inside the same process; hardcoded internal URL breaks on Railway's dynamic routing; duplicates error handling; requires auth bypass or header forwarding.
**Do this instead:** Import `run_explore` from `app.services.explorer`; call it directly. Pass `db` and `app_state` from the pilot router's dependency injection.

### Anti-Pattern 2: Awaiting trackEvent

**What people do:** `await trackEvent(...)` or `return trackEvent(...).then(...)` to ensure event is logged.
**Why it's wrong:** Blocks the critical path (filter dispatch, Sage response display). If the `/api/events` endpoint is slow or returns 5xx, user sees degraded performance.
**Do this instead:** `trackEvent()` is always fire-and-forget. The `.catch(() => {})` suppresses errors. Analytics loss on failure is acceptable.

### Anti-Pattern 3: Tracking in useEffect

**What people do:** `useEffect(() => { trackEvent(...) }, [lastClickedExpert])` to track events reactively.
**Why it's wrong:** Fires on mount if dependency is non-null at mount time; creates stale closure risk; couples analytics to render lifecycle.
**Do this instead:** Call `trackEvent()` directly in onClick handlers and Zustand set actions — synchronous calls that start async fire-and-forget fetches.

### Anti-Pattern 4: Separate Tables per Event Type

**What people do:** Create `card_click_events`, `sage_query_events`, `filter_change_events` tables.
**Why it's wrong:** Cross-event gap analysis requires JOIN across three tables. Admin aggregation queries become complex. At this scale, three tables provide no query optimization benefit over a well-indexed single table.
**Do this instead:** Single `user_events` table with discriminated `event_type` and sparse nullable fields. Composite index on `(event_type, created_at)` makes per-type queries fast.

### Anti-Pattern 5: Storing Full Expert Objects in user_events

**What people do:** Store the full expert JSON blob in `user_events` for `card_click` events.
**Why it's wrong:** Redundant data (expert profile already in `experts` table); makes events table large; complicates queries.
**Do this instead:** Store only `expert_username`. JOIN to `experts` table in aggregation queries when name/title/score is needed.

### Anti-Pattern 6: Adding search_experts Results to resultsSlice Directly

**What people do:** When Sage calls `search_experts`, directly call `setResults()` on resultsSlice with the backend-returned experts, bypassing `useExplore`.
**Why it's wrong:** Breaks the invariant that resultsSlice is always a reflection of the current filterSlice state. Infinite scroll (`loadNextPage`) uses the cursor from resultsSlice — if results were injected directly, cursor is wrong. URL sync reads from filterSlice — direct result injection means URL doesn't reflect the search.
**Do this instead:** Update filterSlice via `validateAndApplyFilters(data.filters)`. `useExplore` reacts and re-fetches GET /api/explore with the new filters. The grid gets consistent data with correct cursor, URL sync, and infinite scroll.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (530 experts, low traffic) | All v2.3 patterns correct as described. SQLite `user_events` grows slowly. |
| 10k events/day | Add `(event_type, created_at)` composite index (already in schema). Consider archiving events older than 90 days. |
| 100k+ events/day | SQLite write contention on Railway's single-instance deployment. Consider batch writes (collect events in memory, flush periodically) or WAL mode (`PRAGMA journal_mode=WAL` — already Railway default). At this scale, Postgres migration is warranted. |
| 50k+ experts | `run_explore()` call from `pilot_service` becomes heavier (FAISS + FTS5 at scale). Move to IndexIVFFlat; pilot endpoint's `run_in_executor` already handles thread offload correctly. |

**First bottleneck for v2.3:** The `run_explore()` call inside `pilot_service.run_pilot()` is CPU-bound (FAISS + FTS5). At the router level, `run_pilot()` is already offloaded to `run_in_executor`. The inner `run_explore()` call executes in that same thread — this is correct and safe. No additional concurrency machinery needed.

---

## Sources

- Direct codebase inspection (HIGH confidence — ground truth):
  - `app/routers/pilot.py` — current PilotRequest/PilotResponse shapes, run_in_executor pattern
  - `app/services/pilot_service.py` — APPLY_FILTERS_DECLARATION, two-turn pattern, run_pilot() signature
  - `app/routers/explore.py` — run_explore() signature, app_state injection pattern
  - `app/services/explorer.py` — ExploreResponse schema, ExpertCard model, pipeline structure
  - `app/models.py` — Conversation, Expert, EmailLead patterns (Mapped[T], DateTime, nullable conventions)
  - `app/routers/admin.py` — router auth pattern, existing SQL aggregation style, _require_admin dep
  - `frontend/src/hooks/useSage.ts` — handleSend flow, validateAndApplyFilters, storeState snapshot pattern
  - `frontend/src/hooks/useExplore.ts` — reactive filter dependency array, how grid re-fetches on state change
  - `frontend/src/store/filterSlice.ts` — set actions, filterDefaults, slice structure
  - `frontend/src/store/pilotSlice.ts` — PilotMessage interface, addMessage action
  - `frontend/src/store/resultsSlice.ts` — Expert interface, setResults/appendResults actions
  - `frontend/src/components/marketplace/ExpertCard.tsx` — onViewProfile handler, existing onClick pattern
  - `frontend/src/components/pilot/SagePanel.tsx` — SageMessage rendering, panel structure
  - `frontend/src/admin/hooks/useAdminData.ts` — adminFetch, hook patterns, existing admin data shapes
  - `frontend/src/admin/types.ts` — existing type conventions for admin responses
  - `.planning/PROJECT.md` — v2.3 requirements, existing key decisions table

---

*Architecture research for: TCS v2.3 Sage Evolution & Marketplace Intelligence*
*Researched: 2026-02-22*
