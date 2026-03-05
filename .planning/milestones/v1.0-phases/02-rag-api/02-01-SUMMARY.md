---
phase: 02-rag-api
plan: 01
subsystem: database
tags: [sqlalchemy, sqlite, fastapi, orm, conversation-logging]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: FastAPI app with lifespan, config.py with DATA_DIR, FAISS loading

provides:
  - SQLAlchemy engine, SessionLocal, Base, and get_db FastAPI dependency (app/database.py)
  - Conversation ORM model with all conversation-logging fields (app/models.py)
  - DATABASE_URL constant pointing to data/conversations.db (app/config.py)
  - Auto-table-creation via Base.metadata.create_all() in lifespan startup (app/main.py)

affects: [02-02, 02-03, 02-04, chat-router, conversation-persistence]

# Tech tracking
tech-stack:
  added: [sqlalchemy==2.0.*]
  patterns: [SQLAlchemy 2.0 DeclarativeBase with Mapped/mapped_column typed ORM, FastAPI get_db dependency injection pattern, idempotent table creation at startup]

key-files:
  created:
    - app/database.py
    - app/models.py
  modified:
    - app/config.py
    - app/main.py
    - requirements.txt
    - .gitignore

key-decisions:
  - "SQLite for v1 — zero-config, sufficient for lead capture; replace DATABASE_URL with Postgres URL for production persistence in Phase 4"
  - "No Alembic migrations — Base.metadata.create_all() at startup is idempotent and sufficient for v1 schema stability"
  - "history and response_experts stored as JSON-serialized Text columns — avoids JSON column type portability issues with SQLite"
  - "check_same_thread=False for SQLite engine — required for FastAPI multi-threaded request handling"

patterns-established:
  - "get_db(): FastAPI dependency yielding session per request — always use Depends(get_db) in route handlers, never create sessions directly"
  - "import app.models noqa: F401 in main.py — side-effect import pattern to register ORM models with Base before create_all()"
  - "Base.metadata.create_all() called BEFORE FAISS loading in lifespan — DB tables available before any request can be served"

requirements-completed: [REC-02]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 2 Plan 01: Database Layer Summary

**SQLite conversation-logging DB via SQLAlchemy 2.0 ORM — Conversation model, get_db dependency, and idempotent table creation wired into FastAPI lifespan**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-20T11:54:39Z
- **Completed:** 2026-02-20T11:57:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- SQLAlchemy 2.0 installed and wired with engine, SessionLocal, Base, and get_db FastAPI dependency
- Conversation ORM model with all required fields: id, email, query, history, response_type, response_narrative, response_experts, created_at
- Base.metadata.create_all() added to lifespan startup — conversations table auto-created at server start
- DATABASE_URL constant added to config.py pointing to data/conversations.db; data/conversations.db added to .gitignore

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SQLAlchemy to requirements and create database module** - `a860a18` (feat)
2. **Task 2: Create Conversation ORM model and wire table creation into lifespan** - `c10cb06` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/database.py` - SQLAlchemy engine, SessionLocal, Base, and get_db FastAPI dependency
- `app/models.py` - Conversation ORM model with all required fields for lead capture and analytics
- `app/config.py` - Added DATABASE_URL constant pointing to data/conversations.db
- `app/main.py` - Added DB imports and Base.metadata.create_all() before FAISS loading in lifespan
- `requirements.txt` - Added sqlalchemy==2.0.*
- `.gitignore` - Added data/conversations.db

## Decisions Made

- No Alembic: Base.metadata.create_all() at startup is idempotent and sufficient for v1 where schema is stable
- SQLite for v1: zero-config, data survives restarts but not redeployments on Railway — acceptable for lead capture analytics; Postgres upgrade deferred to Phase 4
- history and response_experts as JSON-serialized Text columns: avoids JSON column type compatibility issues with SQLite
- conversations.db gitignored: runtime data file, not source artifact

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added data/conversations.db to .gitignore**
- **Found during:** Task 2 (wiring lifespan)
- **Issue:** .gitignore only listed specific data files (faiss.index, metadata.json, *.csv) — conversations.db would have been committed as runtime data
- **Fix:** Added `data/conversations.db` entry to .gitignore
- **Files modified:** .gitignore
- **Verification:** gitignore rule confirmed present
- **Committed in:** c10cb06 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential correction to prevent committing runtime database file. No scope creep.

## Issues Encountered

None — all verifications passed on first attempt.

## User Setup Required

None - no external service configuration required. SQLite is zero-config and auto-created at startup.

## Next Phase Readiness

- DB layer fully ready for Plan 02 (Pydantic schemas) and Plan 03 (chat endpoint)
- get_db() dependency ready for use in any route handler via Depends(get_db)
- Conversation model ready for INSERT in chat route after LLM response is generated
- Existing Phase 1 functionality (FAISS loading, /api/health) unchanged and verified working

## Self-Check: PASSED

- FOUND: app/database.py
- FOUND: app/models.py
- FOUND: app/config.py (modified)
- FOUND: app/main.py (modified)
- FOUND: requirements.txt (modified)
- FOUND: .gitignore (modified)
- FOUND: .planning/phases/02-rag-api/02-01-SUMMARY.md
- FOUND commit: a860a18 (Task 1)
- FOUND commit: c10cb06 (Task 2)
- Verification commands all passed: DB module OK, Model OK: conversations, all 8 columns present, App import OK

---
*Phase: 02-rag-api*
*Completed: 2026-02-20*
