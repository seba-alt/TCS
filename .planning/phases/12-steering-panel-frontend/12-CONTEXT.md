# Phase 12: Steering Panel Frontend - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The admin Intelligence tab becomes a live control panel. Admins can see and edit all feature flags (as toggles) and numeric thresholds, save changes, and receive inline feedback — without leaving the page or redeploying. The backend settings API (Phase 11) must exist; this phase is purely the frontend layer on top of it.

</domain>

<decisions>
## Implementation Decisions

### Toggle behavior
- No loading indicator during the async save — assume near-instant, no spinner or disabled state
- Claude's Discretion: optimistic update vs wait-for-confirm; error handling style; success confirmation style

### Threshold inputs
- Each threshold has a tooltip on hover (ℹ icon or similar) explaining what it controls — not inline text, not just a bare label
- Claude's Discretion: slider vs number input vs combined; save trigger (blur, explicit button, or real-time); validation timing (inline vs on-save)

### Save flow
- Save confirmation message stays visible for ~4 seconds before fading
- A dirty state indicator is shown when there are unsaved threshold changes (e.g. Save button highlights or a dot/badge appears) — admin should know when they have pending changes
- Claude's Discretion: global Save button vs per-row Save; placement of inline success/error feedback

### Source display
- Claude's Discretion: all source display decisions (label visibility, badge vs tooltip vs text; whether env-var-sourced toggles are interactive or read-only; whether a reset-to-env-var action exists; whether thresholds also show their source)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-steering-panel-frontend*
*Context gathered: 2026-02-21*
