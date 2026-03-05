# Architecture Research: v5.4 Launch Hardening

**Domain:** Expert Marketplace SPA — launch hardening integration
**Researched:** 2026-03-05
**Confidence:** HIGH — all findings from direct codebase inspection of v5.3 source
**Scope:** v5.4 feature integration only. Existing v5.3 system is ground truth. Only deltas documented.

---

## Context: v5.3 Ground Truth (verified by file inspection)

```
EVENT TRACKING PIPELINE  (current — synchronous per-event)
  Frontend: trackEvent() in frontend/src/tracking.ts
    - Fire-and-forget void fetch + keepalive:true
    - Each call = one POST /api/events HTTP request
    - 5 call sites: ExpertCard (card_click), useExplore (search_query),
      filter handlers (filter_change), bookmark toggle (save)
    - Reads session_id from localStorage, email from nltrStore

  Backend: POST /api/events in app/routers/events.py
    - Synchronous DB write per request (db.add + db.commit)
    - Returns 202 Accepted
    - No rate limiting or batching

HEALTH ENDPOINT  (current — minimal)
  app/routers/health.py: GET /api/health
    Returns: { "status": "ok", "index_size": <int> }
    No DB check, no memory check, no latency metrics

ADMIN /experts ENDPOINT  (current — unbounded)
  app/routers/admin/experts.py: GET /api/admin/experts
    Returns: { "experts": [all experts serialized] }
    No pagination — full table dump every request
    At ~530 experts: ~2-3MB JSON payload per admin page load
    Sentry large-payload alert already triggered

FRONTEND BUNDLE  (current — partially split)
  vite.config.ts manualChunks:
    - vendor-charts: recharts
    - vendor-table: @tanstack/react-table
  Admin: all 11 components lazy-loaded (React.lazy + Suspense)
  Public explorer bundle: NOT split beyond admin/public separation
  Motion library: motion/react (v12) — full bundle included in public chunk

META TAGS  (current — static HTML only)
  frontend/index.html:
    - <title>Tinrate — Find the right expert, instantly</title>
    - og:title, og:description, og:image, og:url (static hardcoded)
    - twitter:card, twitter:title, twitter:description, twitter:image
    - NO: description meta tag, NO: canonical, NO: JSON-LD structured data

ANALYTICS  (current — multiple systems, fire-and-forget)
  GA4: window.gtag() in index.html + Analytics component in RootLayout
    - send_page_view:false — React Analytics component handles ALL page_view events
    - Admin routes excluded via send_page_view:false pattern
  Microsoft Clarity: IIFE in index.html
    - Early return for /admin/* paths
    - Loads async, no React component needed
  Vercel Speed Insights: <SpeedInsights /> in App.tsx (chat page only)
    - NOT present in MarketplacePage.tsx (Explorer)
  User events: trackEvent() → POST /api/events (custom, in-DB)

RESILIENCE  (current — minimal)
  Error boundaries: NONE — uncaught React errors crash the whole app
  API error handling: EXP-06 (retry button on explore errors only)
  Health checks: GET /api/health (FAISS index_size only)
  Graceful degradation: no pattern for offline/API-down state

SQLITE WAL  (current — tuned)
  database.py: WAL mode + busy_timeout=5000ms on every connection
  Single Railway instance — concurrent writes via WAL reader/writer
  No connection pooling beyond SQLAlchemy SessionLocal
```

---

## System Overview (v5.3 → v5.4 Integration Map)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Vercel CDN (Frontend)                                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │ MarketplacePage│ │  RootLayout  │  │  AdminApp   │               │
│  │  [BOUNDARY]  │  │ [ANALYTICS+] │  │  (lazy)     │               │
│  └──────┬───────┘  └──────────────┘  └─────────────┘               │
│         │                                                            │
│  ┌──────▼───────┐  ┌──────────────┐  ┌─────────────┐               │
│  │  ExpertGrid  │  │  tracking.ts │  │ vite.config │               │
│  │  ExpertList  │  │ [BATCH QUEUE]│  │ [CHUNK SPLIT]│              │
│  │  ExpertCard  │  └──────────────┘  └─────────────┘               │
│  └──────────────┘                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Railway Single Instance (Backend)                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │  /api/explore│  │ /api/events  │  │/api/health  │               │
│  │  [CACHE]     │  │ [BATCH RECV] │  │ [ENHANCED]  │               │
│  └──────────────┘  └──────┬───────┘  └─────────────┘               │
│                            │                                         │
│  ┌──────────────────────── ▼ ──────────────────────────────────┐    │
│  │  SQLite WAL (conversations.db on Railway volume)             │    │
│  │  Tables: user_events [BATCH TARGET] / experts / leads / ...  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  FAISS index (in-memory)  +  metadata.json (in-memory)     │      │
│  └────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘

[BOUNDARY]     = new component needed
[ANALYTICS+]   = existing component modified
[BATCH QUEUE]  = tracking.ts modified (in-memory queue + flush timer)
[BATCH RECV]   = events.py modified (accept array body)
[CACHE]        = explore.py modified (TTL response cache)
[ENHANCED]     = health.py modified (DB + memory checks)
[CHUNK SPLIT]  = vite.config.ts modified (more manualChunks)
```

---

## Component Boundaries: New vs Modified

### NEW Components

| Component | File | Responsibility |
|-----------|------|---------------|
| ErrorBoundary | `frontend/src/components/ErrorBoundary.tsx` | Catch uncaught React render errors, show fallback UI |
| StructuredData | Inline in `frontend/index.html` or `MarketplacePage.tsx` | JSON-LD WebSite + Organization schema |

### MODIFIED Components

| Component | File | What Changes |
|-----------|------|-------------|
| `tracking.ts` | `frontend/src/tracking.ts` | Add in-memory queue + 3s flush timer + batch send |
| `POST /api/events` | `app/routers/events.py` | Accept `EventRequest | list[EventRequest]` body |
| `GET /api/explore` | `app/routers/explore.py` | Add in-memory TTL response cache keyed on query params |
| `GET /api/health` | `app/routers/health.py` | Add DB probe + memory metrics |
| `GET /api/admin/experts` | `app/routers/admin/experts.py` | Add `page` + `per_page` query params, return paginated slice |
| `vite.config.ts` | `frontend/vite.config.ts` | Add motion/framer, react-virtuoso chunks |
| `index.html` | `frontend/index.html` | Add `<meta name="description">`, canonical, JSON-LD |
| `MarketplacePage.tsx` | `frontend/src/pages/MarketplacePage.tsx` | Wrap content in ErrorBoundary |
| `RootLayout.tsx` | `frontend/src/layouts/RootLayout.tsx` | Ensure SpeedInsights present for Explorer |
| `main.tsx` | `frontend/src/main.tsx` | Wrap router in top-level ErrorBoundary |

---

## Feature Integration Details

### 1. Event Write Batching

**Problem:** Each of the 5 tracking call sites fires an individual HTTP request. Under load (10k concurrent users each triggering filter changes, searches, card clicks), this creates a write storm against SQLite WAL. WAL handles concurrent readers well but serializes all writers — a flood of 202 responses hides backend queueing.

**Current data flow:**
```
User action → trackEvent() → void fetch() → POST /api/events → db.add() + db.commit()
```

**New data flow:**
```
User action → trackEvent() → push to localQueue[]
                                    ↓
                          (timer every 3s OR queue >= 10)
                                    ↓
                          POST /api/events  { events: [...] }
                                    ↓
                          backend: bulk INSERT in single transaction
```

**Frontend change (tracking.ts):**
```typescript
// Module-level batch queue
const _queue: EventRequest[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null

function _scheduleFlush() {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flush()
    _flushTimer = null
  }, 3000)
}

function _flush() {
  if (_queue.length === 0) return
  const batch = _queue.splice(0, _queue.length)
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ events: batch }),
  })
}

export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  const email = getSubscriberEmail()
  _queue.push({ session_id, event_type, payload, email })
  if (_queue.length >= 10) _flush()
  else _scheduleFlush()
}
```

**Backend change (events.py):**
```python
class BatchEventRequest(BaseModel):
    events: list[EventRequest] = Field(..., min_length=1, max_length=50)

@router.post("/api/events", status_code=202)
def record_event(body: BatchEventRequest | EventRequest, db: Session = Depends(get_db)):
    items = body.events if isinstance(body, BatchEventRequest) else [body]
    records = [
        UserEvent(
            session_id=item.session_id,
            event_type=item.event_type,
            payload=json.dumps(item.payload),
            email=_validate_email(item.email),
        )
        for item in items
    ]
    db.add_all(records)
    db.commit()
    return {"status": "accepted", "count": len(records)}
```

**Integration notes:**
- `keepalive: true` on batched fetch ensures events survive page navigation
- Existing call sites unchanged — `trackEvent()` signature stays identical
- Backend union type `BatchEventRequest | EventRequest` maintains backward compat for any direct callers
- Flush on `beforeunload` window event needed for final batch: `window.addEventListener('beforeunload', _flush)`
- Single transaction for batch = one WAL write cycle instead of N

---

### 2. Response Caching (/api/explore)

**Problem:** `/api/explore` with `query=""` (initial load, no search) hits the same SQLAlchemy + FAISS + FTS5 pipeline repeatedly. With 10k users landing simultaneously, initial load causes N identical expensive queries. Each involves FAISS similarity search (CPU) + SQLite joins.

**What to cache:** Empty-query (browse mode) results are safe to cache — they change only when experts are added/deleted. Filtered results (tags, rate) are query-param specific. Search queries (non-empty) embed via Google API — caching saves real money.

**Current explore pipeline:**
```
GET /api/explore?query=&seed=12345
  → run_in_executor → run_explore()
    → SQLAlchemy rate/tag pre-filter
    → FAISS IDSelectorBatch (if query)
    → FTS5 BM25 fusion (if query)
    → findability sort / seeded random
  → ExploreResponse (JSON)
```

**Cache integration point (explore.py):**
```python
import hashlib, json, time

# Module-level TTL cache: cache_key → (response_dict, timestamp)
_explore_cache: dict[str, tuple[dict, float]] = {}
_EXPLORE_CACHE_TTL = 30.0  # seconds — tunable

def _make_cache_key(query, rate_min, rate_max, tags, industry_tags, limit, cursor, seed, usernames) -> str:
    parts = f"{query}|{rate_min}|{rate_max}|{sorted(tags)}|{sorted(industry_tags)}|{limit}|{cursor}|{seed}|{sorted(usernames or [])}"
    return hashlib.md5(parts.encode()).hexdigest()

@router.get("/api/explore", response_model=ExploreResponse)
async def explore(request: Request, db: Session = Depends(get_db), ...):
    cache_key = _make_cache_key(query, rate_min, rate_max, tag_list, industry_tag_list, limit, cursor, seed, username_list)
    now = time.time()
    if cache_key in _explore_cache:
        cached_response, ts = _explore_cache[cache_key]
        if now - ts < _EXPLORE_CACHE_TTL:
            return cached_response

    result = await loop.run_in_executor(None, lambda: run_explore(...))
    _explore_cache[cache_key] = (result, now)
    # Evict stale entries to prevent unbounded growth
    stale = [k for k, (_, ts) in _explore_cache.items() if now - ts > _EXPLORE_CACHE_TTL]
    for k in stale:
        del _explore_cache[k]
    return result
```

**Cache invalidation:** Triggered on admin expert add/delete/import (same pattern as embedding cache). Add `_explore_cache.clear()` call in:
- `app/routers/admin/experts.py`: `delete_expert()`, `delete_experts_bulk()`
- `app/routers/admin/imports.py`: after CSV sync completes

**Integration notes:**
- Thread-safe: module dict reads/writes protected by GIL in single-process Railway deployment
- Seeded random results (seed > 0): cache key includes seed, so per-user random orderings are cached separately — acceptable tradeoff (cache fills proportionally to distinct seeds)
- Cache is per-process (single Railway instance) — no Redis needed at this scale
- 30s TTL aligns with embedder cache TTL (already 60s) — experts change infrequently

---

### 3. Admin /experts Pagination

**Problem:** `GET /api/admin/experts` returns all ~530 experts as a single JSON payload. Sentry has already flagged this as a large payload alert. At 530 experts with serialized tags, bios, and metadata, this is ~2-3 MB per admin page load.

**Change (experts.py):**
```python
@router.get("/experts")
def get_experts(
    db: Session = Depends(get_db),
    active_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    search: str = Query(default=""),
):
    stmt = select(Expert).order_by(Expert.findability_score.asc().nulls_first())
    if active_only:
        stmt = stmt.where(Expert.is_active.is_(True))
    if search:
        stmt = stmt.where(
            (Expert.first_name + " " + Expert.last_name).ilike(f"%{search}%")
            | Expert.job_title.ilike(f"%{search}%")
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    experts = db.scalars(stmt.offset((page - 1) * per_page).limit(per_page)).all()
    return {
        "experts": [_serialize_expert(e) for e in experts],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page),
    }
```

**Frontend (ExpertsPage.tsx):** Already uses `AdminPagination` component — update `useAdminData` hook fetch to pass `page` and `per_page` params. ExpertsPage already has name search via the backend search param (v5.0 feature).

---

### 4. Bundle Optimization

**Current manualChunks (vite.config.ts):**
- `vendor-charts`: recharts
- `vendor-table`: @tanstack/react-table
- Admin: lazy-loaded (entirely separate chunks)

**Missing from chunk splitting (public bundle):**
- `motion` (v12, `motion/react`): Used for AnimatePresence in EmailEntryGate and ProfileGateModal — in public bundle, ~40-60 KB gzipped
- `react-virtuoso`: Used by ExpertGrid and ExpertList — in public bundle, ~20-30 KB gzipped
- `lucide-react`: Icon library tree-shakeable but can be split for clarity

**Recommended additions to vite.config.ts:**
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('recharts')) return 'vendor-charts'
    if (id.includes('@tanstack/react-table')) return 'vendor-table'
    if (id.includes('motion')) return 'vendor-motion'        // NEW
    if (id.includes('react-virtuoso')) return 'vendor-virtuoso'  // NEW
  }
}
```

**Preload hint (index.html):** Add `<link rel="preconnect" href="https://www.googletagmanager.com">` and `<link rel="preconnect" href="https://www.clarity.ms">` to reduce DNS resolution time for analytics scripts on first load.

**Expected gain:** Splitting motion and react-virtuoso reduces initial parse time for users who visit but don't trigger animations immediately. Browser parallelizes chunk loading. Marginal gain but zero cost.

---

### 5. Error Boundaries

**Problem:** Zero React error boundaries in the public app. An uncaught error in ExpertCard, ExpertGrid, or MarketplacePage crashes the entire Explorer with a blank white screen. No user feedback.

**Integration pattern (new ErrorBoundary.tsx):**
```typescript
// frontend/src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry is already wired via instrument.ts — will auto-capture
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 p-8 text-center">
          <p className="text-gray-600 font-medium">Something went wrong</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-sm px-4 py-2 rounded-lg bg-brand-purple text-white hover:bg-purple-700"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Placement strategy (2 boundaries, not many):**
1. `main.tsx` — wraps entire `<RouterProvider>`: catches routing-level errors
2. `MarketplacePage.tsx` — wraps the `<ExpertGrid>` / `<ExpertList>` area: isolates grid errors from header/filters

**Why class component:** React error boundaries must be class components. Functional error boundary wrappers (react-error-boundary library) exist but add a dependency. Class component approach is 20 lines, no new dep.

**Sentry integration:** `instrument.ts` is already imported in `main.tsx`. Sentry auto-captures errors caught by error boundaries via `componentDidCatch`. No additional wiring needed.

---

### 6. Health Check Enhancement

**Current:** `GET /api/health` returns `{ "status": "ok", "index_size": <int> }` — only confirms FAISS loaded.

**Gap:** No DB health probe. If SQLite WAL becomes locked or Railway volume is unhealthy, the FAISS check still passes but writes fail silently.

**Enhanced health.py:**
```python
import time
from fastapi import APIRouter, Request
from sqlalchemy import text
from app.database import SessionLocal

router = APIRouter()

@router.get("/api/health")
async def health(request: Request) -> dict:
    index = request.app.state.faiss_index

    # DB probe — single SELECT 1
    db_ok = False
    db_latency_ms = None
    try:
        t0 = time.perf_counter()
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "index_size": index.ntotal,
        "db": db_ok,
        "db_latency_ms": db_latency_ms,
    }
```

**Integration notes:**
- Admin OverviewPage already calls `GET /api/health` for the "API health" indicator (verified in PROJECT.md). The `status` field shape is unchanged — `"ok"` or new `"degraded"` value. Frontend health display needs to handle `"degraded"` gracefully.
- Railway health check URL: if configured at Railway dashboard, point to `/api/health`. The enhanced response is still valid JSON with `status: "ok"`.

---

### 7. SEO and Meta Tags

**Current state (index.html):**
- Title: static `<title>Tinrate — Find the right expert, instantly</title>`
- OG tags: static, hardcoded Vercel preview URL for og:image
- NO: `<meta name="description">` — major SEO gap (search engines use this for snippets)
- NO: `<link rel="canonical">`
- NO: JSON-LD structured data

**Changes to index.html (no React components needed):**

```html
<!-- Add inside <head> -->

<!-- Description (SEO snippet) -->
<meta name="description" content="Find vetted experts for any business challenge. Browse 500+ professionals by domain, rate, and specialty. Instant matching, no guesswork." />

<!-- Canonical (prevents duplicate content from query params) -->
<link rel="canonical" href="https://tcs-three-sigma.vercel.app/" />

<!-- JSON-LD structured data — WebSite + SearchAction -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Tinrate",
  "url": "https://tcs-three-sigma.vercel.app/",
  "description": "Find vetted experts for any business challenge.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://tcs-three-sigma.vercel.app/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>
```

**Why static in index.html (not React):** The app is a SPA with a single URL (`/`). No per-page dynamic meta needed. Static HTML is parsed by crawlers before React hydrates — guarantees SEO bots see the tags. React Helmet / @tanstack/react-head would be overkill for a single-route app.

**Why `SearchAction` JSON-LD:** The Explorer's core value proposition is search. The `SearchAction` schema tells Google this site supports search and may enable a Sitelinks Search Box in Google results — directly relevant to a marketplace launch.

---

### 8. Analytics Hardening

**Problem:** Vercel Speed Insights is only in `App.tsx` (the legacy chat page). `MarketplacePage.tsx` (the live Explorer at `/`) lacks it. GA4 `send_page_view:false` is correct but the `Analytics` component is only in `RootLayout.tsx` which wraps Explorer — admin routes bypass it. This is correct by design but needs verification.

**Vercel Speed Insights gap:** Add `<SpeedInsights />` to `MarketplacePage.tsx`:
```typescript
// MarketplacePage.tsx — add at bottom of return, inside AuroraBackground
import { SpeedInsights } from '@vercel/speed-insights/react'
// ...
<SpeedInsights />
```

Note: Speed Insights is idempotent — multiple instances on different routes don't double-count. But since `App.tsx` (chat) is no longer the primary route, the Explorer needs its own instance.

**GA4 hardening — verify event firing under load:** The current `trackEvent()` sends to `/api/events` (custom in-DB). GA4 events are sent via `window.gtag()`. These are separate channels. With event batching, the custom events batch but GA4 events (if added) remain individual. No conflict.

**Clarity admin exclusion (verify):** `index.html` IIFE checks `window.location.pathname.startsWith('/admin')` — runs at parse time, before React mounts. This is correct for hard navigations. For SPA navigations to `/admin`, Clarity is already loaded but the early-return prevents the tag initialization. SPA navigations do not re-run the IIFE. This means Clarity records admin sessions if user navigates SPA-style to `/admin` after loading `/`. Acceptable for v5.4 — no user PII concern, admin is authenticated.

**Analytics event under load:** `trackEvent()` with batching means events may arrive 3 seconds late. This is acceptable for marketplace intelligence — the data is used for daily/weekly aggregates in the admin dashboard, not real-time.

---

## Data Flow: Event Batching

```
[User action]
      ↓
trackEvent('card_click', { expert_id, rank })
      ↓
_queue.push({ session_id, event_type, payload, email })
      ↓
  queue.length >= 10?                 3s timer fires?
       YES ──────────────────────────────── YES
              ↓
          _flush()
              ↓
  POST /api/events { events: [...] }
      keepalive: true
              ↓
  record_event(body: BatchEventRequest)
              ↓
  db.add_all([UserEvent, ...])
  db.commit()  ← single WAL write
              ↓
  { "status": "accepted", "count": N }
```

**Before-unload safety:**
```typescript
// tracking.ts — module-level registration
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', _flush)
}
```

---

## Data Flow: Response Cache

```
GET /api/explore?query=&seed=12345&rate_max=5000
      ↓
_make_cache_key(params) → "a3f9b..."
      ↓
_explore_cache["a3f9b"] exists and age < 30s?
  YES → return cached ExploreResponse
  NO  →
      ↓
  run_in_executor → run_explore()
      ↓
  _explore_cache["a3f9b"] = (result, now)
      ↓
  return ExploreResponse
```

**Cache invalidation trigger:**
```
admin POST /experts/delete-bulk
      ↓
delete_experts_bulk() soft-deletes
      ↓
_explore_cache.clear()   ← add this line
      ↓
FAISS rebuild in background thread
```

---

## Build Order (Recommended — 1 Day Constraint)

Ordered by: dependencies first, then highest risk/impact, then polish.

### Phase 1: Backend Foundation (no frontend impact, safe to ship first)

1. **Admin /experts pagination** — isolated change to experts.py, fixes existing Sentry alert. No frontend change required yet (ExpertsPage still works with old response; pagination just adds more fields). Zero risk.

2. **Health check enhancement** — isolated change to health.py. Backward-compatible response shape. Admin OverviewPage handles new `"degraded"` status if frontend handles it gracefully.

3. **Event batching — backend** — change events.py to accept `BatchEventRequest | EventRequest` union. Fully backward-compatible: existing single-event format still works. Deploy this first so backend is ready before frontend sends batches.

### Phase 2: Frontend Performance (no new dependencies)

4. **Event batching — frontend** — update tracking.ts queue + flush logic. Depends on Phase 1.3 (backend must accept batch). No UI changes. Add beforeunload handler.

5. **Bundle chunk splitting** — update vite.config.ts with motion + react-virtuoso chunks. Zero behavior change, build-time only. Run `npm run build` locally to verify chunk sizes before shipping.

6. **Response caching** — update explore.py with TTL cache + cache invalidation in delete/import handlers. Depends on nothing. Pure backend, no frontend change.

### Phase 3: Resilience and SEO (visible user-facing changes)

7. **Error boundaries** — new ErrorBoundary.tsx + wrap main.tsx and MarketplacePage.tsx grid area. Zero behavior change for happy path. Test by temporarily throwing in ExpertCard.

8. **SEO meta tags + JSON-LD** — update index.html. Static, zero risk. Verify with browser DevTools (Elements > head) and Google's Rich Results Test.

### Phase 4: Analytics Hardening (final, lowest risk)

9. **Speed Insights for Explorer** — add `<SpeedInsights />` to MarketplacePage.tsx.

10. **Verify GA4 + Clarity exclusions** — no code change, manual QA. Confirm admin routes not tracked in GA4 real-time report. Confirm Clarity sessions only on Explorer.

---

## Scaling Considerations

| Concern | Current (530 experts, single Railway) | At 10k concurrent users |
|---------|---------------------------------------|------------------------|
| Event writes | 1 DB write per user action → write storm | Batching reduces to ~1/10 writes; WAL serializes writers |
| /api/explore cold calls | Each request hits FAISS + SQLAlchemy | 30s TTL cache means ~2 requests/30s per unique param set |
| Admin /experts payload | 2-3 MB full dump | Pagination to 50/page reduces to ~200 KB |
| SQLite WAL | Handles concurrent reads well | Single writer limit; batching helps; true bottleneck is embedding API |
| Google embed API | 60s TTL cache in embedder.py (PERF-01) | Cache hits prevent quota exhaustion for repeated queries |
| FAISS in-memory | Loaded once at startup, read-only at query time | Thread-safe reads; asyncio.Lock only on rebuild |

**First bottleneck at 10k users:** The Google GenAI embedding API — quota limits before SQLite becomes a problem. Embedder TTL cache (60s) is already in place. Second bottleneck: SQLite WAL single-writer for user_events. Batching directly addresses this.

**Not a bottleneck (verify before over-engineering):** FAISS search is nanosecond-range for 530 vectors. SQLAlchemy pre-filter on indexed columns (tags via expert_tags join table, rate via float column) is fast. The explore.py run_in_executor offloads to thread pool — FastAPI stays non-blocking.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Cache at the Zustand / React layer

**What people do:** Cache `/api/explore` responses in Zustand store and skip the fetch if results exist.
**Why it's wrong:** Filter state changes trigger refetches. Stale results appear when filters change. The server-side TTL cache handles identical param sets — let React re-fetch, backend serves from cache.
**Do this instead:** Cache on the server (explore.py module-level dict). Frontend always fetches, backend absorbs duplicates.

### Anti-Pattern 2: Many fine-grained error boundaries

**What people do:** Wrap every component in its own ErrorBoundary.
**Why it's wrong:** 15 boundaries is maintenance overhead. One at app level + one at feature level is sufficient for a single-page SPA.
**Do this instead:** Two boundaries: router-level (main.tsx) + grid-level (MarketplacePage.tsx).

### Anti-Pattern 3: Flush event queue on every user interaction

**What people do:** Add a flush call after every important action ("card click is important, send immediately").
**Why it's wrong:** Defeats the purpose of batching. Under load, immediate flushes = the problem we're solving.
**Do this instead:** Trust the 10-event threshold + 3s timer. Only flush on beforeunload for navigation safety.

### Anti-Pattern 4: Redis or external cache for this scale

**What people do:** Reach for Redis for any caching requirement.
**Why it's wrong:** Railway single instance, 530 experts, Python dict with TTL is 20 lines and zero ops. Redis adds network hop, Railway add-on cost, and connection pooling complexity.
**Do this instead:** Module-level Python dict with TTL eviction — same pattern as embedder.py (already proven in production).

### Anti-Pattern 5: Dynamic meta tags via React for a single-route SPA

**What people do:** Add react-helmet or @tanstack/react-head for SEO meta management.
**Why it's wrong:** The app has one public route (`/`). Dynamic meta is for multi-route apps where each page has different titles/descriptions. A dependency for one static `<meta>` tag is waste.
**Do this instead:** Edit index.html directly. Static, zero JS, parsed by crawlers before React hydrates.

---

## Integration Points

### External Services

| Service | Integration Point | Notes |
|---------|------------------|-------|
| GA4 | `index.html` IIFE + `analytics.tsx` | No change in v5.4; verify admin exclusion in QA |
| Microsoft Clarity | `index.html` IIFE | No change; admin exclusion via pathname check at init |
| Vercel Speed Insights | `MarketplacePage.tsx` (add) + `App.tsx` (keep) | Add to Explorer; existing chat instance unchanged |
| Sentry | `instrument.ts` + `vite.config.ts` | ErrorBoundary `componentDidCatch` auto-reports via existing Sentry setup |
| Google GenAI | `app/services/embedder.py` | No change; 60s TTL cache already in place |
| Intercom | `main.tsx` IntercomProvider + `IntercomIdentity.tsx` | No change in v5.4 |
| Railway health check | `/api/health` (enhanced) | Point Railway's health check URL here if not already configured |

### Internal Boundaries

| Boundary | Communication | Change |
|----------|--------------|--------|
| tracking.ts → /api/events | HTTP POST batch | Queue + timer; backend union type |
| explore.py → _explore_cache | Module dict | TTL cache + invalidation hooks |
| admin/experts.py → ExpertsPage | HTTP GET paginated | page/per_page params + pagination response shape |
| MarketplacePage → ErrorBoundary | React children | Wrap grid area only |
| main.tsx → ErrorBoundary | React children | Wrap RouterProvider |
| health.py → SessionLocal | Direct DB probe | SELECT 1 with latency timing |

---

## Sources

- Direct codebase inspection: `app/routers/events.py`, `app/routers/health.py`, `app/routers/explore.py`, `app/routers/admin/experts.py`, `app/services/embedder.py`, `frontend/src/tracking.ts`, `frontend/src/main.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/layouts/RootLayout.tsx`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/package.json` (HIGH confidence — ground truth)
- `.planning/PROJECT.md` — feature history and key decisions (HIGH confidence)
- SQLite WAL documentation — single-writer behavior at scale (MEDIUM confidence — known constraint)
- Schema.org WebSite + SearchAction JSON-LD spec — verified pattern for marketplace search (MEDIUM confidence)

---

*Architecture research for: v5.4 Launch Hardening — Expert Marketplace SPA*
*Researched: 2026-03-05*
