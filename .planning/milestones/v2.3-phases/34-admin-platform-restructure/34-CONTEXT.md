# Phase 34: Admin Platform Restructure - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the admin navigation and OverviewPage — shrink sidebar from 11 to 8 items, consolidate Searches + Marketplace into a "Data" tabbed page, move Search Lab / Score Explainer / Index into a single "Tools" page with tabs, move re-index trigger into Settings under "Index Management", and uplift the OverviewPage dashboard to give a strong first impression. This is a navigation/IA refactor — existing page functionality is NOT rewritten.

</domain>

<decisions>
## Implementation Decisions

### Dashboard priority
- **Layout:** Small health strip at top (API speedometer + key stats), then two-column split: top zero-result queries (left) + Sage volume sparkline (right)
- **Speedometer:** Keep the distinctive SVG speedometer gauge for API health
- **Zero-result queries card:** Mini top-5 preview with "See all →" link to Gaps page — calls existing `/api/admin/events/demand` endpoint (no new backend work)
- **Sage volume:** Small 7-day sparkline in the right column (compact, not a full chart)

### Page consolidation
- **Searches + Marketplace merge:** Combined into a single "Data" page with two tabs — Searches (query log) | Marketplace (demand/exposure insights)
- **Intelligence:** Stays as standalone nav item under Analytics (keeps its search performance charts and score distribution)
- **Leads + Experts:** Both stay under Admin section as separate items
- **Re-index (Index page):** Moves to Settings under "Index Management" section — `IndexPage.tsx` removed after migration

### Final sidebar structure (8 items)
```
Analytics
  Overview
  Gaps          ← second, highest-priority signal after Overview
  Intelligence
  Data          ← merged Searches + Marketplace with tabs

Tools
  Tools         ← Search Lab / Score Explainer / Index tabs

Admin
  Experts
  Leads
  Settings
```

### Tools page
- **Default tab:** Score Explainer (most diagnostic/educational)
- **Tab order:** Score Explainer | Search Lab | Index
- **Tab visual style:** Claude's discretion — pick what fits dark admin theme
- **Old URL redirects:** `/admin/search-lab`, `/admin/score-explainer`, `/admin/index` all redirect to `/admin/tools` (default tab, no pre-selection)

### Sidebar visual
- **Section labels:** Claude's discretion — visible labels or separators, whichever fits the dark aesthetic cleanest
- **Item order:** Confirmed above — Gaps second in Analytics (high priority)
- **Brand block:** Keep as-is (Tinrate icon + name + "Admin Console" subtitle)

### Claude's Discretion
- Tab visual style for Tools page (pill vs underline)
- Sidebar section labels vs separators
- Whether "Data" page uses URL query param or hash for tab state
- How to handle the `AdminApp.tsx` route rewiring cleanly

</decisions>

<specifics>
## Specific Ideas

- "The first view you get — the dashboard — should really give you a good first impression"
- "Seeing gaps in searches, tracking data etc. are the most important things" — reflected in Gaps being second in nav and zero-result queries on the dashboard
- "Improvement tools and search can move to a tab/Tools" — confirmed as ToolsPage
- "Re-index can move to settings" — confirmed under Index Management section
- The "Data" tab page keeps both Searches and Marketplace accessible without cluttering the sidebar

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-admin-platform-restructure*
*Context gathered: 2026-02-22*
