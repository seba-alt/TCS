---
phase: 03-frontend
plan: "03"
subsystem: ui
tags: [react, typescript, sse, streaming, hooks, chat, integration]

# Dependency graph
requires:
  - phase: 03-02
    provides: Header, ChatMessage, ExpertCard, ChatInput, EmptyState presentational components
  - phase: 03-01
    provides: Vite+React+TS scaffold, Tailwind brand tokens, shared TypeScript types (Expert, Message, ChatStatus)
provides:
  - useChat SSE streaming hook managing messages, status, sendMessage, retryLast
  - Full App.tsx chat layout composing all components with auto-scroll and error/retry UI
  - frontend/.env.local configuring VITE_API_URL=http://localhost:8000 for local dev
affects: [04-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fetch ReadableStream for SSE (POST body required — native EventSource does not support POST)
    - Manual SSE parsing via \n\n split and data: prefix extraction
    - useRef for lastQuery and history (avoids closure stale state in callbacks)
    - Placeholder assistant message pattern — append empty streaming message, update in-place on result event
    - setTimeout 100ms status reset to idle after done (avoids React state batching race)

key-files:
  created:
    - frontend/src/hooks/useChat.ts
    - frontend/.env.local
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "fetch ReadableStream + manual SSE parsing instead of EventSource — POST body required for /api/chat; EventSource is GET-only"
  - "Placeholder assistant message appended on sendMessage, updated in-place on result event — smooth chat UX without flash"
  - "Fixed placeholder email user@tinrate.com — user auth is out of scope for v1 per REQUIREMENTS.md"
  - "historyRef (useRef) for multi-turn history — avoids stale closure issues in async sendMessage callback"
  - "isStreaming=true on result event, false on done event — animated cursor shown while narrative is visible but before done arrives"

patterns-established:
  - "useChat hook: messages state + ChatStatus enum + manual SSE parsing via ReadableStream"
  - "App.tsx layout: Header fixed top, main flex-1 overflow-y-auto, ChatInput fixed bottom"
  - "Error state: inline error in assistant message + Retry button via retryLast()"

requirements-completed: [CHAT-01, CHAT-02, REC-03, REC-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 3 Plan 03: SSE Hook + App Integration Summary

**useChat hook with fetch ReadableStream SSE parsing wired into full App.tsx chat layout — end-to-end chatbot connecting React UI to FastAPI streaming backend**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-20T13:05:18Z
- **Completed:** 2026-02-20T13:07:00Z
- **Tasks:** 1 of 2 (Task 2 is checkpoint:human-verify — awaiting human confirmation)
- **Files modified:** 3

## Accomplishments

- Built `frontend/src/hooks/useChat.ts`: SSE streaming hook using fetch + ReadableStream (not EventSource) with manual SSE event parsing, multi-turn history tracking, and retryLast capability
- Rewrote `frontend/src/App.tsx`: full chat layout composing Header, ChatMessage, EmptyState, ChatInput with auto-scroll, spinner during loading, and Retry button on error
- Created `frontend/.env.local` with VITE_API_URL=http://localhost:8000 for local development

## Task Commits

Each task was committed atomically:

1. **Task 1: Build useChat SSE streaming hook and wire App.tsx** - `9441182` (feat)

## Files Created/Modified

- `frontend/src/hooks/useChat.ts` - SSE streaming hook: manages messages[], status ChatStatus, sendMessage, retryLast; parses result/done/error events from fetch ReadableStream
- `frontend/src/App.tsx` - Root component: Header + scrollable message list + ChatInput; EmptyState when empty; "Finding experts..." spinner; Retry button on error
- `frontend/.env.local` - Local dev config: VITE_API_URL=http://localhost:8000

## Decisions Made

- fetch ReadableStream instead of EventSource — the backend `/api/chat` endpoint requires a POST body (email, query, history); EventSource only supports GET requests
- Placeholder empty assistant message appended immediately on sendMessage, updated in-place on SSE result event — provides smooth UX with streaming cursor visible from the start
- Fixed email `user@tinrate.com` used as placeholder — user authentication is explicitly out of scope for v1 (see REQUIREMENTS.md); email is required by API for DB lead capture
- historyRef (useRef not useState) stores conversation history — avoids stale closure capture in the async sendMessage callback
- isStreaming cursor shown from thinking state through result, cleared only on done event — matches CONTEXT.md "typing effect" intent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `frontend/.env.local` is pre-created with the correct local dev API URL.

## Next Phase Readiness

- Task 2 is checkpoint:human-verify — run `uvicorn app.main:app --reload` and `npm run dev` from project root and frontend/ respectively, then open http://localhost:5173 to verify the full chat flow
- After human approval, plan 03-03 is complete and Phase 3 (Frontend) is ready for Phase 4 (Deployment)

## Self-Check: PASSED

- `frontend/src/hooks/useChat.ts` — present
- `frontend/src/App.tsx` — present and modified (254 lines)
- `frontend/.env.local` — present (VITE_API_URL=http://localhost:8000)
- Commit `9441182` — verified in git log

---
*Phase: 03-frontend*
*Completed: 2026-02-20*
