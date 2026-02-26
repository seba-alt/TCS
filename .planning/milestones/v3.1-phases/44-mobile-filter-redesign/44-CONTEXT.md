# Phase 44: Mobile Filter Redesign - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the mobile filter bottom sheet (Vaul drawer) with inline dropdown controls so mobile users can filter experts without opening/dismissing a drawer. The Sage mobile bottom sheet (Vaul) must continue to work. Rate range filter is intentionally excluded from mobile.

</domain>

<decisions>
## Implementation Decisions

### Inline filter layout
- Filters sit in a horizontal scrollable row directly below the full-width search bar, above the expert grid
- Always visible without scrolling — no toggle/collapse needed
- Two dropdown buttons in the row: "Tags" and "Sort" (no rate range on mobile)
- Each is a compact dropdown button that opens a popover/menu on tap

### Tag selection pattern
- Tapping the "Tags" dropdown button opens a tag picker (Claude's discretion on exact format — scrollable checklist popover or full-screen picker, whichever works best for 18+ tags)
- Selected tags appear as removable "X" chips below the filter row — users can see and remove selections at a glance
- Filters apply instantly on each tag toggle (debounced to prevent API spam)
- A prominent "Clear all" button appears when any tag is selected — must visually jump out so users easily see and tap it

### Rate range
- Rate range filter is removed from mobile entirely — not in the filter row, not behind a "More" button
- Mobile experience simplified to tags + sort only

### Sort dropdown
- Default sort: relevance (existing behavior)
- Sort options: Relevance, Rate (low-high / high-low), Alphabetical (Name)

### Active filter feedback
- Tags dropdown button shows a badge count (e.g. "Tags (3)") when tags are selected
- Result count (e.g. "24 experts") displayed near the filter row or top of the grid, updates as filters change
- Empty state shows "No experts match your filters" message with a prominent "Clear filters" button

### Claude's Discretion
- Tag picker format (scrollable checklist popover vs full-screen modal — pick what works best for 18+ tags on mobile)
- Exact positioning and sizing of the clear-all button (must be prominent)
- Dropdown animation/transition style
- Debounce timing for instant filter apply
- Loading state while filters update

</decisions>

<specifics>
## Specific Ideas

- The "Clear all" button needs to really jump out — user explicitly wants it prominent and easy to find
- Sage mobile bottom sheet (Vaul) must not be affected by the filter redesign — only the filter drawer is being replaced
- Search bar should span full viewport width on mobile

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-mobile-filter-redesign*
*Context gathered: 2026-02-26*
