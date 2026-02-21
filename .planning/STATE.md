# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.
**Current focus:** v1.2 — Phase 12: Steering Panel Frontend

## Current Position

Phase: 12 — Steering Panel Frontend
Plan: 01 complete — ready for Plan 02 (IntelligenceDashboardPage steering panel)
Status: In progress — Phase 12 Plan 01 complete (AdminSetting types + useAdminSettings hook)
Last activity: 2026-02-21 — Phase 12 Plan 01 complete (AdminSetting/AdminSettingsResponse types + useAdminSettings hook)

Progress: [████████████████████████░░░░░░] v1.0 + v1.1 complete (10/13 phases) — v1.2 Phase 12 in progress

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 23 (v1.0) + 9 (v1.1) = 32 total
- Average duration: ~2.1 min/plan (automated tasks)
- Total execution time: ~67 min automated

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 01–07 (v1.0) | 23 total | Complete |
| 08 (v1.1) | 4/4 plans | Complete |
| 09 (v1.1) | 3/3 plans | Complete |
| 10 (v1.1) | 2/2 plans | Complete |
| 11 (v1.2) | 2/2 plans | Complete |
| 12 (v1.2) | TBD | In progress — Plan 01 done |
| 13 (v1.2) | TBD | Not started |

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
- [Phase 09-admin-expert-tab-enhancement]: DomainMapEntry and DomainMapResponse placed after ExpertRow in types.ts — logically grouped with expert data
- [Phase 09-admin-expert-tab-enhancement]: useAdminDomainMap starts loading=false with no useEffect — lazy pattern for on-demand fetch when domain-map section first opened
- [Phase 09-admin-expert-tab-enhancement]: DomainMapResponse added to existing import statement in useAdminData.ts — no separate import statement per plan spec
- [09-03]: CategoryDropdown removed from rebuilt ExpertsPage — new 5-column layout has no category column; auto-classify button remains in actions bar
- [09-03]: scoreZone and sub-components (SortHeader, ScoreBadge, TagPills) defined at module level — avoids re-creation on every render
- [09-03]: Domain-map section guarded with {data &&} — only renders after experts load, preventing stale toggle state
- [10-01]: retrieve_with_intelligence() is synchronous — genai.Client() and embed_query() are sync; asyncio.wait_for HyDE timeout handled by chat.py caller (Plan 02)
- [10-01]: Both QUERY_EXPANSION_ENABLED and FEEDBACK_LEARNING_ENABLED default False at module level — Railway explicitly enables after validation
- [10-01]: HyDE fires only when fewer than STRONG_RESULT_MIN (3) candidates score >= SIMILARITY_THRESHOLD
- [10-01]: faiss.normalize_L2 mandatory after embedding average — averaged vectors are NOT unit length, corrupts IndexFlatIP without it
- [10-01]: Empty url_set guard in _apply_feedback_boost returns early to avoid SQLite empty .in_() query (same pattern as 09-01)
- [Phase 10-02]: asyncio.wait_for(timeout=12.0) wraps run_in_executor — 5s HyDE + 2s embed + margin; TimeoutError caught by existing except block
- [Phase 10-02]: intelligence field added additively to SSE result event — existing frontend consumers unaffected
- [11-01]: AppSetting ORM model with SCREAMING_SNAKE_CASE keys matching env var names; settings table auto-created by Base.metadata.create_all()
- [11-01]: get_settings(db) uses deferred import of AppSetting inside function to avoid circular import at module load time
- [11-01]: HYDE_TIMEOUT_SECONDS=5.0 kept hardcoded in search_intelligence — safety constant (hang-protection), not a tuneable setting
- [11-01]: _is_weak_query() and _apply_feedback_boost() now accept settings as parameters; no module-level flag constants remain
- [11-01]: DB settings read on every chat request (SELECT * from 5-row max table) — no caching ensures zero-redeploy config changes
- [11-02]: SETTINGS_SCHEMA dict is single source of truth for all 5 intelligence setting metadata (type, env_default, min, max, description)
- [11-02]: GET /api/admin/settings returns native-typed value (bool/float/int) and source field ("db" | "env" | "default") for override hierarchy
- [11-02]: POST /api/admin/settings uses db.merge() for upsert on AppSetting primary key; value always stored as string
- [11-02]: Deferred import of AppSetting inside settings endpoint functions — consistent with 11-01 get_settings() pattern
- [Phase 12-01]: AdminSetting.value typed as boolean|number (native-typed per backend Phase 11 shape); source typed as 'db'|'env'|'default'

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (required for CORS)
- Check `SELECT COUNT(*) FROM feedback` before planning Phase 10 — if under 50 rows, ship `FEEDBACK_LEARNING_ENABLED=false`
- Verify exact Gemini paid-tier RPM limits at ai.google.dev before setting CONCURRENCY in tag_experts.py

### Blockers/Concerns

- CORS not wired: Railway preflight returns "Disallowed CORS origin" for Vercel domain — fix before running any Phase 8 validation that calls the live API

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 12-01-PLAN.md — AdminSetting/AdminSettingsResponse interfaces in types.ts + useAdminSettings hook in useAdminData.ts. Ready for Phase 12 Plan 02 (IntelligenceDashboardPage steering panel).
Resume file: None
