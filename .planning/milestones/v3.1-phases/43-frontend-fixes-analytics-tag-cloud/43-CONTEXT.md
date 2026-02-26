# Phase 43: Frontend Fixes + Analytics + Tag Cloud - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the React redirect loop on legacy routes (/explore, /marketplace, /browse, /chat), integrate GA4 page-view tracking with property G-0T526W3E1Z, and expand the desktop tag cloud from 12 to 18-20 visible tags. No new features — three targeted improvements.

</domain>

<decisions>
## Implementation Decisions

### Tag cloud expansion
- Just increase the visible count from 12 to 18-20 — same pill size (`text-xs`), same gap, same flex-wrap layout
- Let the cloud grow taller; no max-height or scroll needed
- Keep the proximity-scale hover effect at 1.4x max — it's part of the brand feel
- Desktop only: show 18-20 on desktop, keep 12 on mobile where space is tighter

### GA4 integration
- Page views only — no custom events at launch
- Load gtag.js via a standard `<script>` tag in `index.html` (not a React component)
- Track immediately — no cookie consent banner needed for now
- SPA page-view tracking should send full path including query params (e.g., `/?tags=saas`) so filter usage is visible in GA4

### Redirect loop fix
- Legacy routes should still redirect to `/` — they are not becoming real pages
- Preserve query params on redirect (e.g., `/explore?tags=saas` → `/?tags=saas`)
- Fix the `RedirectWithParams` infinite loop without breaking param forwarding

### Claude's Discretion
- Root cause analysis of the redirect loop (likely `useSearchParams` context or route nesting issue)
- Exact breakpoint for desktop vs mobile tag count
- gtag.js SPA integration pattern (useEffect hook on location change, or React Router listener)

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

*Phase: 43-frontend-fixes-analytics-tag-cloud*
*Context gathered: 2026-02-26*
