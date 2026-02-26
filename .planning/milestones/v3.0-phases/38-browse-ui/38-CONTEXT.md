# Phase 38: Browse UI - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Netflix-style landing page at `/` with horizontal category rows of expert cards, a featured expert hero banner, glassmorphic card design with photo/monogram fallback, and navigation into Explorer via "See All" and "Explore All Experts". Sage integration and cross-page navigation are Phase 39.

</domain>

<decisions>
## Implementation Decisions

### Card design
- Compact cards (~160px wide), fitting 5-6 visible per row on desktop
- Frosted glass overlay: semi-transparent blur on bottom portion of card where name + rate appear, photo fills the full card behind
- Hover behavior: card expands slightly (scale up) revealing a tag row below existing info; other cards shift to accommodate
- Name + hourly rate visible in the frosted overlay area at all times
- Tags hidden by default, revealed on hover via the card expand animation

### Monogram fallback
- Claude's discretion — pick a style that fits the glassmorphic card aesthetic (gradient, solid color, etc.)

### Featured expert banner (hero)
- Auto-rotating carousel cycling through 3-5 featured experts with fade/slide transitions
- Medium height (~300px) — hero has breathing room but first category row peeks above the fold
- Includes "Explore All Experts" CTA button
- On mobile: same carousel but reduced height (~180px)

### Page spacing
- Spacious gaps between category rows (48-64px)
- Premium, uncluttered feel — rows breathe

### Category rows
- Row order top-to-bottom: Most Clicked → Trending → Highest Findability → Recently Joined
- Descriptive row labels: "Most Popular Experts", "Trending Now", "Top Rated Experts", "Recently Joined"
- Scroll indicators: fade edges on left/right hinting more content (no arrow buttons)
- "See All" appears in two places: inline with row title (right-aligned) AND as a special end-of-row card at the scroll end
- Snap scroll behavior, no visible scrollbar

### Skeleton loading
- Per-card skeleton placeholders while data loads — no blank rows at any point

### Mobile behavior
- Category rows stay horizontal with touch-swipe (same pattern as desktop)
- Tap-to-expand replaces hover: tap a card to expand and show tags, tap again or elsewhere to collapse
- Expanded card action (what second tap on expanded card does): Claude's discretion — pick the most natural interaction pattern

### Claude's Discretion
- Monogram fallback visual style
- Expanded card tap action on mobile
- Exact skeleton placeholder design
- Loading skeleton animation style
- Card border radius and shadow values
- Transition/animation timing and easing
- Error state handling (failed data fetch)

</decisions>

<specifics>
## Specific Ideas

- Netflix-style hero banner with auto-rotating featured experts — cinematic feel
- Cards should expand on hover like interactive tiles, not just change opacity or color
- "See All" as both a title link and end-of-row card maximizes discoverability
- Fade edges for scroll cues — clean, no extra UI chrome

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-browse-ui*
*Context gathered: 2026-02-24*
