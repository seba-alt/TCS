# Phase 69: Admin Saved Insights - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Top Saved Experts" ranked card to the admin overview and display save/unsave events in lead timelines. No new event types or tracking — this consumes save events from Phase 68.

</domain>

<decisions>
## Implementation Decisions

### Top Saved card content
- Follow the exact same pattern as existing Top Experts/Top Searches cards (row format, count display, number of rows, empty state)
- Positioned after Top Searches as the last ranked card
- Each row shows expert info and save count in the same format other cards use
- Responds to the existing period toggle (Today / 7d / 30d / All)
- Empty state matches whatever other cards show when no data exists

### Save ranking logic
- Rank by total save event count (not net saves, not unique savers)
- Each save event counts regardless of subsequent unsaves
- Count display format matches existing cards

### Timeline event display
- Save and unsave events use distinct icons: filled bookmark for save, outline/crossed bookmark for unsave
- Events appear chronologically alongside existing searches and clicks in the lead timeline
- No separate section — mixed into the existing timeline

### Claude's Discretion
- Event text format next to save/unsave icons in timeline (match existing patterns)
- Visual prominence of save events relative to searches and clicks
- Exact icon choices and colors for save/unsave distinction
- Card styling details (follows existing card component patterns)

</decisions>

<specifics>
## Specific Ideas

- Everything should match existing admin card and timeline patterns — consistency is the priority
- "Top Saved Experts" card is the third ranked card, after Top Experts and Top Searches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 69-admin-saved-insights*
*Context gathered: 2026-03-04*
