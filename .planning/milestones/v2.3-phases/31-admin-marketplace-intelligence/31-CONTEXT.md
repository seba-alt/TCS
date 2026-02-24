# Phase 31: Admin Marketplace Intelligence - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

New admin page at `/admin/marketplace` showing three views: zero-result demand signals, expert exposure, and Sage query volume trend. Read from Phase 30's `user_events` table. No modifications to existing admin pages. Admins can export data and navigate to experts.

</domain>

<decisions>
## Implementation Decisions

### Demand table design
- Layout: Claude decides whether zero-result Sage queries and underserved filter combos are shown together or separated — optimize for clarity
- Default time window: **last 30 days**
- Columns for the zero-result Sage query table: query text, frequency (count), last seen date, unique users count
- Default sort: frequency descending (most-repeated zero-result queries first)
- Pagination: top 25 rows per page with pagination controls

### Exposure table design
- "Appears" = times the expert's card appeared in grid or Sage panel results (impression count)
- Context breakdown: two sub-columns per metric inline — e.g., "Clicks: 12 grid / 3 sage" — within the same row
- Default sort: most clicks first (top-performing experts at top)
- Show only experts with at least one appearance or click — no rows of zero-event experts
- Expert rows are clickable: link opens the expert's public card (as users see it)

### Chart scope
- Y-axis: total daily Sage queries, stacked by outcome (successful results vs zero-result queries)
- Default date range: **last 14 days**
- Interactivity: hover tooltips showing exact counts per day (standard Recharts behavior) — no click-through
- Above the chart: headline KPIs — total queries for the period, zero-result rate, and change vs prior period

### Action affordances
- Demand table: exportable as CSV
- Exposure table: exportable as CSV
- Time range selector: dropdown (7d / 30d / 90d / all time) applies to both tables — chart stays at 14 days by default
- No other interactive actions in this phase

### Claude's Discretion
- Whether zero-result Sage queries and underserved filter combos are in one table or two separate sections
- Exact CSV column names and formatting
- Whether the time range selector also affects the chart or only the tables
- KPI "change vs prior period" calculation (same window length, rolling)

</decisions>

<specifics>
## Specific Ideas

- The page is an admin diagnostic tool — density and information richness are valued over visual minimalism
- Cold-start state is explicitly required: show tracking start timestamp + "insights appear after ~50 page views" — no blank or broken state
- Export affordance should be consistent across both tables — same button style and behavior

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-admin-marketplace-intelligence*
*Context gathered: 2026-02-22*
