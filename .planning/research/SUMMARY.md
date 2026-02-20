# Project Research Summary

**Project:** TCS / Tinrate AI Concierge — v1.1 Expert Intelligence & Search Quality
**Domain:** RAG-based expert-matching chatbot — subsequent milestone (existing production system)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

This milestone extends a working production RAG system (FastAPI + FAISS + Gemini + React) rather than building from scratch. The core challenge is data enrichment at scale: 1,558 expert profiles exist in SQLite, but the FAISS index only contains 530 of them, and none have domain tags. All v1.1 search quality improvements depend on first tagging every expert with AI-generated domain terms and re-ingesting the complete expert set into FAISS with enriched text. The recommended approach is a strict serial pipeline: batch tag generation offline first, then FAISS re-ingest reading from the enriched DB, then admin UI enhancements, then search intelligence features layered on top. No new infrastructure is needed — every feature is implementable with the existing google-genai SDK, SQLite, and FastAPI patterns already in production.

The highest-leverage improvements are also the most straightforward: AI batch tagging (one offline Gemini script), FAISS re-ingest with tag-enriched text (modified existing ingest.py), findability scoring (deterministic Python formula), and an enhanced admin Expert tab (React table additions). These four deliver the stated milestone goal and unblock everything else. The search intelligence features — HyDE query expansion and feedback-weighted re-ranking — are valuable but should be layered on after the data foundation is solid, with careful gating to avoid query drift and popularity bias.

The dominant risks in this milestone are all data integrity risks, not architectural ones. Partial FAISS index from silent API throttling, schema-drifted tags from unconstrained LLM output, and crash-corrupted metadata files are the three failure modes most likely to be missed and hardest to recover from. Each has a clear prevention pattern (count assertions, response_schema enforcement, staging file writes) that costs trivial implementation effort. The search intelligence features carry secondary risks around query drift and feedback cold-start that are well-understood in the RAG literature and equally preventable with documented thresholds.

---

## Key Findings

### Recommended Stack

No new libraries are required for v1.1. The existing production stack handles every feature area. The only package change is upgrading `tenacity` from `8.4.*` to `9.1.*` for Python 3.10+ compliance and a cleaner retry API. The embedding model migration has already occurred: `gemini-embedding-001` with `output_dimensionality=768` (MRL truncation) is confirmed in `app/config.py`. All offline scripts use the same `google-genai` SDK already present.

**Core technologies:**
- `google-genai 1.64.*`: All Gemini calls (tagging, query expansion, generation) — already in production, handles async natively via `client.aio.models`
- `faiss-cpu 1.13.*`: Vector search — unchanged, 1,558 vectors is trivially small for FAISS in-memory
- `asyncio.Semaphore` + `tenacity 9.1.*`: Rate limit management for batch tagging — stdlib + existing dependency (version bump only)
- `SQLAlchemy 2.0.*` + `sqlalchemy.text()`: Schema migrations for two new columns (tags, findability_score) — same idempotent ALTER TABLE pattern already in main.py

**Critical version note:** `text-embedding-004` was shut down January 14, 2026. `gemini-embedding-001` is already in production. Do not reference the old model anywhere in v1.1 work.

See `/Users/sebastianhamers/Documents/TCS/.planning/research/STACK.md` for full detail.

### Expected Features

The milestone divides cleanly into a P1 core (4 features that deliver the stated milestone value) and a P2 extension (3 features that improve search quality measurably). The P1 features are all data-layer or admin-display work — no retrieval path changes. P2 features touch the live retrieval path and carry more risk.

**Must have (P1 — v1.1 core):**
- AI batch auto-tagging (1,558 experts via Gemini 2.5 Flash, structured JSON output) — prerequisite for all other features
- FAISS re-ingest with all 1,558 experts + tags in embedding text — raises index from 530 to 1,558; without this, tags are cosmetic
- Findability score (0-100 deterministic formula: bio presence/length, profile URL, tags, job title) — stored as Float column, enables worst-first admin sort
- Enhanced admin Expert tab (first/last name, bio preview, profile URL link, tag pills, color-coded score badge, worst-first default sort) — admin visibility layer over the enriched data

**Should have (P2 — v1.1 extended):**
- Feedback-weighted re-ranking (post-FAISS soft boost using cumulative thumbs up/down per expert, minimum 10 interactions threshold, max 20% similarity score boost)
- Query expansion via HyDE (hedged: averaged raw query + hypothetical expert bio embedding; one extra Gemini call per search; gated on weak original results only)
- Expert domain pre-mapping (group tags into domain clusters from the tagging output; enriches GAP reports)

**Defer (v2+):**
- Search quality test lab (high UI complexity, high long-term value; defer until feedback corpus is large enough to show signal)
- Manual tag editing with FAISS sync (requires "mark as reviewed" workflow and scheduled re-ingest)
- Multi-query RAG Fusion (higher Gemini call overhead; test HyDE alone first)

See `/Users/sebastianhamers/Documents/TCS/.planning/research/FEATURES.md` for full detail.

### Architecture Approach

The architecture is additive: two new offline scripts, two new SQLite columns on the Expert table, one new service file, and surgical modifications to three existing backend files. No components are replaced. The DB is the single source of truth — ingest.py must be changed to read from the Expert SQLAlchemy table rather than experts.csv to ensure tags (written by tag_experts.py) are included in the FAISS embedding text. This also fixes a latent consistency risk where CSV and DB could diverge.

**Major components:**
1. `scripts/tag_experts.py` (NEW) — offline batch pipeline: reads Expert table, calls Gemini 2.5 Flash with structured output schema (Pydantic `response_schema`), writes tags + findability_score back to Expert table; must run before ingest
2. `scripts/ingest.py` (MODIFIED) — reads from Expert table (not CSV), appends `"Tags: X, Y, Z."` to `expert_to_text()`, rebuilds FAISS index with all 1,558 experts
3. `app/services/query_expander.py` (NEW) — calls Gemini to generate 2 query variants; integrated in chat.py as a graceful-degrading pre-step before retrieve()
4. `app/services/retriever.py` (MODIFIED) — accepts `extra_queries` param; runs FAISS search per query variant, deduplicates by username, returns merged top-K
5. `app/routers/admin.py` (MODIFIED) — `_serialize_expert()` adds tags/score; new `GET /api/admin/domain-map` endpoint surfaces tag-level downvote frequency from Feedback table
6. `app/models.py` + `app/main.py` (MODIFIED) — two new columns (tags TEXT, findability_score REAL) via idempotent ALTER TABLE guards in lifespan

See `/Users/sebastianhamers/Documents/TCS/.planning/research/ARCHITECTURE.md` for full detail.

### Critical Pitfalls

1. **Silent partial FAISS index from embedding API throttling** — 429 errors mid-ingest produce a valid-looking but incomplete index with no crash. Prevention: `tenacity` retry on every embed call plus assert `index.ntotal == 1558` before writing the index to disk.

2. **LLM tag schema drift across 1,558-expert batch run** — temperature > 0 and LLM non-determinism cause structurally inconsistent tag output (mixed case, wrong array format, wrong count). Prevention: `response_mime_type="application/json"` + `response_schema` with Pydantic model + `min_items`/`max_items` constraints + post-response validation on every call.

3. **Crash leaves metadata.json in partially-tagged state** — the resulting half-enriched FAISS index is worse than either fully-tagged or fully-untagged. Prevention: write to `data/tags_staging.json` during the run, promote to production only after count assertion passes; implement `--resume` flag for idempotent re-runs.

4. **Railway volume not mounted during pre-deploy** — index writes in pre-deploy silently write to a temp filesystem that disappears at runtime. Prevention: all index writes must happen in the FastAPI lifespan startup handler (where the volume IS mounted), never in pre-deploy.

5. **Query expansion causing drift worse than no expansion** — LLM-generated variants introduce domain-wrong terms that dilute retrieval. Prevention: gate expansion on weak original results only (skip if original returns 3+ above-threshold results); add `QUERY_EXPANSION_ENABLED` env var flag; run 10-query regression test before enabling in production.

6. **Feedback cold-start / popularity bias** — sparse early feedback disproportionately boosts already-visible experts. Prevention: require minimum 10 interactions before applying any feedback boost; cap boost at 20% of similarity score.

See `/Users/sebastianhamers/Documents/TCS/.planning/research/PITFALLS.md` for full detail.

---

## Implications for Roadmap

Based on research, the dependency graph dictates a clear serial phase structure for P1 and parallel independence for P2 features. The order is not a stylistic choice — each phase has hard data prerequisites from the phase before it.

### Phase 1: Data Enrichment Pipeline

**Rationale:** Everything else depends on tags existing in the DB. This is the unblocking prerequisite for all other features. It also contains the highest-risk data integrity work (batch LLM + FAISS re-ingest), which must be validated before touching the live retrieval path.
**Delivers:** All 1,558 Expert rows with tags (JSON) and findability_score (Float) in SQLite; new FAISS index with 1,558 vectors (up from 530) using tag-enriched embedding text; two new SQLite columns added via idempotent migration.
**Addresses:** AI batch auto-tagging, FAISS re-ingest (P1 features 1 and 2 from FEATURES.md)
**Avoids:** Silent partial index (count assertion), schema-drifted tags (response_schema + validation), crash corruption (staging file + resume logic), Railway volume write in wrong context (lifespan handler only), shared API quota exhaustion (run at off-peak hours with 8 RPM cap)
**Implementation notes:**
- Add tags + findability_score columns to Expert model + main.py lifespan guards first (30 min)
- Write tag_experts.py with Pydantic response_schema, validation, staging file, --resume flag
- Modify ingest.py to read from Expert DB table (not CSV) and include tags in expert_to_text()
- Run batch tagging at off-peak hours to avoid shared quota exhaustion
- Validate: `index.ntotal == 1558` before marking done; sample 30 random experts for tag quality

### Phase 2: Admin Expert Tab Enhancement

**Rationale:** Phase 1 produces the data; Phase 2 surfaces it. Admin can verify tag quality and findability scores before search intelligence features go live. This is the lowest-risk phase — read-only display work, no retrieval path changes.
**Delivers:** Enhanced admin Expert tab with first/last name, bio preview, profile URL (clickable), tag pills (4 + overflow), color-coded findability score badge (red 0-39, yellow 40-69, green 70-100), worst-first default sort, score breakdown tooltip.
**Addresses:** Enhanced admin Expert tab (P1 feature 4), expert domain pre-mapping (P2 feature)
**Avoids:** Findability score misused as retrieval signal — document explicitly as admin-diagnostic only, no retrieval weight in v1.1.
**Research flag:** Standard React/Tailwind table patterns. Does not need deeper research. Follow existing admin component patterns in `frontend/src/admin/`.

### Phase 3: Search Intelligence Layer

**Rationale:** Search quality improvements build on the enriched FAISS index from Phase 1. These features touch the live retrieval path and require careful gating and measurement before enabling in production.
**Delivers:** HyDE query expansion (hedged: averaged raw query + hypothetical bio embedding), feedback-weighted re-ranking (cumulative score per expert, minimum 10 interaction threshold, 20% similarity score cap), domain map admin endpoint (`GET /api/admin/domain-map`).
**Addresses:** Query expansion (P2 feature), feedback-weighted re-ranking (P2 feature), domain pre-mapping (P2 feature)
**Avoids:** Query drift (gate on weak original results, 2 variant limit, regression test), popularity bias (minimum 10 interaction threshold, 20% boost cap), latency degradation (asyncio.gather parallelization, 1s timeout on expansion), feedback loop suppressing niche experts (impression distribution monitoring), blocking the event loop (use run_in_executor for sync Gemini calls in async handler)
**Implementation notes:**
- Create query_expander.py service with graceful fallback on Gemini failure
- Modify retriever.py to accept extra_queries with deduplication
- Wire into chat.py with run_in_executor (never block event loop on sync Gemini calls)
- Add QUERY_EXPANSION_ENABLED + FEEDBACK_LEARNING_ENABLED env var flags before shipping
- Run 10-query regression test; compare thumbs-up rate pre/post; benchmark p95 latency before/after
**Research flag:** The architecture research provides complete implementation patterns, but the specific HyDE prompt effectiveness and expansion gating threshold need empirical validation against the actual expert corpus. Plan iteration on the prompt during Phase 3 implementation. Also: check current feedback corpus size before planning Phase 3 — if under 50 thumbs events, ship feedback infrastructure with `FEEDBACK_LEARNING_ENABLED=false`.

### Phase Ordering Rationale

- **Phase 1 must come first** because the tags column must exist before tag_experts.py runs, and tags must be in the DB before ingest.py can embed them. The FAISS index must be rebuilt before retriever.py changes are meaningful.
- **Phase 2 before Phase 3** because admin review of tags and scores provides a human quality gate before those signals influence live retrieval. Admin visibility also lets developers verify data quality without touching the user-facing path.
- **Phase 3 is a single phase** because query expansion and feedback re-ranking are independent retrieval improvements but both require the enriched FAISS index and are best measured together via the same feedback signal (thumbs rate).
- The feedback learning component of Phase 3 can be decoupled from query expansion if needed — both have `ENABLED` env var flags to allow independent shipping.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3:** HyDE prompt engineering and expansion gating thresholds need empirical validation against the actual TCS expert corpus. The architecture research provides the implementation pattern (hedged HyDE with `extra_queries` param) but not the optimal prompt text or the exact `original_quality_threshold` value. Plan a manual evaluation pass on 20 representative queries during Phase 3 implementation.
- **Phase 3:** Feedback signal volume is unknown at research time. Check the SQLite `feedback` table row count before planning Phase 3. If under 50 rows, implement feedback re-ranking infrastructure but ship with `FEEDBACK_LEARNING_ENABLED=false`.

Phases with standard patterns (skip deeper research):
- **Phase 1 (tagging script):** Pattern is fully specified in ARCHITECTURE.md with working code examples. Rate limit handling, response_schema usage, and staging file approach are documented. No novel patterns.
- **Phase 1 (ingest.py modification):** The change is surgical — read from Expert DB instead of CSV, append tags in expert_to_text(). The existing ingest.py is correct otherwise.
- **Phase 2 (admin tab):** Standard React table + Tailwind badge pattern. Follow existing admin component conventions in `frontend/src/admin/`. No novel UI patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing production stack is validated. Only change is tenacity version bump. All implementation patterns verified against official Google GenAI + FAISS docs and confirmed working in the existing codebase. gemini-embedding-001 migration already done. |
| Features | MEDIUM-HIGH | P1 features have well-established patterns (batch tagging, FAISS re-ingest, admin tables). P2 search intelligence features (HyDE, feedback re-ranking) are documented in RAG literature but specific thresholds and prompt effectiveness need empirical validation against this specific corpus. |
| Architecture | HIGH | Based on direct inspection of all production source files. Component boundaries are unambiguous. Data flow diagrams in ARCHITECTURE.md are grounded in actual file structure, not abstract. Build order is dictated by hard data dependencies. |
| Pitfalls | MEDIUM-HIGH | Rate limiting, FAISS thread safety, and Railway volume constraints are verified against official documentation. Query drift and feedback cold-start claims are well-established in literature. Specific threshold values (10 interactions, 20% cap) are informed heuristics requiring empirical tuning for this system. |

**Overall confidence:** HIGH for the P1 data pipeline and admin display phases. MEDIUM-HIGH for the P2 search intelligence features pending empirical validation of expansion gating and feedback thresholds.

### Gaps to Address

- **Exact Gemini rate limits for paid tier:** STACK.md cites 150-300 RPM for Tier 1. Verify the exact current RPM limit at ai.google.dev/gemini-api/docs/rate-limits before setting CONCURRENCY in tag_experts.py. Use conservative values (8 RPM for LLM, 50 RPM for embeddings) if uncertain.
- **Current feedback corpus size:** Unknown at research time. Check `SELECT COUNT(*) FROM feedback` before planning Phase 3. If under 50 rows, ship feedback re-ranking infrastructure with `FEEDBACK_LEARNING_ENABLED=false`.
- **HyDE prompt effectiveness:** The hypothetical bio generation prompt in STACK.md and ARCHITECTURE.md is a reasonable starting point. Plan a manual evaluation pass on 20 representative queries before enabling in production — the prompt may need iteration for the expert-matching domain.
- **ingest.py source-of-truth migration:** ARCHITECTURE.md flags that ingest.py currently reads from experts.csv. The transition to reading from the Expert SQLAlchemy table needs careful handling — verify the existing filter logic (`bio and hourly_rate`) translates correctly to the ORM query before running against production data.

---

## Sources

### Primary (HIGH confidence)
- Existing production codebase (`app/config.py`, `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/services/retriever.py`, `scripts/ingest.py`) — direct inspection, all architecture patterns grounded here
- Google GenAI structured output docs (response_schema, Pydantic): https://ai.google.dev/gemini-api/docs/structured-output
- FAISS write/read index and thread safety: https://faiss.ai/index.html and https://github.com/facebookresearch/faiss/wiki/Threads-and-asynchronous-calls
- Railway volumes documentation: https://docs.railway.com/volumes
- FastAPI lifespan pattern: https://fastapi.tiangolo.com/advanced/events/
- faiss-cpu 1.13.2 on PyPI: https://pypi.org/project/faiss-cpu/
- tenacity 9.1.4 on PyPI: https://pypi.org/project/tenacity/

### Secondary (MEDIUM confidence)
- Google Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits — direction confirmed, exact paid-tier numbers need verification
- HyDE query expansion pattern: https://medium.aiplanet.com/advanced-rag-improving-retrieval-using-hypothetical-document-embeddings-hyde-1421a8ec075a
- RAG feedback re-ranking (NVIDIA technical blog): https://developer.nvidia.com/blog/enhancing-rag-pipelines-with-re-ranking/
- Query expansion pitfalls: https://medium.com/@sahin.samia/query-expansion-in-enhancing-retrieval-augmented-generation-rag-d41153317383
- Cold start and sparse signals in recommender systems: https://medium.com/data-scientists-handbook/cracking-the-cold-start-problem-in-recommender-systems-a-practitioners-guide-069bfda2b800
- Hard negatives degrading RAG: https://arxiv.org/html/2506.00054v1
- gemini-embedding-001 deprecation of text-embedding-004 (Jan 14, 2026): https://github.com/mem0ai/mem0/issues/3942
- embed_content batch limit 100 texts per call: https://github.com/googleapis/python-genai/issues/427
- Gemini Batch API: https://ai.google.dev/gemini-api/docs/batch-api

### Tertiary (LOW-MEDIUM confidence)
- LLM batch-sensitive nondeterminism: https://superintelligencenews.com/research/thinking-machines-llm-nondeterminism-inference/ — supports using response_schema
- Completeness meter UX pattern: https://ui-patterns.com/patterns/CompletenessMeter — informed findability score display decisions

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
