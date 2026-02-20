# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 2 — RAG API

## Current Position

Phase: 2 of 4 (RAG API) — IN PROGRESS
Plan: 1 of 4 in phase 2 — COMPLETE
Status: Phase 2 in progress — 02-01 DB layer complete, ready for 02-02 (Pydantic schemas)
Last activity: 2026-02-20 — Completed 02-01 (DB layer: SQLAlchemy, Conversation model, get_db dependency)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 2.5 min
- Total execution time: 7.5 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 7.5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 2.5 min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: RAG over fine-tuning — CSV data changes; retrieval is more maintainable
- [Roadmap]: CSV as vector source — 1,600 profiles fits in-memory FAISS; no vector DB for v1
- [Roadmap]: Streaming upgrade folded into Phase 2 (not a separate phase) — quick depth + same delivery boundary
- [Roadmap]: Non-streaming validation first, streaming upgrade second within Phase 2
- [01-01]: google-genai==1.64.* confirmed as active SDK on PyPI (not deprecated google-generativeai); import path is `from google import genai`
- [01-01]: CSV column names treated as unknown until validate_csv.py runs against real data — ingest.py field names must be set after first run
- [01-01]: utf-8-sig encoding used for CSV loads to handle Excel BOM characters; chardet as fallback
- [01-02]: Lazy genai.Client() initialization in embedder.py — deferred to first call so module imports without GOOGLE_API_KEY (critical for CI and testability)
- [01-02]: L2 normalization required in both ingest.py and embedder.py — 768-dim truncated vectors are NOT pre-normalized by Google API
- [01-02]: Task type asymmetry enforced — RETRIEVAL_DOCUMENT for ingest, RETRIEVAL_QUERY for runtime embed_query()
- [01-03]: asynccontextmanager lifespan (not deprecated @app.on_event) used for FAISS loading — FastAPI 0.90+ pattern
- [01-03]: CORS never uses ['*'] — ALLOWED_ORIGINS env var with explicit origin list; Railway injects Vercel URL at deploy time
- [01-03]: .gitignore fixed — added !.env.example negation to allow safe committed example file despite .env.* wildcard rule
- [01-03]: Phase 1 fully verified by human — server starts, health returns non-zero index_size, CORS headers present, embed_query returns 768-dim vector, .env gitignored
- [02-01]: SQLite for v1 — zero-config; replace DATABASE_URL with Postgres URL for production persistence in Phase 4
- [02-01]: No Alembic — Base.metadata.create_all() at startup is idempotent and sufficient for v1 schema stability
- [02-01]: history and response_experts stored as JSON-serialized Text columns to avoid SQLite JSON type compatibility issues
- [02-01]: get_db() FastAPI dependency pattern established — always use Depends(get_db) in route handlers, never create sessions directly

### Pending Todos

None.

### Blockers/Concerns

- [Phase 2]: Verify Gemini JSON mode parameters (`response_mime_type`, `response_schema`) against current Google GenAI Python SDK docs before implementing LLM service
- [Phase 2]: Confirm `gemini-2.0-flash` is available on the project API key tier; fall back to `gemini-1.5-flash` if not

## Session Continuity

Last session: 2026-02-20
Stopped at: 02-01-PLAN.md complete — SQLite DB layer with Conversation model and get_db dependency. Ready for 02-02.
Resume file: None
