# Phase 25: Admin Intelligence Metrics - Research

**Researched:** 2026-02-22
**Domain:** FastAPI analytics endpoint + React admin dashboard metrics panel
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- OTR@K displayed as percentage (e.g. "82%"), not decimal (0.82)
- Color coding thresholds: green >= 75%, amber 60-74%, red < 60%
- OTR@K computed post `scored.sort()` in `run_explore()` — admin-only, NOT in public ExploreResponse
- `ALTER TABLE conversations ADD COLUMN otr_at_k REAL` via inline migration pattern
- Index Drift reads from `_ingest` dict fields: `last_rebuild_at` + `expert_count_at_rebuild` (populated by Phase 24)
- `SIMILARITY_THRESHOLD=0.60` aligns with existing `GAP_THRESHOLD=0.60` — no recalibration needed
- OTR@K is admin-only — do NOT expose in public ExploreResponse

### Claude's Discretion
All layout, visualization depth, and behavioral choices:
- Metrics layout — arrangement of OTR@K and Index Drift panels
- Whether to use Phase 22 glassmorphism aesthetic
- OTR@K visualization depth — rolling average only or trend/sparkline too
- OTR@K label — "OTR@K", "On-Topic Rate", or "Search Relevance"
- Color coding extent — number only, badge, or card background
- Index Drift prominence — which headline metric
- Empty states — no search history; Phase 24 fields absent
- Low-confidence caveat — "based on N queries" context
- Refresh mechanism — live-on-visit or manual refresh button
- Actionability on red OTR@K — rebuild nudge or purely observational
- API shape — dedicated `/api/admin/intelligence` endpoint or extend existing
- Tab scope — read-only metrics only vs. light admin actions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-01 | OTR@K (On-Topic Rate, K=10) computed per search query and stored in `conversations` table | DB migration pattern in main.py lifespan + computation site in run_explore() after scored.sort() |
| INTEL-02 | Admin Intelligence dashboard displays OTR@K 7-day rolling average | New `/api/admin/intelligence` endpoint + new IntelligenceMetrics React component on `/admin/intelligence` route |
| INTEL-03 | Index Drift metric tracks time since last rebuild and expert count delta since rebuild | Reads `_ingest["last_rebuild_at"]` and `_ingest["expert_count_at_rebuild"]` already set in Phase 24 |
| INTEL-04 | Admin Intelligence dashboard displays Index Drift status with last-rebuilt timestamp | Same endpoint + same frontend component as INTEL-02 |
</phase_requirements>

---

## Summary

Phase 25 adds two read-only observability metrics to the admin dashboard: OTR@K (On-Topic Rate at K=10) and Index Drift. The implementation touches three layers: (1) backend computation and DB storage of OTR@K during explore calls, (2) a new admin API endpoint that aggregates OTR@K into a 7-day rolling average and reads Index Drift from the in-memory `_ingest` dict, and (3) a frontend metrics panel added to the existing `/admin/intelligence` route.

The codebase already has all scaffolding needed. Phase 24 added `last_rebuild_at` and `expert_count_at_rebuild` to `_ingest`. The `run_explore()` function in `explorer.py` performs the FAISS-ranked sort at `scored.sort()` — OTR@K is computed immediately after, using the top 10 entries and the existing 0.60 threshold. The inline `ALTER TABLE` migration pattern in `main.py` lifespan is the established path for adding `otr_at_k REAL` to conversations. The IntelligenceDashboardPage at `/admin/intelligence` currently hosts search intelligence settings; the new metrics panel is added as a new section within that page (or split into a dedicated sub-section depending on Claude's layout discretion).

**Primary recommendation:** Add `otr_at_k REAL` column via inline migration, compute it in `run_explore()` and write it alongside the existing Conversation DB write in the explore router/service, expose it through a dedicated `GET /api/admin/intelligence` endpoint, and render a two-card metrics panel on the existing IntelligenceDashboardPage route.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | existing | DB query for OTR@K rolling average | Already used for all analytics queries |
| FastAPI | existing | New `/api/admin/intelligence` endpoint | All admin endpoints follow this pattern |
| React + TypeScript | existing | IntelligenceMetrics UI panel | All admin pages use this stack |
| Tailwind CSS | existing | Styling the metrics cards | All admin components use Tailwind |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | existing | Logging OTR@K computation | Consistent with existing log calls |
| `datetime` / `timedelta` | stdlib | 7-day cutoff calculation for rolling average | Same pattern as `get_intelligence_stats` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated `/api/admin/intelligence` endpoint | Extend `/api/admin/ingest/status` | Cleaner separation; ingest/status is for job state, not analytics |
| Rolling average via SQL | Python-side calculation | SQL AVG with date filter is simpler, lower memory |
| Inline OTR@K in ExploreResponse | Admin-only field | Explicitly prohibited by locked decision |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

This phase touches existing files only — no new files except the RESEARCH.md and PLAN.md. Changes are:

```
app/
├── main.py                          # ADD: ALTER TABLE conversations ADD COLUMN otr_at_k REAL
├── services/
│   └── explorer.py                  # ADD: compute otr_at_k after scored.sort(); return it from run_explore()
└── routers/
    └── admin.py                     # ADD: GET /api/admin/intelligence endpoint

frontend/src/admin/
├── types.ts                         # ADD: IntelligenceMetrics interface
├── hooks/
│   └── useAdminData.ts              # ADD: useIntelligenceMetrics() hook
└── pages/
    └── IntelligenceDashboardPage.tsx # ADD: OTR@K + Index Drift panels
```

### Pattern 1: Inline Column Migration (established project pattern)

**What:** `ALTER TABLE ... ADD COLUMN` wrapped in try/except inside the lifespan function — idempotent on every startup.

**When to use:** Every time a new column is added to an existing table.

**Example:**
```python
# Source: app/main.py (existing pattern, lines 116-127)
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE conversations ADD COLUMN otr_at_k REAL",
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # Column already exists — idempotent
log.info("startup: otr_at_k column migrated/verified")
```

### Pattern 2: OTR@K Computation (new, after scored.sort())

**What:** After `scored.sort(key=lambda x: x[0], reverse=True)` in `run_explore()`, take top_k=10 entries and count how many have a FAISS-weighted final score >= 0.60.

**When to use:** Only in text-query mode (is_text_query=True). Skip in pure filter mode (no FAISS scores).

**Critical note:** OTR@K is computed from `final_score` values (the post-fusion, post-findability-boost score), not raw FAISS scores. The threshold 0.60 aligns with `GAP_THRESHOLD` which is already applied to `top_match_score` (also a final/fused score). This is self-consistent.

**Example:**
```python
# After scored.sort() in run_explore() — text query branch only
top_k = scored[:10]
otr_at_k: float | None = None
if top_k:
    otr_at_k = sum(1 for final_s, _, _, _ in top_k if final_s >= 0.60) / len(top_k)
```

The `otr_at_k` value must be returned from `run_explore()` so the router can persist it. Two options:
- **Option A:** Return it in `ExploreResponse` as an internal field — but ExploreResponse is the public contract, locked by phase 15-19 stability constraint.
- **Option B (recommended):** Return it as a second return value from `run_explore()`, or via a separate attribute, and write to DB in the router without exposing it in ExploreResponse.

Since ExploreResponse must not change (public contract), the cleanest approach is to have `run_explore()` accept the `conversation_id` and write OTR@K itself — but that couples search to DB writes, which the current design avoids. The practical pattern: have `explore.py` router pass a callback or have `run_explore()` accept an optional `db_write_otr` callable. The simplest: return `otr_at_k` as part of a wrapper tuple or separate out-param — but since the router is async and delegates to `run_in_executor`, the cleanest is to return a modified response that includes otr_at_k internally, then the router extracts it before returning the public response.

**Recommended implementation:** Extend `run_explore()` to return `(ExploreResponse, otr_at_k: float | None)` as a named tuple or dataclass wrapper. The router unpacks it, writes otr_at_k to the Conversation row, and returns only `ExploreResponse` to the client.

**Alternative (simpler):** The explore router currently does not write to the conversations table — that is done in `chat.py`. The `/api/explore` endpoint is the Marketplace search, which does NOT create a Conversation row. Only chat creates Conversation rows. Therefore:

**CRITICAL FINDING:** Looking at `explore.py` router and `explorer.py` service — they do NOT write to the conversations table at all. The `conversations` table is populated by `chat.py` (the Sage chat endpoint). The `run_explore()` function is for the Marketplace browse, which is stateless. OTR@K must be stored in the conversations table, but conversations are created by chat queries, not explore queries.

This means OTR@K should be computed in the **chat pipeline** (`app/routers/chat.py` or `app/services/retriever.py`), not in `run_explore()`. The planning notes say "computed in `run_explore()` after `scored.sort()`" — this refers to `retriever.py`'s retrieve function or the chat path, not the marketplace explore path.

Let me reconcile: the roadmap says "OTR@K computed in `run_explore()` after `scored.sort()`" but the conversations table is only written from chat. The roadmap likely intends that OTR@K is computed wherever the top-K scored results are determined and a Conversation is being persisted — i.e., in the retriever/chat path, not the marketplace explore path.

**Resolution:** OTR@K is computed in the retrieval pipeline that feeds the chat endpoint, which is where Conversation rows are created. The `retriever.py` returns scored candidates with scores; the chat router writes the Conversation. OTR@K should be computed after the top-10 candidates are determined and written alongside the Conversation row.

### Pattern 3: OTR@K Persistence in Chat Path

```python
# In the chat router (app/routers/chat.py), after retrieval, before or after DB write:
top_k_scores = [c.score for c in candidates[:10]]
otr_at_k = (
    sum(1 for s in top_k_scores if s >= 0.60) / len(top_k_scores)
    if top_k_scores else None
)
# Write to conversation row:
conversation.otr_at_k = otr_at_k
```

### Pattern 4: Rolling Average SQL Query (established pattern from get_intelligence_stats)

**What:** SQLite `AVG()` with a 7-day date cutoff, matching the existing `get_intelligence_stats` daily trend query.

**Example:**
```python
# Source: app/routers/admin.py get_intelligence_stats() pattern (line 363-378)
from sqlalchemy import text as _text

cutoff = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
result = db.execute(_text("""
    SELECT
        AVG(otr_at_k) AS rolling_avg,
        COUNT(*) AS query_count
    FROM conversations
    WHERE otr_at_k IS NOT NULL
      AND date(created_at) >= :cutoff
"""), {"cutoff": cutoff}).one_or_none()

otr_rolling_avg = float(result.rolling_avg) if result and result.rolling_avg is not None else None
otr_query_count = result.query_count if result else 0
```

### Pattern 5: Index Drift from _ingest dict

**What:** Read `_ingest["last_rebuild_at"]` (Unix timestamp float or None) and `_ingest["expert_count_at_rebuild"]` (int or None) from the module-level dict in admin.py. The current expert count comes from `len(app.state.metadata)` or a DB count.

**Example:**
```python
# Source: app/routers/admin.py _ingest dict (line 69-76)
@router.get("/intelligence")
def get_intelligence_metrics(request: Request, db: Session = Depends(get_db)):
    # OTR@K 7-day rolling average
    cutoff = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    from sqlalchemy import text as _text
    row = db.execute(_text("""
        SELECT AVG(otr_at_k) AS rolling_avg, COUNT(*) AS query_count
        FROM conversations
        WHERE otr_at_k IS NOT NULL AND date(created_at) >= :cutoff
    """), {"cutoff": cutoff}).one_or_none()

    otr_rolling_avg = round(float(row.rolling_avg), 4) if row and row.rolling_avg is not None else None
    otr_query_count = int(row.query_count) if row else 0

    # Index Drift
    current_expert_count = len(request.app.state.metadata)
    last_rebuild_at = _ingest.get("last_rebuild_at")
    expert_count_at_rebuild = _ingest.get("expert_count_at_rebuild")

    return {
        "otr": {
            "rolling_avg_7d": otr_rolling_avg,       # e.g. 0.82 — frontend formats as "82%"
            "query_count_7d": otr_query_count,
        },
        "index_drift": {
            "last_rebuild_at": last_rebuild_at,               # Unix timestamp or None
            "expert_count_at_rebuild": expert_count_at_rebuild,  # int or None
            "current_expert_count": current_expert_count,
            "expert_delta": (
                current_expert_count - expert_count_at_rebuild
                if expert_count_at_rebuild is not None else None
            ),
        },
    }
```

### Pattern 6: Frontend Hook (established useIngestStatus pattern)

**What:** A simple `useEffect`-based fetch hook for the new endpoint, mirroring `useIntelligenceStats`.

```typescript
// Source: frontend/src/admin/hooks/useAdminData.ts (lines 167-183) — established pattern
export function useIntelligenceMetrics() {
  const [data, setData] = useState<IntelligenceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    adminFetch<IntelligenceMetrics>('/intelligence')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
```

### Pattern 7: Color-coded OTR@K display

**What:** Map OTR@K percentage to Tailwind color classes at render time.

```typescript
// Frontend: derive color class from percentage value
function otrColorClass(pct: number | null): string {
  if (pct === null) return 'text-slate-400'
  if (pct >= 0.75) return 'text-green-400'
  if (pct >= 0.60) return 'text-yellow-400'  // amber
  return 'text-red-400'
}

// Display
const pct = data.otr.rolling_avg_7d
const display = pct !== null ? `${Math.round(pct * 100)}%` : '—'
```

### Anti-Patterns to Avoid

- **Exposing otr_at_k in ExploreResponse:** Locked decision — it is admin-only. The public response contract must not change.
- **Computing OTR@K in the marketplace explore path:** The `/api/explore` endpoint does not write Conversation rows; OTR@K is meaningless there. Compute and persist only in the chat pipeline.
- **Modifying `_ingest` from outside admin.py:** The `_ingest` dict is module-level in admin.py. Read it in the same module via `_ingest.get(...)`.
- **Adding a new sidebar nav entry:** The "Intelligence" nav link at `/admin/intelligence` already exists. Phase 25 adds a new section within the existing page — not a new route.
- **Using `app.state` to store OTR@K:** OTR@K is per-query and belongs in the DB. `app.state` is for preloaded assets (FAISS index, metadata).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-ago formatting | Custom relative time formatter | `Date` subtraction with `Math.floor` in seconds/minutes/days | Simple enough inline; no library needed for "3 days ago" |
| Rolling average | Python sliding-window loop | SQL `AVG()` with date filter | DB handles it in one query; no memory overhead |
| Color threshold logic | Complex gradient system | Three Tailwind classes keyed by if/else | Only three states: green/amber/red |
| Expert count delta | Cross-state reconciliation | `current_expert_count - expert_count_at_rebuild` | Both values already available |

**Key insight:** All the data is already in-flight — `_ingest` has the rebuild timestamp and count, the DB has OTR@K once the column is added. This phase is mostly plumbing and display, not algorithm work.

---

## Common Pitfalls

### Pitfall 1: OTR@K Computed in Wrong Pipeline
**What goes wrong:** OTR@K is computed and stored in the marketplace explore path (`/api/explore`) which never writes Conversation rows.
**Why it happens:** The planning notes say `run_explore()` — this is ambiguous between the marketplace service and the general idea of "running a search."
**How to avoid:** OTR@K must be persisted to the `conversations` table. Conversations are only created by `chat.py`. Compute OTR@K from the retriever candidates in the chat path.
**Warning signs:** `otr_at_k` column always NULL after searches.

### Pitfall 2: Division by Zero in OTR@K
**What goes wrong:** `sum(...) / len(top_k)` raises ZeroDivisionError when no results return.
**Why it happens:** Query returns 0 results — `top_k` is empty.
**How to avoid:** Guard: `otr_at_k = ... if top_k else None`. Store NULL when no results.
**Warning signs:** 500 errors on empty-result searches.

### Pitfall 3: Rolling Average When otr_at_k Is NULL
**What goes wrong:** SQL `AVG(otr_at_k)` includes NULL rows implicitly — it actually ignores NULLs by SQL standard, so this is safe. But the query count must use `WHERE otr_at_k IS NOT NULL` to give meaningful N.
**Why it happens:** Historic Conversation rows pre-dating Phase 25 will all have `otr_at_k = NULL`.
**How to avoid:** Filter `WHERE otr_at_k IS NOT NULL` and surface `query_count_7d` for confidence context.
**Warning signs:** Rolling average returns NULL even after new searches.

### Pitfall 4: Index Drift Shows Stale Data After Server Restart
**What goes wrong:** `_ingest["last_rebuild_at"]` is `None` after a server restart because `_ingest` is an in-memory dict initialized to `None`.
**Why it happens:** Phase 24 sets `last_rebuild_at` only when a rebuild completes during the current process lifetime — not persisted to DB.
**How to avoid:** Accept this as a known limitation; display "—" (em dash) in the UI when `None`. The UI already uses this pattern in IndexPage.tsx (`formatTs` function returns `'—'` for null).
**Warning signs:** Index Drift shows "—" after Railway deploys even though a rebuild ran previously. This is expected behavior.

### Pitfall 5: Type Conflict in Existing IntelligenceDashboardPage
**What goes wrong:** The current `IntelligenceDashboardPage` fetches from `/api/admin/settings` and is named "Intelligence Dashboard" but contains settings controls. Adding OTR@K metrics to this same page requires careful section separation.
**Why it happens:** The page is named "IntelligenceDashboardPage" but currently only renders the settings panel. Phase 25 adds the metrics section.
**How to avoid:** Keep the existing settings section intact; add the OTR@K and Index Drift panels as new sections above or below the existing content within the same component.
**Warning signs:** Breaking the existing settings toggle/save functionality.

### Pitfall 6: Threshold Ambiguity — Final Score vs. FAISS Score
**What goes wrong:** OTR@K threshold of 0.60 applied to raw FAISS similarity scores instead of the fused `final_score`.
**Why it happens:** `GAP_THRESHOLD` is applied to `top_match_score` in the chat path — this is the retriever score, not the fused score. The chat path uses `retriever.py`, not `explorer.py`.
**How to avoid:** In the chat path, `top_match_score` is the retriever score. Use the same score type consistently. OTR@K = fraction of top-10 candidates with score >= 0.60 using the same score field as `top_match_score`.
**Warning signs:** OTR@K values inconsistent with gap_count trends.

---

## Code Examples

### DB Migration (main.py lifespan)
```python
# Source: Existing pattern app/main.py lines 116-127
with engine.connect() as _conn:
    for _col_ddl in [
        "ALTER TABLE conversations ADD COLUMN otr_at_k REAL",
    ]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # Column already exists — idempotent
log.info("startup: Phase 25 otr_at_k column migrated/verified")
```

### ORM Model Update (app/models.py)
```python
# Add to Conversation class:
otr_at_k: Mapped[float | None] = mapped_column(Float, nullable=True)
```

### Backend Endpoint Response Shape
```python
# GET /api/admin/intelligence
{
    "otr": {
        "rolling_avg_7d": 0.82,     # float 0.0-1.0 or null
        "query_count_7d": 47,       # int — how many queries in the 7-day window
    },
    "index_drift": {
        "last_rebuild_at": 1708560000.0,    # Unix timestamp or null
        "expert_count_at_rebuild": 530,      # int or null
        "current_expert_count": 542,         # int (always present)
        "expert_delta": 12,                  # int or null (null when no rebuild recorded)
    },
}
```

### TypeScript Interface (types.ts addition)
```typescript
export interface IntelligenceMetrics {
  otr: {
    rolling_avg_7d: number | null
    query_count_7d: number
  }
  index_drift: {
    last_rebuild_at: number | null           // Unix timestamp
    expert_count_at_rebuild: number | null
    current_expert_count: number
    expert_delta: number | null
  }
}
```

### Time-Ago Helper (frontend utility)
```typescript
function timeAgo(unixTs: number | null): string {
  if (unixTs === null) return '—'
  const diffSeconds = Math.floor((Date.now() / 1000) - unixTs)
  if (diffSeconds < 60) return 'just now'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hr ago`
  return `${Math.floor(diffSeconds / 86400)} days ago`
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A — new feature | OTR@K computed at query time, stored per row, aggregated via SQL AVG | Phase 25 | Simple, no precomputation needed |
| N/A — new feature | Index Drift from in-memory `_ingest` dict (Phase 24 added fields) | Phase 25 reads Phase 24 data | No new state; reads existing dict |

**Deprecated/outdated:**
- None for this phase.

---

## Open Questions

1. **Where exactly in the chat pipeline does OTR@K get computed and written?**
   - What we know: `chat.py` creates Conversation rows; `retriever.py` returns scored candidates.
   - What's unclear: Whether to compute OTR@K in `chat.py` directly or pass it through from `retriever.py` as a return value alongside candidates.
   - Recommendation: Compute it in `chat.py` after `retrieve()` or `retrieve_with_intelligence()` returns candidates — the candidates list has `.score` attributes, take top 10, apply 0.60 threshold, store as `conversation.otr_at_k`.

2. **Does the IntelligenceDashboardPage get a new section, or is there a dedicated page?**
   - What we know: The route `/admin/intelligence` already maps to `IntelligenceDashboardPage`. The sidebar already has an "Intelligence" link. The current page renders settings controls.
   - What's unclear: Whether to add metrics sections to the existing page or create a new page with new route.
   - Recommendation: Add two new metric cards to the existing `IntelligenceDashboardPage` as a new section above the settings. This avoids router/sidebar changes. The page currently renders settings; the name "Intelligence Dashboard" semantically fits metrics too.

3. **Should the Intelligence endpoint use the same auth pattern?**
   - What we know: All admin endpoints on `router` (not `auth_router`) require `X-Admin-Key` via `Depends(_require_admin)`.
   - What's unclear: Nothing — it's clear. Use `router` (not `auth_router`).
   - Recommendation: Add `@router.get("/intelligence")` — inherits the `_require_admin` dependency automatically.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `app/main.py`, `app/routers/admin.py`, `app/services/explorer.py`, `app/models.py`, `app/routers/explore.py` — all read 2026-02-22
- Direct codebase inspection — `frontend/src/admin/hooks/useAdminData.ts`, `frontend/src/admin/types.ts`, `frontend/src/admin/pages/IntelligenceDashboardPage.tsx`, `frontend/src/admin/pages/IndexPage.tsx`, `frontend/src/main.tsx` — all read 2026-02-22
- `.planning/phases/25-admin-intelligence-metrics/25-CONTEXT.md` — user decisions
- `.planning/STATE.md` — Phase 24 completion confirmed; `_ingest` fields in place

### Secondary (MEDIUM confidence)
- SQLite `AVG()` ignores NULL behavior — SQL standard, confirmed by existing pattern in `get_intelligence_stats` which uses `AVG(top_match_score)` with nullable column

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in use; no new dependencies
- Architecture: HIGH — all patterns verified directly from codebase inspection
- Pitfalls: HIGH — all identified from direct code reading (no search history path issue, NULL handling, threshold type)
- Frontend integration: HIGH — route exists, hook pattern established, type interface clear

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable stack — no fast-moving dependencies)
