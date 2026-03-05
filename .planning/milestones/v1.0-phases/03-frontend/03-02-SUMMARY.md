---
phase: 03-frontend
plan: "02"
subsystem: ui
tags: [react, typescript, tailwind, components, chat-ui, expert-card, mobile-first]

# Dependency graph
requires:
  - phase: 03-01
    provides: Vite+React+TS scaffold, Tailwind brand color tokens, shared TypeScript types (Expert, Message)
provides:
  - Header component: fixed top bar with logo and tagline
  - ChatMessage component: user/assistant bubbles with streaming cursor and ExpertCard integration
  - EmptyState component: welcome message with 3 example prompt suggestion chips
  - ExpertCard component: clickable anchor card opening profile_url in new tab with initials avatar
  - ChatInput component: fixed bottom textarea with Enter-to-submit, spinner while disabled, iOS safe-area support
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fixed top header + fixed bottom input bar (iMessage/Intercom layout pattern)
    - import type syntax required for interface imports (verbatimModuleSyntax TS config)
    - Inline style for iOS safe-area-inset-bottom (no Tailwind plugin needed)
    - Initials avatar fallback (no photo URL in Expert type)

key-files:
  created:
    - frontend/src/components/Header.tsx
    - frontend/src/components/ChatMessage.tsx
    - frontend/src/components/EmptyState.tsx
    - frontend/src/components/ExpertCard.tsx
    - frontend/src/components/ChatInput.tsx
  modified: []

key-decisions:
  - "import type syntax required — verbatimModuleSyntax in tsconfig.app.json requires type-only imports for interfaces"
  - "ExpertCard created in Task 1 (not Task 2) to resolve ChatMessage import dependency at build time"
  - "iOS safe-area padding via inline style prop (max(12px, env(safe-area-inset-bottom))) not Tailwind class — avoids PostCSS plugin complexity"
  - "Initials avatar as two-letter fallback — Expert type has no photo URL field"

patterns-established:
  - "import type for all type/interface imports from types.ts (verbatimModuleSyntax compliance)"
  - "Fixed layout: Header z-10 top-0, ChatInput z-10 bottom-0, chat content scrolls in between"
  - "ExpertCard as anchor tag (not button) — native link semantics, target=_blank, rel=noopener noreferrer"
  - "Textarea auto-resize via onInput handler (not CSS field-sizing) — broad browser support"

requirements-completed: [CHAT-01, CHAT-02, REC-03, REC-04]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 3 Plan 02: Presentational Components Summary

**Five Tailwind-styled React components — Header, ChatMessage, ExpertCard, ChatInput, EmptyState — typed with Expert and Message interfaces, mobile-first with iOS safe-area support**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T13:00:29Z
- **Completed:** 2026-02-20T13:03:04Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- Built all five presentational components: Header (fixed top), ChatInput (fixed bottom textarea with spinner), ChatMessage (user/assistant bubbles with streaming cursor), ExpertCard (clickable anchor to profile_url), EmptyState (welcome + 3 prompt chips)
- All components fully typed with named TypeScript imports from types.ts — no `any`
- Mobile-first and responsive: ChatInput handles 375px viewport, iOS safe-area inset, touch-friendly 48px min-height; ExpertCards stack vertically one per row

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Header, ChatMessage, and EmptyState components** - `a77bcba` (feat)
2. **Task 2: Build ExpertCard and ChatInput components** - `e581fa5` (feat)

## Files Created/Modified

- `frontend/src/components/Header.tsx` - Fixed top bar with logo (/logo.png, graceful onError fallback) and tagline
- `frontend/src/components/ChatMessage.tsx` - User (right, black) and assistant (left, gray) bubbles; streaming cursor; ExpertCard list below assistant messages
- `frontend/src/components/EmptyState.tsx` - Welcome heading, subtext, 3 example prompt buttons that call onPromptSelect callback
- `frontend/src/components/ExpertCard.tsx` - Anchor tag with target=_blank, initials avatar, name/title@company/hourly_rate display, external link SVG icon
- `frontend/src/components/ChatInput.tsx` - Textarea with auto-resize (onInput handler), Enter-to-submit, Shift+Enter for newlines, spinner SVG while disabled, iOS safe-area-inset-bottom inline style

## Decisions Made

- `import type` syntax used for all interface imports — required by `verbatimModuleSyntax` in `tsconfig.app.json`
- ExpertCard created fully in Task 1 (alongside ChatMessage which imports it) to ensure build passes from the start
- iOS safe-area padding applied via inline `style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}` on ChatInput container — simpler than adding Tailwind custom plugin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `import type` syntax for TypeScript verbatimModuleSyntax compliance**
- **Found during:** Task 1 (initial build verification)
- **Issue:** `import { Message } from '../types'` and `import { Expert } from '../types'` caused TS2484 error — TypeScript requires `import type` for type-only imports when `verbatimModuleSyntax` is enabled in tsconfig.app.json
- **Fix:** Changed both to `import type { Message } from '../types'` and `import type { Expert } from '../types'`
- **Files modified:** `frontend/src/components/ChatMessage.tsx`, `frontend/src/components/ExpertCard.tsx`
- **Verification:** `npm run build` exits 0 after fix
- **Committed in:** `a77bcba` (Task 1 commit)

**2. [Rule 3 - Blocking] Created ExpertCard in Task 1 to resolve ChatMessage import dependency**
- **Found during:** Task 1 (ChatMessage imports ExpertCard)
- **Issue:** Plan called for ExpertCard in Task 2 but ChatMessage (Task 1) imports it — build would fail if ExpertCard didn't exist
- **Fix:** Created complete ExpertCard implementation in Task 1 instead of a stub; Task 2 commit then formally captures the file as the "Task 2" deliverable
- **Files modified:** `frontend/src/components/ExpertCard.tsx`
- **Verification:** Build passed in Task 1 with ExpertCard present
- **Committed in:** `a77bcba` (Task 1), staged for `e581fa5` (Task 2 — ChatInput added)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking dependency)
**Impact on plan:** Both fixes necessary for correct TypeScript compilation and build success. No scope creep.

## Issues Encountered

None beyond the auto-fixed TypeScript import syntax issue.

## User Setup Required

None - no external service configuration required. Components are purely presentational with no API calls.

## Next Phase Readiness

- All 5 presentational components exist in `frontend/src/components/` and pass TypeScript compilation
- Plan 03-03 (SSE hook + chat state) can begin immediately — it will import these components and wire them to the streaming API
- ChatMessage is ready to receive `message.experts` array from the SSE hook
- ChatInput `onSubmit` prop ready to receive the send handler from App-level state

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 03-frontend*
*Completed: 2026-02-20*
