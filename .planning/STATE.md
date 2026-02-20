# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 3 — Frontend

## Current Position

Phase: 3 of 4 (Frontend) — IN PROGRESS
Plan: 3 of 3 in phase 3 — AWAITING CHECKPOINT
Status: Phase 3 underway — Plan 03-03 Task 1 (useChat SSE hook + App.tsx) complete. Awaiting checkpoint:human-verify at Task 2 before Phase 3 is fully done.
Last activity: 2026-02-20 — Completed 03-03 Task 1 (useChat hook + App.tsx integration). Build exits 0. Awaiting human browser verification.

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 2.1 min
- Total execution time: ~19.7 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 7.5 min | 2.5 min |
| 02-rag-api | 4 | 12.2 min | 3.1 min |
| 03-frontend | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 2.6 min
- Trend: stable

*Updated after each plan completion*

| Phase 03-03 | 03 | 2 min | 1 task | 3 files |

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
- [02-02]: GENERATION_MODEL=gemini-2.5-flash (not deprecated gemini-2.0-flash which shuts down June 2026)
- [02-02]: SIMILARITY_THRESHOLD=0.60 (lowered from 0.65) — threshold was too strict; 0.60 returns results across diverse domain queries
- [02-02]: TOP_K=5 retrieval gives LLM room to skip low-quality matches while always providing 3 recommendations
- [02-02]: Lazy genai.Client() pattern applied to LLM service — consistent with embedder.py; no GOOGLE_API_KEY at import time
- [02-02]: Defensive _get() column normalization in retriever handles snake_case/space/TitleCase CSV column variants
- [02-03]: EmailStr enforces email format at Pydantic validation — no manual regex; returns 422 automatically
- [02-03]: history stored as JSON-serialized Text in Conversation — consistent with 02-01 schema decisions
- [02-03]: Non-streaming endpoint validates full RAG pipeline before streaming upgrade in 02-04
- [02-04]: StreamingResponse with media_type='text/event-stream' replaces JSONResponse — response_model removed from @router.post decorator
- [02-04]: Sync services (embed_query, generate_content) offloaded via run_in_executor() to avoid blocking asyncio event loop during SSE streaming
- [02-04]: Cache-Control: no-cache and X-Accel-Buffering: no headers prevent Railway/nginx proxy buffering of SSE stream
- [02-04]: thinking event emitted before any thread pool work begins — guarantees sub-100ms first event latency
- [02-04]: Phase 2 fully verified by human — SSE streaming confirmed, DB logging confirmed (7 conversations), 10+ domain queries verified, clarification path working
- [03-01]: Tailwind CSS v3 (not v4) installed — stable, plan-specified version; brand colors as theme.extend.colors.brand.* tokens
- [03-01]: VITE_API_URL typed in ImportMetaEnv interface for TypeScript-safe import.meta.env access
- [03-01]: Named exports only in types.ts — no default export; all consuming components import { Expert, Message } from './types'
- [03-02]: import type syntax required for interface imports — verbatimModuleSyntax in tsconfig.app.json; all components use `import type { Expert }` not `import { Expert }`
- [03-02]: ExpertCard uses anchor tag (not button) with target=_blank and rel=noopener noreferrer for native link semantics
- [03-02]: iOS safe-area padding applied via inline style prop on ChatInput — simpler than Tailwind plugin for env(safe-area-inset-bottom)
- [03-02]: Initials avatar (2-letter) as fallback — Expert type has no photo URL field, consistent with backend schema
- [Phase 03-frontend]: fetch ReadableStream SSE parsing instead of EventSource — POST body required for /api/chat; EventSource is GET-only
- [Phase 03-frontend]: Fixed placeholder email user@tinrate.com — user auth out of scope for v1; API requires email for DB lead capture

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-20
Stopped at: 03-03 Task 2 checkpoint:human-verify — useChat hook and App.tsx built and compiled. Awaiting human browser verification of full chat flow (desktop + mobile + error state).
Resume file: None
