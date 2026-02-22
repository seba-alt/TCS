# Phase 28: Sage Search Engine - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Sage gains a `search_experts` function tool. When a user asks Sage to find experts, Sage calls `/api/explore` in-process, narrates the results in the panel, and syncs the main expert grid. Creating posts, expert profiles, and user-to-user interactions are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Sage narration format
- Summary includes: result count + 1-2 expert names + skill highlights (e.g., "Found 8 fintech experts, including Sarah Chen and Marcus Reid, with backgrounds in payments, risk, and blockchain")
- Tone adapts to result count — more enthusiastic for a tight, well-matched set; matter-of-fact for large generic returns
- No follow-up nudge after summary — Sage delivers results and waits; user decides what to do next
- No filter recitation — Sage does not restate what criteria it applied; keep the message clean

### Panel expert display
- Text only in the Sage panel — no mini-cards or visual expert previews
- Sage names 1-2 experts inline in the text summary for personalization
- Sage includes a brief grid acknowledgment in the message (e.g., "Updated the grid for you") — makes the connection between panel response and grid change explicit

### Zero-result handling
- Primary response: acknowledge + suggest closest match — e.g., "No fintech experts at $200/hr — found 3 at $250/hr though"
- Suggestion is always a specific closest match, not general broadening advice
- Grid stays as-is when zero results — user acts on Sage's suggestion if they choose to
- If the closest-match alternative also returns zero results: Sage resets the grid to show all experts (unfiltered fallback) and states it couldn't find a match

### Grid state on search
- Sage replaces all current filters when calling `search_experts` — full control, clean slate
- After Sage's search, manual filter changes from the user apply normally with no Sage acknowledgment — user takes back control silently
- Sage's applied filters are fully reflected in the filter UI (chips, sliders, tags show Sage's values — user can see and modify them)
- If result count is 100+, Sage mentions the size and suggests narrowing (e.g., "Found 120 experts — want me to narrow by specialty or rate?")

### Claude's Discretion
- Exact threshold for "large result set" (100+ is the stated intent; Claude can tune)
- Loading/transition state while grid syncs
- Exact wording of the grid acknowledgment line

</decisions>

<specifics>
## Specific Ideas

- No specific UI references given — open to standard approaches for the panel text layout
- The "Updated the grid for you" line should feel like a natural part of Sage's message, not a separate system notice

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-sage-search-engine*
*Context gathered: 2026-02-22*
