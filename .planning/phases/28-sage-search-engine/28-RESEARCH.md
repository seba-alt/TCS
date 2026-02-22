# Phase 28: Sage Search Engine - Research

**Researched:** 2026-02-22
**Domain:** Gemini function calling, FastAPI in-process service calls, Zustand filterSlice, zero-result handling
**Confidence:** HIGH — all findings verified directly from codebase; no external library unknowns

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sage narration format**
- Summary includes: result count + 1-2 expert names + skill highlights (e.g., "Found 8 fintech experts, including Sarah Chen and Marcus Reid, with backgrounds in payments, risk, and blockchain")
- Tone adapts to result count — more enthusiastic for a tight, well-matched set; matter-of-fact for large generic returns
- No follow-up nudge after summary — Sage delivers results and waits; user decides what to do next
- No filter recitation — Sage does not restate what criteria it applied; keep the message clean

**Panel expert display**
- Text only in the Sage panel — no mini-cards or visual expert previews
- Sage names 1-2 experts inline in the text summary for personalization
- Sage includes a brief grid acknowledgment in the message (e.g., "Updated the grid for you") — makes the connection between panel response and grid change explicit

**Zero-result handling**
- Primary response: acknowledge + suggest closest match — e.g., "No fintech experts at $200/hr — found 3 at $250/hr though"
- Suggestion is always a specific closest match, not general broadening advice
- Grid stays as-is when zero results — user acts on Sage's suggestion if they choose to
- If the closest-match alternative also returns zero results: Sage resets the grid to show all experts (unfiltered fallback) and states it couldn't find a match

**Grid state on search**
- Sage replaces all current filters when calling `search_experts` — full control, clean slate
- After Sage's search, manual filter changes from the user apply normally with no Sage acknowledgment — user takes back control silently
- Sage's applied filters are fully reflected in the filter UI (chips, sliders, tags show Sage's values — user can see and modify them)
- If result count is 100+, Sage mentions the size and suggests narrowing (e.g., "Found 120 experts — want me to narrow by specialty or rate?")

### Claude's Discretion
- Exact threshold for "large result set" (100+ is the stated intent; Claude can tune)
- Loading/transition state while grid syncs
- Exact wording of the grid acknowledgment line

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAGE-01 | Sage can find experts via a `search_experts` Gemini function that calls `/api/explore` in-process (direct Python import, no HTTP self-call) | `run_explore()` in `app/services/explorer.py` is already importable; `pilot.py` uses `run_in_executor` pattern; `pilot_service.py` needs `db` + `app_state` threaded through |
| SAGE-02 | Sage search updates the main expert grid via filterSlice dispatch — single-ownership rule: `resultsSlice` written only by `useExplore` | `validateAndApplyFilters()` already exists in `useSage.ts`; it dispatches to `filterSlice` which triggers `useExplore` reactive re-fetch automatically |
| SAGE-03 | Sage narrates results in natural language after every function call — no silent grid updates | Turn-2 Gemini pattern already exists; system prompt must include result data (count, expert names) in the function response so Gemini can generate the narration |
| SAGE-04 | Sage acknowledges zero-result searches and suggests alternatives or asks a clarifying question | Zero-result detection happens in `run_explore()` (`total == 0`); backend must run a fallback relaxed search and return alternative data; system prompt guides narration style |
</phase_requirements>

---

## Summary

Phase 28 adds a `search_experts` Gemini function tool alongside the existing `apply_filters` tool. The critical architectural distinction: `search_experts` performs a real `/api/explore` call (via direct Python import of `run_explore()`, not HTTP) and returns expert data to Gemini for narration, while `apply_filters` only signals filter intent (no actual search — the browser executes the search reactively). Both tools dispatch to `filterSlice` via `validateAndApplyFilters()`, triggering `useExplore` to re-fetch.

The backend changes are concentrated in `pilot_service.py` and `pilot.py`. `pilot_service.py` needs `db` and `app_state` injected so `run_explore()` can be called with live data. The `pilot.py` router already uses `run_in_executor`; it must now also inject `db: Session = Depends(get_db)` and `request.app.state`. The two-turn Gemini pattern already exists — for `search_experts`, the function response includes actual expert data (count, names, tags) so Turn 2 can generate a rich narration.

The frontend changes are contained to `useSage.ts`: when `data.search_result` is present in the API response, call `validateAndApplyFilters(data.filters)` to sync the grid, and render `data.message` as the Sage narration. Zero-result handling requires the backend to run a fallback search with relaxed constraints, return it in the function response, and let Gemini narrate the "closest match" suggestion.

**Primary recommendation:** Implement `search_experts` as a second `FunctionDeclaration` in `pilot_service.py`, thread `db` + `app_state` through `run_pilot()` arguments, and distinguish the two tools by return shape (`filters` dict only for `apply_filters`; `filters + experts + total` for `search_experts`).

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-genai` | current | Gemini function calling SDK | Already used in `pilot_service.py` |
| `SQLAlchemy` | current | ORM session injection for `run_explore()` | Already used throughout |
| FastAPI `Depends` | current | `get_db` and `request.app.state` injection | Already used in `explore.py` |
| `asyncio.get_event_loop().run_in_executor` | stdlib | Offload sync `run_pilot()` to thread pool | Already used in `pilot.py` |
| Zustand (`filterSlice`) | current | Grid sync via `validateAndApplyFilters()` | Already implemented in `useSage.ts` |

### No New Dependencies

This phase requires zero new packages. All required capabilities exist in the current stack.

---

## Architecture Patterns

### Existing Two-Turn Gemini Pattern (already working)

```python
# Turn 1: Gemini chooses a function
response = client.models.generate_content(model=..., contents=contents, config=config)
fn_call = response.function_calls[0]  # e.g. fn_call.name == "search_experts"

# CRITICAL: fn_call.args is a protobuf Struct — wrap in dict() before use
args = dict(fn_call.args)

# Turn 2: Send function result back → Gemini generates narration
contents.append(response.candidates[0].content)
contents.append(types.Content(
    role="user",
    parts=[types.Part.from_function_response(
        name="search_experts",
        response={"result": {...}},  # include expert data here for rich narration
    )]
))
final = client.models.generate_content(model=..., contents=contents, config=config)
```

Source: `app/services/pilot_service.py` lines 134-148 (existing `apply_filters` Turn 2)

### Adding `search_experts` FunctionDeclaration

```python
SEARCH_EXPERTS_DECLARATION = types.FunctionDeclaration(
    name="search_experts",
    description=(
        "Discover experts matching a specific need — use when the user wants to find, "
        "discover, or explore experts: 'find me X', 'who can help with Y', 'show me Z experts'. "
        "Performs a live search and returns matched experts."
    ),
    parameters_json_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language description of the expert needed.",
            },
            "rate_min": {"type": "number", "description": "Minimum hourly rate."},
            "rate_max": {"type": "number", "description": "Maximum hourly rate."},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Domain tags to filter by (AND logic).",
            },
        },
        "required": ["query"],
    },
)
```

**CRITICAL — mutually exclusive descriptions:**
- `apply_filters` description: "Narrow or refine the current expert results based on user-specified criteria (rate, tags, keywords). Use when the user is adjusting or narrowing what they already see."
- `search_experts` description: "Discover experts matching a specific need. Use when the user wants to find experts from scratch: 'find me X', 'who can help with Y', 'show me Z experts'."

Overlap in descriptions is the primary risk for incorrect function routing. The descriptions must make the routing decision unambiguous for Gemini.

### `run_pilot()` Signature Change

Current signature (no DB awareness):
```python
def run_pilot(message: str, history: list[dict], current_filters: dict) -> dict:
```

Required signature (Phase 28):
```python
def run_pilot(
    message: str,
    history: list[dict],
    current_filters: dict,
    db: Session,           # NEW — for run_explore()
    app_state,             # NEW — for FAISS index + metadata
) -> dict:
```

### `pilot.py` Router Injection Pattern

Following the same pattern as `explore.py`:
```python
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db

@router.post("/api/pilot", response_model=PilotResponse)
async def pilot(
    body: PilotRequest,
    request: Request,           # NEW — for request.app.state
    db: Session = Depends(get_db),  # NEW — for run_explore()
) -> PilotResponse:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_pilot(
            message=body.message,
            history=[h.model_dump() for h in body.history],
            current_filters=body.current_filters,
            db=db,
            app_state=request.app.state,
        ),
    )
    return PilotResponse(**result)
```

Source: `app/routers/explore.py` lines 20-50 (identical injection pattern)

### `run_explore()` Call from `pilot_service.py`

```python
from app.services.explorer import run_explore, ExploreResponse

def _execute_search(args: dict, db, app_state) -> ExploreResponse:
    """Call run_explore() in-process — direct import, NOT HTTP self-call."""
    return run_explore(
        query=args.get("query", ""),
        rate_min=args.get("rate_min", 0.0),
        rate_max=args.get("rate_max", 10000.0),
        tags=args.get("tags", []),
        limit=20,
        cursor=0,
        db=db,
        app_state=app_state,
    )
```

**`run_explore()` signature** (from `app/services/explorer.py` line 144):
```python
def run_explore(
    query: str,
    rate_min: float,
    rate_max: float,
    tags: list[str],
    limit: int,
    cursor: int,
    db: Session,
    app_state,
) -> ExploreResponse:
```

`ExploreResponse` fields: `experts: list[ExpertCard]`, `total: int`, `cursor: int | None`, `took_ms: int`
`ExpertCard` fields: `username`, `first_name`, `last_name`, `job_title`, `company`, `hourly_rate`, `tags`, etc.

### Zero-Result Handling Pattern

```python
result = _execute_search(args, db, app_state)

if result.total == 0:
    # Fallback: try relaxed search (e.g., drop rate constraints, keep query)
    relaxed_args = {**args}
    relaxed_args.pop("rate_min", None)
    relaxed_args.pop("rate_max", None)
    relaxed_args["tags"] = []
    fallback = _execute_search(relaxed_args, db, app_state)

    if fallback.total == 0:
        # Complete fallback: reset grid to all experts
        reset_filters = {"reset": True}
        fn_response = {
            "result": "zero_results",
            "fallback": "none",
            "suggestion": "No experts found matching any criteria.",
        }
    else:
        # Partial fallback: keep grid as-is, suggest closest match
        fn_response = {
            "result": "zero_results",
            "fallback_total": fallback.total,
            "fallback_experts": [
                {"name": f"{e.first_name} {e.last_name}", "rate": e.hourly_rate}
                for e in fallback.experts[:2]
            ],
            "suggestion": f"Found {fallback.total} experts with relaxed criteria.",
        }
```

### API Response Shape Change

Current `PilotResponse`:
```python
class PilotResponse(BaseModel):
    filters: dict | None
    message: str
```

Phase 28 extended response:
```python
class PilotResponse(BaseModel):
    filters: dict | None   # apply_filters args (or search params for grid sync)
    message: str           # Sage's narration
    experts: list[dict] | None = None  # expert data for panel display (search_experts only)
    total: int | None = None           # result count (search_experts only)
    search_performed: bool = False     # flag: did Sage run search_experts?
```

### Frontend `useSage.ts` Change

The existing `validateAndApplyFilters()` handles grid sync. For `search_experts`, `data.filters` contains the search params that were used — pass them to `validateAndApplyFilters()` to reflect Sage's search in the filter UI.

```typescript
// In handleSend(), after getting data from /api/pilot:

if (data.search_performed && data.filters) {
  // search_experts: reset all filters to Sage's search params (full control)
  validateAndApplyFilters({ reset: true })  // clear slate first
  validateAndApplyFilters(data.filters as Record<string, unknown>)
} else if (data.filters) {
  // apply_filters: layer on top of existing filters
  validateAndApplyFilters(data.filters as Record<string, unknown>)
}
```

**CRITICAL:** `validateAndApplyFilters()` dispatches to `filterSlice` which triggers `useExplore` to re-fetch. Do NOT call `setResults()` directly. `resultsSlice` is only written by `useExplore`.

### `PilotMessage` Type Extension (pilotSlice.ts)

The architecture notes specify `PilotMessage` gains `experts?: Expert[]` for panel display. However, the locked decision says "text only in the Sage panel — no mini-cards". The `experts` field is only for Sage to reference names in its narration (passed via the function response to Gemini Turn 2) — NOT for rendering cards in the panel.

The panel renders `msg.content` (text) only. Expert names appear inline in the narration text, not as separate data structures rendered in the UI.

### System Prompt Update

The system prompt in `pilot_service.py` must be updated to:
1. Explain both functions to Gemini
2. Include current filter state context
3. Guide narration format (count + 1-2 names + skill highlights, grid acknowledgment)

```python
system_instruction = (
    "You are Sage, a warm and helpful AI assistant for a professional expert marketplace. "
    "You have two tools:\n"
    "- apply_filters: use to narrow or refine what the user currently sees\n"
    "- search_experts: use to discover experts from scratch when the user asks to find, "
    "show, or explore experts\n\n"
    "When search_experts returns results, narrate them like: "
    "'Found {N} {domain} experts, including {Name1} and {Name2}, with backgrounds in "
    "{skill1}, {skill2}. Updated the grid for you.'\n"
    "For large result sets (100+), mention the size and offer to narrow.\n"
    "For zero results, acknowledge and suggest the closest alternative found.\n"
    "Do not restate the filters you applied. Be warm and concise.\n"
    f"Current active filters: {current_filters}."
)
```

### 20-Query Test Protocol

From `app/models.py`, the `conversations` table has a `query` column (Text). Test queries come from:

```sql
SELECT DISTINCT query FROM conversations ORDER BY created_at DESC LIMIT 20;
```

The test asserts `fn_call.name` in Railway logs before shipping. In `pilot_service.py`, structured logging already exists:

```python
log.info(
    "pilot: request processed",
    fn_name=fn_call.name,           # ADD THIS — assert this in Railway logs
    has_filters=filters_applied is not None,
    message_length=len(confirmation),
)
```

Run 20 real queries from the conversations table, check that `search_experts` fires for discovery queries and `apply_filters` fires for refinement queries. Budget one iteration of description tuning if routing is off.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Explore search from pilot | Custom search logic | `run_explore()` direct import | All FAISS + FTS5 + scoring already there |
| Grid sync | `setResults()` direct write | `validateAndApplyFilters()` + filterSlice | Single-ownership rule; prevents stale state |
| Expert name extraction | Parse strings | Use `ExpertCard.first_name + last_name` | Structured data already returned |
| HTTP self-call to /api/explore | `httpx`/`requests` | Direct Python import | Same process; HTTP adds latency + no shared state |
| Protobuf dict conversion | Custom protobuf handling | `dict(fn_call.args)` | Already the established pattern in codebase |

---

## Common Pitfalls

### Pitfall 1: fn_call.args is a Protobuf Struct, Not a Plain Dict
**What goes wrong:** Iterating `fn_call.args.items()` works but comparison operators, `get()`, and JSON serialization may behave unexpectedly on the raw Struct.
**Why it happens:** Gemini SDK returns `google.protobuf.struct_pb2.Struct`, which looks dict-like but is not.
**How to avoid:** Always wrap immediately: `args = dict(fn_call.args)`. The existing codebase already does `{k: v for k, v in fn_call.args.items()}` — use `dict(fn_call.args)` which is equivalent and clearer.
**Warning signs:** `TypeError` or missing keys when accessing args after branch logic.

### Pitfall 2: Function Routing Ambiguity Between `apply_filters` and `search_experts`
**What goes wrong:** Gemini calls `apply_filters` when the user says "find me blockchain experts" — no actual search runs, grid doesn't update correctly.
**Why it happens:** Function descriptions overlap ("filter by blockchain" vs "find blockchain experts" look similar to the model).
**How to avoid:** Descriptions must be mutually exclusive. `apply_filters`: "narrow or refine current results". `search_experts`: "discover experts, find me X, who can help with Y". Test 20 real queries from `conversations` table and assert `fn_call.name` in logs.
**Warning signs:** Search queries result in filter-only behavior (grid doesn't refresh with new results matching intent).

### Pitfall 3: `setResults()` Called Directly by `useSage`
**What goes wrong:** Grid shows stale data, `useExplore` re-fetches and overwrites, race condition.
**Why it happens:** Developer bypasses filterSlice to avoid the async re-fetch delay.
**How to avoid:** NEVER call `store.setResults()` from `useSage`. Always dispatch to `filterSlice` via `validateAndApplyFilters()`. The `useExplore` reactive re-fetch IS the grid update mechanism.
**Warning signs:** Grid flickers, results show briefly then are replaced.

### Pitfall 4: `db` Session Not Thread-Safe Across Executor
**What goes wrong:** SQLAlchemy session used in multiple threads — exceptions or data corruption.
**Why it happens:** `run_in_executor` runs in a thread pool; the `db` session from FastAPI's `Depends(get_db)` is scoped to the request coroutine context.
**How to avoid:** Pass `db` directly into `run_pilot()` (which runs in the executor). The session is already bound to the request; it's safe to use within the single executor thread that handles the request. This is the same pattern `explore.py` uses — `db` is passed into `run_explore()` via the lambda.
**Warning signs:** `DetachedInstanceError` or `sqlalchemy.exc.InvalidRequestError`.

### Pitfall 5: Zero-Result Grid Update
**What goes wrong:** Developer calls `validateAndApplyFilters(data.filters)` even when `total == 0`, causing the grid to re-fetch and show zero results with Sage's failed search params.
**Why it happens:** Following the happy-path code without checking `total`.
**How to avoid:** When `total == 0` and no fallback found, either: (a) don't update filters at all (grid stays as-is), or (b) reset filters (`validateAndApplyFilters({ reset: true })`). Per locked decisions: grid stays as-is on zero results; only resets to all experts if the alternative fallback ALSO returns zero.

### Pitfall 6: `run_explore()` Import Creates Circular Dependency
**What goes wrong:** `pilot_service.py` imports from `explorer.py`, which imports from `models.py`, which might create a cycle.
**Why it happens:** Rare, but possible if `explorer.py` imports from `pilot_service.py` transitively.
**How to avoid:** Check the import chain before implementing. `explorer.py` currently imports from `models`, `embedder`, and stdlib only — no cycle risk. The import is safe.
**Warning signs:** `ImportError: cannot import name` at startup.

---

## Code Examples

### Complete `run_pilot()` with Both Functions

```python
# Source: pattern from app/services/pilot_service.py (existing) + Phase 28 additions

def run_pilot(
    message: str,
    history: list[dict],
    current_filters: dict,
    db,          # Session — passed from pilot.py router
    app_state,   # FastAPI app.state — passed from pilot.py router
) -> dict:
    client = _get_client()
    tool = types.Tool(function_declarations=[
        APPLY_FILTERS_DECLARATION,
        SEARCH_EXPERTS_DECLARATION,  # NEW
    ])

    # ... build contents, config, system_instruction ...

    response = client.models.generate_content(
        model=GENERATION_MODEL,
        contents=contents,
        config=config,
    )

    if response.function_calls:
        fn_call = response.function_calls[0]
        args = dict(fn_call.args)  # CRITICAL: unwrap protobuf Struct

        if fn_call.name == "search_experts":
            return _handle_search_experts(
                fn_call, args, contents, config, db, app_state, client
            )
        elif fn_call.name == "apply_filters":
            return _handle_apply_filters(
                fn_call, args, contents, config, client
            )

    # No function call — clarification or greeting
    return {"filters": None, "message": response.text or "...", "search_performed": False}
```

### `_handle_search_experts()` Implementation

```python
def _handle_search_experts(fn_call, args, contents, config, db, app_state, client) -> dict:
    from app.services.explorer import run_explore

    result = run_explore(
        query=args.get("query", ""),
        rate_min=float(args.get("rate_min", 0.0)),
        rate_max=float(args.get("rate_max", 10000.0)),
        tags=list(args.get("tags", [])),
        limit=20,
        cursor=0,
        db=db,
        app_state=app_state,
    )

    if result.total == 0:
        # Try relaxed search
        fallback = run_explore(
            query=args.get("query", ""),
            rate_min=0.0,
            rate_max=10000.0,
            tags=[],
            limit=5,
            cursor=0,
            db=db,
            app_state=app_state,
        )
        if fallback.total == 0:
            fn_response = {"result": "zero_results", "fallback": "none"}
            filters_to_apply = {"reset": True}
        else:
            top = fallback.experts[:2]
            fn_response = {
                "result": "zero_results",
                "fallback_count": fallback.total,
                "fallback_examples": [
                    f"{e.first_name} {e.last_name} (${e.hourly_rate:.0f}/hr)"
                    for e in top
                ],
            }
            filters_to_apply = None  # Grid stays as-is
    else:
        top = result.experts[:2]
        fn_response = {
            "result": "success",
            "total": result.total,
            "top_experts": [
                {
                    "name": f"{e.first_name} {e.last_name}",
                    "title": e.job_title,
                    "rate": e.hourly_rate,
                    "tags": e.tags[:3],
                }
                for e in top
            ],
        }
        filters_to_apply = {
            "query": args.get("query", ""),
            "rate_min": args.get("rate_min", 0.0),
            "rate_max": args.get("rate_max", 10000.0),
            "tags": args.get("tags", []),
        }

    # Turn 2: Gemini generates narration from fn_response
    contents.append(response.candidates[0].content)  # NOTE: 'response' must be in scope
    contents.append(types.Content(
        role="user",
        parts=[types.Part.from_function_response(
            name="search_experts",
            response=fn_response,
        )]
    ))
    final = client.models.generate_content(
        model=GENERATION_MODEL, contents=contents, config=config
    )
    narration = final.text or "I found some experts matching your request — check the grid!"

    log.info(
        "pilot: search_experts executed",
        fn_name=fn_call.name,
        total=result.total,
        query=args.get("query", ""),
    )

    return {
        "filters": filters_to_apply,
        "message": narration,
        "search_performed": True,
        "total": result.total,
    }
```

### Frontend `useSage.ts` Branch for `search_experts`

```typescript
// After: const data = await res.json()

if (data.search_performed && data.filters && typeof data.filters === 'object') {
  // Full replace: clear slate, then apply Sage's search params
  validateAndApplyFilters({ reset: true })
  validateAndApplyFilters(data.filters as Record<string, unknown>)
} else if (data.filters && typeof data.filters === 'object') {
  // Refinement: layer apply_filters on existing state
  validateAndApplyFilters(data.filters as Record<string, unknown>)
}

addMessage({
  id: `${Date.now()}-assistant`,
  role: 'assistant',
  content: data.message ?? "I've updated your search. Check the results!",
  timestamp: Date.now(),
})
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `apply_filters` function | Two mutually exclusive functions: `apply_filters` (refine) + `search_experts` (discover) | Gemini can route correctly; grid sync happens for both paths |
| `run_pilot()` unaware of DB | `run_pilot()` receives `db` + `app_state` | `run_explore()` can be called in-process |
| Frontend receives only `filters` | Frontend receives `filters + search_performed + total` | Can distinguish search vs refine and apply correct filterSlice behavior |

---

## Open Questions

1. **Gemini routing accuracy between `apply_filters` and `search_experts`**
   - What we know: Function descriptions are the primary routing signal; descriptions must be mutually exclusive
   - What's unclear: Exactly how often Gemini misroutes at the boundary ("show me blockchain experts" = search or filter?)
   - Recommendation: Budget one description-tuning iteration after running 20-query test. Log `fn_call.name` in every request to get empirical data fast.

2. **`fn_call.args` protobuf Struct — nested list behavior**
   - What we know: `dict(fn_call.args)` works for top-level keys; tags are returned as a list
   - What's unclear: Whether nested protobuf list values need additional unwrapping (e.g., `list(args["tags"])`)
   - Recommendation: Add defensive casting: `tags=list(args.get("tags", []))` and `float(args.get("rate_min", 0.0))` to ensure correct Python types before passing to `run_explore()`.

3. **Turn 2 `response` variable scope in `_handle_search_experts()`**
   - What we know: The `response` object (Turn 1) must be appended to contents for Turn 2
   - What's unclear: If extracted into a separate function, `response` must be passed as a parameter
   - Recommendation: Pass `response` as a parameter to `_handle_search_experts()` or keep Turn 2 logic inline in `run_pilot()`.

---

## Sources

### Primary (HIGH confidence)
- `/Users/sebastianhamers/Documents/TCS/app/services/pilot_service.py` — existing two-turn pattern, fn_call handling, protobuf Struct access
- `/Users/sebastianhamers/Documents/TCS/app/services/explorer.py` — `run_explore()` signature, `ExploreResponse` schema, `ExpertCard` fields
- `/Users/sebastianhamers/Documents/TCS/app/routers/explore.py` — `db` + `app_state` injection pattern via `Depends(get_db)` + `Request`
- `/Users/sebastianhamers/Documents/TCS/app/routers/pilot.py` — current router pattern, `run_in_executor` usage
- `/Users/sebastianhamers/Documents/TCS/frontend/src/hooks/useSage.ts` — `validateAndApplyFilters()`, `handleSend()` async flow
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/filterSlice.ts` — `filterSlice` actions, `resetFilters()`, `setQuery()`, `setRateRange()`, `setTags()`
- `/Users/sebastianhamers/Documents/TCS/frontend/src/store/resultsSlice.ts` — confirms `setResults()` belongs to `resultsSlice` (NEVER called by `useSage`)
- `/Users/sebastianhamers/Documents/TCS/frontend/src/hooks/useExplore.ts` — reactive re-fetch on filterSlice changes (confirms grid sync mechanism)
- `/Users/sebastianhamers/Documents/TCS/app/models.py` — `conversations.query` column for 20-query test
- `.planning/phases/28-sage-search-engine/28-CONTEXT.md` — all locked decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all libraries already installed and in use
- Architecture: HIGH — all patterns verified from existing codebase; `run_explore()` signature confirmed directly
- Pitfalls: HIGH — all pitfalls derived from actual code review of existing patterns and architecture notes
- Gemini routing accuracy: MEDIUM — depends on empirical validation with real queries; description tuning may be needed

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable stack; Gemini SDK changes are the main expiry risk)
