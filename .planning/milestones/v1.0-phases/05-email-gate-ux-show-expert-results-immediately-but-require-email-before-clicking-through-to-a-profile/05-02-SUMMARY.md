---
phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, localStorage, email-gate, hooks]

# Dependency graph
requires:
  - phase: 03-frontend
    provides: ExpertCard, ChatMessage, App.tsx, useChat hook, types.ts
  - phase: 05-01
    provides: /api/email-capture backend endpoint accepting POST {email}

provides:
  - useEmailGate hook with lazy localStorage initializer, no returning-user flash
  - EmailGate inline form component with spinner, validation, privacy note
  - ExpertCard locked prop rendering greyed-out non-interactive div
  - ChatMessage gate insertion below last expert message only
  - App.tsx wired with useEmailGate, real email passed to useChat when available
affects: [phase-06-thumbs-feedback, phase-07-analytics-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "localStorage lazy useState initializer — synchronous read before first render, no useEffect flash for returning users"
    - "unlock-on-localStorage policy — write localStorage first, fire-and-forget backend POST; backend failure is silent"
    - "locked prop pattern on ExpertCard — single prop switches between interactive anchor and non-interactive div"
    - "lastExpertMsgIndex reduce inside map — simple pattern for single-gate placement across multi-turn chat"

key-files:
  created:
    - frontend/src/hooks/useEmailGate.ts
    - frontend/src/components/EmailGate.tsx
  modified:
    - frontend/src/components/ExpertCard.tsx
    - frontend/src/components/ChatMessage.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Lazy useState initializer (not useEffect) for localStorage read — prevents flash of locked state for returning users"
  - "localStorage write before backend POST — UX unlock is immediate; backend failure does not re-lock"
  - "locked renders as <div> not <a> — keyboard users cannot tab-activate a locked link; aria-hidden on locked cards"
  - "EmailGate only on last expert message (lastExpertMsgIndex reduce) — prevents duplicate forms in multi-turn chat"
  - "PLACEHOLDER_EMAIL remains fallback in useChat — pre-gate chat requests remain valid; real email used when available"

patterns-established:
  - "Gate-then-unlock UX: show greyed content immediately, gate blocks interaction, instant unlock on form submit"
  - "Fire-and-forget backend sync: localStorage is source of truth, backend failure never degrades UX"

requirements-completed: [EMAIL-GATE-01]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 05 Plan 02: Email Gate UX Summary

**localStorage-backed email gate with instant unlock: greyed ExpertCards on first visit, inline EmailGate form on last expert message, instant unlock on submission, zero-friction returning user experience**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T18:44:27Z
- **Completed:** 2026-02-20T18:47:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `useEmailGate` hook with lazy localStorage initializer — returning users see unlocked cards with zero flash on page load
- Created `EmailGate` inline form component with client-side validation, spinner state, privacy note, and accessible ARIA markup
- Added `locked` prop to `ExpertCard` — locked renders as greyed-out `<div>` (grayscale opacity-60 pointer-events-none) blocking all interaction
- Wired `ChatMessage` to show locked cards on all expert messages when !isUnlocked, with `EmailGate` only on the last expert message
- App.tsx wired to use real email in useChat when available, falling back to PLACEHOLDER_EMAIL for pre-gate requests

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useEmailGate hook and EmailGate component** - `54e3b18` (feat)
2. **Task 2: Wire email gate into ExpertCard, ChatMessage, and App.tsx** - `1c3768b` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `frontend/src/hooks/useEmailGate.ts` — localStorage-backed email gate state and submitEmail async function
- `frontend/src/components/EmailGate.tsx` — inline email capture form with spinner, validation, privacy note (72 lines)
- `frontend/src/components/ExpertCard.tsx` — added locked prop: renders greyed-out non-interactive div when locked=true
- `frontend/src/components/ChatMessage.tsx` — imports EmailGate, adds gate insertion below last expert message, passes locked prop to ExpertCard
- `frontend/src/App.tsx` — calls useEmailGate, passes real email to useChat, computes lastExpertMsgIndex for gate placement

## Decisions Made

- **Lazy useState initializer for localStorage:** Using `useState<string | null>(() => localStorage.getItem(STORAGE_KEY))` runs synchronously before first render — no useEffect flash of locked state for returning users.
- **Unlock on localStorage write (not backend response):** `submitEmail` writes localStorage and calls `setEmail` before awaiting the backend POST. Backend failure is silently caught — localStorage is the UX source of truth.
- **locked renders as `<div>` not `<a>`:** Ensures locked cards are not keyboard-navigable. `aria-hidden="true"` prevents screen readers from announcing non-interactive content as a link.
- **EmailGate only on last expert message:** Using `messages.reduce()` inside the map callback to find `lastExpertMsgIndex` — prevents duplicate EmailGate forms appearing in multi-turn chat sessions.
- **PLACEHOLDER_EMAIL as fallback:** `email ?? PLACEHOLDER_EMAIL` in useChat ensures all chat requests are valid even before gate submission, maintaining existing backend contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The `/api/email-capture` endpoint (built in 05-01) receives fire-and-forget POSTs; gate works fully even if that endpoint is unavailable.

## Next Phase Readiness

- Email gate UX complete and deployed. Expert cards are locked for new users, unlocked instantly after email submission, and always unlocked for returning users (localStorage).
- Phase 6 (thumbs up/down feedback) can proceed — the email from `useEmailGate` is available in App.tsx to attach to feedback submissions.

---

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/hooks/useEmailGate.ts
- FOUND: frontend/src/components/EmailGate.tsx
- FOUND: frontend/src/components/ExpertCard.tsx
- FOUND: frontend/src/components/ChatMessage.tsx
- FOUND: frontend/src/App.tsx

Commits verified:
- 54e3b18: feat(05-02): create useEmailGate hook and EmailGate component
- 1c3768b: feat(05-02): wire email gate into ExpertCard, ChatMessage, and App.tsx

TypeScript: zero errors
Vite build: PASSED (built in 2.16s)

---
*Phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile*
*Completed: 2026-02-20*
