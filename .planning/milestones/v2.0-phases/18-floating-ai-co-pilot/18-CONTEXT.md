# Phase 18: Floating AI Co-Pilot - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A persistent floating action button (bottom-right) that opens a 380px slide-in conversation panel. Users describe what they need in natural language; the co-pilot (Sage) uses Gemini function calling to translate that into Zustand filter updates and grid re-fetches. Mobile: full-screen panel. Sage only navigates the expert grid — lead capture, match reports, and URL sharing are Phase 19.

</domain>

<decisions>
## Implementation Decisions

### FAB design
- Icon: Custom TCS branding mark (not a generic chat bubble or sparkle icon)
- Label: Icon only — no text label alongside
- First-visit attention: A tooltip appears once on first page load (e.g. "Try the AI assistant") — dismisses on click or after a few seconds; does not appear on subsequent visits
- When panel is open: FAB hides entirely — panel has its own close control

### Co-pilot tone & personality
- Name: **Sage**
- Voice: Warm and conversational with a touch of playfulness — "Got it! Found 43 marketing experts that fit your budget ✨" — friendly but not over-the-top
- Not formal, not minimal — has personality without getting in the way

### Conversation behavior
- Sage holds context across messages — follow-up messages layer on the current filter state (e.g. "now under €80" after an initial query refines rather than resets)
- Sage can reset all filters — "show everyone" or "start over" clears active filters and re-fetches the full grid
- Failed/ambiguous requests: Sage explains what it understood and asks for clarification — "I wasn't sure about X — did you mean Y?"
- Confirmation message always includes the resulting expert count — "Found 43 experts matching your criteria"

### Panel UX & layout
- First open: Short greeting from Sage + empty input — no example prompts, no noise
- Input: Auto-growing textarea (expands as user types; Enter to submit)
- Dismiss: Clicking outside the panel closes it
- Session persistence: Conversation history is preserved within the session — re-opening the panel shows the previous exchange
- Mobile: Panel expands to full-screen (per success criteria)

### Claude's Discretion
- Panel slide-in animation direction and duration
- Exact greeting text from Sage on first open
- Typing/loading indicator while Gemini processes the request
- Visual distinction between user messages and Sage messages in the conversation
- Exact tooltip copy and dismissal timing

</decisions>

<specifics>
## Specific Ideas

- Sage is the name — treat it as a character, not just a label. It should sign off or be referenced by name in the greeting.
- The Phase 17 empty state (zero results) includes a placeholder CTA pointing to Sage — this is the handoff Phase 18 completes by wiring the actual panel.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-floating-ai-co-pilot*
*Context gathered: 2026-02-21*
