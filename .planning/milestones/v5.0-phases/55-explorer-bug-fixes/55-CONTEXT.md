# Phase 55: Explorer Bug Fixes - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix visual/UX issues on the Explorer surface: match tier sorting, currency symbols, mobile card completeness, mobile clear-all button, and Open Graph social sharing tags. No new features — these are corrections and completions of existing functionality.

</domain>

<decisions>
## Implementation Decisions

### Mobile card layout
- Company name displayed below job title (third text line)
- Match badge (Top Match / Good Match) positioned as a top corner tag/ribbon
- Card height is FIXED — all cards uniform height in the grid
- Name allowed to wrap to 2 lines max (currently 1-line truncate)
- Priority when space is tight: name (2 lines) → company → rate + badge. Job title hides first if space is constrained
- Photo-centric layout stays (80px centered photo)

### Match tier sorting
- Sort by tier group: all Top Match first, then all Good Match, then unscored rest
- Within each tier group, maintain existing `final_score` ordering (relevance-ranked within tier)
- No visual separators or section headers between groups — just sort order
- Only applies when a search query is active (existing behavior for when badges appear)

### Currency symbols
- Symbol placed BEFORE the number: €250/hr, $150/hr, £200/hr
- Currency code from CSV `currency` column mapped to symbol (EUR→€, USD→$, GBP→£, etc.)
- Fallback: show text code as-is for any unrecognized currency
- Applied everywhere rates are displayed (mobile + desktop cards, any other surfaces)

### Open Graph tags
- Image: `Logo Icon Purple.png` from frontend folder
- Title: "Tinrate" (or "Tinrate — [tagline]")
- Description: Claude's discretion — write a concise, compelling description

### Claude's Discretion
- OG description text (concise, compelling)
- Exact mobile card fixed height value (must fit: photo, 2-line name, company, rate)
- Mobile clear-all button placement and styling (must be clearly visible and accessible)
- Currency symbol mapping implementation (lookup table vs library)

</decisions>

<specifics>
## Specific Ideas

- Mobile cards should feel uniform — fixed height, no card-to-card height variation in the grid
- Match badge as top corner element — like a ribbon or small tag overlay
- Currency display should be standard across ALL surfaces, not just cards

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-explorer-bug-fixes*
*Context gathered: 2026-03-03*
