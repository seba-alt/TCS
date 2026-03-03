# Phase 52: Explorer & Search UX - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Explorer immediately usable on load: autofocused search bar, randomized initial results weighted by findability score, sort-by dropdown removed (always best match), working autocomplete with tag-first suggestions, Intercom CTA on no-results, and dynamic rate slider that resizes to actual max. No new search features or filter types.

</domain>

<decisions>
## Implementation Decisions

### Initial Expert Ranking
- Randomize initial display on every page load, weighted by findability score (Claude picks exact algorithm)
- Show ALL experts — low-score experts pushed to the bottom, not excluded
- Once user searches or filters: switch to pure relevance ranking (no randomization)
- When user clears search and returns to initial view: show the same random order from page load (session-stable)

### No-Results Intercom CTA
- Add alongside existing tag suggestions and clear-all option (don't replace them)
- Copy combines both tones: "Can't find what you need? Request an expert" + "Need help finding the right expert? Chat with us"
- Clicking the CTA opens the Intercom messenger widget directly (no form, no page)

### Autocomplete Suggestions
- Tags should rank first in suggestion results, before job titles and companies
- Selecting any suggestion (including tag suggestions) performs a text search — not a tag filter
- Current issue: suggestions are not relevant enough — investigate and fix matching quality
- Keep existing debounced FTS5 approach, improve ranking

### Rate Slider
- Slider range dynamically resizes to the actual max rate in the current filtered result set (e.g., 0–$300 not 0–$5000)
- Show a label with the current max rate (e.g., "$300/hr max")
- If user's rate filter exceeds new max after a filter change, auto-adjust filter value down to the new max
- Slider updates when search/tag/filter context changes

### Sort-by Removal
- Remove the sort-by dropdown entirely
- Default and only ordering: best match (relevance for searches, findability-weighted random for initial view)

### Search Bar Autofocus
- Search bar receives focus automatically on page load — ready for immediate typing

### Claude's Discretion
- Exact randomization algorithm (weighted random, tiered shuffle, etc.)
- Autocomplete FTS5 matching improvements
- Intercom CTA visual styling and exact copy phrasing
- Rate slider animation/transition when range changes

</decisions>

<specifics>
## Specific Ideas

- The autocomplete currently shows job titles, companies, and tags — tags should be prioritized higher
- Rate slider should feel responsive when the range changes, not jarring
- The no-results Intercom CTA should feel helpful, not like a dead end

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-explorer-search-ux*
*Context gathered: 2026-03-02*
