# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21 after v1.1 milestone started)

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** v1.1 — Phase 8: Data Enrichment Pipeline

## Current Position

Phase: 8 of 10 (Data Enrichment Pipeline)
Plan: 08-03 complete
Status: In progress
Last activity: 2026-02-21 — Phase 8 Plan 03 complete (ingest.py rewrite: DB-sourced, tag-enriched, crash-safe)

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
| 08 (v1.1) | TBD | Not started |
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

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (required for CORS)
- Check `SELECT COUNT(*) FROM feedback` before planning Phase 10 — if under 50 rows, ship `FEEDBACK_LEARNING_ENABLED=false`
- Verify exact Gemini paid-tier RPM limits at ai.google.dev before setting CONCURRENCY in tag_experts.py

### Blockers/Concerns

- CORS not wired: Railway preflight returns "Disallowed CORS origin" for Vercel domain — fix before running any Phase 8 validation that calls the live API
- Phase 10 feedback threshold depends on real feedback corpus size — check DB before planning Phase 10

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 08-03-PLAN.md — scripts/ingest.py rewritten: DB-sourced (Expert table), tag-enriched embeddings (Domains: ...), crash-safe staging promotion.
Resume file: None
