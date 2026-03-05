# Phase 72: Frontend Performance & Vercel Config - Research

**Researched:** 2026-03-05
**Domain:** Frontend performance optimization (event batching, code splitting, caching, preconnect)
**Confidence:** HIGH

## Summary

Phase 72 is pure performance/config work touching four areas: (1) client-side event batching in `tracking.ts`, (2) Vite `manualChunks` expansion for vendor dependencies, (3) Vercel cache headers in `vercel.json`, and (4) a preconnect hint in `index.html`.

The current `tracking.ts` fires individual `POST /api/events` calls per event. The phase goal requires a module-level queue that flushes as a single batch POST. However, the backend currently has no batch endpoint — only the single-event `POST /api/events`. Phase 72 must add a `POST /api/events/batch` endpoint that accepts an array of events and enqueues them all. This is a small addition since the backend already has the async queue infrastructure from Phase 71.

The Vite config already has `manualChunks` for recharts and tanstack-table. It needs expansion for five additional vendor groups: motion, virtuoso, lucide-icons, intercom, and react-router.

**Primary recommendation:** Two plans — Plan 01 handles all code changes (tracking batch queue, batch endpoint, manualChunks, preconnect), Plan 02 handles the vercel.json config-only changes (cache headers).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Queue flushes at 10 items or 3-second timer, whichever comes first
- Flush on beforeunload to capture exit events
- Must produce a single batch POST instead of N individual requests
- Phase 74 handles offline/beacon concerns — this phase focuses on the happy-path queue
- Separate vendor chunks for: motion, virtuoso, icons, intercom, router
- Verified by `npm run preview` with zero console errors
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- Static images: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- Vite's content-hash filenames ensure cache busting on deploys
- `<link rel="preconnect">` to Railway API origin in index.html

### Claude's Discretion
- Batch queue error handling (retry vs drop on failed POST)
- Queue behavior across SPA navigation
- Event payload metadata beyond what tracking.ts currently sends
- Exact manualChunks regex patterns for each vendor group

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FPERF-01 | Event tracking batched client-side (module-level queue, flush on 10 items / 3s timer / beforeunload) | tracking.ts currently fires individual POSTs; needs queue + timer + batch POST endpoint |
| FPERF-02 | Vite manualChunks expanded (vendor-motion, vendor-virtuoso, vendor-icons, vendor-intercom, vendor-router) | vite.config.ts already has manualChunks for recharts/tanstack; needs 5 more entries |
| FPERF-03 | Preconnect hint to Railway API origin added to index.html | index.html has no preconnect; Railway origin is `https://web-production-fdbf9.up.railway.app` |
| VCFG-01 | Cache-Control immutable headers for /assets/* in vercel.json | vercel.json currently has only redirects/rewrites, no headers |
| VCFG-02 | Cache-Control for static images in vercel.json | Same — needs headers section added |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | ^7.3.1 | Build tool with manualChunks | Already in use |
| Vitest | ^4.0.18 | Test runner | Already in use |

### Supporting
No new dependencies required. All changes use existing libraries and built-in browser APIs (setTimeout, addEventListener, fetch).

## Architecture Patterns

### Current tracking.ts Architecture
```typescript
// Current: fires individual POST per event
export function trackEvent(event_type, payload): void {
  void fetch(`${API_BASE}/api/events`, { method: 'POST', keepalive: true, body: ... })
}
```

### Target: Module-Level Queue Pattern
```typescript
// Module-level state (survives across SPA navigation)
const queue: EventItem[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const BATCH_SIZE = 10
const FLUSH_INTERVAL_MS = 3000

export function trackEvent(event_type, payload): void {
  queue.push({ session_id, event_type, payload, email })
  if (queue.length >= BATCH_SIZE) {
    flush()
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS)
  }
}

function flush(): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (queue.length === 0) return
  const batch = queue.splice(0)  // drain queue
  void fetch(`${API_BASE}/api/events/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ events: batch }),
  })
}

// Flush on page exit
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush)
}
```

### Backend Batch Endpoint Pattern
```python
class BatchEventRequest(BaseModel):
    events: list[EventRequest] = Field(..., min_length=1, max_length=50)

@router.post("/api/events/batch", status_code=202)
async def record_event_batch(body: BatchEventRequest):
    for event in body.events:
        validated_email = _validate_email(event.email)
        item = { ... }
        _event_queue.put_nowait(item)
    return {"status": "accepted", "count": len(body.events)}
```

### Vite manualChunks Pattern
```typescript
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('recharts'))              return 'vendor-charts'
    if (id.includes('@tanstack/react-table')) return 'vendor-table'
    if (id.includes('motion'))                return 'vendor-motion'
    if (id.includes('react-virtuoso'))        return 'vendor-virtuoso'
    if (id.includes('lucide-react'))          return 'vendor-icons'
    if (id.includes('react-use-intercom'))    return 'vendor-intercom'
    if (id.includes('react-router'))          return 'vendor-router'
  }
}
```

### vercel.json Headers Pattern
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp))",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400, stale-while-revalidate=604800" }
      ]
    }
  ]
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event batching | Custom pub/sub system | Simple array + setTimeout | KISS — array.splice(0) + setTimeout is sufficient for fire-and-forget |
| Code splitting | Dynamic import() wrappers | Vite manualChunks | Build-time splitting is deterministic; no runtime overhead |
| Cache headers | Middleware/service worker | vercel.json headers config | Vercel's edge handles headers natively; zero application code |

## Common Pitfalls

### Pitfall 1: keepalive Size Limit
**What goes wrong:** `fetch` with `keepalive: true` has a 64KB body limit per the spec. A very large batch could exceed this.
**Why it happens:** keepalive requests are handled by the browser's keep-alive pool with strict size limits.
**How to avoid:** Cap batch at 50 items (each event is ~200 bytes = ~10KB max batch). The 10-item flush threshold keeps us well under.
**Warning signs:** Network errors on beforeunload flush with large queues.

### Pitfall 2: manualChunks Breaking Circular Dependencies
**What goes wrong:** Splitting vendor chunks can surface circular dependency issues between chunks at runtime.
**Why it happens:** Rollup's chunk splitting can break initialization order.
**How to avoid:** Always verify with `npm run build && npm run preview` — check for runtime errors. STATE.md already flags this as CRITICAL.
**Warning signs:** Console errors like "Cannot access before initialization" in preview mode.

### Pitfall 3: beforeunload Not Firing on Mobile
**What goes wrong:** Mobile browsers don't reliably fire `beforeunload`.
**How to avoid:** Phase 74 handles this with `navigator.sendBeacon()` and `visibilitychange`. For now, the queue timer (3s) ensures most events flush during normal browsing.
**Warning signs:** Missing events from mobile sessions (acceptable — Phase 74 scope).

### Pitfall 4: vercel.json Source Pattern Mismatch
**What goes wrong:** Vercel source patterns don't match expected paths, so headers aren't applied.
**Why it happens:** Vite outputs to `/assets/` with content-hashed filenames. Static images in `public/` are served from root.
**How to avoid:** Test with `vercel dev` or deploy preview. Check response headers with browser DevTools.

### Pitfall 5: Timer Leak on Module Reload (HMR)
**What goes wrong:** In development, Vite HMR re-executes the module, creating duplicate timers.
**How to avoid:** Clear timer in an `import.meta.hot?.dispose()` handler if needed, or accept it in dev only.

## Code Examples

### Current State: tracking.ts
- Location: `frontend/src/tracking.ts`
- Each `trackEvent()` call fires an individual `POST /api/events`
- Uses `keepalive: true` for page navigation survival
- Gets session_id from localStorage, subscriber email from Zustand persist store

### Current State: vite.config.ts
- Location: `frontend/vite.config.ts`
- Already has `manualChunks` for `recharts` and `@tanstack/react-table`
- Uses `vitest/config` import for test configuration

### Current State: vercel.json
- Location: `frontend/vercel.json`
- Has redirects (`/marketplace` → `/explore`) and SPA rewrite
- No headers section exists

### Current State: index.html
- Location: `frontend/index.html`
- Has GA4, Clarity scripts, OG/Twitter meta tags
- No preconnect links

### Backend: events.py
- Location: `app/routers/events.py`
- Single-event `POST /api/events` endpoint with Pydantic validation
- Uses asyncio queue from `app/event_queue.py` (Phase 71)
- No batch endpoint exists yet

### Railway API Origin
- Production: `https://web-production-fdbf9.up.railway.app`

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test section) |
| Quick run command | `cd frontend && npx vitest run src/tracking.test.ts` |
| Full suite command | `cd frontend && npm test` |
| Estimated runtime | ~5 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FPERF-01 | trackEvent batches into queue, flushes at 10 items or 3s | unit | `cd frontend && npx vitest run src/tracking.test.ts` | Yes (needs new batch tests) |
| FPERF-02 | manualChunks produces separate vendor chunks | build verification | `cd frontend && npm run build 2>&1 \| grep vendor` | No test file (build check) |
| FPERF-03 | preconnect link in index.html | unit | `grep preconnect frontend/index.html` | No test file (static check) |
| VCFG-01 | Cache-Control immutable on /assets/* | config verification | `grep immutable frontend/vercel.json` | No test file (config check) |
| VCFG-02 | Cache-Control on static images | config verification | `grep stale-while-revalidate frontend/vercel.json` | No test file (config check) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `cd frontend && npx vitest run src/tracking.test.ts`
- **Full suite trigger:** Before merging final task of any plan wave -> `cd frontend && npm test && npm run build`
- **Phase-complete gate:** Full suite green + build produces expected chunks
- **Estimated feedback latency per task:** ~8 seconds

### Wave 0 Gaps (must be created before implementation)
None -- existing `tracking.test.ts` covers FPERF-01 test infrastructure. New batch-specific tests will be added as part of FPERF-01 implementation. FPERF-02/03 and VCFG-01/02 are config-only and verified by build/grep checks.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `frontend/src/tracking.ts`, `frontend/vite.config.ts`, `frontend/vercel.json`, `frontend/index.html`
- Codebase inspection: `app/routers/events.py`, `app/event_queue.py`
- `frontend/package.json` — dependency versions confirmed

### Secondary (MEDIUM confidence)
- Vite manualChunks documentation — patterns verified against existing config
- Vercel headers configuration — standard JSON schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in use, no new dependencies
- Architecture: HIGH - patterns verified against existing codebase
- Pitfalls: HIGH - common issues well-documented, STATE.md already flags manualChunks risk

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable — no fast-moving dependencies)
