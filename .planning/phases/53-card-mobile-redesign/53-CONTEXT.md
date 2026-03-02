# Phase 53: Card & Mobile Redesign - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign expert cards for both mobile (bigger photo, name below centered, direct tap) and desktop (bigger photo, info inline right). Simplify mobile filter controls: remove clear button, remove search-within-tags and search-within-industry on mobile. Fix tag scroll glitch. Tag click resets search query on both platforms. No new card features or filter types.

</domain>

<decisions>
## Implementation Decisions

### Mobile Card Layout
- 2 cards per row (keep current grid)
- Photo takes ~40-50% of card height (balanced, not dominant)
- Below photo: name (centered), job title, hourly rate
- No tags, match reason, or company on mobile cards — keep it clean
- Keep monogram initials fallback for experts without photos
- Direct tap (no tap-expand) → newsletter gate → Tinrate profile (same flow as desktop)

### Desktop Card Layout
- Bigger profile photo on the left side
- Full current info inline to the right: name, title, company, rate, tags, match reason
- Keep grid/list view toggle from v4.0 — both views use the new bigger photo layout
- Keep current hover animation (lift + purple glow)
- Claude decides number of cards per row based on what fits the photo-left layout best

### Tag Interaction (Both Platforms)
- Clicking a tag resets the active search query (clears the search bar) on BOTH mobile and desktop
- Clicking a tag adds to existing active tags (does not replace them)
- Search query cleared, but tag filters accumulate

### Mobile Tag Simplification
- Remove search-within-tags filter input on mobile (the text input to filter the tag list)
- Remove search-within-industry filter input on mobile
- Keep both domain tags AND industry tags visible as scrollable options on mobile
- Just the search/filter inputs within each picker are removed — tags themselves stay

### Mobile Clear Button
- Remove the clear/reset button on mobile

### Tag Scroll Fix
- Fix the scrolling glitch on mobile tag row (visual glitching during horizontal scroll)

### Claude's Discretion
- Desktop cards per row (2 or 3 depending on photo-left layout fit)
- Card dimensions and spacing
- How list view adapts to the new photo-left layout
- Tag scroll glitch root cause and fix approach

</decisions>

<specifics>
## Specific Ideas

- Mobile cards should feel clean and visual — photo-forward, minimal text
- Desktop cards keep all the current info but reorganized around a bigger photo
- The tag search-within removal is specifically about the filter input inside the tag picker — not the tags themselves

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-card-mobile-redesign*
*Context gathered: 2026-03-02*
