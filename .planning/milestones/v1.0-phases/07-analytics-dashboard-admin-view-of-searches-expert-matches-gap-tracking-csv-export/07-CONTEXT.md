# Phase 7: Analytics Dashboard — Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-only analytics interface showing aggregate platform usage data — what searches are happening, what expert matches result, where the system is failing (gaps), and the ability to export that data. Accessible at a dedicated `/admin` route separate from the main app. Regular users never see this.

</domain>

<decisions>
## Implementation Decisions

### Dashboard structure
- Sidebar nav layout — left sidebar with nav items, main content area changes per section
- Summary/overview section with key stats cards visible at the top (total searches, match rate, gap count, export button)
- Dedicated `/admin` route, separate from main app — not integrated into main user nav
- Claude decides the exact sidebar sections based on data shape (e.g., Overview / Searches / Gaps)

### Data tables & display
- Searches table columns: query text, timestamp, user email, match count, top match score, gap flag
- Full filter panel: filter by date range, user, gap flag, match score threshold
- Click to expand row — expanded row shows full expert match list inline (names, scores)
- Pagination — 25 or 50 rows per page (admin selectable)

### Gap tracking
- Gap definition: Claude decides threshold based on existing scoring system (e.g., top match score below a meaningful threshold)
- Gaps surfaced in two places: (1) flagged rows in the searches table with a gap badge, AND (2) a dedicated Gaps section in the sidebar
- Dedicated Gaps section shows: gap query text, frequency count (how many times searched), best match attempt (what the closest expert was even though it wasn't good enough)
- Admin can mark a gap as resolved after taking action (e.g., manually adding experts or improving the system)
- "Send to test lab / search improver" integration is Phase 8 scope — deferred

### CSV export
- Separate Export CSV button per section (searches export and gaps export are independent)
- At export time, a dialog asks: "Export filtered results or all data?" — user chooses
- CSV includes a metadata header section before data columns: export date, filter applied, total row count
- Filename format: `searches-YYYY-MM-DD.csv` and `gaps-YYYY-MM-DD.csv`

### Claude's Discretion
- Exact sidebar section names and grouping
- Gap score threshold value
- Summary card metrics and layout
- Loading states, empty states, error handling
- Exact filter UI (dropdowns vs date pickers vs chips)

</decisions>

<specifics>
## Specific Ideas

- Gap tracking should help the admin understand recurring failures — frequency ranking of gap queries is the core value
- The "mark as resolved" flow for gaps is lightweight — just a status toggle, no complex workflow

</specifics>

<deferred>
## Deferred Ideas

- "Send to test lab / search improver" action on gaps — connects Phase 7 gaps to Phase 8 test lab; belongs in Phase 8 scope

</deferred>

---

*Phase: 07-analytics-dashboard-admin-view-of-searches-expert-matches-gap-tracking-csv-export*
*Context gathered: 2026-02-20*
