# Phase 61: Lead Journey Timeline - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can inspect the full chronological history of any lead's interaction with the marketplace. Displays searches and expert clicks in a timeline within the existing leads table. No new data collection — surfaces existing conversation/event data in a visual timeline.

</domain>

<decisions>
## Implementation Decisions

### Expand interaction
- Inline row expand — clicking a lead row reveals the timeline directly below it in the table
- Accordion behavior — only one row expanded at a time; expanding a new row collapses the previous
- Smooth slide-down animation (~200ms transition)

### Timeline visual style
- Search events and click events are visually distinct — different icons and subtle color accents
- Newest events first (most recent at top)
- Show last ~10 events initially with a "Load earlier events" button for leads with many events

### Event detail depth
- Search events: query text + number of results returned
- Click events: expert name (clickable link to expert profile) + which search query preceded the click
- Timestamps: relative time as primary display ("2h ago"), exact timestamp on hover

### Time gap presentation
- Inline label between events when gap is 30+ minutes (e.g., "2 hours later", "3 days later")
- Smart rounding to natural language units (minutes, hours, days)
- Long gaps (1+ day) get emphasized styling (bolder or with a divider line) to highlight return visits

### Claude's Discretion
- Expand affordance design (chevron, hover effect, or other)
- Timeline layout style (vertical line with nodes vs flat event list)
- Exact color palette and icon choices for event types
- Exact styling of gap labels and emphasis treatment

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

*Phase: 61-lead-journey-timeline*
*Context gathered: 2026-03-03*
