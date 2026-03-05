# Phase 71: Backend Performance & Railway Config - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Tune the Railway backend for 10k-concurrent-user launch load. Covers: event write batching, API compression and caching, admin experts pagination (fixing Sentry large-payload alert), health endpoint, photo proxy caching, and Railway infrastructure config (region, restart policy, keep-alive). No new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Health endpoint scope
- Two-tier design: public `/health` (just ok/not-ok for Railway healthcheck) + authenticated `/api/admin/health` (full diagnostics requiring admin JWT)
- Detailed endpoint includes: DB status, expert count, latency metric, plus whatever Claude deems useful for production monitoring (FAISS status, memory, uptime, version — Claude's discretion)
- Admin UI widget: show a small status indicator in the admin panel (header or overview page) pulling from the detailed health endpoint

### Event batch tuning
- Fire-and-forget: `POST /api/events` returns 202 Accepted immediately after adding to the async queue
- Flush interval and batch size: Claude's discretion based on expected load patterns
- Failure handling: retry once on flush failure, then drop events and log the error — analytics loss is acceptable, app must keep running
- Queue cap: max 1000 events in memory, drop oldest when exceeded to prevent memory runaway

### Admin pagination UX
- Default sort: alphabetical by first name (A-Z)
- Pagination style: classic page numbers (1/2/3) with total count — admin can jump to any page
- Fixed page size: 50 per page, not configurable
- Search: simple text search filtering by expert name

### Cache & compression
- Explore/search API: in-memory LRU cache with 5-minute TTL — repeated queries hit cache
- GZip: FastAPI GZipMiddleware on all responses with a min-size threshold (~500 bytes)
- Client-side Cache-Control: photo proxy only (24h) — API data stays dynamic, no browser caching on explore results

### Claude's Discretion
- Detailed health endpoint contents beyond DB/experts/latency (FAISS, memory, uptime, version — pick what's useful)
- Event batch flush interval and batch size tuning
- GZip minimum size threshold
- LRU cache max size
- SQLite PRAGMA tuning values
- Railway Uvicorn flags and keep-alive tuning
- Admin health widget placement and design

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 71-backend-performance-railway-config*
*Context gathered: 2026-03-05*
