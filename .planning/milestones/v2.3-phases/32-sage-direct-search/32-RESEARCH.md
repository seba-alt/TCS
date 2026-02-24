# Phase 32: Sage Direct Search Integration - Research

**Researched:** 2026-02-22
**Domain:** Zustand state management, React hooks, FastAPI response schema
**Confidence:** HIGH — all findings are from direct code inspection, no external lookups required

---

## Summary

The bug is fully understood from reading the actual code. When `search_experts` fires, `useSage.ts`
calls `validateAndApplyFilters({ query: args.query, ... })` which writes to `filterSlice` (specifically
`setQuery`). That triggers `useExplore`'s `useEffect` dependency array (query changed), which fires
a new `GET /api/explore?query=<sage_text>` FTS5 request. The FTS5 broad-match returns a wide pool
(often the same ~530 count) because conversational text like "find me a fintech expert" matches loosely.
The FAISS-ranked 20-result set that `run_explore()` already computed inside `_handle_search_experts`
is discarded — only the filter args are returned to the frontend.

The fix is four surgical edits across five files. No new dependencies, no backend changes. The
architecture is already decided: add `sageMode` boolean to the store, useSage injects results
directly via `setResults()`, useExplore early-returns when `sageMode` is true, filter actions
each call `setSageMode(false)` to restore normal behavior.

**Primary recommendation:** The plan should treat this as pure frontend refactoring with one backend schema addition. The six risks listed in the brief are all resolvable — findings documented below.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAGE-DX-01 | Sage discovery queries inject results directly into the grid via `store.setResults()` — search bar stays empty, filters unchanged | Backend already returns `experts: list[dict] | None` in PilotResponse (currently null); needs to be populated. Frontend useSage must call `store.setResults()` directly. |
| SAGE-DX-02 | Header expert count reflects Sage's actual FAISS result count; zero-result queries render empty-state UI | `total` from `run_explore()` is the pre-pagination count (all matched experts). `setResults([], 0, null)` triggers EmptyState via existing `experts.length === 0` guard in ExpertGrid. |
| SAGE-DX-03 | Any manual sidebar interaction (search, rate, tags, reset) exits Sage mode and restores normal filter-driven results | All four filter actions (setQuery, setRateRange, toggleTag/setTags, resetFilters) must call `setSageMode(false)` before or after their existing `set()` call. |
</phase_requirements>

---

## Risk Analysis (the six known risks)

### Risk 1: Expert object shape — does run_explore() return everything the frontend needs?

**Status: CONFIRMED SAFE with one caveat.**

The backend `ExpertCard` Pydantic model (explorer.py lines 40-56) produces:

```python
class ExpertCard(BaseModel):
    username: str
    first_name: str
    last_name: str
    job_title: str
    company: str
    hourly_rate: float
    currency: str
    profile_url: str          # profile_url_utm preferred; fallback to profile_url
    tags: list[str]           # ALREADY PARSED — json.loads() called in _build_card()
    findability_score: float | None
    category: str | None
    faiss_score: float | None
    bm25_score: float | None
    final_score: float
    match_reason: str | None
```

The frontend `Expert` interface (resultsSlice.ts lines 5-17) expects:

```typescript
interface Expert {
  username: string
  first_name: string
  last_name: string
  job_title: string
  company: string
  hourly_rate: number
  currency: string
  profile_url: string
  tags: string[]
  findability_score: number | null
  match_reason: string | null
}
```

**What matches:** All 11 fields the frontend cares about are present in ExpertCard.

**The caveat — extra fields:** ExpertCard contains `category`, `faiss_score`, `bm25_score`,
`final_score` which are not in the `Expert` interface. TypeScript with `list[dict]` serialization
will include these extra fields in the JSON. This is safe — TypeScript's structural typing means
extra fields are ignored when the object is used as `Expert`. No type errors, no runtime errors.

**tags field:** Tags are `list[str]` in ExpertCard because `_build_card()` calls
`json.loads(expert.tags or "[]")` before constructing the card. They arrive at the frontend
already parsed as a string array. No JSON.parse needed client-side.

**profile_url:** `_build_card()` uses `expert.profile_url_utm or expert.profile_url` — same
logic as the normal explore endpoint. Profile URLs will be correct and identical to what the
normal grid shows.

**match_reason:** `_build_match_reason()` is called with the sage query — will produce
"Strong match: ..." or "Match via: job_title" strings. These will render in Zone D of ExpertCard
when `hasSemanticFilter` is true. However: `hasSemanticFilter` is computed from `store.query`
and `store.tags` (filterSlice). In sageMode, those stay at their prior values (not the sage
query). This means: if the user had no query active, `hasSemanticFilter` = false, and
match_reason will be suppressed from display even though it's present on the data.

**Implication for planning:** This is acceptable behavior (match reasons are a nice-to-have).
The planner should note it as a known cosmetic limitation, not a bug to fix.

---

### Risk 2: ExploreResponse from run_explore() — ExpertCard objects or ORM objects?

**Status: CONFIRMED — ExpertCard Pydantic objects.**

`run_explore()` returns `ExploreResponse` (explorer.py lines 58-63):

```python
class ExploreResponse(BaseModel):
    experts: list[ExpertCard]   # Pydantic objects, not ORM
    total: int
    cursor: int | None
    took_ms: int
```

The `_handle_search_experts` function already accesses `result.experts` (a list of `ExpertCard`)
and `result.total` (an int). In pilot_service.py line 173, `e.first_name`, `e.last_name`,
`e.hourly_rate`, `e.job_title` are accessed directly — confirming these are Pydantic objects
with attribute access.

**What the backend must do for Phase 32:** Serialize `result.experts` to dicts for the response.
The current return dict has `"experts": None` (PilotResponse.experts = `list[dict] | None = None`).
Must become:

```python
return {
    "filters": filters_to_apply,
    "message": narration,
    "search_performed": True,
    "total": result.total,
    "experts": [e.model_dump() for e in result.experts],  # serialize to dict
}
```

For the zero-result fallback path where `filters_to_apply = None` (grid stays as-is), the
decision from the architecture is to call `setResults([], 0, null)` + `setSageMode(true)`.
But the backend for that path returns `total=0`. The frontend useSage must handle:
- `search_performed=True` + `total=0` + `experts=[]` → `setResults([], 0, null)` + `setSageMode(true)`
- `search_performed=True` + `total>0` + `experts=[...]` → `setResults(data.experts, data.total, null)` + `setSageMode(true)`

The fallback case (zero results, fallback found, `filters=null`, grid stays as-is) contradicts
the architecture decision. See Risk 6 below for the tracking path. The architecture says
"zero-results: setResults([], 0, null) + setSageMode(true)" — this should apply in both
zero-result cases (absolute zero and zero-with-fallback).

---

### Risk 3: sageMode flag and Zustand persist

**Status: CONFIRMED — sageMode must NOT be persisted.**

The current `partialize` in index.ts (lines 35-41) only persists:
- `query`, `rateMin`, `rateMax`, `tags`, `sortBy`, `sortOrder`

The `sageMode` boolean must be added to `resultsSlice` (not `filterSlice`) because it is not
filter state — it is display/fetch-mode state. It must NOT be added to the `partialize` list.
Since `partialize` uses an explicit allowlist (not a blocklist), adding `sageMode` to
resultsSlice automatically keeps it out of localStorage. No changes needed to index.ts partialize.

**Recommended placement:** Add to `resultsSlice.ts` alongside other non-persisted booleans like
`loading` and `isFetchingMore`.

---

### Risk 4: Race condition — setSageMode(true) and setResults() in same tick

**Status: LOW RISK — Zustand batches synchronous updates in React 18.**

In useSage.ts, both calls happen inside the same `try` block in an async handler:

```typescript
store.setResults(data.experts, data.total, null)
store.setSageMode(true)
```

React 18 automatic batching means these two synchronous Zustand `set()` calls in an async
context will be batched into a single re-render. The `useExplore` effect runs on re-render
via React's scheduling — by the time it runs, `sageMode` will already be `true`.

However, there is a subtlety: `useExplore` subscribes to `sageMode` as a dependency. When
`setResults` updates `experts`/`total`/`cursor`, that does NOT trigger useExplore (those aren't
in its dependency array). When `setSageMode(true)` updates sageMode, useExplore will run its
effect — but the early return guard will immediately bail. The abort-and-restart sequence in
the useEffect cleanup will not cause a network request because the effect early-returns before
the fetch call.

**Conclusion:** No race condition. The early-return must come BEFORE any `setLoading(true)` call
in the useEffect body to avoid a loading flash.

```typescript
useEffect(() => {
  // sageMode guard — must be FIRST, before setLoading or controller setup
  if (sageMode) return

  // ... existing abort/fetch logic
}, [query, rateMin, rateMax, tags, sortBy, sageMode, setLoading, setResults, setError, resetResults])
```

---

### Risk 5: The total returned by run_explore() — page total or global total?

**Status: CONFIRMED — `total` is the pre-pagination count (global, not page count).**

From explorer.py line 177:
```python
filtered_experts: list[Expert] = list(db.scalars(stmt).all())
total = len(filtered_experts)
```

`total` is the count of ALL experts passing the pre-filter (rate + tags), before FAISS ranking
and before pagination. For a search_experts call with `limit=20`, if 47 experts match the
semantic query, `total=47` (all experts that passed pre-filter), not 20 (the page count).

**Important nuance:** In text-query mode, experts with no FAISS or BM25 signal are excluded
from `scored` (explorer.py line 245: `if fs == 0.0 and bs == 0.0: continue`). So the actual
number of cards returned may be less than `total`. The `total` count is the pre-filter count,
not the final ranked count.

**What this means for Phase 32:** When useSage calls `setResults(data.experts, data.total, null)`,
`data.experts` will have 0-20 cards (the FAISS top-20), and `data.total` will be the
pre-filter count (potentially larger than 20). The FilterChips component displays
`{total} experts found` — this number comes from `store.total`, which will show the pre-filter
count, not the FAISS-ranked count.

**Recommendation for the plan:** Accept this as acceptable. The pre-filter count is what the
explore API has always returned for the "N experts found" display. It's consistent behavior.
If you want to show only the FAISS-ranked count, you'd need a new field — this is out of scope.

---

### Risk 6: Tracking code in useSage.ts

**Status: NO CHANGE NEEDED — tracking fires before the results injection path.**

The current tracking call in useSage.ts (lines 116-121):

```typescript
void trackEvent('sage_query', {
  query_text: text.trim(),
  function_called: data.search_performed ? 'search_experts' : 'apply_filters',
  result_count: data.total ?? 0,
  zero_results: (data.total ?? 0) === 0,
})
```

This fires immediately after `await res.json()`, before the filter/results logic. After Phase 32
refactoring, the same tracking block fires at the same point — it doesn't depend on whether we
call `validateAndApplyFilters` or `setResults`. No changes to tracking behavior.

The `function_called` tracking uses `data.search_performed` (boolean), which the backend
already returns correctly. `result_count` uses `data.total` which will now be populated from
`run_explore()`.

---

## Exact Code Changes Required

### File 1: `app/services/pilot_service.py`

**Change:** Populate `experts` key in the return dict of `_handle_search_experts`.

Current return (line 231):
```python
return {
    "filters": filters_to_apply,
    "message": narration,
    "search_performed": True,
    "total": result.total,
}
```

New return:
```python
return {
    "filters": filters_to_apply,
    "message": narration,
    "search_performed": True,
    "total": result.total,
    "experts": [e.model_dump() for e in result.experts],
}
```

For the zero-result + absolute-zero fallback path (lines 167-168), `filters_to_apply = {"reset": True}`
and `result.total = 0`. The `result.experts` is `[]` so `experts=[]` is returned automatically.

For the zero-result + fallback-found path (lines 169-179), `filters_to_apply = None` and
`result.total = 0`. Same: `experts=[]` is returned.

**No other backend changes needed.** The `PilotResponse` schema in `app/routers/pilot.py` already
has `experts: list[dict] | None = None` — this field exists and just needs to be populated.

---

### File 2: `frontend/src/store/resultsSlice.ts`

**Change:** Add `sageMode` boolean and `setSageMode` action.

Add to `ResultsSlice` interface:
```typescript
sageMode: boolean
setSageMode: (v: boolean) => void
```

Add to `createResultsSlice` initial state and actions:
```typescript
sageMode: false,
setSageMode: (v) => set({ sageMode: v }),
```

Also update `resetResults` to clear sageMode:
```typescript
resetResults: () =>
  set({ experts: [], total: 0, cursor: null, loading: false, error: null, sageMode: false }),
```

**Persist:** sageMode is NOT added to index.ts `partialize` — the allowlist means it's excluded
automatically.

**Export:** Update `useResultsSlice` in index.ts to expose `sageMode` and `setSageMode`.

---

### File 3: `frontend/src/store/filterSlice.ts`

**Change:** Each filter action must call `setSageMode(false)` before executing.

This requires the `StateCreator` to receive `get` as the third argument so it can access
cross-slice actions. The `ExplorerStore` combined type already exposes `setSageMode`.

```typescript
export const createFilterSlice: StateCreator<
  ExplorerStore,
  [['zustand/persist', unknown]],
  [],
  FilterSlice
> = (set, get) => ({    // <-- add get parameter
  ...filterDefaults,

  setQuery: (q) => {
    get().setSageMode(false)
    set({ query: q })
  },

  setRateRange: (min, max) => {
    get().setSageMode(false)
    set({ rateMin: min, rateMax: max })
  },

  toggleTag: (tag) => {
    get().setSageMode(false)
    set((state) => ({
      tags: state.tags.includes(tag)
        ? state.tags.filter((t) => t !== tag)
        : [...state.tags, tag],
    }))
  },

  setTags: (tags) => {
    get().setSageMode(false)
    set({ tags })
  },

  setSortBy: (sortBy) => set({ sortBy }),  // sort does NOT exit sage mode

  resetFilters: () => {
    get().setSageMode(false)
    set({ ...filterDefaults })
  },
})
```

**Note on setSortBy:** Sort-only changes don't exit sage mode — the user is reordering the
Sage results, not requesting new filter-driven results.

**Cross-slice dependency:** `get().setSageMode` works because at runtime `get()` returns the
full combined `ExplorerStore` which includes `setSageMode` from resultsSlice. This is the
standard Zustand cross-slice pattern and is safe.

---

### File 4: `frontend/src/hooks/useExplore.ts`

**Change:** Add `sageMode` to dependency array and add early-return guard.

```typescript
export function useExplore() {
  // ... existing selectors ...
  const sageMode = useExplorerStore((s) => s.sageMode)  // <-- ADD

  // ... existing selectors ...

  useEffect(() => {
    // Sage mode guard — skip re-fetch when Sage has injected results directly
    // Must come FIRST, before setLoading or controller setup to avoid loading flash
    if (sageMode) return

    // Abort any in-flight request from the previous effect run
    if (controllerRef.current) {
      controllerRef.current.abort()
    }
    // ... rest of existing fetch logic unchanged ...

  }, [query, rateMin, rateMax, tags, sortBy, sageMode, setLoading, setResults, setError, resetResults])
  //                                              ^^^^^-- ADD to dep array

  // loadNextPage — behavior in sage mode: leave as-is
  // loadNextPage uses cursor from store; in sageMode cursor=null (setResults passes null),
  // so the guard `if (cursor === null ...) return` already prevents infinite scroll in sage mode.
  const loadNextPage = useCallback(async () => {
    // ... unchanged ...
  }, [...])

  return { loadNextPage }
}
```

---

### File 5: `frontend/src/hooks/useSage.ts`

**Change:** Replace `validateAndApplyFilters` calls for the `search_performed=true` path with
direct store injection.

**Also:** Extend the local type annotation for `data` to include `experts`.

Current local type (lines 108-113):
```typescript
const data: {
  filters: Record<string, unknown> | null
  message: string
  search_performed?: boolean
  total?: number
} = await res.json()
```

New local type:
```typescript
const data: {
  filters: Record<string, unknown> | null
  message: string
  search_performed?: boolean
  total?: number
  experts?: Expert[]          // <-- ADD (import Expert from store/resultsSlice)
} = await res.json()
```

Replace the `search_performed` handling block (lines 125-141):

**Current (broken) code:**
```typescript
if (data.search_performed === true) {
  if (data.filters && typeof data.filters === 'object') {
    const filtersObj = data.filters as Record<string, unknown>
    if (filtersObj.reset === true) {
      validateAndApplyFilters({ reset: true })
    } else {
      validateAndApplyFilters({ reset: true })
      validateAndApplyFilters(filtersObj)
    }
  }
  // If data.filters is null: grid stays as-is
}
```

**New (correct) code:**
```typescript
if (data.search_performed === true) {
  const store = useExplorerStore.getState()
  const experts = data.experts ?? []
  const total = data.total ?? 0
  store.setResults(experts, total, null)
  store.setSageMode(true)
  // Note: apply_filters path (data.search_performed !== true) still uses
  // validateAndApplyFilters — that behavior is unchanged.
}
```

The `validateAndApplyFilters` function and the `else if (data.filters ...)` block for
`apply_filters` remain unchanged.

---

## What Does NOT Change

- `app/routers/pilot.py` — `PilotResponse` already has `experts: list[dict] | None = None`
- `FilterChips.tsx` — `{total} experts found` displays correctly because `store.total` is set by `setResults()`
- `ExpertGrid.tsx` — EmptyState renders when `!loading && experts.length === 0` — this fires correctly when `setResults([], 0, null)` is called with `loading` still `false`
- `MarketplacePage.tsx` — no changes needed
- `pilotSlice.ts` — no changes needed
- Tracking code in useSage.ts — no changes needed
- `validateAndApplyFilters` function — still used for `apply_filters` path, no changes

---

## Common Pitfalls

### Pitfall 1: EmptyState requires loading=false

**What goes wrong:** If `sageMode=true` causes useExplore to early-return before calling
`setLoading(false)`, and the store has `loading=true` from a previous fetch, EmptyState
will not render — the skeleton grid will show instead.

**How to avoid:** When useSage calls `store.setResults()`, call `store.setLoading(false)`
immediately before or ensure the previous fetch has completed. Since useSage awaits the pilot
API call (which takes 2-5s), the prior useExplore fetch will have already resolved. But to be
safe, also call `store.setLoading(false)` explicitly in the sage path:

```typescript
store.setLoading(false)
store.setResults(experts, total, null)
store.setSageMode(true)
```

### Pitfall 2: FilterChips hides when chips=0 and total=0

From FilterChips.tsx line 34: `if (chips.length === 0 && total === 0) return null`

When sage returns zero results with no active filter chips, the "0 experts found" count
will be hidden. This is existing behavior and is correct — the EmptyState component fills
the grid area instead.

### Pitfall 3: loadNextPage in sage mode

In sage mode, `cursor=null` (because `setResults` is called with `null` as the cursor arg).
The `loadNextPage` callback already guards: `if (cursor === null ...) return`. Infinite scroll
is automatically disabled in sage mode. No code change needed.

### Pitfall 4: get() in filterSlice needs resultsSlice to be initialized first

`get().setSageMode` reads from the combined store. In Zustand's combined store pattern (index.ts),
all slices are initialized in the same `create()` call — there's no ordering issue. By the
time any filter action is called, the entire store including `setSageMode` from resultsSlice
is already registered.

### Pitfall 5: sageMode persisting across page refresh

Because `sageMode` is not in the `partialize` allowlist, it defaults to `false` on every
page load. Sage results are intentionally ephemeral — the user returns to the normal
filter-driven grid on refresh. This is correct behavior.

---

## Architecture Pattern: The sageMode State Machine

```
Normal mode (sageMode=false):
  useExplore watches [query, rateMin, rateMax, tags, sortBy]
  → any filter change triggers /api/explore fetch
  → setResults() updates grid

Sage mode (sageMode=true):
  useSage receives pilot response with search_performed=true
  → store.setResults(data.experts, data.total, null) injects FAISS results
  → store.setSageMode(true) suppresses useExplore
  → grid shows FAISS results, total shows pre-filter count
  → useExplore early-returns on every render (no re-fetch)

Exit sage mode (any filter action):
  setQuery/setRateRange/toggleTag/setTags/resetFilters calls setSageMode(false)
  → sageMode changes → useExplore's dependency array triggers a new effect run
  → useExplore fetches /api/explore with current filter state
  → normal mode resumes
```

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Expert object shape compatibility | HIGH | Direct inspection of ExpertCard Pydantic model vs Expert TS interface |
| tags parsed vs string | HIGH | _build_card() calls json.loads() — confirmed in code |
| total semantics | HIGH | total = len(filtered_experts) before pagination — code confirms |
| sageMode not persisted | HIGH | partialize uses explicit allowlist — confirmed in index.ts |
| React 18 batching prevents race | HIGH | Standard React 18 behavior, consistent with existing Zustand patterns in codebase |
| Tracking unchanged | HIGH | Tracking fires before results handling block — confirmed in code |
| EmptyState render path | HIGH | ExpertGrid line 52: `!loading && experts.length === 0` |
| Cross-slice get() pattern | HIGH | Standard Zustand cross-slice pattern, already used in codebase (useSage uses getState()) |

---

## Sources

All findings from direct code inspection — no external sources required.

- `app/services/pilot_service.py` — `_handle_search_experts` return shape, ExpertCard access
- `app/services/explorer.py` — ExpertCard schema, _build_card(), total semantics, ExploreResponse
- `app/routers/pilot.py` — PilotResponse schema, experts field already exists as `list[dict] | None`
- `frontend/src/store/resultsSlice.ts` — Expert interface, ResultsSlice, setResults signature
- `frontend/src/store/filterSlice.ts` — All filter actions, filterDefaults
- `frontend/src/store/index.ts` — partialize allowlist, combined store pattern
- `frontend/src/hooks/useExplore.ts` — dependency array, fetch logic, loadNextPage guard
- `frontend/src/hooks/useSage.ts` — validateAndApplyFilters, tracking, search_performed path
- `frontend/src/components/marketplace/FilterChips.tsx` — total display, hide-when-zero logic
- `frontend/src/components/marketplace/ExpertGrid.tsx` — EmptyState render condition
- `frontend/src/components/marketplace/EmptyState.tsx` — empty state UI
- `frontend/src/components/marketplace/ExpertCard.tsx` — hasSemanticFilter, match_reason display

**Research date:** 2026-02-22
**Valid until:** Stable — only invalidated by changes to pilot_service.py, resultsSlice, or useExplore
