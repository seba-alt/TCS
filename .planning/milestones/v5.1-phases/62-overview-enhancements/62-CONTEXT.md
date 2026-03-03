# Phase 62: Overview Enhancements - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add three new dashboard cards to the existing Overview page: top experts by click volume, top search queries, and zero-result queries as unmet demand signals. All cards respect the existing period toggle (Today / 7d / 30d / All). No changes to existing Overview cards or the period toggle itself.

</domain>

<decisions>
## Implementation Decisions

### Card layout & placement
- New cards appear in a new row below the existing overview stats
- 3-column equal-width grid on desktop (all three side by side)
- Full-width vertical stack on mobile
- Each card has a title header with a small icon

### Ranking presentation
- Each card shows a top 5 ranked list
- Display as numbered rows with count (e.g., "1. Expert Name — 42 clicks")
- Expert names in the top experts card are clickable links to their profile in the admin panel
- Search queries in the top queries card are display-only (no click interaction)

### Unmet demand display
- Card titled "Unmet Demand" — positive, action-oriented framing
- Shows frequency count next to each zero-result query (e.g., "blockchain — 7 searches")
- Sorted by frequency (most-searched gaps first)
- Same card styling as the other two cards (no special accent or emphasis)

### Empty/low data states
- Cards with no data show a short inline message (e.g., "No activity today") — card stays visible
- Unmet demand card empty state is positive: "All searches returned results" with a subtle checkmark
- Cards with fewer than 5 items show only what's available (no placeholder padding)
- Skeleton loader while data is being fetched (placeholder lines, no spinner)

### Claude's Discretion
- Exact icon choices for each card header
- Skeleton loader design details
- Card border/shadow styling to match existing admin cards
- Exact wording of empty state messages

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

*Phase: 62-overview-enhancements*
*Context gathered: 2026-03-03*
