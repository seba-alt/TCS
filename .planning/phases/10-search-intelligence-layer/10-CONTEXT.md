# Phase 10: Search Intelligence Layer - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the backend retrieval pipeline with two intelligent behaviors: HyDE (Hypothetical Document Embeddings) query expansion for weak queries, and feedback-weighted re-ranking for all results. Both features are gated by environment variable flags (QUERY_EXPANSION_ENABLED, FEEDBACK_LEARNING_ENABLED) so they can be toggled without code changes. No frontend changes — this phase is entirely backend/API.

</domain>

<decisions>
## Implementation Decisions

### Threshold Calibration
- Similarity threshold (what defines "weak" vs "strong"), the minimum count of strong results before HyDE is skipped, the embedding blend ratio (original vs HyDE), and result merging strategy are all Claude's discretion — pick sensible defaults based on cosine similarity scale and the existing FAISS retrieval pipeline
- Success criteria locks: 3 strong results above threshold = skip HyDE; this count may be adjusted at Claude's discretion

### Feedback Scoring Rules
- What "positive thumbs ratio" percentage qualifies is Claude's discretion
- Whether boost is flat (20% cap) or scales proportionally with ratio is Claude's discretion
- Cold-start threshold: count all feedback interactions for an expert **globally** (across all queries) — 10 total interactions from any query qualifies
- Whether re-ranking applies only when HyDE triggered vs always applying is Claude's discretion

### HyDE Generation
- Model: Use the **same model as the main chat** (whatever is configured for the existing conversation flow — same API client/model setting)
- Admin Test Lab visibility: **YES** — the search API response should include enough info for the Test Lab (Phase 9 admin panel) to show whether HyDE was triggered and what bio was generated, so admins can inspect and debug
- Caching strategy (whether to cache HyDE bios by query), and prompt design (bio style vs keyword-rich) are Claude's discretion

### Failure Modes
- If LLM call for HyDE fails or times out: Claude's discretion (likely silent fallback to original results)
- If feedback DB query fails when FEEDBACK_LEARNING_ENABLED=true: **degrade gracefully** — return search results without re-ranking, never fail the entire request
- Whether API response includes debug metadata about which features were applied, and logging level, are Claude's discretion

### Claude's Discretion
- Similarity threshold value and "strong result" count
- HyDE embedding blend ratio (original + hypothetical)
- Result merging strategy when HyDE triggers (replace vs merge-and-deduplicate)
- Positive thumbs ratio threshold
- Boost scaling approach (flat vs proportional)
- Whether re-ranking applies to every search or only when HyDE ran
- HyDE caching strategy
- HyDE prompt design (bio format to best match expert embedding style)
- HyDE failure fallback behavior
- API response metadata structure (debug fields)
- Logging level for intelligence feature activity

</decisions>

<specifics>
## Specific Ideas

- Admin Test Lab (Phase 9) should be able to see HyDE activity — "HyDE triggered: [bio text]" visible when inspecting a query result set. This is important for quality verification.
- Feedback cold-start uses global interaction count — simpler and practical given the current feedback data structure.
- Feedback DB failure must never block search — graceful degradation is required.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-search-intelligence-layer*
*Context gathered: 2026-02-21*
