# Phase 10: Search Intelligence Layer - Research

**Researched:** 2026-02-21
**Domain:** HyDE query expansion + feedback-weighted re-ranking on a FAISS/Gemini retrieval pipeline (FastAPI/Python)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- `QUERY_EXPANSION_ENABLED` and `FEEDBACK_LEARNING_ENABLED` env vars gate each feature — toggle without code changes
- HyDE model: same model as main chat (currently `gemini-2.5-flash`, using the same sync `genai.Client()` pattern as `tagging.py` and `llm.py`)
- Admin Test Lab (Phase 9) must be able to see HyDE activity — search API response must include enough info to display "HyDE triggered: [bio text]"
- Feedback cold-start: count all feedback interactions globally (across all queries) per expert — 10 total interactions qualifies
- Feedback DB failure must NEVER block the search request — degrade gracefully (return results without re-ranking)
- Success criteria: 3 strong results above the similarity threshold = skip HyDE (count adjustable at Claude's discretion)

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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEARCH-01 | System generates a hypothetical expert bio matching each user query (HyDE) and blends it with the raw query embedding before FAISS search | HyDE section covers: embedding generation with gemini-2.5-flash, embedding averaging with embed_query, FAISS search on blended vector |
| SEARCH-02 | HyDE expansion is controlled by a `QUERY_EXPANSION_ENABLED` environment variable flag (can be disabled without a code change) | Env-var boolean pattern section — `os.getenv(...).lower() in ("true", "1")` |
| SEARCH-03 | HyDE expansion is skipped when the original query already returns strong results above the similarity threshold — only activates on weak matches | Weak-query detection pattern: count results >= SIMILARITY_THRESHOLD from initial FAISS pass |
| SEARCH-04 | System applies a soft feedback-weighted boost to retrieval results based on cumulative thumbs up/down votes per expert | Feedback scoring section — per-expert ratio query against `feedback` table, score multiplication |
| SEARCH-05 | Feedback re-ranking requires a minimum of 10 interactions per expert before applying any boost, capped at 20% of similarity score | Cold-start guard and boost cap pattern documented in Architecture Patterns |
| SEARCH-06 | Feedback re-ranking is controlled by a `FEEDBACK_LEARNING_ENABLED` environment variable flag | Same env-var boolean pattern as SEARCH-02 |
</phase_requirements>

---

## Summary

Phase 10 adds two intelligence layers to the existing FAISS retrieval pipeline. Both features are implemented as backend-only changes to `app/services/retriever.py` (and supporting service modules), gated by env vars read at call time. No frontend changes and no new dependencies are required — everything uses already-installed libraries (`google-genai`, `faiss-cpu`, `sqlalchemy`, `numpy`).

**HyDE (SEARCH-01 through SEARCH-03):** When the first-pass FAISS search returns fewer than N results above `SIMILARITY_THRESHOLD`, the system calls `gemini-2.5-flash` to generate a hypothetical expert bio that would answer the user's query. That bio is embedded with `gemini-embedding-001` (same `embed_query()` function, same `RETRIEVAL_QUERY` task type — HyDE docs confirm query-task-type is correct for this use), then averaged with the original query vector. The averaged vector is L2-normalized and used for a second FAISS search. Results from both passes are merged and deduplicated by expert position/profile_url before returning. If the Gemini HyDE call fails or times out, the original candidates are returned unchanged (silent fallback).

**Feedback re-ranking (SEARCH-04 through SEARCH-06):** After candidates are assembled, the system queries the `feedback` SQLite table to compute a per-expert thumbs-up ratio. Experts with >= 10 total feedback interactions receive a boost to their similarity score — capped at 20% of their original score — before final sorting. DB failures degrade gracefully. The Phase 9 admin endpoint `GET /api/admin/domain-map` already queries the feedback table in the same way (profile_url join), confirming the query pattern is production-proven.

**Primary recommendation:** Implement as a new service `app/services/search_intelligence.py` that wraps `retriever.retrieve()`, applying HyDE then feedback re-ranking in sequence. The chat endpoint calls this wrapper instead of calling `retriever.retrieve()` directly.

---

## Standard Stack

### Core (already installed — no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-genai` | 1.64.* | Generate hypothetical bio (HyDE) via `gemini-2.5-flash` | Already in requirements.txt; same client pattern as `tagging.py` and `llm.py` |
| `faiss-cpu` | 1.13.* | FAISS search on blended embedding vector | Already loaded in `app.state.faiss_index`; `IndexFlatIP` supports direct re-query |
| `numpy` | 2.2.* | Vector averaging and L2 normalization | Already used in `embedder.py` |
| `sqlalchemy` | 2.0.* | Query `feedback` table for per-expert vote counts | Already used throughout; `SessionLocal` is the established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `structlog` | 24.2.* | Log HyDE triggered/skipped, feedback boost applied | Already installed; use same `log = structlog.get_logger()` pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single hypothetical bio (1 generation) | Multiple generations + average (Haystack approach uses 5) | Multiple generations is more semantically robust but costs 5x LLM calls; project uses only 1 to keep latency low |
| Averaging original + HyDE embedding | Using HyDE embedding alone | Blending preserves original query intent; pure HyDE can drift from the user's literal words |
| `run_in_executor` (thread pool) | `asyncio.run` | `run_in_executor` is the established pattern in `chat.py` for sync Gemini calls; do not change it |

**Installation:** No new packages needed — all dependencies already in `requirements.txt`.

---

## Architecture Patterns

### Recommended File Structure

```
app/
├── services/
│   ├── embedder.py          # Existing — embed_query(), unchanged
│   ├── retriever.py         # Existing — retrieve() unchanged; search_intelligence calls it
│   ├── tagging.py           # Existing — unchanged
│   ├── llm.py               # Existing — unchanged
│   └── search_intelligence.py   # NEW — HyDE + feedback re-ranking wrapper
├── routers/
│   └── chat.py              # MODIFIED — call search_intelligence.retrieve_with_intelligence()
│                            #            instead of retriever.retrieve()
```

### Pattern 1: Environment Variable Boolean Flags

**What:** Read env var as string, convert to bool at import time or call time.
**When to use:** For both `QUERY_EXPANSION_ENABLED` and `FEEDBACK_LEARNING_ENABLED`.

```python
# Source: Python ecosystem standard (verified via multiple sources)
import os

def _flag(name: str, default: bool = False) -> bool:
    """Read an environment variable as a boolean feature flag."""
    return os.getenv(name, "false").lower().strip() in ("true", "1", "yes")

QUERY_EXPANSION_ENABLED: bool = _flag("QUERY_EXPANSION_ENABLED")
FEEDBACK_LEARNING_ENABLED: bool = _flag("FEEDBACK_LEARNING_ENABLED")
```

**IMPORTANT:** Read at module import time (module-level constants). Railway injects env vars at startup; the value will not change mid-process.

### Pattern 2: Weak Query Detection

**What:** Count results from the first FAISS pass that meet the threshold, skip HyDE if enough strong results exist.
**When to use:** Before every HyDE call.

```python
# Based on existing SIMILARITY_THRESHOLD = 0.60 in retriever.py
# STRONG_RESULT_MIN = 3 is the locked threshold from CONTEXT.md
STRONG_RESULT_MIN = 3  # Adjustable: skip HyDE if >= this many strong results

def _is_weak_query(candidates: list[RetrievedExpert]) -> bool:
    """Return True if the query needs HyDE expansion."""
    strong = sum(1 for c in candidates if c.score >= SIMILARITY_THRESHOLD)
    return strong < STRONG_RESULT_MIN
```

### Pattern 3: HyDE Hypothetical Bio Generation

**What:** Generate a hypothetical expert bio from the user query using gemini-2.5-flash.
**When to use:** When `_is_weak_query()` returns True and `QUERY_EXPANSION_ENABLED` is True.

The prompt should describe an expert's bio (matching expert embedding format), not a query answer. The FAISS index vectors are expert bios — the hypothetical must be bio-shaped to land in the right region of the embedding space.

```python
# Source: HyDE original paper pattern + Haystack docs + project-specific adaptation
import structlog
from google import genai
from google.genai import types

log = structlog.get_logger()
_hyde_client: genai.Client | None = None

def _get_hyde_client() -> genai.Client:
    global _hyde_client
    if _hyde_client is None:
        _hyde_client = genai.Client()
    return _hyde_client

def _generate_hypothetical_bio(query: str) -> str | None:
    """
    Generate a hypothetical expert bio matching the user query.
    Returns None on any failure — caller falls back to original candidates.
    """
    prompt = (
        f"Write a short professional bio (2-3 sentences) for an expert consultant "
        f"who would be the perfect answer to this problem:\n\n"
        f"\"{query}\"\n\n"
        f"Write the bio in first person. Focus on domain expertise, not generic skills. "
        f"Example style: 'I am a tax attorney specializing in EU VAT compliance for "
        f"e-commerce companies. I have advised 50+ startups on cross-border tax structures.'"
    )
    try:
        response = _get_hyde_client().models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,  # Higher temperature for bio diversity
                max_output_tokens=200,
            ),
        )
        bio = (response.text or "").strip()
        return bio if bio else None
    except Exception as exc:
        log.warning("hyde.generation_failed", error=str(exc))
        return None
```

### Pattern 4: Embedding Blend (Average + Normalize)

**What:** Average the original query vector with the hypothetical bio vector; L2-normalize the result.
**When to use:** After generating the hypothetical bio.

```python
import numpy as np
import faiss
from app.services.embedder import embed_query

def _blend_embeddings(original_vec: list[float], hyde_text: str) -> list[float]:
    """
    Embed hypothetical bio, average with original query vector, L2-normalize.
    Returns blended vector (same dimension as original).
    """
    hyde_vec = embed_query(hyde_text)  # Already normalized by embed_query()

    orig = np.array(original_vec, dtype=np.float32)
    hyp = np.array(hyde_vec, dtype=np.float32)

    blended = (orig + hyp) / 2.0  # Equal weight average (adjustable via ratio)
    blended = blended.reshape(1, -1)
    faiss.normalize_L2(blended)  # Re-normalize after averaging (critical!)
    return blended[0].tolist()
```

**Critical:** Re-normalizing after averaging is mandatory. The average of two unit vectors is NOT itself a unit vector. Skipping this breaks `IndexFlatIP` cosine similarity.

### Pattern 5: Feedback Re-ranking Query

**What:** For each candidate, query the feedback table for global up/down counts.
**When to use:** After candidate assembly, when `FEEDBACK_LEARNING_ENABLED` is True.

```python
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models import Feedback
import json

def _load_feedback_scores(
    candidates: list[RetrievedExpert],
    db: Session,
) -> dict[str, float]:
    """
    For each candidate, compute a feedback boost multiplier.
    Returns dict mapping profile_url → boost multiplier (1.0 = no boost).
    Cold-start: experts with < 10 global interactions get no boost.
    Max boost: +20% of original score (multiplier capped at 1.20).
    Degrades gracefully: returns {} on any DB error.
    """
    try:
        # Collect profile URLs for lookup
        urls = [c.profile_url for c in candidates if c.profile_url]
        if not urls:
            return {}

        # Query all feedback rows where these experts appear in expert_ids JSON
        # Strategy: load all feedback rows containing these URLs (SQLite has no JSON indexing)
        # This is acceptable for the small feedback table (<50K rows expected)
        rows = db.scalars(
            select(Feedback).where(Feedback.vote.in_(["up", "down"]))
        ).all()

        # Parse expert_ids and accumulate per-URL up/down counts
        counts: dict[str, dict[str, int]] = {u: {"up": 0, "down": 0} for u in urls}
        url_set = set(urls)

        for row in rows:
            expert_ids = json.loads(row.expert_ids or "[]")
            for eid in expert_ids:
                if eid in url_set:
                    counts[eid][row.vote] = counts[eid].get(row.vote, 0) + 1

        multipliers: dict[str, float] = {}
        for url in urls:
            up = counts[url]["up"]
            down = counts[url]["down"]
            total = up + down
            if total < 10:  # Cold-start guard — SEARCH-05
                continue
            ratio = up / total  # thumbs-up ratio
            if ratio > 0.5:
                # Proportional boost: 0% to 20% based on ratio above 50%
                # ratio=0.5 → 0% boost, ratio=1.0 → 20% boost
                boost = (ratio - 0.5) * 0.4  # (ratio - 0.5) * 0.4 → max 0.20
                multipliers[url] = 1.0 + boost
            elif ratio < 0.5:
                # Penalty: symmetric downward adjustment, same cap
                penalty = (0.5 - ratio) * 0.4
                multipliers[url] = 1.0 - penalty  # min 0.80

        return multipliers
    except Exception as exc:
        log.warning("feedback.score_load_failed", error=str(exc))
        return {}  # Degrade gracefully — never fail the search request
```

### Pattern 6: Admin Test Lab Debug Metadata

**What:** Include HyDE debug info in the chat SSE response so Phase 9 admin can inspect.
**When to use:** Always include the fields in the response payload (null when not triggered).

The `result` SSE event in `chat.py` already returns a dict. Add intelligence metadata to this event:

```python
# In chat.py _stream_chat — augment the result event
yield _sse({
    "event": "result",
    "type": llm_response.type,
    "narrative": llm_response.narrative,
    "experts": experts_payload,
    "conversation_id": conversation.id,
    # Intelligence metadata for Phase 9 admin Test Lab
    "intelligence": {
        "hyde_triggered": hyde_triggered,       # bool
        "hyde_bio": hyde_bio if hyde_triggered else None,  # str | None
        "feedback_applied": feedback_applied,   # bool
    },
})
```

### Anti-Patterns to Avoid

- **HyDE with `RETRIEVAL_DOCUMENT` task type:** The hypothetical bio is a query-time artifact, not an indexed document. Always use `RETRIEVAL_QUERY` task type via `embed_query()` — this is what `embedder.py` does.
- **Direct `asyncio.run()` inside FastAPI:** Already known project pitfall (Phase 08 decision). Use `loop.run_in_executor(None, lambda: ...)` for sync Gemini calls, same pattern as `chat.py`.
- **Storing `Session` across `await` calls:** Existing DB pattern in the project keeps sessions short. Pass `Session` explicitly to feedback scoring function; do not hold across async gaps.
- **Checking `os.getenv("FLAG") == "true"` without `.lower()`:** Railway may inject `"True"` or `"TRUE"`. Always normalize with `.lower()`.
- **Skipping L2 re-normalization after averaging:** Critical bug — averaged vectors are NOT unit length, which corrupts `IndexFlatIP` cosine scores.
- **Failing the entire search when feedback DB is unavailable:** The feedback table is append-only and non-critical. Always `try/except` and return `{}` on failure.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Embedding generation for HyDE bio | Custom embedding HTTP client | `embed_query()` from `embedder.py` | Already handles L2 normalization, API key, lazy client — reuse exactly |
| LLM call for HyDE generation | New HTTP client or new genai.Client setup | `genai.Client()` lazy singleton (same as `llm.py` / `tagging.py`) | Established project pattern, avoids duplicate API key wiring |
| Vector normalization | Manual math | `faiss.normalize_L2(vector)` | Already imported everywhere; handles float32 in-place |
| Boolean env var parsing | Custom parser | `os.getenv("FLAG", "false").lower() in ("true", "1")` | Two-liner; no dependency needed |
| Feedback SQL aggregation | ORM-level Python aggregation after loading all rows | SQLAlchemy `select(Feedback)` filter + Python groupby | Feedback table is small enough; simpler than complex SQL JSON extraction since SQLite lacks JSON indexing |

**Key insight:** Phase 10 is almost entirely orchestration logic — it combines existing infrastructure (Gemini client, embed_query, FAISS index) in a new sequence. Resist the urge to introduce new abstractions.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Re-normalize After Embedding Average
**What goes wrong:** `IndexFlatIP` dot product is only equivalent to cosine similarity for unit vectors. Averaged vectors have magnitude < 1, making scores incomparable to original thresholds.
**Why it happens:** HyDE papers describe "average the embeddings" without always noting this normalization requirement.
**How to avoid:** Always call `faiss.normalize_L2(blended_vec.reshape(1, -1))` immediately after computing the average.
**Warning signs:** HyDE-blended scores are consistently lower than original scores for the same query.

### Pitfall 2: Using Wrong Task Type for HyDE Embedding
**What goes wrong:** If `RETRIEVAL_DOCUMENT` is used instead of `RETRIEVAL_QUERY` for the HyDE bio embedding, retrieval quality degrades because the model optimizes differently for document vs. query representations.
**Why it happens:** The bio text looks like a document, but it's being used as a query-side vector.
**How to avoid:** Always call `embed_query()` from `embedder.py` — it hardcodes `RETRIEVAL_QUERY`. Never bypass it.
**Warning signs:** HyDE-augmented results are worse than baseline results for strong queries.

### Pitfall 3: Gemini HyDE Call Blocking the Event Loop
**What goes wrong:** Calling Gemini synchronously from an async FastAPI route handler blocks the event loop, degrading all concurrent requests.
**Why it happens:** `genai.Client().models.generate_content()` is synchronous.
**How to avoid:** Use `loop.run_in_executor(None, lambda: _generate_hypothetical_bio(query))` — same pattern used in `chat.py` for `retrieve()` and `generate_response()`. The entire search_intelligence wrapper should run inside a single `run_in_executor` call.
**Warning signs:** API latency increases linearly with concurrent users.

### Pitfall 4: Gemini-2.5-Flash Socket Hang (Documented Bug)
**What goes wrong:** A known issue (Google internal bug p2) causes gemini-2.5-flash to hang indefinitely at the network socket level under load rather than returning a 503.
**Why it happens:** IPv6 connection timeouts on certain network configurations.
**How to avoid:** Wrap the HyDE Gemini call in a try/except with a timeout mechanism. Since `run_in_executor` doesn't natively support timeouts, use `asyncio.wait_for()` with a timeout (e.g., 5 seconds) around the executor call. On timeout, fall back to original candidates.
**Warning signs:** Occasional requests hang; no exception raised; Railway times out the whole request.

```python
# Timeout wrapper for HyDE generation
try:
    hyde_bio = await asyncio.wait_for(
        loop.run_in_executor(None, lambda: _generate_hypothetical_bio(query)),
        timeout=5.0
    )
except asyncio.TimeoutError:
    log.warning("hyde.timeout")
    hyde_bio = None
```

### Pitfall 5: Feedback Table Cold-Start Inflation
**What goes wrong:** An expert with 1 upvote and 0 downvotes would get maximum boost (100% thumbs up ratio) if the cold-start guard is missing.
**Why it happens:** Low sample size makes ratios statistically unreliable.
**How to avoid:** Enforce `total >= 10` check before computing any boost. This is locked in SEARCH-05.
**Warning signs:** New experts with sparse feedback appearing disproportionately high in results.

### Pitfall 6: Feedback Lookup Performance on Large Tables
**What goes wrong:** Loading all Feedback rows to Python and doing in-Python groupby will be slow as the table grows.
**Why it happens:** SQLite lacks JSON indexing, making server-side JSON parsing expensive.
**How to avoid:** This is acceptable for v1.1 (table expected to have < 1,000 rows at launch based on STATE.md note "if under 50 rows"). Add a SQLite index on `expert_ids` if performance becomes an issue post-launch.
**Warning signs:** Feedback scoring step taking > 50ms for a single request.

### Pitfall 7: `QUERY_EXPANSION_ENABLED=False` (Railway default)
**What goes wrong:** Deploying with the flag defaulting to True without a feedback corpus could expose unvalidated HyDE behavior.
**Why it happens:** Default-true flags in new code.
**How to avoid:** Default both flags to False in the code. Railway explicitly enables them. The STATE.md note says "ship FEEDBACK_LEARNING_ENABLED=false" — apply same caution to HyDE.
**Warning signs:** Unexpected behavior in production before validation.

---

## Code Examples

### Full search_intelligence.py Module Structure

```python
# app/services/search_intelligence.py
# Source: derived from project patterns in retriever.py, llm.py, tagging.py
"""
Search intelligence layer: HyDE query expansion + feedback re-ranking.

Both features are gated by env var flags (read at module import time):
    QUERY_EXPANSION_ENABLED   — enables HyDE
    FEEDBACK_LEARNING_ENABLED — enables feedback re-ranking

Called by chat.py instead of retriever.retrieve() directly.
"""
import os
import json
import asyncio
import numpy as np
import faiss
import structlog

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.services.embedder import embed_query
from app.services.retriever import retrieve, RetrievedExpert, SIMILARITY_THRESHOLD
from app.config import OUTPUT_DIM

log = structlog.get_logger()

# ── Feature Flags ─────────────────────────────────────────────────────────────

def _flag(name: str) -> bool:
    return os.getenv(name, "false").lower().strip() in ("true", "1", "yes")

QUERY_EXPANSION_ENABLED: bool = _flag("QUERY_EXPANSION_ENABLED")
FEEDBACK_LEARNING_ENABLED: bool = _flag("FEEDBACK_LEARNING_ENABLED")

# ── HyDE Constants ────────────────────────────────────────────────────────────

STRONG_RESULT_MIN = 3     # Skip HyDE if >= this many results >= SIMILARITY_THRESHOLD
HYDE_TIMEOUT_SECONDS = 5  # Abort HyDE LLM call after this many seconds

# ── Public API ────────────────────────────────────────────────────────────────

def retrieve_with_intelligence(
    query: str,
    faiss_index,
    metadata: list[dict],
    db: Session,
) -> tuple[list[RetrievedExpert], dict]:
    """
    Synchronous retrieval with optional HyDE expansion and feedback re-ranking.
    Run in thread pool via run_in_executor (same as retrieve() in chat.py).

    Returns:
        (candidates, intelligence_meta)
        intelligence_meta: {"hyde_triggered": bool, "hyde_bio": str | None, "feedback_applied": bool}
    """
    # Step 1: Initial FAISS retrieval
    candidates = retrieve(query, faiss_index, metadata)
    intelligence = {"hyde_triggered": False, "hyde_bio": None, "feedback_applied": False}

    # Step 2: HyDE expansion (if enabled and query is weak)
    if QUERY_EXPANSION_ENABLED and _is_weak_query(candidates):
        hyde_bio = _generate_hypothetical_bio(query)
        if hyde_bio:
            original_vec = embed_query(query)
            blended_vec = _blend_embeddings(original_vec, hyde_bio)
            hyde_candidates = _search_with_vector(blended_vec, faiss_index, metadata)
            candidates = _merge_candidates(candidates, hyde_candidates)
            intelligence["hyde_triggered"] = True
            intelligence["hyde_bio"] = hyde_bio
            log.info("hyde.triggered", query_preview=query[:60], candidates_after=len(candidates))
        else:
            log.info("hyde.skipped_no_bio")

    # Step 3: Feedback re-ranking (if enabled)
    if FEEDBACK_LEARNING_ENABLED:
        candidates = _apply_feedback_boost(candidates, db)
        if candidates:
            intelligence["feedback_applied"] = True

    return candidates, intelligence
```

### Integration Point in chat.py

```python
# MODIFIED section in chat.py _stream_chat
# Replace the retrieve() call with search_intelligence wrapper

from app.services.search_intelligence import retrieve_with_intelligence

# In _stream_chat (run in executor):
candidates, intelligence = await loop.run_in_executor(
    None,
    lambda: retrieve_with_intelligence(
        query=body.query,
        faiss_index=request.app.state.faiss_index,
        metadata=request.app.state.metadata,
        db=db,
    ),
)

# Include intelligence metadata in the SSE result event:
yield _sse({
    "event": "result",
    "type": llm_response.type,
    "narrative": llm_response.narrative,
    "experts": experts_payload,
    "conversation_id": conversation.id,
    "intelligence": intelligence,  # Admin Test Lab uses this
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct query embedding → FAISS | HyDE: generate hypothetical doc, blend embeddings → FAISS | 2023 (Gao et al. paper) | Improves retrieval for short/vague queries |
| Static retrieval results | Feedback-weighted re-ranking | Emerging 2024 | Incorporates historical user signal |
| No feature flags | Env-var-gated features | Standard practice 2024 | Zero-downtime toggle |

**Deprecated/outdated:**
- `text-embedding-004`: Shut down January 14, 2026 (documented in `config.py`). Do NOT reference. Use `gemini-embedding-001` only.
- `gemini-2.0-flash`: Deprecated, shutdown June 2026 (documented in `llm.py`). HyDE generation uses `gemini-2.5-flash` (same as chat LLM).

---

## Open Questions

1. **Feedback corpus size at Phase 10 implementation time**
   - What we know: STATE.md note says "if under 50 rows, ship FEEDBACK_LEARNING_ENABLED=false"
   - What's unclear: Actual row count in production `feedback` table — depends on live usage between Phase 9 completion and Phase 10 deployment
   - Recommendation: Default `FEEDBACK_LEARNING_ENABLED=false` in Railway. Admin enables after verifying count with `SELECT COUNT(*) FROM feedback`.

2. **HyDE embed_query task type for hypothetical bio**
   - What we know: Haystack docs confirm the hypothetical embedding replaces the query embedding; `embed_query()` uses `RETRIEVAL_QUERY`
   - What's unclear: Whether `RETRIEVAL_QUERY` or `RETRIEVAL_DOCUMENT` would perform better for a bio-shaped hypothetical text
   - Recommendation: Use `RETRIEVAL_QUERY` via `embed_query()` — it is the established project pattern and avoids introducing a new `embed_document()` variant. The semantic intent is "find documents similar to this hypothetical document" which maps to query-side embedding.

3. **Caching HyDE bios by query**
   - What we know: Caching strategy is Claude's discretion
   - What's unclear: Whether repeated identical queries are common enough to justify cache complexity
   - Recommendation: No caching in v1.1. The feedback corpus is small, HyDE fires only on weak queries, and identical repeated queries are rare. Add LRU cache only if profiling shows HyDE latency is a bottleneck.

---

## Sources

### Primary (HIGH confidence)
- Haystack official docs — `https://docs.haystack.deepset.ai/docs/hypothetical-document-embeddings-hyde` — HyDE algorithm, averaging multiple hypothetical embeddings, production approach
- Project codebase — `app/services/retriever.py`, `app/services/embedder.py`, `app/services/llm.py`, `app/models.py`, `app/routers/feedback.py` — confirmed existing patterns for Gemini client, FAISS usage, feedback schema, env var conventions
- Python official docs / ecosystem — `os.getenv` pattern for boolean flags

### Secondary (MEDIUM confidence)
- WebSearch: Zilliz HyDE article — confirms embedding replacement (not blending) is the baseline; blending is a project-chosen enhancement
- WebSearch: January 2026 Medium article on production HyDE — confirms adaptive HyDE (fire only on weak queries) is the current production pattern
- GitHub issue googleapis/python-genai#1893 — confirms gemini-2.5-flash socket hang bug; timeout wrapper is a documented workaround

### Tertiary (LOW confidence)
- WebSearch: Multiple Medium articles on HyDE — general pattern confirmation, no specific code reviewed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in requirements.txt; no new dependencies
- Architecture: HIGH — patterns derived directly from project codebase; HyDE algorithm confirmed by official Haystack docs
- Pitfalls: HIGH (normalization, task type, event loop) — derived from codebase + documented Gemini bug; MEDIUM (feedback performance) — extrapolated from table growth

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days — stable libraries, well-understood problem domain)
