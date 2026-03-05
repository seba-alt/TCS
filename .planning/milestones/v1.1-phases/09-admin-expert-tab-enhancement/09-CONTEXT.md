# Phase 9: Admin Expert Tab Enhancement - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface enriched expert data in the admin Expert tab: full name, bio preview, profile URL, domain tags, and a color-coded findability score — sorted worst-first as a human quality gate before search changes go live. A companion domain-map section shows which expert domains are most frequently downvoted.

</domain>

<decisions>
## Implementation Decisions

### Column layout
- Merged "Name" column (First + Last in one cell, not separate columns)
- Profile URL shown as a clickable external-link icon only — no text, saves width
- Findability score column at far right (trailing summary column)
- Implied column order: Name | Bio preview | Tags | Link icon | Findability score

### Tag overflow
- Show first 2 tags per row — keeps row height uniform
- Empty tag state: blank (no indicator for untagged experts)
- Tag pill style and overflow handling (beyond 2): Claude's discretion

### Sort & filter controls
- Default sort: ascending findability score (worst-quality experts at top)
- All column headers are clickable to re-sort asc/desc
- Filter by color zone: Red (0–39) / Yellow (40–69) / Green (70–100) toggle buttons
- No text search on this tab — sort + zone filter is enough
- Paginated: 50 experts per page with prev/next controls

### Domain-map section
- Displayed as a separate sub-tab or collapsible section within the Expert tab
- Shows top 10 domains ranked by downvote frequency
- Display format: Claude's discretion (simplest that communicates the ranking clearly)
- Clicking a domain in the map filters the expert table to show experts with that tag

### Claude's Discretion
- Tag pill visual style (color, size, shape)
- How remaining tags beyond 2 are accessible (tooltip or none)
- Domain-map display format (list vs bar chart)
- Exact spacing, typography, loading skeleton

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-admin-expert-tab-enhancement*
*Context gathered: 2026-02-21*
