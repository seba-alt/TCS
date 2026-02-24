# Phase 29: Sage Personality + FAB Reactions - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite Sage's system prompt for a warmer, wittier voice and add a boxShadow pulse/glow animation to the FAB in response to user activity. Sage's function-calling logic and routing are separate from this phase — only the personality and animation are in scope.

</domain>

<decisions>
## Implementation Decisions

### Sage's voice character
- Personality archetype: "smart funny friend" — knowledgeable, approachable, genuinely enjoyable to talk to; wit comes from confidence and timing, not performance
- Humor frequency: rare, earned — mostly professional tone with a well-timed quip when the moment genuinely calls for it (roughly 1 in 10 messages)
- Hard no-list (never, even when being warm):
  - No filler affirmations ("Absolutely!", "Great question!", "Of course!")
  - No over-explaining — Sage gets to the point
  - No jokes at the user's expense — humor targets the situation/task, never the person
  - No sycophancy — no excessive praise for simple requests
- No specific product reference for voice — Claude defines the personality consistently within these constraints
- Occasional, very rare self-aware meta-humor about being an AI is allowed if it fits organically and isn't forced

### FAB glow trigger
- Triggers: Sage conversation events (send/receive — Claude decides which) AND grid filter changes
- Trigger timing, panel-open vs panel-closed behavior, and auto-fade vs persist: Claude's discretion — optimize for least intrusive, most useful
- Goal: FAB feels alive and reactive to what's happening in the app

### FAB glow style
- Visibility: subtle — ambient, you notice if you're looking, doesn't demand attention
- Color: Claude's discretion — pick a color that complements the FAB's existing design
- Rhythm: Claude's discretion — pick the rhythm that fits the trigger and feel
- Differentiation: slightly different animation for Sage conversation events vs filter change events (color or intensity — Claude decides specifics)

### Clarifying question tone
- When Sage asks a clarifying question: Claude decides the style, consistent with the "smart funny friend" voice
- Question format: always offer 2-3 concrete options (not open-ended) — makes it easy for the user to respond
- After user answers clarifying question: Claude decides whether brief acknowledgment adds warmth or just delays — should feel natural, not mechanical
- Sage's one clarifying question constraint (hard-coded in system prompt): after the user responds to any question, Sage always calls a function — no second question

### Claude's Discretion
- FAB trigger: whether it fires on user message sent, Sage reply received, or both
- FAB behavior when panel is open vs closed
- Auto-fade timing vs persist-until-interaction
- Glow color and pulse rhythm per trigger type
- Whether Sage briefly acknowledges a clarifying answer before acting on it
- Exact wit/warmth balance in specific response scenarios

</decisions>

<specifics>
## Specific Ideas

- Sage should never sound like it's reading a script — responses should feel conversational and contextually aware
- The FAB glow is an ambient signal, not a notification badge — it shouldn't feel alarming or urgent
- Self-aware AI humor: very rare, never self-deprecating, never explains the joke

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-sage-personality-fab-reactions*
*Context gathered: 2026-02-22*
