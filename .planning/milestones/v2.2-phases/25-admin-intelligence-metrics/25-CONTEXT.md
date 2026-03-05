# Phase 25: Admin Intelligence Metrics - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface OTR@K (On-Topic Rate at K=10) as a 7-day rolling average and Index Drift (time since last rebuild + expert count delta since rebuild) in the admin Intelligence tab — giving operators actionable signal on retrieval health. No new admin actions in scope; index rebuild UI belongs to Phase 24.

</domain>

<decisions>
## Implementation Decisions

### OTR@K format
- Display as **percentage** (e.g. "82%"), not decimal (0.82)
- Color coding thresholds from requirements: green ≥ 75%, amber 60–74%, red < 60%

### Claude's Discretion
All layout, visualization depth, and behavioral choices are deferred to Claude:

- **Metrics layout** — Arrangement of OTR@K and Index Drift panels (side-by-side vs stacked vs unified); whether to use Phase 22 glassmorphism aesthetic; how much visual weight each piece gets
- **OTR@K visualization depth** — Whether to show just the rolling average or also a trend (sparkline/bars); whether to surface query count for confidence context
- **OTR@K label** — "OTR@K", "On-Topic Rate", or "Search Relevance" — pick whatever suits the admin dashboard tone
- **Color coding extent** — Whether color applies to the number only, a badge, or the card background
- **Index Drift prominence** — Which of (time since rebuild / expert count delta) is the headline; how to handle staleness signaling
- **Empty states** — What shows when no search history exists; what shows when Phase 24 fields (last_rebuild_at, expert_count_at_rebuild) are absent
- **Low-confidence caveat** — Whether and when to surface "based on N queries" context
- **Refresh mechanism** — Whether the tab is live-on-visit or includes a manual refresh button
- **Actionability on red OTR@K** — Whether to surface a nudge toward rebuilding or stay purely observational
- **API shape** — Whether metrics get a dedicated `/api/admin/intelligence` endpoint or extend an existing stats endpoint
- **Tab scope** — Read-only metrics only vs. any light admin actions (export, etc.)

</decisions>

<specifics>
## Specific Ideas

- The only user-specified constraint: OTR@K shown as percentage, not decimal
- Planning notes from roadmap confirm: OTR@K threshold aligns with existing `GAP_THRESHOLD=0.60`; computation goes in `run_explore()` after sort; `otr_at_k REAL` column added via inline ALTER TABLE; admin-only (not in public ExploreResponse)
- Index Drift reads from `_ingest` dict fields populated by Phase 24 (`last_rebuild_at`, `expert_count_at_rebuild`)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-admin-intelligence-metrics*
*Context gathered: 2026-02-22*
