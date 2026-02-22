# Phase 27: Newsletter Gate + Easter Egg - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the existing profile-unlock email gate as a newsletter subscription CTA with value-exchange framing. Subscription state persists via Zustand + localStorage. Returning v2.0 users (tcs_email_unlocked key) bypass automatically. Admins can see subscriber counts, full list, and export to CSV. Typing "barrel roll" or "do a flip" triggers a Framer Motion spin on the ExpertCards grid. No new tracking or analytics changes — existing conversation/Sage tracking is unaffected.

</domain>

<decisions>
## Implementation Decisions

### Modal tone & copy
- Tone: **exclusive & aspirational** — "Get access" feel, slightly premium
- Headline copy: Claude's discretion (roadmap copy is a starting point, not locked)
- Supporting copy: Include a brief anti-spam reassurance (e.g. "No spam, ever") — something that lowers friction without listing frequency or content type
- Submit button: **value-forward** framing (e.g. "Unlock Profiles" or "Get Access", not "Subscribe")

### Gate strictness
- **Soft gate** — modal is dismissible (X button present)
- After dismiss: modal re-appears on the **next "View Full Profile" click** (not once-per-session)
- Once subscribed: **permanently unlocked** (until localStorage cleared) — no expiry
- Email validation: **basic format validation** (must look like x@x.x before submit enables)
- Duplicate email submissions: Claude's discretion (handle gracefully, no alarming error)
- Post-subscribe unlock indicator: **none** — profiles just work, no toast or badge

### Easter egg
- Trigger phrases: "barrel roll" and "do a flip" (in Sage input or search input)
- Spin duration, repeat behavior, input clearing, and any supplemental feedback: **Claude's discretion** — optimise for delight without being annoying

### Admin subscriber view
- Location in admin: Claude's discretion (planner picks tab vs Leads section based on nav fit)
- Fields per subscriber: Claude's discretion (show whatever is naturally captured — at minimum email + signup date)
- **CSV export button** — one-click download of all subscriber emails (required)
- Subscriber count prominence: Claude's discretion (planner picks visual weight that fits admin layout)

### Claude's Discretion
- All visual layout details (modal design, card styling)
- Easter egg animation specifics (duration, repeat, input handling, supplemental feedback)
- Duplicate email UX
- Admin subscriber section placement and visual weight
- Subscriber list fields beyond email

</decisions>

<specifics>
## Specific Ideas

- Existing `localStorage['tcs_email_unlocked']` bypass is unchanged — v2.0 users are already unlocked
- The existing conversation/Sage tracking is retained as-is — no new tracking added in this phase
- Barrel roll targets the VirtuosoGrid container element (not individual ExpertCards) per planning notes — avoids scroll-triggered re-animations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-newsletter-gate-easter-egg*
*Context gathered: 2026-02-22*
