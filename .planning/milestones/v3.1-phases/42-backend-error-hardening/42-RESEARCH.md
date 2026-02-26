# Phase 42: Backend Error Hardening - Research

**Researched:** 2026-02-26
**Domain:** FastAPI error handling, Gemini model migration, FTS5 safety, Search Lab pipeline alignment
**Confidence:** HIGH

## Summary

Phase 42 addresses five backend issues visible in Sentry: photo proxy 502 errors, FTS5 empty-string 500 errors, a deprecated Gemini model, and Search Lab pipeline misalignment. All changes are Python-only (Railway deploy) except one minor frontend empty-input guard.

The photo proxy at `/api/photos/{username}` in `app/routers/browse.py` returns HTTP 502 when the upstream photo URL is unreachable or returns non-200. This should be a 404 since the frontend already handles missing photos gracefully (onError hides the image element). The FTS5 empty-string issue is in `app/services/explorer.py` where `_safe_fts_query()` can return an empty string, but the caller in `run_explore()` already checks `if safe_q:` before executing the MATCH query -- so the explorer path is actually guarded. The issue likely surfaces through the suggest endpoint or direct API calls. The `_detect_and_translate()` function in `app/services/pilot_service.py` uses the deprecated `gemini-2.0-flash-lite` model which shuts down June 1, 2026. The replacement is `gemini-2.5-flash-lite`. The Search Lab A/B comparison at `POST /api/admin/compare` uses `retriever.retrieve()` directly instead of `explorer.run_explore()`, meaning it skips the three-stage hybrid pipeline (pre-filter + FAISS IDSelector + FTS5 BM25 fusion + feedback boost) that the live search uses.

**Primary recommendation:** Fix each error source in isolation, replace the deprecated model, and refactor Search Lab to use `run_explore()` while preserving A/B override capability.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Block submission when input is empty (disable search button / ignore enter on whitespace-only input)
- Special characters (e.g. `***`) are allowed through -- zero results is acceptable, only truly empty strings are blocked
- Backend must also guard FTS5 MATCH against empty/invalid strings as a safety net (belt and suspenders)
- Keep the current Search Lab UI identical -- fix the pipeline under the hood only
- Default to run_explore() as the base pipeline
- A/B comparison should allow different bases -- one side can use the legacy pipeline for validating alignment
- Show a pipeline label/badge on each result set so it's clear which pipeline produced the results (e.g. "run_explore" vs "legacy")
- Photo fallback: completely silent -- monogram appears without any error indicator
- Translation failure: show original untranslated text rather than an error message
- General approach: graceful degradation, never surface raw errors to users

### Claude's Discretion
- Scope of empty-input guards across entry points (search bar, Sage, Search Lab, API endpoints) -- based on where Sentry errors are actually firing
- Whether to add placeholder text hints on disabled search state -- based on current UX
- Photo proxy response strategy (404 with empty body vs returning placeholder image) -- based on least code change and robustness
- Which errors warrant a subtle user-facing fallback message vs completely silent logging
- Whether to keep the legacy pipeline option permanently or remove after verification -- based on maintenance burden
- Pipeline labels in Search Lab should make it easy to verify alignment is working during testing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | Photo proxy returns 404 instead of 502 when upstream unavailable | `browse.py` line 183/186: change HTTPException status_code from 502 to 404 |
| ERR-03 | FTS5 MATCH queries guarded against empty/invalid strings | `explorer.py` already guards in run_explore(); need belt-and-suspenders on suggest.py and any other FTS5 callers |
| ERR-04 | Deprecated gemini-2.0-flash-lite replaced with current model | `pilot_service.py` line 116: change model string to "gemini-2.5-flash-lite" |
| SRCH-01 | Search Lab uses run_explore() pipeline | `admin.py` compare endpoint uses retriever.retrieve() directly; needs refactor to call run_explore() |
| SRCH-02 | Search Lab A/B preserves HyDE/feedback toggle overrides | Override mechanism already exists in CompareRequest.overrides; needs adaptation for run_explore() params |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current | HTTP framework | Already in use |
| httpx | current | Async HTTP client for photo proxy | Already in use |
| SQLAlchemy | current | ORM + raw SQL for FTS5 | Already in use |
| google-genai | current | Gemini API client | Already in use |

### Supporting
No new libraries needed. All changes use existing dependencies.

## Architecture Patterns

### Pattern 1: Error Response Downgrade (ERR-01)
**What:** Change photo proxy from 502 to 404 when upstream fails
**When to use:** When the client already handles 404 gracefully and a 502 creates unnecessary Sentry noise
**Current code (browse.py:182-186):**
```python
except httpx.RequestError:
    raise HTTPException(status_code=502, detail="Upstream photo unavailable")

if upstream_resp.status_code != 200:
    raise HTTPException(status_code=502, detail="Upstream photo unavailable")
```
**Fix:** Change both to `status_code=404`. The frontend `ExpertCard.tsx` already sets `imgError=true` on any fetch error, which hides the photo and shows the card without it (silent monogram fallback per CONTEXT.md).

### Pattern 2: Belt-and-Suspenders FTS5 Guard (ERR-03)
**What:** Protect FTS5 MATCH at both frontend (prevent submission) and backend (guard before query)
**Current state:**
- `explorer.py:_safe_fts_query()` strips special chars and returns "" for empty input
- `explorer.py:run_explore()` already checks `if safe_q:` before executing MATCH -- **this path is safe**
- `suggest.py:_safe_prefix_query()` returns "" for empty input
- `suggest.py:_run_suggest_multi()` checks `if not prefix_q: return []` -- **this path is safe**
- The `/api/explore` endpoint accepts `query=""` by default and enters pure filter mode -- **safe**
- The `/api/pilot` endpoint validates `message: str = Field(..., min_length=1)` -- **safe**

**Recommendation:** The backend already guards FTS5 in all paths. The empty-string 500 error may come from an edge case where `_safe_fts_query()` produces a valid-looking but FTS5-invalid string. Add try/except around the FTS5 MATCH calls as a final safety net. Also add frontend empty-input blocking on the search bar.

### Pattern 3: Model String Replacement (ERR-04)
**What:** Replace deprecated `gemini-2.0-flash-lite` with `gemini-2.5-flash-lite`
**Location:** `pilot_service.py:116` -- the `_detect_and_translate()` function
**Reasoning:** gemini-2.0-flash-lite shuts down June 1, 2026. The replacement `gemini-2.5-flash-lite` is the official successor for lightweight structured extraction tasks.

### Pattern 4: Search Lab Pipeline Alignment (SRCH-01 + SRCH-02)
**What:** Refactor `_retrieve_for_lab()` and `compare_configs()` in admin.py to use `run_explore()` instead of `retriever.retrieve()`
**Current flow:**
1. `_retrieve_for_lab()` calls `retrieve(query, faiss_index, metadata)` -- this is FAISS-only retrieval
2. Optionally applies HyDE expansion and feedback re-ranking
3. Returns `RetrievedExpert` objects with `name`, `title`, `score`, `profile_url`

**Target flow:**
1. Call `run_explore(query, ...)` which does: SQLAlchemy pre-filter + FAISS IDSelector + FTS5 BM25 fusion + findability boost + feedback boost
2. Return `ExpertCard` objects (the same schema the live search returns)
3. Preserve override capability: HyDE and feedback toggles need to work as per-run overrides

**Challenge:** `run_explore()` does not accept HyDE/feedback toggles -- it always applies its own feedback boost and never does HyDE (that's in `retrieve_with_intelligence()` for the chat path). The Search Lab override mechanism currently patches settings before calling retrieve functions.

**Solution approach:**
- Create a new lab-specific wrapper that calls `run_explore()` with the query and default parameters
- For HyDE override: since run_explore() uses FAISS IDSelectorBatch (not raw retrieve()), HyDE expansion would need to happen before run_explore() or as a separate query-expansion step
- For legacy comparison: keep the old `_retrieve_for_lab()` as `_retrieve_legacy()` so one side of A/B can use it
- Add a `pipeline` field to each compare column response: "run_explore" or "legacy"

### Anti-Patterns to Avoid
- **Silently swallowing errors:** Log all caught exceptions with structlog before returning fallback values
- **Hardcoding model strings in multiple places:** The deprecated model string appears only in `pilot_service.py:116` -- single location is already correct
- **Breaking A/B override semantics:** Don't remove the override mechanism; adapt it for the new pipeline

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS5 input sanitization | Custom regex parser | Existing `_safe_fts_query()` + try/except | Edge cases in FTS5 syntax are numerous |
| Photo fallback image | Server-side placeholder generation | HTTP 404 + frontend onError handler | Frontend already handles this cleanly |

## Common Pitfalls

### Pitfall 1: FTS5 Empty MATCH Crash
**What goes wrong:** Passing `""` or whitespace-only string to `WHERE experts_fts MATCH :q` causes SQLite to throw `fts5: syntax error`
**Why it happens:** FTS5 requires at least one search term in MATCH queries
**How to avoid:** Always check `if safe_q:` before MATCH, plus wrap in try/except as final safety net
**Warning signs:** 500 errors in Sentry with `fts5: syntax error` traceback

### Pitfall 2: Gemini Model Shutdown
**What goes wrong:** API returns 404 or similar error when calling a deprecated model
**Why it happens:** Google decommissions old model versions on published dates
**How to avoid:** Replace `gemini-2.0-flash-lite` with `gemini-2.5-flash-lite` before June 1, 2026
**Warning signs:** Sentry errors from `_detect_and_translate()` in pilot_service.py

### Pitfall 3: Search Lab Pipeline Drift
**What goes wrong:** Search Lab results don't match what users see in the search bar
**Why it happens:** Search Lab uses `retrieve()` (FAISS-only) while live search uses `run_explore()` (3-stage hybrid)
**How to avoid:** Route Search Lab through the same `run_explore()` pipeline
**Warning signs:** Admin notices different expert rankings in Search Lab vs live search

### Pitfall 4: run_explore() Requires app_state
**What goes wrong:** `run_explore()` needs `app_state` parameter with `username_to_faiss_pos`, `faiss_index`, `metadata`
**Why it happens:** The explorer was designed to receive app_state from the FastAPI request context
**How to avoid:** Pass `request.app.state` from the admin compare endpoint (already available)
**Warning signs:** AttributeError on app_state access

## Code Examples

### Photo Proxy Fix (ERR-01)
```python
# browse.py — change 502 to 404
except httpx.RequestError:
    raise HTTPException(status_code=404, detail="Photo not found")

if upstream_resp.status_code != 200:
    raise HTTPException(status_code=404, detail="Photo not found")
```

### FTS5 Safety Net (ERR-03)
```python
# Add try/except around FTS5 MATCH in explorer.py as belt-and-suspenders
bm25_scores: dict[int, float] = {}
if safe_q:
    try:
        fts_rows = db.execute(
            text("SELECT rowid, rank FROM experts_fts WHERE experts_fts MATCH :q ORDER BY rank LIMIT 200"),
            {"q": safe_q},
        ).fetchall()
        # ... existing processing
    except Exception as exc:
        log.warning("explore.fts5_match_failed", error=str(exc), query=safe_q)
        # Continue without BM25 scores — FAISS results still available
```

### Gemini Model Fix (ERR-04)
```python
# pilot_service.py — replace deprecated model
resp = client.models.generate_content(
    model="gemini-2.5-flash-lite",  # Was gemini-2.0-flash-lite (deprecated, shuts down June 2026)
    contents=prompt,
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
    ),
)
```

### Search Lab Pipeline Alignment (SRCH-01)
```python
# admin.py — new wrapper using run_explore()
def _explore_for_lab(
    query: str,
    db: Session,
    app_state,
    result_count: int = 20,
) -> tuple[list[dict], dict]:
    """Run query through run_explore() pipeline for Search Lab."""
    from app.services.explorer import run_explore
    result = run_explore(
        query=query,
        rate_min=0.0,
        rate_max=10000.0,
        tags=[],
        limit=result_count,
        cursor=0,
        db=db,
        app_state=app_state,
    )
    experts = [
        {
            "rank": i + 1,
            "name": f"{e.first_name} {e.last_name}",
            "title": e.job_title,
            "score": round(e.final_score, 4),
            "profile_url": e.profile_url if hasattr(e, 'profile_url') else None,
        }
        for i, e in enumerate(result.experts)
    ]
    intelligence = {
        "hyde_triggered": False,
        "hyde_bio": None,
        "feedback_applied": True,  # run_explore always applies feedback
        "pipeline": "run_explore",
    }
    return experts, intelligence
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gemini-2.0-flash-lite | gemini-2.5-flash-lite | Jan 2026 | Direct replacement for lightweight structured extraction |
| 502 for upstream photo failure | 404 (photo not found) | This phase | Sentry noise elimination, cleaner HTTP semantics |
| Search Lab uses retrieve() only | Search Lab uses run_explore() | This phase | Results match live pipeline |

## Open Questions

1. **HyDE override in run_explore() context**
   - What we know: run_explore() does not call HyDE. The chat path goes through retrieve_with_intelligence() which does HyDE.
   - What's unclear: How to support "HyDE ON" override in Search Lab when using run_explore() as the base pipeline.
   - Recommendation: For the run_explore pipeline, HyDE override is N/A (run_explore never did HyDE). The legacy pipeline column can show HyDE behavior. Document this difference with pipeline labels.

2. **gemini-2.5-flash-lite JSON mode compatibility**
   - What we know: gemini-2.0-flash-lite supports response_mime_type="application/json"
   - What's unclear: Whether gemini-2.5-flash-lite has identical JSON mode support
   - Recommendation: Test with a live Dutch query after deployment. STATE.md already notes this as a blocker/concern.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `app/routers/browse.py`, `app/services/explorer.py`, `app/services/pilot_service.py`, `app/routers/admin.py`, `app/routers/suggest.py`
- Frontend analysis: `frontend/src/components/marketplace/ExpertCard.tsx` (photo error handling)

### Secondary (MEDIUM confidence)
- Google Gemini deprecation docs: gemini-2.0-flash-lite shutdown June 1, 2026; replacement is gemini-2.5-flash-lite

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all existing libraries, no new dependencies
- Architecture: HIGH - direct codebase analysis of all affected files
- Pitfalls: HIGH - error patterns visible in current code
- Gemini model replacement: MEDIUM - model name confirmed via Google deprecation docs, JSON mode compatibility needs live validation

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable — no fast-moving dependencies)
