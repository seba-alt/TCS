# Phase 57: Admin Frontend Overhaul - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Modernize the admin panel: URL-based routing for Tools/Data sub-pages, improved pagination, consistent component patterns across all pages, Overview dashboard redesign, Experts table with name search, and responsive tablet layout. No new admin capabilities — this is about making what exists work properly and consistently.

</domain>

<decisions>
## Implementation Decisions

### Overview dashboard
- Compact at-a-glance stats row at top (total searches, clicks, gaps, new leads)
- Time period toggle (today / 7 days / etc.)
- Below stats: recent searches, recent clicks, top zero-result queries, recent leads
- All items clickable — navigate to their respective detail pages (search → searches page, click → expert, gap → gaps page, lead → leads page)

### Experts table
- Name search as the PRIMARY filter — prominent search field
- Light visual refresh, nothing complex
- Zone filters (red/yellow/green) kept but secondary/less prominent
- Same columns: name, company, findability badge, domain tags, expandable lead clicks
- Keep existing tag filter, bio filter, sort options as secondary

### Visual consistency
- Keep dark slate (`bg-slate-950`) + purple accent theme
- Focus on functional consistency — same card/table/form patterns on every page
- Goal: "everything works properly" with the same look, not a redesign

### Navigation structure
- Sidebar stays as-is: 3 sections, 8 items
- Tools and Data sub-pages get real URL routes but don't promote to sidebar
- Browser back button works between sub-pages

### Claude's Discretion
- Exact time period toggle options (today/7d/30d/all)
- Pagination component design (page numbers, direct jump input)
- Responsive breakpoint behavior at tablet width
- Consistent component patterns (shared card, table, form components vs inline consistency)
- How to surface sub-page URL routes within Tools/Data pages (tabs with URL sync, nested routes, etc.)

</decisions>

<specifics>
## Specific Ideas

- Overview is about understanding user behavior: what people searched, clicked, what didn't show results, leads collected
- Experts table: user mostly searches by name now, zone filters are secondary
- "Just want everything to work properly" — functional polish over aesthetic ambition

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 57-admin-frontend-overhaul*
*Context gathered: 2026-03-03*
