# Phase 14: Hybrid Search Backend - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend exposes `GET /api/explore` — a three-stage hybrid search pipeline (SQLAlchemy pre-filter → FAISS IDSelectorBatch vector search → FTS5 BM25 fusion) plus findability/feedback boosting. The output is a typed JSON data contract (`ExploreResponse`) that every subsequent marketplace UI phase builds against. No frontend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Expert response contract
- Raw scores always included in each expert object: `faiss_score`, `bm25_score`, `final_score` (useful for Test Lab and admin debugging)
- Claude's discretion: which metadata fields to include (lean toward only what Phase 17 cards display: username, first_name, last_name, job_title, company, hourly_rate, tags, findability_score, category + computed match_reason and scores)
- Claude's discretion: whether match_reason is always generated or only when a text query is present
- Claude's discretion: whether profile_url is included in response or constructed client-side from username

### Pagination
- Default page size: **20 per page** (matches Phase 17 react-virtuoso success criterion explicitly)
- Claude's discretion: cursor mechanism (offset-based vs opaque base64 — pick simplest for react-virtuoso scroll loading)
- Claude's discretion: exact count strategy for `total` (exact COUNT(*) on pre-filtered set vs SQLite estimate; pick what's accurate enough for "243 experts found" display)
- Claude's discretion: end-of-results signal (null cursor vs has_more boolean)

### Tag filter semantics
- Multi-tag selection uses **AND logic** — an expert must have ALL selected tags to appear (precision over recall)
- Tag filtering uses the existing **`tags` field** from metadata.json (skill-level tags, already populated)
- Category field used for **grouping/display** (sidebar section headers), tags used for **filter matching**
- Claude's discretion: whether category computation (currently None for all 536 experts) happens as Phase 14 startup logic writing back to metadata.json, or as a pre-phase script — pick the cleanest approach given the existing startup initialization pattern

### Scoring & boost formula
- Claude's discretion: findability boost formula (multiplicative vs additive weight)
- Claude's discretion: feedback boost formula (net score vs Wilson lower bound — consider cold start: most experts have zero feedback)
- Claude's discretion: weight configurability (hardcoded constants vs env vars — consider how often tuning happens in practice)
- Claude's discretion: filter-only sort order (findability only vs findability + feedback net)

### Claude's Discretion
- Response field selection (lean vs full)
- match_reason generation strategy (BM25 term highlighting, FAISS top-k field inspection, or constructed label)
- Cursor encoding (opaque string preferred for clean API contract)
- total count method
- End-of-results signaling
- Category derivation approach and timing
- All scoring formulas and weight configurability
- Filter-only sort secondary signal

</decisions>

<specifics>
## Specific Ideas

- The API is specifically described as "a working, validated data contract to build against" — correctness and schema stability matter more than premature optimization
- Success criteria explicitly mention 1,558 experts (roadmap) but metadata.json has 536 — researcher should reconcile this discrepancy
- FTS5 `experts_fts` and `username_to_faiss_pos` mapping must be built at startup — startup time should remain acceptable for Railway cold starts
- Phase 17 explicitly calls out "match reason snippet" on cards — even if Claude decides how to generate it, it must be present in the response

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-hybrid-search-backend*
*Context gathered: 2026-02-21*
