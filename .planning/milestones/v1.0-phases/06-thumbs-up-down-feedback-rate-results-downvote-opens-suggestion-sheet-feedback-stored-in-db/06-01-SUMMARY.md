---
phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db
plan: 01
subsystem: api, database

tags: [fastapi, sqlalchemy, pydantic, sqlite, sse, feedback]

# Dependency graph
requires:
  - phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile
    provides: email_leads table pattern and router registration pattern in main.py
  - phase: 02-rag-api
    provides: Conversation model, Base.metadata.create_all pattern, get_db dependency, SSE streaming chat endpoint
provides:
  - Feedback SQLAlchemy ORM model (8 columns) auto-created at startup via Base.metadata.create_all
  - POST /api/feedback endpoint with Pydantic validation — inserts feedback row, returns {status ok}
  - conversation_id field in SSE result event — links frontend feedback UI to DB conversation row
affects: [06-02-frontend, 07-analytics-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No FK on conversation_id — consistent with schema style (no FK relationships in this project)"
    - "Vote switch inserts new row; latest record per conversation_id is authoritative for analytics"
    - "fire-and-forget feedback POST from frontend — same pattern as email-capture"

key-files:
  created:
    - app/routers/feedback.py
  modified:
    - app/models.py
    - app/routers/chat.py
    - app/main.py

key-decisions:
  - "[06-01]: No FK on conversation_id in Feedback — consistent with existing schema style (Conversation and EmailLead also have no FK relationships)"
  - "[06-01]: Vote switch creates new row (not upsert) — preserves vote history; latest row per conversation_id is authoritative for analytics"
  - "[06-01]: FeedbackRequest uses Literal['up', 'down'] for vote field — Pydantic enforces valid values at request validation time, returns 422 automatically for invalid votes"
  - "[06-01]: expert_ids and reasons stored as JSON-serialized Text — consistent with history/response_experts pattern in Conversation model"

patterns-established:
  - "Router pattern: import router from app.routers.X, register with app.include_router(X.router) in main.py"
  - "Feedback table auto-created by Base.metadata.create_all in lifespan — no migration script"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 6 Plan 01: Backend Feedback Infrastructure Summary

**SQLAlchemy Feedback model with 8 columns, POST /api/feedback endpoint (Pydantic-validated, DB-backed), and conversation_id surfaced in SSE result events**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T19:51:19Z
- **Completed:** 2026-02-20T19:53:06Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (app/models.py, app/routers/chat.py, app/routers/feedback.py [new], app/main.py)

## Accomplishments
- Feedback SQLAlchemy ORM class added to models.py with all 8 required columns; auto-created at startup via existing Base.metadata.create_all — no migration needed
- POST /api/feedback endpoint accepts FeedbackRequest (conversation_id, vote, optional email/expert_ids/reasons/comment), inserts a Feedback row, and returns {"status": "ok"}
- conversation_id added to SSE result event in chat.py so frontend can link thumbs up/down votes to the correct conversation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Feedback model and conversation_id to SSE result event** - `d8b0079` (feat)
2. **Task 2: Create POST /api/feedback router and register in main.py** - `4f101d8` (feat)

## Files Created/Modified
- `app/models.py` - Added Feedback ORM class with 8 columns after EmailLead
- `app/routers/chat.py` - Added `"conversation_id": conversation.id` to SSE result event payload
- `app/routers/feedback.py` - New file: FeedbackRequest Pydantic model, POST /api/feedback handler
- `app/main.py` - Added feedback to router imports and registered with app.include_router(feedback.router)

## Decisions Made
- No FK on conversation_id in Feedback — consistent with existing schema style (Conversation and EmailLead have no FK relationships)
- Vote switch inserts new row rather than upsert — preserves vote history; latest row per conversation_id is authoritative for analytics
- FeedbackRequest uses Literal["up", "down"] for vote field — Pydantic enforces valid values, returns 422 for invalid votes automatically
- expert_ids and reasons stored as JSON-serialized Text columns — consistent with history/response_experts pattern in Conversation model

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both tasks executed cleanly. Server startup test confirmed Feedback table auto-created and /api/feedback endpoint returns {"status":"ok"} with 200.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend feedback infrastructure is complete and ready for Phase 6 Plan 02 (frontend thumbs up/down UI)
- Frontend needs to: (1) read conversation_id from SSE result event, (2) POST to /api/feedback on thumb click, (3) implement DownvoteModal that sends reasons + comment
- /api/feedback endpoint appears in OpenAPI schema at /docs — testable before frontend ships

---
*Phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db*
*Completed: 2026-02-20*
