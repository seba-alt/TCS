# Phase 5: Email Gate UX - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an email capture gate to the Expert Cards. Expert results appear immediately in the chat (cards are visible), but the cards are greyed out and non-clickable until the user enters their email. Once submitted, cards unlock instantly and the gate disappears. Clicking through to Tinrate expert profiles is what is gated — not the results themselves.

</domain>

<decisions>
## Implementation Decisions

### Gate presentation
- Expert Cards appear greyed out (desaturated/muted, not blurred) immediately when results are shown
- Cards are non-clickable in this greyed-out state — they tease the results but prevent navigation
- Email capture form appears below the greyed-out cards (not above, not in a modal)
- On valid email submission: cards instantly become clickable and the email form disappears (no animation — instant state change)
- No modal, no slide-in panel — it's an inline flow within the chat message

### Email persistence
- Email is stored in localStorage after submission — returning visitors (same browser) see fully unlocked cards with no gate shown at all
- If localStorage has an email, cards appear immediately active on page load — zero friction for returning users
- No "unlocked for [email]" indicator shown — just silently unlocked
- Both client-side (localStorage) and backend storage: email is POSTed to the server for lead capture, AND saved to localStorage for UX

### Gate copy & value prop
- Primary framing: "Enter your email to view expert profiles" — direct, transactional
- Headline / main text: Claude's discretion — keep it short and action-oriented (aligned with "unlock profiles" theme)
- Submit button label: **"Unlock profiles"**
- Short privacy note below the email field (e.g. "We'll never spam you.") — required

### Validation & error states
- Invalid email format: Claude's discretion on exact error display (standard inline validation UX)
- Gate is **mandatory** — no dismiss option, no skip, no clicking away to close. Cards stay locked until email is submitted
- Backend failure handling: Claude's discretion — prioritize UX (unlock on localStorage even if backend fails) vs data integrity
- Loading state: Yes — button shows a spinner and input is disabled while the backend call is in flight. Cards unlock after the call resolves (or per discretion if it fails)

### Claude's Discretion
- Exact error display for invalid email format
- Exact headline/heading text in the gate (user said "you decide")
- Whether to unlock on backend failure or show retry (user said "you decide" — recommend unlock-anyway for UX)
- Backend endpoint design: reuse existing chat email field vs new `/api/email-capture` endpoint (user said "you decide")
- Loading state duration handling (timeout, retry logic)

</decisions>

<specifics>
## Specific Ideas

- The gate is a "tease" — users can SEE the experts (name, title, company, rate) but cannot click through. This is intentional to drive email submission.
- The greyed-out state should clearly communicate that the cards are locked/inactive, not broken
- Unlocking is instant — no animation — to feel responsive and rewarding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile*
*Context gathered: 2026-02-20*
