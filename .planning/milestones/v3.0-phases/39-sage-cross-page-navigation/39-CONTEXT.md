# Phase 39: Sage Cross-Page Navigation - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Sage operates as a persistent co-pilot across both Browse and Explorer. Conversation history survives in-app navigation, and discovery searches from Browse land the user in Explorer with results already loaded. No new Sage capabilities — just cross-page presence and handoff.

</domain>

<decisions>
## Implementation Decisions

### FAB placement & behavior
- Identical purple FAB at root layout level — visible on ALL pages above the route outlet
- On Browse: Sage opens as a compact popover (not the full-height side panel used on Explorer)
- On Explorer: existing full-height side panel behavior unchanged
- Panel/popover overlays content (no push/shrink layout)

### Navigation handoff
- Instant React Router navigation — no transition animation or loading overlay
- Pre-load discovery results into Zustand `navigationSlice.pendingSageResults` BEFORE navigating so Explorer skips default 530-expert fetch entirely (no flash)
- Sage panel stays CLOSED on Explorer landing — user sees results in grid, can open Sage via FAB to see conversation
- On back-navigation (Browse ← Explorer), Sage popover always starts closed regardless of previous state

### Conversation continuity
- Full conversation history visible when user opens Sage on Explorer after Browse conversation
- Conversation stored in Zustand only (in-app memory) — clears on page refresh
- Direct `/explore` URL visits start with a clean Sage panel (no stale conversation from previous navigation)
- No visual indicator of conversation origin — messages flow seamlessly as one thread

### Discovery search flow
- Sage responds in Browse popover first (e.g., "Found 5 AI experts. Taking you there..."), then auto-navigates after ~2 seconds
- ALL question types work in the Browse popover — general questions stay on Browse, only discovery searches trigger navigation
- Multiple questions accumulate in the popover like a mini-chat — navigation only triggers after a discovery response

### Claude's Discretion
- Exact popover dimensions and positioning on Browse
- Popover open/close animation
- How to distinguish discovery vs non-discovery responses (classification logic)
- Loading states within the popover while Sage is thinking

</decisions>

<specifics>
## Specific Ideas

- Browse popover should feel like a lightweight chat bubble — quick interactions, not a full workspace
- The ~2 second delay before auto-navigation gives user time to read "Found X experts. Taking you there..."
- Explorer full panel remains the "power user" Sage experience; Browse popover is the casual entry point

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-sage-cross-page-navigation*
*Context gathered: 2026-02-24*
