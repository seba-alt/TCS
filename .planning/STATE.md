# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21 after v1.1 milestone started)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** v1.1 — Phase 8: Data Enrichment Pipeline

## Current Position

Phase: 9 of 10 (Admin Expert Tab Enhancement)
Plan: 09-01 complete
Status: In progress
Last activity: 2026-02-21 — Phase 9 Plan 01 complete (Backend API: tags+findability_score in _serialize_expert(), worst-first sort, GET /api/admin/domain-map)

Progress: [████████████████████░░░░░░░░░░] v1.0 complete (7/7 phases) — v1.1 starting Phase 8

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 23 (v1.0)
- Average duration: ~2.1 min/plan (automated tasks)
- Total execution time: ~48 min automated

**By Phase (v1.0 summary):**

| Phase | Plans | Status |
|-------|-------|--------|
| 01–07 (v1.0) | 23 total | Complete |
| 08 (v1.1) | TBD | In progress |
| 09 (v1.1) | TBD | Not started |
| 10 (v1.1) | TBD | Not started |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 research]: gemini-embedding-001 already in production — do NOT reference text-embedding-004 (shut down Jan 14 2026)
- [v1.1 research]: ingest.py must switch source from experts.csv to Expert SQLAlchemy table so tags written by tag_experts.py are included in FAISS embedding text
- [v1.1 research]: All FAISS index writes must happen in FastAPI lifespan handler only — Railway volume not mounted during pre-deploy
- [v1.1 research]: tag_experts.py must write to staging file first, promote only after count assertion passes — crash safety
- [v1.1 research]: Feedback re-ranking: minimum 10 interactions before boost; max 20% of similarity score — prevents cold-start bias
- [08-01]: TYPE_CHECKING guard in app/services/tagging.py avoids circular imports; Expert type available for type hints without runtime import
- [08-01]: Deferred google-genai imports inside tag_expert_sync() prevent failures when module loaded without GOOGLE_API_KEY set
- [08-01]: Sync Gemini client used in tag_expert_sync — asyncio.run() inside FastAPI's running event loop raises RuntimeError
- [08-01]: compute_findability_score accepts optional tags list to support batch processing where tags not yet committed
- [08-03]: pandas removed from ingest.py; SQLAlchemy SessionLocal replaces CSV loading — Expert table is authoritative source
- [08-03]: Assertion uses actual_count from DB query (not hardcoded 1558) — future-proof as expert count grows
- [08-03]: Metadata dicts preserve "First Name"/"Last Name" key names (capital + spaced) for retriever.py/llm.py compatibility
- [Phase 08]: All DB helper functions sync — no SessionLocal held across await, preventing SQLite thread errors in async batch script
- [Phase 08]: Async Gemini client (client.aio) used in batch script; sync genai.Client reserved for FastAPI route handlers (tag_expert_sync)
- [Phase 08]: CONCURRENCY=5 conservative default for Gemini calls; constant at top of file with AI Studio RPM docs link
- [08-04]: Auto-tagging synchronous on POST /api/admin/experts — expert fully enriched before response; BackgroundTasks retry fires only on Gemini failure
- [08-04]: No-bio experts skip Gemini but still get findability_score computed; creation never fails due to AI error
- [09-01]: _serialize_expert() uses json.loads(e.tags or '[]') — safe NULL default, no try/except needed
- [09-01]: GET /api/admin/experts sorts by findability_score asc nulls_first — worst experts surface at top for admin review
- [09-01]: domain-map uses Expert.profile_url.in_() not username — Feedback.expert_ids stores profile URLs
- [09-01]: Empty url_set guard in domain-map returns early to avoid SQLite empty .in_() query

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (required for CORS)
- Check `SELECT COUNT(*) FROM feedback` before planning Phase 10 — if under 50 rows, ship `FEEDBACK_LEARNING_ENABLED=false`
- Verify exact Gemini paid-tier RPM limits at ai.google.dev before setting CONCURRENCY in tag_experts.py

### Blockers/Concerns

- CORS not wired: Railway preflight returns "Disallowed CORS origin" for Vercel domain — fix before running any Phase 8 validation that calls the live API
- Phase 10 feedback threshold depends on real feedback corpus size — check DB before planning Phase 10

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 09-01-PLAN.md — GET /api/admin/experts enriched with tags+findability_score and worst-first sort; GET /api/admin/domain-map added (top-10 downvoted tag domains).
Resume file: None
