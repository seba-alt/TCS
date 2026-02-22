# Phase 32: Sage Direct Search Integration - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

When Sage performs a discovery query, its FAISS hybrid search results flow directly into the expert grid — no search bar text pollution, correct count in the header, working zero-result empty state, and sidebar filters always override Sage mode. This phase wires the backend `experts` array in the pilot response to the frontend store and guards `useExplore` from re-fetching while Sage mode is active.

</domain>

<decisions>
## Implementation Decisions

### Sage mode visual indicator
- Show a Sage avatar/icon in the results header when Sage mode is active
- Icon sits next to the expert count (e.g., [Sage icon] 12 experts)
- When user returns to normal filter mode, the icon fades out smoothly (opacity transition)
- No label change needed alongside the icon — the icon itself is the signal

### Empty state messaging
- Zero-result Sage queries use a Sage-specific message, not the generic "No experts found"
- Tone: encourage a new message — e.g. "No results. Try describing what you need differently in Sage"
- Text only — no CTA button; user naturally returns to the Sage chat input
- Whether the Sage icon appears in the header during zero-result state: Claude's discretion (keep consistent with the non-zero Sage mode behavior)

### Result count display
- Count label alongside the number: Claude's discretion — Sage icon is already the mode signal; avoid redundancy
- No tooltip or explanation for why fewer results are shown than the full database total
- Count animation on switch: Claude's discretion — match existing patterns
- Expert database total is dynamic — do NOT hardcode any fixed number (not 530, not any other value); always use the live count returned from the backend
- Result limit per Sage query is dynamic — Sage should be able to control how many results to return via request parameters
- Default fallback when Sage doesn't specify a count: Claude's discretion (document the chosen default)
- When exiting Sage mode, count behavior: Claude's discretion — should be consistent with how `setSageMode(false)` triggers `useExplore` to re-fetch

### Sidebar filter transition
- Typing in the search bar or adjusting the rate slider while in Sage mode shows a confirmation before switching modes
- Confirmation form: inline tooltip near the search bar input (not a modal)
- If user cancels the confirmation: Claude's discretion (pick least surprising behavior — likely revert the input)
- Tag chip selection: silently exits Sage mode with no confirmation (tag clicks are deliberate, no prompt needed)

### Claude's Discretion
- Sage icon design/asset choice (use existing Sage avatar if available in the codebase)
- Header icon placement exact pixel details
- Count animation specifics
- Exact copy of the confirmation tooltip
- Cancel behavior in the filter transition tooltip
- Whether Sage icon appears in header during zero-result state
- Default result count limit when Sage doesn't specify one
- Count transition behavior when exiting Sage mode

</decisions>

<specifics>
## Specific Ideas

- The expert database is actively growing — every count and total must come from live backend data, never hardcoded values
- The Sage icon should feel consistent with how Sage is represented elsewhere in the product (avatar, not a generic search icon)
- The inline tooltip for the filter transition should be non-blocking — user shouldn't feel trapped

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-sage-direct-search*
*Context gathered: 2026-02-22*
