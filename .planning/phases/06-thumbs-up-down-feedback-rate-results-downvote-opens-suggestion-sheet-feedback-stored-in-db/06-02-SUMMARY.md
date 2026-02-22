---
phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, feedback, hooks, modal, sse]

# Dependency graph
requires:
  - phase: 06-01
    provides: POST /api/feedback endpoint that accepts conversation_id, vote, email, expert_ids, reasons, comment
  - phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile
    provides: email gate and email value passed into chat flow
  - phase: 03-frontend
    provides: useChat hook, SSE parsing, Message type, ExpertCard components

provides:
  - conversationId field on Message interface from SSE result event
  - FeedbackVote type ('up' | 'down' | null) exported from types.ts
  - SSEResultEvent extended with conversation_id field
  - useFeedback hook with vote state, API POST, modal open/close
  - FeedbackBar component with thumb-up/thumb-down SVG buttons and label
  - DownvoteModal centered overlay with 4 checkboxes and free-text for Other

affects: [06-03, 07-analytics-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget feedback POST — UI updates immediately, backend failure is silent"
    - "FeedbackVote useState with idempotent guard (clicking same thumb again is no-op)"
    - "DownvoteModal: fixed inset-0 z-50 overlay, backdrop click closes, Escape key closes"
    - "verbatimModuleSyntax: import type { FeedbackVote } for all type-only imports"

key-files:
  created:
    - frontend/src/hooks/useFeedback.ts
    - frontend/src/components/FeedbackBar.tsx
    - frontend/src/components/DownvoteModal.tsx
  modified:
    - frontend/src/types.ts
    - frontend/src/hooks/useChat.ts

key-decisions:
  - "Fire-and-forget feedback POST — setVote and openModal before await so UI is instant regardless of backend latency"
  - "Clicking already-selected thumb is a no-op — prevents double-submitting same vote"
  - "DownvoteModal auto-submits vote:down detail on form submit, closes modal via closeModal() (no separate state reset needed)"
  - "brand-purple for thumbs-up, red-500 for thumbs-down — intentional color asymmetry to match positive/negative sentiment"

patterns-established:
  - "useFeedback: encapsulate all vote state and API calls in a hook, not in the component"
  - "FeedbackBar: pure UI delegate — receives conversationId/expertIds/email, all logic in hook"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 6 Plan 02: Frontend Feedback Data Layer and UI Components Summary

**React feedback layer with useFeedback hook, SVG thumb buttons in FeedbackBar, and DownvoteModal overlay with 4 checkboxes and free-text — wired to POST /api/feedback fire-and-forget with conversationId flowing from SSE stream into Message**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-20T19:51:24Z
- **Completed:** 2026-02-20T19:53:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 extended, 3 created)

## Accomplishments

- Extended Message interface and SSEResultEvent in types.ts with conversationId; added FeedbackVote type
- Updated useChat.ts to extract conversation_id from SSE result event and store on message
- Created useFeedback hook managing vote state, API POST (fire-and-forget), and modal open/close lifecycle
- Created FeedbackBar with SVG thumbs-up (brand-purple) and thumbs-down (red-500) icons, aria attributes, filled on selection
- Created DownvoteModal as fixed z-50 overlay with 4 preset reasons, "Other" revealing free-text textarea, backdrop and Escape key close

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types.ts and useChat.ts with conversationId support** - `0756014` (feat)
2. **Task 2: Create useFeedback hook, FeedbackBar, and DownvoteModal** - `e49c547` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/types.ts` - Added conversationId to Message, FeedbackVote type, conversation_id to SSEResultEvent
- `frontend/src/hooks/useChat.ts` - Parse conversation_id from SSE result event and assign to message
- `frontend/src/hooks/useFeedback.ts` - Vote state management, fire-and-forget POST /api/feedback, modal lifecycle
- `frontend/src/components/FeedbackBar.tsx` - Thumb-up/down SVG buttons with label, delegates to useFeedback
- `frontend/src/components/DownvoteModal.tsx` - Centered overlay, 4 checkboxes, free-text for Other, Escape/backdrop close

## Decisions Made

- Fire-and-forget feedback POST: `void postFeedback(...)` — UI state set immediately, backend failure logged silently
- Idempotent vote guard: `if (vote === v) return` — prevents double submission when user re-clicks same thumb
- FeedbackVote placed after SSEResultEvent in types.ts (logical grouping with feedback-related types)
- brand-purple for upvote hover/selected, red-500 for downvote hover/selected — intentional positive/negative color semantics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript passed with zero errors and `npm run build` succeeded on first attempt.

## User Setup Required

None - no external service configuration required. FeedbackBar must be wired into ChatMessage component (06-03) before end-to-end testing.

## Next Phase Readiness

- All feedback UI components ready to integrate into ChatMessage (06-03)
- FeedbackBar expects: `conversationId: number`, `expertIds: string[]`, `email: string | null`
- DownvoteModal is fully standalone — imported and rendered by FeedbackBar internally
- Backend /api/feedback endpoint (06-01) accepts the payload structure posted by useFeedback

---
*Phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db*
*Completed: 2026-02-20*

## Self-Check: PASSED

- FOUND: frontend/src/types.ts
- FOUND: frontend/src/hooks/useChat.ts
- FOUND: frontend/src/hooks/useFeedback.ts
- FOUND: frontend/src/components/FeedbackBar.tsx
- FOUND: frontend/src/components/DownvoteModal.tsx
- FOUND: 06-02-SUMMARY.md
- FOUND: commit 0756014 (feat: extend types.ts and useChat.ts)
- FOUND: commit e49c547 (feat: add useFeedback hook, FeedbackBar, DownvoteModal)
