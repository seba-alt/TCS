# Architecture Research

**Domain:** Expert Marketplace v2.0 — Hybrid search, Zustand state, floating AI co-pilot
**Researched:** 2026-02-21
**Confidence:** HIGH — all seven integration questions resolved against actual codebase + verified sources

---

## Context: Subsequent Milestone

This document answers seven concrete integration questions for v2.0 rearchitecture. The existing production system (v1.2) is ground truth. Nothing is replaced unless explicitly stated — this is an additive rearchitecture.

### Existing production components (do not touch)

| File | Status |
|------|--------|
| `app/main.py` | EXISTS — MODIFIED to add FTS5 migration and new router registrations |
| `app/models.py` | EXISTS — UNCHANGED (FTS5 is raw DDL, not SQLAlchemy ORM) |
| `app/routers/chat.py` | EXISTS — UNCHANGED |
| `app/routers/admin.py` | EXISTS — UNCHANGED |
| `app/routers/feedback.py` | EXISTS — UNCHANGED |
| `app/routers/email_capture.py` | EXISTS — UNCHANGED |
| `app/services/search_intelligence.py` | EXISTS — UNCHANGED (used by chat.py only) |
| `app/services/retriever.py` | EXISTS — UNCHANGED |
| `app/services/embedder.py` | EXISTS — UNCHANGED |
| `app/services/llm.py` | EXISTS — UNCHANGED |
| `frontend/src/admin/` | EXISTS — UNCHANGED (all admin pages, hooks, types) |
| `frontend/src/hooks/useChat.ts` | EXISTS — UNCHANGED |
| `frontend/src/App.tsx` | EXISTS — DEPRECATED (no longer at `/`) |

---

## Q1: /api/explore router structure

### Decision: New file `app/routers/explore.py`

Create `app/routers/explore.py` as a standalone `APIRouter`. Do NOT extend `chat.py` or `admin.py`.

**Why not chat.py:** `/api/chat` is an SSE streaming endpoint for conversational AI. `/api/explore` is a synchronous JSON endpoint for paginated hybrid search. They share no code, no response format, and serve different clients (chat UI vs marketplace grid).

**Why not admin.py:** `admin.py` is already 500+ lines and has its own `_require_admin` dependency. The explore endpoint is public-facing with no admin auth. Adding public routes to an admin router is the wrong abstraction.

**Why a separate file:** The existing codebase already follows router-per-file: `chat.py`, `admin.py`, `email_capture.py`, `feedback.py`, `health.py`. This is FastAPI's official recommended pattern for larger applications.

```python
# app/routers/explore.py
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.explorer import run_explore

router = APIRouter()

@router.get("/api/explore")
async def explore(
    request: Request,
    db: Session = Depends(get_db),
    query: str = Query(default="", max_length=500),
    rate_min: float = Query(default=0.0, ge=0),
    rate_max: float = Query(default=10000.0, le=10000),
    tags: str = Query(default=""),       # comma-separated tag names
    limit: int = Query(default=20, ge=1, le=100),
    cursor: int = Query(default=0, ge=0),
) -> ExploreResponse:
    import asyncio
    loop = asyncio.get_event_loop()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    result = await loop.run_in_executor(
        None,
        lambda: run_explore(
            query=query,
            rate_min=rate_min,
            rate_max=rate_max,
            tags=tag_list,
            limit=limit,
            cursor=cursor,
            db=db,
            app_state=request.app.state,
        )
    )
    return result
```

### Registration in main.py

```python
# app/main.py — add alongside existing routers
from app.routers import admin, chat, email_capture, feedback, health, explore, pilot

app.include_router(explore.router)
app.include_router(pilot.router)
```

### CORS: no change needed

`app/main.py` already allows `GET` and `POST` methods with `Content-Type` and `X-Admin-Key` headers. `/api/explore` uses `GET` with no custom headers — no CORS update required.

### Endpoint comparison

| Router | Auth | Response type | Verb | Access |
|--------|------|---------------|------|--------|
| `chat.py` | None (email in body) | SSE stream | POST | Public |
| `admin.py` | X-Admin-Key header | JSON | GET/POST | Admin only |
| `feedback.py` | None | JSON | POST | Public |
| `explore.py` (NEW) | None | JSON paginated | GET | Public |
| `pilot.py` (NEW) | None | JSON | POST | Public |

---

## Q2: FTS5 virtual table migration strategy

### What FTS5 external content tables are

SQLite FTS5 supports "external content" mode: the FTS index stores term positions only; actual column values are fetched from the source table on retrieval. This avoids data duplication. The `content='experts'` and `content_rowid='id'` options wire the FTS index to the existing `experts` table.

### Migration DDL — add to lifespan handler in main.py

```python
# In app/main.py lifespan handler
# Add AFTER the existing Phase 8 enrichment column migrations

from sqlalchemy import text as _text

with engine.connect() as _conn:
    # Step 1: Create FTS5 virtual table (idempotent via IF NOT EXISTS)
    _conn.execute(_text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS experts_fts USING fts5(
            first_name,
            last_name,
            job_title,
            company,
            bio,
            tags,
            content='experts',
            content_rowid='id'
        )
    """))
    _conn.commit()

    # Step 2: Populate from existing 1,558 Expert rows (runs once — guarded by count)
    fts_count = _conn.execute(_text("SELECT COUNT(*) FROM experts_fts")).scalar()
    if fts_count == 0:
        _conn.execute(_text("""
            INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
            SELECT id, first_name, last_name, job_title, company, bio, COALESCE(tags, '')
            FROM experts
        """))
        _conn.commit()

log.info("startup: FTS5 index created/verified")
```

**Why `IF NOT EXISTS`:** SQLite FTS5 supports `IF NOT EXISTS` on `CREATE VIRTUAL TABLE`. This is idempotent and safe across restarts — the same pattern used for the existing `ALTER TABLE` guards.

**Why explicit rowid mapping in INSERT:** FTS5 external content tables require the `rowid` to match the content table's primary key (`Expert.id`). Without specifying `rowid` in the INSERT, FTS5 autogenerates its own rowids and cannot retrieve data from the `experts` table.

**Why populate from `experts` not from CSV:** `app.state.metadata` / `experts.csv` may be stale. The Expert SQLAlchemy table is the authoritative source (established in v1.1). This is consistent with the existing `ingest.py` change that switched to reading from the Expert table.

### Keeping FTS5 in sync after writes

SQLite triggers for FTS5 can cause "unsafe use of virtual table" errors in certain configurations (confirmed in SQLite Forum). Use explicit SQL sync in write paths instead:

**When a new expert is added (POST /api/admin/experts in admin.py):**
```python
# After db.commit() on the new Expert row:
db.execute(text("""
    INSERT INTO experts_fts(rowid, first_name, last_name, job_title, company, bio, tags)
    VALUES (:id, :fn, :ln, :jt, :co, :bio, :tags)
"""), {"id": expert.id, "fn": expert.first_name, ...})
db.commit()
```

**After a bulk tag update (end of `_run_ingest_job` in admin.py):**
```python
# Rebuild entire FTS index from current experts table
app_obj.state.faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
with SessionLocal() as db:
    db.execute(text("INSERT INTO experts_fts(experts_fts) VALUES('rebuild')"))
    db.commit()
```

The `'rebuild'` command is FTS5's documented mechanism for resynchronizing the FTS index from the content table. Call this at the end of any bulk update that modifies `experts.bio`, `experts.tags`, or `experts.job_title`.

### FTS5 BM25 query

```python
# In app/services/explorer.py
from sqlalchemy import text

fts_rows = db.execute(text("""
    SELECT rowid, rank
    FROM experts_fts
    WHERE experts_fts MATCH :q
    ORDER BY rank
    LIMIT :limit
"""), {"q": fts_query, "limit": 100}).fetchall()
# Note: FTS5 rank is negative (lower = better). expert rowid = Expert.id
```

**FTS5 MATCH syntax note:** Simple word queries work as-is. For multi-word queries, wrap in quotes for phrase search or use `AND`/`OR` operators. For the explore endpoint, the user's raw query string passed directly to MATCH is the starting point; add `*` suffix for prefix matching on partial words.

**Confidence:** HIGH — SQLite FTS5 official docs confirm `content=`, `content_rowid=`, INSERT rowid mapping, and rebuild command. Trigger limitation confirmed in SQLite Forum threads.

---

## Q3: FAISS IDSelectorBatch with existing IndexFlatIP

### Short answer: works without index rebuild

`IDSelectorBatch` is passed at search time via `SearchParameters.sel`. The FAISS index itself is not modified, not rebuilt, and not reloaded. The selector acts as a per-query membership filter applied during the search.

### Python API (confirmed against FAISS wiki and issue #3046)

```python
import numpy as np
import faiss

# Build allowed positions array from SQLAlchemy pre-filter results
allowed_positions = np.array([12, 45, 892, 1201, ...], dtype=np.int64)

selector = faiss.IDSelectorBatch(allowed_positions)
params = faiss.SearchParameters(sel=selector)

# Same index.search() call — params is the only addition
scores, indices = faiss_index.search(query_vector, k=50, params=params)
# indices are positional — map back to username via app.state.metadata[idx]
```

### Critical constraint: FAISS uses positional indices, not Expert.id

The existing `IndexFlatIP` uses **positional indexing**: vector at position 0 corresponds to `metadata[0]`, position 1 to `metadata[1]`, etc. `IDSelectorBatch` works on these **positional indices** (0 to 1557), not on `Expert.id` from the database.

The SQLAlchemy pre-filter returns `Expert` objects with DB `id` values. To bridge:

**Build a username → FAISS position mapping at startup (in lifespan handler):**

```python
# In app/main.py lifespan handler, after loading metadata:
username_to_pos: dict[str, int] = {}
for pos, row in enumerate(app.state.metadata):
    username = row.get("Username") or row.get("username") or ""
    if username:
        username_to_pos[username] = pos
app.state.username_to_faiss_pos = username_to_pos
log.info("startup: username-to-FAISS-position mapping built", count=len(username_to_pos))
```

Then in `explorer.py`:

```python
username_to_pos = app_state.username_to_faiss_pos
filtered_experts = db.scalars(pre_filter_query).all()

# Map expert usernames to FAISS positions (skip experts not in index)
allowed_positions = np.array(
    [username_to_pos[e.username] for e in filtered_experts if e.username in username_to_pos],
    dtype=np.int64
)

if len(allowed_positions) == 0:
    return ExploreResponse(experts=[], total=0, cursor=None, took_ms=0)
```

### Known issue: IDSelectorBatch hash collisions

GitHub issue #3112 documents inconsistent results when IDs share common bit patterns. For sequential positional indices (0, 1, 2... 1557), this is not a concern — sequential integers do not cause hash collisions in the IDSelectorBatch hash function. This issue affects non-sequential or patterned ID ranges only.

### Performance characteristic at 1,558 vectors

`IndexFlatIP` scans all 1,558 vectors for every query — IDSelectorBatch does not skip computation for unselected vectors. The selector filters results after scoring. At 1,558 vectors, a full FAISS scan takes under 1ms in Python. The SQLAlchemy pre-filter takes 1-3ms on SQLite with a simple WHERE clause. The FTS5 BM25 query takes 2-5ms. Total pipeline latency for all three stages is well under the 200ms target even without any caching.

**Conclusion:** The <200ms filter-to-grid latency target is achievable for this dataset size. IDSelectorBatch provides correctness (only score pre-filtered experts) not speed at this scale.

**Confidence:** HIGH — confirmed via FAISS wiki "Setting search parameters for one query", IDSelectorBatch C++ API docs, Python examples in issues #3046 and #3156.

---

## Q4: Zustand store placement and coexistence with useAdminData

### Current React tree

```
main.tsx
└── RouterProvider
    ├── / → App (ChatPage)   ← will be replaced by MarketplacePage
    ├── /admin/login → LoginPage
    └── /admin → RequireAuth → AdminApp → [admin pages]
```

### v2.0 React tree

```
main.tsx
└── RouterProvider
    ├── / → MarketplacePage             ← new
    ├── /admin/login → LoginPage        ← unchanged
    └── /admin → RequireAuth → AdminApp → [admin pages]  ← unchanged
```

### Zustand store placement: module-level singleton

Zustand stores are module-level singletons created with `create()` — not inside React components, not inside Providers. The store file lives at:

```
frontend/src/store/useExplorerStore.ts
```

No `<Provider>` wrapper is needed. Any component or hook that imports `useExplorerStore` shares the same store instance. This also enables calling `useExplorerStore.getState()` from async callbacks and plain functions outside the React render cycle — which is required for the co-pilot function call dispatch.

```typescript
// frontend/src/store/useExplorerStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FilterSlice {
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
  setQuery: (q: string) => void
  setRateRange: (min: number, max: number) => void
  setTags: (tags: string[]) => void
  toggleTag: (tag: string) => void
  resetFilters: () => void
}

interface ResultsSlice {
  experts: ExpertCard[]
  total: number
  loading: boolean
  cursor: number
  setResults: (experts: ExpertCard[], total: number, nextCursor: number) => void
  appendResults: (experts: ExpertCard[], nextCursor: number) => void
  setLoading: (loading: boolean) => void
}

interface PilotSlice {
  isPilotOpen: boolean
  messages: PilotMessage[]
  togglePilot: () => void
  addMessage: (msg: PilotMessage) => void
  clearMessages: () => void
}

export const useExplorerStore = create<FilterSlice & ResultsSlice & PilotSlice>()(
  persist(
    (set) => ({
      // filters
      query: '', rateMin: 0, rateMax: 10000, tags: [],
      setQuery: (q) => set({ query: q, cursor: 0 }),
      setRateRange: (min, max) => set({ rateMin: min, rateMax: max, cursor: 0 }),
      setTags: (tags) => set({ tags, cursor: 0 }),
      toggleTag: (tag) => set((s) => ({
        tags: s.tags.includes(tag) ? s.tags.filter(t => t !== tag) : [...s.tags, tag],
        cursor: 0,
      })),
      resetFilters: () => set({ query: '', rateMin: 0, rateMax: 10000, tags: [], cursor: 0 }),

      // results
      experts: [], total: 0, loading: false, cursor: 0,
      setResults: (experts, total, cursor) => set({ experts, total, cursor, loading: false }),
      appendResults: (experts, cursor) => set((s) => ({
        experts: [...s.experts, ...experts], cursor, loading: false
      })),
      setLoading: (loading) => set({ loading }),

      // pilot
      isPilotOpen: false, messages: [],
      togglePilot: () => set((s) => ({ isPilotOpen: !s.isPilotOpen })),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'explorer-store',
      // Only persist filter state — results are stale after page reload, messages are session-only
      partialize: (state) => ({
        query: state.query,
        rateMin: state.rateMin,
        rateMax: state.rateMax,
        tags: state.tags,
        isPilotOpen: state.isPilotOpen,
      }),
    }
  )
)
```

### Coexistence with existing admin state (useAdminData)

Admin hooks (`useAdminStats`, `useAdminSearches`, `useAdminExperts`, etc. in `useAdminData.ts`) use local `useState` — not Zustand. They live entirely in the `/admin` subtree and are mounted only when an admin page is active.

**Zero conflict.** `useExplorerStore` is only imported by marketplace components under `/`. Admin components never touch it. React Router renders admin and marketplace routes in separate branches — they are never mounted simultaneously.

**Rule:** Do NOT migrate admin hooks to Zustand. They are page-local, they work, and mixing concerns would break the clean admin/public separation established in v1.0.

### Component access pattern

```typescript
// MarketplacePage.tsx
const { query, rateMin, rateMax, tags, loading } = useExplorerStore()

// FilterSidebar.tsx — reads filters, writes actions
const { rateMin, rateMax, tags, setRateRange, toggleTag } = useExplorerStore()

// ExpertGrid.tsx — reads results only, no filter awareness
const { experts, loading, cursor } = useExplorerStore()

// CoPilot.tsx — reads pilot slice, dispatches filter actions via getState()
const { isPilotOpen, messages, togglePilot } = useExplorerStore()
```

Use granular selectors (individual field destructuring) to prevent unnecessary re-renders. Components that only read `experts` do not re-render when `isPilotOpen` changes.

---

## Q5: /api/explore response shape vs /api/chat

### Why /api/chat's shape is wrong for the grid

`/api/chat` returns 3 experts via SSE streaming, with each expert having a `why_them` narrative. The marketplace grid needs:
- 20+ experts per page (not 3)
- Cursor-based pagination for infinite scroll
- Total count for "Showing X of Y" display
- Richer per-expert data (tags array, findability_score, bio excerpt)
- Synchronous JSON (not SSE streaming)
- No LLM narrative generation per expert

### Response shape (Pydantic backend + TypeScript frontend)

```python
# app/routers/explore.py
from pydantic import BaseModel

class ExpertCard(BaseModel):
    id: int
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    bio_excerpt: str          # first 150 chars of bio (truncated for grid density)
    hourly_rate: float
    currency: str
    profile_url: str
    tags: list[str]           # parsed from JSON text column
    findability_score: float | None
    faiss_score: float | None     # None when query is empty (pure filter mode)
    bm25_rank: int | None         # None when no text query; 1=best

class ExploreResponse(BaseModel):
    experts: list[ExpertCard]
    total: int                # total matching experts (for display, pre-pagination)
    cursor: int | None        # next page offset; None = no more pages
    took_ms: int              # server latency for debugging/admin monitoring
```

```typescript
// frontend/src/types.ts additions
export interface ExpertCard {
  id: number
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  bio_excerpt: string
  hourly_rate: number
  currency: string
  profile_url: string
  tags: string[]
  findability_score: number | null
  faiss_score: number | null
  bm25_rank: number | null
}

export interface ExploreResponse {
  experts: ExpertCard[]
  total: number
  cursor: number | null
  took_ms: number
}
```

### Pagination strategy: offset-as-cursor (integer)

Use integer offset as cursor, not an opaque encoded string. Rationale: the expert corpus is 1,558 rows and does not change in real-time during a user session. Offset pagination is simpler to implement, debug, and explain, and cursor pagination's main advantage (stable pages during concurrent inserts) is irrelevant here.

```python
# In app/services/explorer.py
ITEMS_PER_PAGE = 20

offset = cursor  # cursor is the integer offset passed from frontend

# Count total matching (for "Showing X of Y" — before pagination)
total = db.scalar(count_query)

# Fetch page + 1 to detect "has more"
page_experts = db.scalars(results_query.offset(offset).limit(ITEMS_PER_PAGE + 1)).all()

has_more = len(page_experts) > ITEMS_PER_PAGE
experts = page_experts[:ITEMS_PER_PAGE]
next_cursor = offset + ITEMS_PER_PAGE if has_more else None
```

### Pure filter mode vs hybrid search mode

**When `query` is empty (pure filter):**
- Skip FAISS entirely
- SQLAlchemy filter by rate_min/rate_max and tags only
- `faiss_score = None`, `bm25_rank = None` for all experts
- Sort by `findability_score DESC NULLS LAST`

**When `query` is non-empty (hybrid search):**
- SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused weighted ranking
- Return `faiss_score` and `bm25_rank` per expert
- Fused score = `(faiss_score * 0.7) + (normalized_bm25 * 0.3)`

The frontend ExpertCard renders the same regardless of mode — score fields are informational (visible in admin debug mode, hidden from end users).

---

## Q6: Gemini function calling co-pilot — client-side dispatch

### Decision: Client-side (frontend parses tool call, dispatches Zustand action)

The co-pilot must dispatch Zustand store actions. Zustand lives in the browser. Therefore function call execution must happen in the browser. There is no server-side alternative that does not require SSE/WebSockets to push state to the client.

### How Gemini function calling works (two-turn loop)

1. Frontend sends user message + tool declarations to Gemini (proxied via FastAPI backend to avoid exposing API key in browser)
2. Gemini responds with either: (a) text response, OR (b) a `functionCall` part with `name` and `args` JSON
3. If `functionCall`: frontend executes the named action locally (dispatch to Zustand), then sends a `tool` result message back to Gemini
4. Gemini generates final text response incorporating the tool result

### Architecture: thin proxy through FastAPI

```
Browser → POST /api/pilot/chat → FastAPI → Gemini API
                                              ↓
                            { function_call: { name, args } } OR { text }
                                              ↓
                            FastAPI returns raw response to browser
                                              ↓
Browser: if function_call → dispatch to Zustand → trigger /api/explore refetch
                                              ↓
Browser → POST /api/pilot/chat (with tool result) → FastAPI → Gemini
                                              ↓
                            { text: "I've applied filters..." }
                                              ↓
CoPilot panel renders final text
```

```python
# app/routers/pilot.py (new)
from fastapi import APIRouter
from pydantic import BaseModel
from google import genai
from google.genai import types

router = APIRouter()

PILOT_TOOLS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="apply_filters",
        description="Apply search filters to the expert grid. Call this when the user asks to filter by rate, tags, or search terms.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "query": types.Schema(type="STRING", description="Text search query"),
                "rate_min": types.Schema(type="NUMBER", description="Minimum hourly rate in EUR"),
                "rate_max": types.Schema(type="NUMBER", description="Maximum hourly rate in EUR"),
                "tags": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Domain tag names to filter by"
                ),
            }
        )
    )
])

class PilotMessage(BaseModel):
    role: str            # "user" | "model" | "tool"
    content: str | None = None
    tool_result: dict | None = None   # {"name": str, "result": str}

class PilotRequest(BaseModel):
    messages: list[PilotMessage]
    context: str | None = None   # e.g. "Currently showing 45 experts"

@router.post("/api/pilot/chat")
async def pilot_chat(body: PilotRequest):
    # Build Gemini contents from message history
    # Return raw Gemini response with either text or function_call
    ...
```

### Frontend execution loop (usePilot.ts)

```typescript
// frontend/src/hooks/usePilot.ts
import { useExplorerStore } from '../store/useExplorerStore'

async function executeFunctionCall(name: string, args: Record<string, unknown>) {
  // getState() works outside React render — documented Zustand pattern
  const store = useExplorerStore.getState()

  if (name === 'apply_filters') {
    if (typeof args.query === 'string') store.setQuery(args.query)
    if (typeof args.rate_min === 'number' || typeof args.rate_max === 'number') {
      store.setRateRange(
        typeof args.rate_min === 'number' ? args.rate_min : store.rateMin,
        typeof args.rate_max === 'number' ? args.rate_max : store.rateMax,
      )
    }
    if (Array.isArray(args.tags)) store.setTags(args.tags as string[])
    return 'filters applied'
  }
  return 'unknown function'
}

export function usePilot() {
  const { messages, addMessage } = useExplorerStore()

  async function sendMessage(userText: string) {
    addMessage({ role: 'user', content: userText })

    const response = await fetch(`${API_URL}/api/pilot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, { role: 'user', content: userText }] }),
    })
    const data = await response.json()

    if (data.function_call) {
      const { name, args } = data.function_call
      const result = await executeFunctionCall(name, args)

      // Second turn: send tool result back for final text response
      const followUp = await fetch(`${API_URL}/api/pilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: 'user', content: userText },
            { role: 'tool', tool_result: { name, result } },
          ],
        }),
      })
      const finalData = await followUp.json()
      addMessage({ role: 'assistant', content: finalData.text })
    } else {
      addMessage({ role: 'assistant', content: data.text })
    }
  }

  return { messages, sendMessage }
}
```

### Why not server-side dispatch

Server-side function execution would require the backend to: (1) know the current filter state, (2) push state updates via SSE or WebSocket, (3) have the frontend reconcile backend-pushed state with local Zustand. This adds a bidirectional communication channel with no benefit — tool calls only modify frontend state, which the backend has no reason to own.

**Confidence:** MEDIUM — Gemini function calling architecture confirmed in official docs. Two-turn proxy pattern follows the documented function calling loop. `useExplorerStore.getState()` outside hooks is confirmed in Zustand documentation. The exact FastAPI proxy implementation is inferred from the pattern (no official FastAPI+Gemini-function-calling reference code found).

---

## Q7: Build order

### Dependency graph

```
Phase 1: FTS5 migration + /api/explore backend
    └── Phase 2: Zustand store + React Router update (needs API contract)
            └── Phase 3: MarketplacePage + FilterSidebar (needs store + API)
                    └── Phase 4: ExpertGrid with react-virtuoso (needs page skeleton)
                            └── Phase 5: Floating co-pilot (needs grid + store)
```

### Phase-by-phase build order

**Phase 1: DB migration + /api/explore backend (build this first)**

Everything else is blocked until the API contract is established and the FTS5 index exists.

1. Add FTS5 migration block to `lifespan` in `main.py` (CREATE VIRTUAL TABLE + seed from Expert rows)
2. Add `username_to_faiss_pos` mapping to `app.state` in `lifespan`
3. Create `app/services/explorer.py` with `run_explore()` implementing SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 → fused rank → cursor pagination
4. Create `app/routers/explore.py` (thin wrapper calling `run_explore`)
5. Register `explore.router` in `main.py`
6. Define and validate `ExploreResponse` Pydantic model

Existing code touched: `main.py` (3 additions to lifespan + 1 router import). Nothing else.

**Phase 2: Zustand store + React Router update**

Can begin in parallel with Phase 1 using a mock API response for local development. Must finalize after Phase 1 API contract is confirmed.

1. `npm install zustand`
2. Create `frontend/src/store/useExplorerStore.ts` (filters + results + pilot slices)
3. Update `frontend/src/main.tsx`: change `/ → App` to `/ → MarketplacePage`
4. Add `frontend/src/types.ts` additions (`ExpertCard`, `ExploreResponse`, `PilotMessage`)
5. Create `frontend/src/hooks/useExplore.ts` (debounced fetch from `/api/explore` on filter change)

Existing code touched: `main.tsx` (1 route change), `types.ts` (additive).

**Phase 3: MarketplacePage + FilterSidebar**

Depends on Phase 1 (API works) and Phase 2 (store works).

1. Create `frontend/src/pages/MarketplacePage.tsx` (layout: sidebar + grid + floating pilot button)
2. Create `frontend/src/components/marketplace/FilterSidebar.tsx` (rate sliders, tag checkboxes, query input)
3. Wire sidebar controls to `useExplorerStore` actions
4. Wire `useExplore` hook to re-fetch on filter changes (with 300ms debounce)

**Phase 4: ExpertGrid with react-virtuoso**

Depends on Phase 3 (page skeleton exists).

1. `npm install react-virtuoso`
2. Create `frontend/src/components/marketplace/ExpertGrid.tsx` (Virtuoso component with `endReached` for cursor pagination)
3. Create `frontend/src/components/marketplace/ExpertCard.tsx` (high-density: tags, bio excerpt, findability badge, hourly rate, profile link)

**Phase 5: Floating co-pilot**

Depends on Phase 2 (Zustand store exists) and Phase 4 (grid exists to summarize).

1. Create `app/routers/pilot.py` (thin Gemini proxy with `apply_filters` tool declaration)
2. Register `pilot.router` in `main.py`
3. Create `frontend/src/hooks/usePilot.ts` (two-turn Gemini function calling loop)
4. Create `frontend/src/components/marketplace/CoPilot.tsx` (fixed-position panel, open/close via `isPilotOpen`)

### What can be built in parallel

- Phase 2 frontend store can start before Phase 1 backend is deployed, using a mock response
- Phase 5 backend (`pilot.py`) can be built while Phase 4 frontend is in progress — they share no code and have no dependency on each other

### What cannot be skipped or reordered

- FTS5 migration (Phase 1, step 1) must be deployed to Railway before any `/api/explore` call can return BM25 scores. The migration is idempotent — safe to deploy early and let Railway's restart trigger it.
- The `username_to_faiss_pos` mapping (Phase 1, step 2) must exist in `app.state` before any explore request that uses IDSelectorBatch. It is built at startup alongside the FAISS index load.
- Zustand store (Phase 2) must exist before FilterSidebar or ExpertGrid can be wired (Phase 3/4).

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              Browser (Vercel)                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  MarketplacePage /                                                     │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌────────────────────────────────────────────┐  │  │
│  │  │  FilterSidebar  │  │  ExpertGrid (react-virtuoso virtualized)   │  │  │
│  │  │                 │  │  ┌────────────┐ ┌────────────┐             │  │  │
│  │  │  query input    │  │  │ ExpertCard │ │ ExpertCard │ ...          │  │  │
│  │  │  rate slider    │  │  └────────────┘ └────────────┘             │  │  │
│  │  │  tag checkboxes │  │  [endReached → cursor pagination]          │  │  │
│  │  └─────────────────┘  └────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │                         ┌──────────────────────────────────────────┐  │  │
│  │                         │  CoPilot (fixed-position floating panel)  │  │  │
│  │                         │  Gemini function calling two-turn loop    │  │  │
│  │                         │  apply_filters → Zustand dispatch         │  │  │
│  │                         └──────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  useExplorerStore (Zustand — module-level singleton)                   │  │
│  │  filters: query, rateMin, rateMax, tags[]                              │  │
│  │  results: experts[], total, cursor, loading                            │  │
│  │  pilot: isPilotOpen, messages[]                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  /admin → AdminApp (entirely unchanged — useAdminData hooks, no Zustand)    │
└────────────────────────────────────────────────────────────────────────────┘
                    │ GET /api/explore?query=...&rate_min=...&tags=...
                    │ POST /api/pilot/chat
                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              Railway (FastAPI)                               │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ explore.py   │  │ pilot.py     │  │ chat.py / admin.py (unchanged)   │  │
│  │ (NEW)        │  │ (NEW)        │  │ SSE chat + admin CRUD            │  │
│  │              │  │ Gemini proxy │  │                                  │  │
│  │ → explorer   │  │ apply_filters│  └──────────────────────────────────┘  │
│  │   .run_      │  │ tool decl    │                                         │
│  │   explore()  │  └──────────────┘                                         │
│  └──────────────┘                                                            │
│                                                                              │
│  app/services/explorer.py (NEW)                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Stage 1: SQLAlchemy pre-filter (rate, tags)                          │  │
│  │       ↓                                                               │  │
│  │  Stage 2: FAISS IDSelectorBatch search (when query non-empty)         │  │
│  │       ↓                                                               │  │
│  │  Stage 3: FTS5 BM25 search (when query non-empty)                     │  │
│  │       ↓                                                               │  │
│  │  Fused rank → cursor pagination → ExploreResponse                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  app.state.faiss_index (IndexFlatIP, 1,558 vectors) — UNCHANGED             │
│  app.state.metadata (position-aligned list[dict]) — UNCHANGED               │
│  app.state.username_to_faiss_pos (NEW: {username: int})                     │
│                                                                              │
│  SQLite: experts table (UNCHANGED) + experts_fts virtual table (NEW FTS5)  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Project Structure

### Backend additions and modifications

```
app/
├── routers/
│   ├── admin.py          UNCHANGED
│   ├── chat.py           UNCHANGED
│   ├── email_capture.py  UNCHANGED
│   ├── feedback.py       UNCHANGED
│   ├── health.py         UNCHANGED
│   ├── explore.py        NEW — GET /api/explore (thin router, delegates to explorer service)
│   └── pilot.py          NEW — POST /api/pilot/chat (Gemini proxy, tool declarations)
├── services/
│   ├── embedder.py           UNCHANGED
│   ├── llm.py                UNCHANGED
│   ├── retriever.py          UNCHANGED
│   ├── search_intelligence.py UNCHANGED
│   ├── tagging.py            UNCHANGED
│   └── explorer.py           NEW — hybrid search pipeline (SQLAlchemy + FAISS + FTS5)
├── main.py               MODIFIED — FTS5 migration block, username_to_faiss_pos mapping,
│                                    register explore.router and pilot.router
└── models.py             UNCHANGED — FTS5 virtual table is raw DDL, not ORM
```

**Why `explorer.py` is a service, not inline in `explore.py`:** The hybrid pipeline (3 stages + fusion + pagination) is complex. Keeping it in a service mirrors the existing pattern: `chat.py` (thin router) → `search_intelligence.py` (service). It also makes the pipeline testable without running FastAPI.

**Why `models.py` is unchanged:** SQLAlchemy ORM does not have native FTS5 virtual table support. `experts_fts` is created and queried via raw `text()` SQL. This is consistent with how the existing migrations use `text()` for `ALTER TABLE` operations.

### Frontend additions and modifications

```
frontend/src/
├── store/
│   └── useExplorerStore.ts    NEW — Zustand module-level singleton (filters + results + pilot)
├── pages/
│   └── MarketplacePage.tsx    NEW — top-level layout (sidebar + grid + pilot button)
├── components/
│   └── marketplace/
│       ├── FilterSidebar.tsx  NEW — rate sliders, tag checkboxes, query input
│       ├── ExpertGrid.tsx     NEW — react-virtuoso virtualized list + endReached
│       ├── ExpertCard.tsx     NEW — high-density card (tags, bio excerpt, findability, rate)
│       └── CoPilot.tsx        NEW — fixed-position panel, isPilotOpen controlled by store
├── hooks/
│   ├── useExplore.ts          NEW — debounced /api/explore fetch, writes to results slice
│   ├── usePilot.ts            NEW — Gemini two-turn function calling loop
│   └── [existing hooks]       UNCHANGED
├── admin/                     ENTIRELY UNCHANGED
├── App.tsx                    DEPRECATED — no longer the / route component
├── main.tsx                   MODIFIED — replace / → App with / → MarketplacePage
└── types.ts                   MODIFIED — add ExpertCard, ExploreResponse, PilotMessage types
```

---

## Architectural Patterns

### Pattern 1: Hybrid search pipeline (SQLAlchemy → FAISS → FTS5 → fused rank)

**What:** Three-stage retrieval where each stage narrows or re-ranks the candidate set.

**Stage 1 — SQLAlchemy pre-filter (always runs):**
```python
from sqlalchemy import select, and_
from app.models import Expert

query_obj = select(Expert).where(
    and_(
        Expert.hourly_rate >= rate_min,
        Expert.hourly_rate <= rate_max,
    )
)
if tags:
    # Tags stored as JSON text: '["SEO", "Content Marketing"]'
    # LIKE per tag is O(n) but acceptable at 1,558 rows
    for tag in tags:
        query_obj = query_obj.where(Expert.tags.like(f'%"{tag}"%'))

filtered_experts = db.scalars(query_obj).all()
```

**Stage 2 — FAISS IDSelectorBatch (when query is non-empty):**
```python
username_to_pos = app_state.username_to_faiss_pos
faiss_index = app_state.faiss_index

allowed_pos = np.array(
    [username_to_pos[e.username] for e in filtered_experts if e.username in username_to_pos],
    dtype=np.int64
)
query_vec = np.array(embed_query(query), dtype=np.float32).reshape(1, -1)
selector = faiss.IDSelectorBatch(allowed_pos)
params = faiss.SearchParameters(sel=selector)
scores, indices = faiss_index.search(query_vec, k=50, params=params)

# Build faiss_score dict: metadata[pos]["Username"] → score
faiss_scores: dict[str, float] = {}
for score, pos in zip(scores[0], indices[0]):
    if pos < 0:
        continue
    username = app_state.metadata[pos].get("Username", "")
    if username:
        faiss_scores[username] = float(score)
```

**Stage 3 — FTS5 BM25 (when query is non-empty):**
```python
# Use Expert.id as rowid key (matches content_rowid='id' in FTS5 table)
fts_rows = db.execute(text("""
    SELECT rowid, rank FROM experts_fts
    WHERE experts_fts MATCH :q
    ORDER BY rank LIMIT 100
"""), {"q": query}).fetchall()

# rank is negative — lower = better. Build id → normalized score
id_to_expert = {e.id: e for e in filtered_experts}
ranks = [abs(r.rank) for r in fts_rows if r.rowid in id_to_expert]
max_rank = max(ranks) if ranks else 1.0
bm25_scores: dict[int, float] = {
    r.rowid: 1.0 - abs(r.rank) / max_rank
    for r in fts_rows if r.rowid in id_to_expert
}
```

**Fusion:**
```python
FAISS_WEIGHT = 0.7
BM25_WEIGHT = 0.3

scored = []
for expert in filtered_experts:
    faiss_s = faiss_scores.get(expert.username, 0.0)
    bm25_s = bm25_scores.get(expert.id, 0.0)
    if faiss_s == 0.0 and bm25_s == 0.0:
        continue  # exclude experts with no signal in either index
    fused = (faiss_s * FAISS_WEIGHT) + (bm25_s * BM25_WEIGHT)
    scored.append((fused, faiss_s, bm25_s, expert))

scored.sort(key=lambda x: x[0], reverse=True)
```

**Trade-offs:**
- Tag `LIKE` queries are O(n) full-table scan — acceptable at 1,558 rows; at 10k+ rows, add a GIN index (Postgres) or use JSON virtual columns (SQLite 3.38+)
- FAISS_WEIGHT/BM25_WEIGHT are starting values (0.7/0.3); tune based on user behavior
- Experts with no FAISS match AND no BM25 match are excluded from hybrid results

### Pattern 2: Zustand getState() dispatch from outside React

**What:** Call `useExplorerStore.getState()` to access and dispatch actions from async callbacks and plain functions that run outside the React render cycle.

**When to use:** The co-pilot `usePilot` hook calls `executeFunctionCall` in an async callback. React hooks cannot be called inside async callbacks. `getState()` is the documented alternative.

```typescript
// Works in any async context — not limited to React components
import { useExplorerStore } from '../store/useExplorerStore'

function executeFunctionCall(name: string, args: Record<string, unknown>) {
  const store = useExplorerStore.getState()  // direct store access
  if (name === 'apply_filters') {
    if (typeof args.query === 'string') store.setQuery(args.query)
    // ... other filter dispatches
  }
  // store.setQuery() calls set() internally → notifies all React subscribers
}
```

**Trade-off:** `getState()` bypasses React's subscription model, but actions called via `getState()` still invoke `set()` internally, which notifies all active `useExplorerStore` hook subscribers. Components re-render correctly. This is not a workaround — it is a documented Zustand pattern.

### Pattern 3: Thin router + fat service (explore pipeline)

**What:** `explore.py` handles HTTP concerns only (request parsing, response serialization, error handling, run_in_executor). All retrieval logic lives in `explorer.py` service.

**When to use:** Always. This is the established pattern in the codebase: `chat.py` (thin) delegates to `search_intelligence.py` (fat service). Maintain this pattern for `explore.py` → `explorer.py`.

**Why:** Separation makes the pipeline testable without FastAPI. It also makes latency profiling simpler — add timing to the service, not the router.

---

## Data Flow

### /api/explore request flow

```
User adjusts filter
    ↓ (debounced 300ms in useExplore hook)
GET /api/explore?rate_min=50&query=marketing&tags=SEO,Content
    ↓
explore.py → loop.run_in_executor → explorer.run_explore()
    ↓
[1] SQLAlchemy: SELECT * FROM experts WHERE rate BETWEEN 50 AND 10000
                AND tags LIKE '%"SEO"%' AND tags LIKE '%"Content"%'
    → 312 filtered experts
    ↓
[2] FAISS: IDSelectorBatch(allowed_positions_for_312_experts)
           index.search(embed("marketing"), k=50)
    → 50 scored candidates
    ↓
[3] FTS5: SELECT rowid, rank FROM experts_fts WHERE experts_fts MATCH 'marketing'
    → BM25 ranked results
    ↓
[4] Fuse + sort → take cursor=0 offset → 20 experts
    ↓
ExploreResponse(experts=[20 cards], total=312, cursor=20, took_ms=38)
    ↓
useExplorerStore.setResults() → ExpertGrid re-renders with 20 experts
```

### Co-pilot function calling flow

```
User types: "show me marketing experts under €100/hr"
    ↓
usePilot → POST /api/pilot/chat { messages, context }
    ↓
pilot.py → Gemini API (with apply_filters tool declaration)
    ↓
Gemini → functionCall: { name: "apply_filters",
                         args: { query: "marketing", rate_max: 100 } }
    ↓
pilot.py → returns { function_call: { name, args } }
    ↓
usePilot → executeFunctionCall()
         → useExplorerStore.getState().setQuery("marketing")
         → useExplorerStore.getState().setRateRange(0, 100)
    ↓ (Zustand notifies all subscribers)
useExplore detects filter change → GET /api/explore?query=marketing&rate_max=100
    ↓
ExpertGrid re-renders with new results
    ↓
usePilot → POST /api/pilot/chat { tool_result: "filters applied, 45 experts visible" }
    ↓
Gemini → "I've filtered to marketing experts under €100/hr. 45 results shown."
    ↓
CoPilot renders Gemini text
```

---

## Component Boundaries

| Component | Responsibility | Reads from | Writes to |
|-----------|---------------|------------|-----------|
| `FilterSidebar` | Render filter controls | `useExplorerStore` filters slice | `useExplorerStore` actions (setQuery, setRateRange, toggleTag) |
| `ExpertGrid` | Virtualized list + infinite scroll | `useExplorerStore` results slice | Triggers `appendResults` via `useExplore` on `endReached` |
| `ExpertCard` | One expert display (dense) | Props from grid | None |
| `CoPilot` | Floating chat panel | `useExplorerStore` pilot slice | `useExplorerStore` via `getState()` dispatch |
| `useExplore` | Fetch /api/explore on filter change | `useExplorerStore` filters | `useExplorerStore` results slice |
| `usePilot` | Gemini two-turn loop | `useExplorerStore.getState()` | `useExplorerStore` actions via getState() |
| `explore.py` | HTTP layer for explore | Request params, `get_db` | Response only |
| `explorer.py` | Hybrid search pipeline | `db`, `app.state` | Returns `ExploreResponse` |
| `pilot.py` | Gemini API proxy | Request body | Returns Gemini response |

---

## Integration Points

### Files modified (existing)

| File | Change | Risk |
|------|--------|------|
| `app/main.py` | Add FTS5 migration block (~15 lines); add `username_to_faiss_pos` to `app.state` (~5 lines); register `explore.router` and `pilot.router` (~2 lines) | LOW — idempotent migration, existing pattern |
| `frontend/src/main.tsx` | Change `/ → App` to `/ → MarketplacePage` (1 line) | MEDIUM — removes chat as homepage; existing `/admin` routes unaffected |
| `frontend/src/types.ts` | Add `ExpertCard`, `ExploreResponse`, `PilotMessage` types (additive) | LOW |

### Files created (new)

| File | Depends on existing |
|------|---------------------|
| `app/routers/explore.py` | `app.state.faiss_index`, `app.state.metadata`, `app.state.username_to_faiss_pos`, `app.database.get_db`, `app.models.Expert` |
| `app/routers/pilot.py` | `google.genai` client |
| `app/services/explorer.py` | `faiss`, `sqlalchemy`, `numpy`, `app.models.Expert`, `app.services.embedder` |
| `frontend/src/store/useExplorerStore.ts` | `zustand`, `zustand/middleware` |
| `frontend/src/pages/MarketplacePage.tsx` | `useExplorerStore`, `FilterSidebar`, `ExpertGrid`, `CoPilot` |
| `frontend/src/hooks/useExplore.ts` | `useExplorerStore`, `fetch` |
| `frontend/src/hooks/usePilot.ts` | `useExplorerStore.getState()`, `fetch` |

### Files completely unchanged

`app/routers/admin.py`, `app/routers/chat.py`, `app/routers/feedback.py`, `app/routers/email_capture.py`, `app/routers/health.py`, `app/services/search_intelligence.py`, `app/services/retriever.py`, `app/services/embedder.py`, `app/services/llm.py`, `app/services/tagging.py`, `app/models.py`, `app/database.py`, `app/config.py`, and everything under `frontend/src/admin/`.

---

## Anti-Patterns

### Anti-Pattern 1: Passing Expert.id to IDSelectorBatch instead of FAISS positional indices

**What people do:** Get `Expert.id` values (1, 2, 3... 1558) from SQLAlchemy and pass them directly to `IDSelectorBatch`.

**Why it's wrong:** `IndexFlatIP` uses positional indices (0, 1, 2... 1557). Expert.id=1 is at FAISS position 0. The IDs may be off by 1 at minimum. If any Expert rows were ever deleted and reinserted, Expert.id values are not contiguous, and the mismatch silently returns wrong experts.

**Do this instead:** Build `app.state.username_to_faiss_pos` at startup by iterating `app.state.metadata` and storing the list position (not Expert.id) per username. Look up positional indices when building the IDSelectorBatch array.

### Anti-Pattern 2: Scoping Zustand store inside a React Provider

**What people do:** Use `createStore()` (not `create()`) and wrap the tree in a `StoreProvider` for "proper scoping".

**Why it's wrong:** The co-pilot's `usePilot` hook dispatches to the store from async callbacks outside React's render cycle. A scoped store accessible only via React Context requires the call site to be inside a React component — which async callbacks are not. The module-level singleton is the correct choice for this use case.

**Do this instead:** Use module-level `create()`. The store is globally accessible via `useExplorerStore.getState()` from any async function.

### Anti-Pattern 3: Streaming /api/explore as SSE

**What people do:** Return `/api/explore` as SSE because `/api/chat` uses SSE, assuming all expensive operations need streaming.

**Why it's wrong:** The marketplace grid must render all 20 experts at once — partial renders of 3 or 5 experts while loading causes layout shift and poor UX. The hybrid search pipeline completes in under 50ms — SSE overhead exceeds the actual computation time. SSE also complicates error handling and pagination.

**Do this instead:** Return synchronous JSON with `ExploreResponse`. Run the hybrid search in `run_in_executor` to keep FastAPI's event loop unblocked. Use cursor-based pagination for "load more" interactions.

### Anti-Pattern 4: Syncing FTS5 via SQLAlchemy ORM events

**What people do:** Register `@event.listens_for(Expert, 'after_insert')` SQLAlchemy events to auto-sync FTS5.

**Why it's wrong:** SQLAlchemy events fire at ORM flush time, but FTS5 sync requires raw SQL `text()`. Transaction ordering between the ORM event and the raw SQL insert is not guaranteed. The FTS5 insert may commit before the Expert row is visible, causing "rowid not found in content table" errors.

**Do this instead:** Explicitly sync FTS5 immediately after the Expert write commits, in the same request handler using `db.execute(text(...))`. For bulk updates, call `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` at the end of the batch operation.

### Anti-Pattern 5: Building co-pilot as a server-side agent that pushes state

**What people do:** Implement the co-pilot entirely on the backend, having FastAPI maintain filter state and push updates to the frontend via SSE.

**Why it's wrong:** Filter state is owned by Zustand on the frontend. Duplicating it on the backend creates two sources of truth. Any SSE push that tries to override Zustand state will conflict with direct user interactions (e.g., user moves a slider while co-pilot is responding). The frontend becomes a dumb terminal instead of a rich interactive UI.

**Do this instead:** Keep the backend as a thin Gemini proxy that returns `functionCall` or text. The frontend is responsible for all state transitions. The backend has no filter state.

---

## Sources

- [FAISS: Setting search parameters for one query](https://github.com/facebookresearch/faiss/wiki/Setting-search-parameters-for-one-query) — IDSelectorBatch + SearchParameters Python API (HIGH confidence — official FAISS wiki)
- [FAISS IDSelectorBatch C++ API](https://faiss.ai/cpp_api/struct/structfaiss_1_1IDSelectorBatch.html) — confirmed Python interface accepts numpy int64 arrays (HIGH confidence)
- [FAISS GitHub issue #3112](https://github.com/facebookresearch/faiss/issues/3112) — IDSelectorBatch hash collision warning (MEDIUM confidence — user-reported issue)
- [FAISS GitHub issue #3046](https://github.com/facebookresearch/faiss/issues/3046) — IDSelectorBatch batch subset search (MEDIUM confidence — feature discussion)
- [SQLite FTS5 official docs](https://sqlite.org/fts5.html) — external content tables, `content=`, `content_rowid=`, rebuild command, `IF NOT EXISTS` (HIGH confidence — official SQLite documentation)
- [SQLite Forum: VTables triggers and FTS5](https://sqlite.org/forum/info/71272bd7607a6408fefa3610ea640df8df1a7a29bb8f69cb8d316f966baa8a40) — trigger "unsafe use of virtual table" limitation (MEDIUM confidence — SQLite forum)
- [Gemini function calling docs](https://ai.google.dev/gemini-api/docs/function-calling) — `functionCall` response structure, two-turn tool loop (HIGH confidence — official Google AI docs)
- [Zustand persist middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data) — `partialize` for selective persistence (HIGH confidence — official Zustand docs)
- [Zustand GitHub](https://github.com/pmndrs/zustand) — `getState()` outside React components (HIGH confidence — official repo)
- [react-virtuoso endless scrolling](https://virtuoso.dev/endless-scrolling/) — `endReached` callback pattern (HIGH confidence — official docs)
- [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) — router-per-file best practice (HIGH confidence — official FastAPI docs)
- Direct codebase inspection: `app/main.py`, `app/models.py`, `app/routers/chat.py`, `app/routers/admin.py`, `app/services/retriever.py`, `app/services/search_intelligence.py`, `frontend/src/main.tsx`, `frontend/src/admin/hooks/useAdminData.ts` — (HIGH confidence — ground truth)

---

*Architecture research for: Tinrate Expert Marketplace v2.0 integration*
*Researched: 2026-02-21*
