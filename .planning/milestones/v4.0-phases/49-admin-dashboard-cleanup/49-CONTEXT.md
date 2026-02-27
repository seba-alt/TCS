# Phase 49: Admin Dashboard Cleanup - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify the admin sidebar by removing legacy redirect routes, add a catch-all redirect for unknown admin routes, and consolidate the overview page to surface recent leads and searches. All 8 current admin pages (Overview, Gaps, Intelligence, Data, Tools, Experts, Leads, Settings) are retained.

</domain>

<decisions>
## Implementation Decisions

### Pages to remove
- No admin pages are removed — all 8 current pages stay (Overview, Gaps, Intelligence, Data, Tools, Experts, Leads, Settings)
- Remove all 5 legacy redirect routes: search-lab, score-explainer, index, searches, marketplace
- Any unknown `/admin/*` route redirects to the overview page (graceful fallback, not 404)
- Clean up corresponding backend endpoints for removed legacy routes if any exist

### Overview consolidation
- Surface recent leads and recent searches directly on the overview page
- Overview data loads on page visit only — no auto-refresh/polling
- Stat cards from Phase 48 (Total Leads, Expert Pool, Top Searches, Conversion Rate) sit at the top
- Recent leads + recent searches sections below the stats, with "View all" links to their respective pages

### Claude's Discretion
- Recent leads section format (compact table vs activity feed)
- Number of recent items to show before "View all" link
- Layout and visual design of the consolidated overview
- Whether any orphaned backend background tasks need cleanup

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

*Phase: 49-admin-dashboard-cleanup*
*Context gathered: 2026-02-27*
