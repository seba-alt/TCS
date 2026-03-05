# Phase 6: Thumbs up/down feedback — Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add thumbs up/down rating buttons below each expert cards result set. Clicking thumbs-down opens a suggestion modal where users can provide more detail. All feedback (vote type, reasons, free text, expert IDs shown, conversation ID, and email if available) is stored in the database. The expert cards themselves, the email gate, and the RAG search logic are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Feedback UI placement & visibility
- Thumbs appear **below the expert cards block** — after the user has seen all three experts
- Only the **most recent result set** gets thumbs; earlier exchanges in a conversation do not show voting controls
- Thumbs are **always visible** (not hover-to-reveal), but color in / fill when the user hovers over them — keep them small and unobtrusive
- A **subtle label** sits above the thumbs (e.g. "Were these results helpful?") to orient the user

### Downvote suggestion sheet
- Clicking thumbs-down opens a **centered modal dialog** overlay
- Modal contains **preset checkboxes + an optional free-text field** — Claude picks 3–4 sensible reasons (e.g. "Wrong experts shown", "Experts not relevant to my problem", "Experts seem unavailable", "Other")
- **Submitting the form is optional** — the thumbs-down vote is recorded the moment the thumb is clicked; the modal collects extra detail but closing without submitting is fine

### Feedback state & interaction
- After voting, the **selected thumb stays highlighted** (filled/colored) — no extra confirmation text needed
- Users **can switch** their vote by clicking the other thumb (thumbs-up → thumbs-down or vice versa)
- Clicking the **already-selected thumb does nothing** — no deselect/unvote behaviour
- Vote state is **not persisted across page reloads** — fresh state each session; the DB record stands but the UI resets

### Data captured in DB
- Each feedback record is **linked to conversation_id** so it can be traced back to the exact query
- The **expert IDs shown** in that result set are stored with the feedback record (enables future analysis of which experts get negative feedback most)
- **Email is included if available** — pulled from the email gate submission if the user already provided one
- API endpoint approach: **Claude's discretion** — likely `POST /api/feedback`, consistent with the existing REST structure

### Claude's Discretion
- Exact checkbox reasons in the suggestion modal (pick 3–4 sensible ones)
- Thumb icon style (SVG icons or emoji-based — match existing Tinrate brand)
- Hover/active color for the thumb buttons
- Exact label wording above the thumbs
- API endpoint naming and request schema

</decisions>

<specifics>
## Specific Ideas

- Thumbs should be **small and unobtrusive** — user's words: "do not make it too big"
- Thumbs are always visible but only fill/color on hover — subtle affordance, not a prominent call-to-action
- The downvote modal should feel lightweight — it's asking for optional extra context, not blocking the user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db*
*Context gathered: 2026-02-20*
