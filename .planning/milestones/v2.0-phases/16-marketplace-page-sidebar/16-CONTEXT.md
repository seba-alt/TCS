# Phase 16: Marketplace Page & Sidebar - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the marketplace page layout with a collapsible faceted sidebar for filtering experts (rate range, domain tags, text search) and active filter chip display. This is the visible frame — expert grid (Phase 17) and co-pilot (Phase 18) attach to it. Lead capture, URL state, and empty states are Phase 19.

</domain>

<decisions>
## Implementation Decisions

### Sidebar layout
- Collapsible left panel — desktop users can also collapse it to gain more grid space
- When collapsed: icon strip showing filter category icons (not fully hidden, not just a toggle arrow)
- Sticky — sidebar stays fixed to the viewport as the user scrolls down through results
- Visual treatment: light background panel (gray-50 or similar) with a thin divider separating it from the grid

### Filter control interactions
- Rate range slider: Claude's discretion on debounce vs on-release timing
- Domain tag multi-select: Claude's discretion on visual style (checkboxes, toggleable pills, or dropdown)
- Loading state while fetch is in flight: skeleton cards replace the expert grid
- Text search: debounce on type (~300–400ms) AND Enter key triggers immediately without waiting for debounce

### Active filter chips
- Chips appear in a horizontal strip above the expert grid, below the page header
- Each chip shows: label + × to individually dismiss that filter (e.g. "Marketing ×", "€50–€100 ×")
- "X experts found" count displayed near the chip strip, updates on each fetch result
- "Clear all" text link at the end of the chip strip — only visible when at least one filter is active

### Mobile bottom-sheet
- Trigger: toolbar button at the top of the page (not a floating FAB)
- Height: snap points — half height and full height, with a drag handle for resizing
- Apply behavior: staged — user configures all filters, then taps "Apply" which closes the sheet and triggers fetch
- Dismiss paths: backdrop tap + drag down + Apply button (Apply also triggers the fetch)

### Claude's Discretion
- Rate slider debounce timing (on-release vs debounce ms)
- Exact visual style for domain tag multi-select
- Skeleton card design
- Exact icon choices for the collapsed sidebar icon strip
- Sidebar width when open

</decisions>

<specifics>
## Specific Ideas

- No specific product references given — open to standard marketplace conventions
- Mobile filter behavior is explicitly staged (not live), which differs from desktop (live with debounce)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-marketplace-page-sidebar*
*Context gathered: 2026-02-21*
