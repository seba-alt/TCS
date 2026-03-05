# Phase 72: Frontend Performance & Vercel Config - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Client-side event batching (trackEvent queue flushing as batch POST), Vite manualChunks splitting for vendor dependencies, Cache-Control headers in vercel.json, and preconnect hint to Railway API origin. Pure performance/config work — no new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Event Batching
- Queue flushes at 10 items or 3-second timer, whichever comes first
- Flush on beforeunload to capture exit events
- Must produce a single batch POST instead of N individual requests
- Phase 74 handles offline/beacon concerns — this phase focuses on the happy-path queue

### Vite Chunk Splitting
- Separate vendor chunks for: motion, virtuoso, icons, intercom, router
- Verified by `npm run preview` with zero console errors

### Cache Headers (vercel.json)
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- Static images: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- Vite's content-hash filenames ensure cache busting on deploys

### Preconnect
- `<link rel="preconnect">` to Railway API origin in index.html

### Claude's Discretion
- Batch queue error handling (retry vs drop on failed POST)
- Queue behavior across SPA navigation
- Event payload metadata beyond what tracking.ts currently sends
- Exact manualChunks regex patterns for each vendor group

</decisions>

<specifics>
## Specific Ideas

No specific requirements — all thresholds and values defined in REQUIREMENTS.md (FPERF-01/02/03, VCFG-01/02).

</specifics>

<deferred>
## Deferred Ideas

None — discussion skipped; requirements are precise.

</deferred>

---

*Phase: 72-frontend-performance-vercel-config*
*Context gathered: 2026-03-05*
