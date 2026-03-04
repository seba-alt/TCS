# Phase 67: Email Gate Polish & List View Fix - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Refine the email gate's visual presentation and focus behavior for a cleaner, more focused experience. Add save/bookmark functionality to list view expert cards. No new capabilities — polish and parity only.

</domain>

<decisions>
## Implementation Decisions

### Gate visual design
- Dark charcoal background (#1a1a2e) as a semi-transparent overlay/modal over the existing page
- Use "For Dark bg.png" as the logo on the gate
- Short copy — something like "Get access" with a brief prompt to enter email to unlock (keep it minimal, one or two short lines max)
- No lengthy descriptions or multiple headings — logo + short text + input

### Gate focus & interaction
- Email input auto-focuses when gate appears (timing at Claude's discretion)
- Search bar behind overlay cannot be interacted with (approach at Claude's discretion — overlay naturally blocks it)
- Both Enter key and button click submit the email form
- Gate dismisses with a smooth fade-out transition (~300ms)
- After gate dismissal, search bar receives focus automatically

### List view bookmark
- Save/bookmark button positioned in the top-right corner of each list view expert card
- Always visible (not hover-only) — important for mobile and discoverability
- Icon, filled/unfilled toggle states, and color identical to grid view
- Feedback behavior (toast, animation, etc.) matches whatever grid view currently does

### Claude's Discretion
- Exact auto-focus timing (immediate vs short delay)
- How search bar is visually treated behind the overlay
- Exact spacing, typography, and button styling within the gate
- Error state handling for invalid email input
- Fade-out animation easing and exact duration

</decisions>

<specifics>
## Specific Ideas

- Use the existing "For Dark bg.png" image file for the gate logo
- Copy tone: brief and action-oriented ("Get access", "Enter your email to unlock") — not formal or wordy
- Overlay style (not full viewport takeover) — page content visible but dimmed behind the gate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 67-email-gate-polish-list-view-fix*
*Context gathered: 2026-03-04*
