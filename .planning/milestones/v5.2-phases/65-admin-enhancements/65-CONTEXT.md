# Phase 65: Admin Enhancements - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin overview cards (Top Experts, Top Searches) gain "See All" expansion to show full ranked lists. Vercel Speed Insights is installed on the frontend. No new admin features or dashboard restructuring.

</domain>

<decisions>
## Implementation Decisions

### Expansion behavior
- Accordion pattern: only one card can be expanded at a time — expanding one collapses the other
- Expanded card has a max height with internal scrolling (card doesn't grow unbounded)
- All data is already loaded client-side — no additional API fetch needed on expand

### Expanded list presentation
- Top Experts rows: rank number (#1, #2...) + expert name + click count
- Top Searches rows: rank number + search query + frequency count
- No trend indicators — keep it simple with rank + label + count
- Uniform styling throughout the list — no visual distinction for top 5 vs rest

### Control placement & style
- "See All" appears as a text link in the card header (top-right area)
- When expanded, "See All" toggles to "Show less" in the same header position
- No count shown in the link (just "See All", not "See All (47)")
- Text link style — subtle, not a button

### Speed Insights
- Install `@vercel/speed-insights` and add the component to the app

### Claude's Discretion
- Expansion animation approach (smooth vs instant)
- Period toggle behavior during expansion (visible/locked)
- Max height value for expanded cards
- Exact styling and spacing

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

*Phase: 65-admin-enhancements*
*Context gathered: 2026-03-04*
