# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** Phase 5 — Email Gate UX (Plan 2 of 3 complete)

## Current Position

Phase: 5 of 8 (Email Gate UX)
Plan: 2 of 3 in phase 5 — COMPLETE
Status: 05-02 complete — Email gate UX shipped: locked ExpertCards, inline EmailGate form, instant unlock on submission, returning-user bypass via localStorage.
Last activity: 2026-02-20 — Frontend email gate complete. TypeScript zero errors, vite build clean. Awaiting 05-03 (final plan if any, or deploy).

Progress: [████████░░░░░░░░░░░░] 67% of phase 5 (2/3 plans done)

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Outstanding Action Required

**CORS not wired yet.** Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables.

Steps:
1. railway.com -> project -> service -> Variables
2. Set `ALLOWED_ORIGINS` = `https://tcs-three-sigma.vercel.app` (no trailing slash)
3. Railway auto-redeploys — wait for completion
4. Verify with: `curl -s -D - -X OPTIONS -H "Origin: https://tcs-three-sigma.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" https://web-production-fdbf9.up.railway.app/api/chat`
   - Expected: `access-control-allow-origin: https://tcs-three-sigma.vercel.app` in response

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: ~2.1 min (automated tasks)
- Total execution time: ~21.7 min automated + human platform setup

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 7.5 min | 2.5 min |
| 02-rag-api | 4 | 12.2 min | 3.1 min |
| 03-frontend | 3 | 6 min | 2 min |
| 04-deployment | 3 | ~4 min automated | 2 min |

**Recent Trend:**
- Last 5 plans: 2.4 min
- Trend: stable

*Updated after each plan completion*
| Phase 03-frontend P03 | 2 | 2 tasks | 3 files |
| Phase 04-deployment P01 | 2 min | 2 tasks | 5 files |
| Phase 04-deployment P02 | 2 min | 2 tasks | 9 files |
| Phase 04-deployment P03 | multi-session | 2 tasks | 15 files |
| Phase 05-email-gate P01 | 1 min | 2 tasks | 3 files |
| Phase 05 P02 | 3min | 2 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 5 added: Email gate UX — Show expert results immediately but require email before clicking through to a profile
- Phase 6 added: Thumbs up/down feedback — Rate results, downvote opens suggestion sheet, feedback stored in DB
- Phase 7 added: Analytics dashboard — Admin view of searches, expert matches, gap tracking, CSV export
- Phase 8 added: Test lab — Run queries against search engine, evaluate results, iterate on retrieval quality

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
- [03-03]: fetch ReadableStream SSE parsing instead of EventSource — POST body required for /api/chat; EventSource is GET-only
- [03-03]: Fixed placeholder email user@tinrate.com — user auth out of scope for v1; API requires email for DB lead capture
- [03-03]: Phase 3 fully verified by human — desktop chat flow confirmed, mobile 375px layout verified, error state + Retry working, multi-turn history visible and scrollable
- [Phase 03-frontend]: fetch ReadableStream SSE parsing instead of EventSource — POST body required for /api/chat; EventSource is GET-only
- [Phase 03-frontend]: Phase 3 fully verified by human — desktop chat flow, mobile 375px layout, error state + Retry, multi-turn history all confirmed
- [04-01]: Railway Volume mounted at /app/var (not /app/data) — mounting at /app/data shadows committed FAISS index; set VAR_DIR=/app/var on Railway dashboard
- [04-01]: FAISS index, metadata.json, and experts.csv committed to git — Railway clones repo at deploy time so data files must be tracked
- [04-01]: sentry-sdk added without version pin — stable and backward-compatible; walrus-operator guard skips init silently when SENTRY_DSN absent
- [04-01]: railway.json declares healthcheckPath=/api/health with 300s timeout for FAISS lifespan startup
- [04-02]: CI workflow gates Railway deploys via ruff check and tsc -- both must pass before merge to main
- [04-02]: Sentry enabled only in PROD builds (import.meta.env.PROD) -- local dev never sends errors to Sentry
- [04-02]: sentryVitePlugin disabled when SENTRY_AUTH_TOKEN absent -- local builds never fail due to missing Sentry credentials
- [04-02]: noqa: E402 applied to scripts/ingest.py sys.path-dependent import -- script legitimately needs sys.path insertion before app.config import
- [Phase 04-deployment]: Data files (faiss.index, metadata.json, experts.csv) committed to git — Railway Railpack cannot inject GOOGLE_API_KEY at build time so ingest.py cannot run as build step
- [Phase 04-deployment]: why_them field added to Expert dataclass — LLM returns per-expert explanation stored in response_experts DB column for future UI display
- [04-03]: Live URLs confirmed — Railway https://web-production-fdbf9.up.railway.app (index_size=530), Vercel https://tcs-three-sigma.vercel.app
- [04-03]: ALLOWED_ORIGINS env var must be set on Railway to https://tcs-three-sigma.vercel.app — CORS rejects Vercel origin until this is done
- [05-01]: sqlalchemy.dialects.sqlite.insert used (not sqlalchemy.insert) for on_conflict_do_nothing — API is identical to postgresql dialect for future migration
- [05-01]: Endpoint returns {status: ok} for both new and duplicate emails — frontend never sees a failure from re-submission
- [05-01]: email_leads table auto-created via existing Base.metadata.create_all in lifespan — no additional startup code needed
- [Phase 05]: Lazy useState initializer (not useEffect) for localStorage — prevents flash of locked state for returning users
- [Phase 05]: localStorage write before backend POST — backend failure is silent, UX unlock is immediate
- [Phase 05]: locked renders as div not anchor — keyboard users cannot tab-activate a locked link; aria-hidden on locked cards
- [Phase 05]: EmailGate only on last expert message (lastExpertMsgIndex reduce) — prevents duplicate forms in multi-turn chat

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (required for end-to-end CORS)

### Blockers/Concerns

- CORS not wired: Railway preflight returns "Disallowed CORS origin" for Vercel domain — chatbot UI loads but queries will fail until `ALLOWED_ORIGINS` is set

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 05-02-PLAN.md — email gate UX complete. Locked ExpertCards on first visit, EmailGate form on last expert message, instant unlock, returning-user bypass via localStorage.
Resume file: None
