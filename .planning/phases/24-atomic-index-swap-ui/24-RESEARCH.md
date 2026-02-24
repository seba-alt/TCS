# Phase 24: Atomic Index Swap UI - Research

**Researched:** 2026-02-22
**Domain:** React admin UI — polling hook, status display, backend backend minor extension
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IDX-01 | Admin can trigger FAISS index rebuild from admin panel | New `IndexRebuildPage` at `/admin/index` with a "Rebuild Index" button calling `POST /api/admin/ingest/run` via existing `triggerRun()` |
| IDX-02 | Index rebuild runs in `asyncio.to_thread` — live index serves requests without interruption | Backend already uses `threading.Thread(target=_run_ingest_job)` for full isolation; `asyncio.Lock` must be added to prevent double-run OOM; research confirms thread isolation is sufficient |
| IDX-03 | On completion, `app.state.faiss_index` swaps atomically | Hot-swap at lines 123–125 of admin.py already atomic (Python GIL + single assignment); need to add `app.state.tsne_cache = []` invalidation line for Phase 26 |
| IDX-04 | Rebuild progress status (idle/running/complete/failed + timestamp) visible in admin panel | `useIngestStatus` hook already polls `GET /api/admin/ingest/status` at 3 s interval; `_ingest` dict needs `last_rebuild_at` + `expert_count_at_rebuild` fields added to backend; frontend status card reads those fields |
</phase_requirements>

---

## Summary

This phase is predominantly frontend work. The backend's `_run_ingest_job` function (admin.py lines 93–146) already performs the full rebuild pipeline: tag_experts.py, ingest.py, then hot-swap `app.state.faiss_index` and metadata. What exists on the frontend is a `useIngestStatus` hook in `useAdminData.ts` that already polls `GET /api/admin/ingest/status` every 3 seconds and exposes a `triggerRun()` helper. What is missing is a dedicated admin page that surfaces this hook with a proper UI, and the two small backend additions called out in the planning notes.

The backend additions are minimal and surgical: (1) extend `_ingest` dict with two new keys (`last_rebuild_at`, `expert_count_at_rebuild`) populated at rebuild completion, (2) add `asyncio.Lock` to `POST /api/admin/ingest/run` to guard against concurrent rebuilds causing OOM, and (3) add `app.state.tsne_cache = []` invalidation inside `_run_ingest_job` immediately after the faiss_index swap. These additions do not change any existing API contract.

The frontend work is: create `frontend/src/admin/pages/IndexPage.tsx`, add the route to `main.tsx`, and add the nav item to `AdminSidebar.tsx`. The page uses the already-existing `useIngestStatus` hook and maps the four statuses (idle/running/done/error) to distinct visual states. The `IngestStatus` type in `types.ts` needs two new optional fields added.

**Primary recommendation:** Build `IndexPage.tsx` as a self-contained status card that calls the existing hook, map the four status values to color-coded badges, and add the three backend lines before writing any frontend code.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18 (existing) | UI rendering | Project standard |
| React Router v7 | existing | Admin route registration | Already used in `main.tsx` |
| Tailwind CSS | v3 (existing) | Styling | Project standard; all admin pages use slate/purple palette |
| TypeScript | existing | Type safety | All admin files are `.tsx`/`.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useIngestStatus` hook | existing (useAdminData.ts) | Polls `/ingest/status` and exposes `triggerRun()` | Already written — consume directly |
| `adminPost` / `adminFetch` | existing (useAdminData.ts) | Auth-header fetch wrappers | Use for any admin API call |
| FastAPI `threading.Thread` | existing (Python stdlib) | Background job isolation | Already in use for `_run_ingest_job` |
| `asyncio.Lock` | Python stdlib | Prevent double-rebuild race | Add to `ingest_run` endpoint |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| polling with `setInterval` | WebSocket / SSE | Polling is already built; WebSocket would need a new backend endpoint and adds complexity for a job that takes 2-10 min |
| dedicated `/admin/index` page | adding UI to ExpertsPage | ExpertsPage already uses `useIngestStatus` but the requirement is dedicated visibility; separate page is cleaner |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

The new file slots into the existing admin pages directory with zero structural changes:

```
frontend/src/admin/
├── pages/
│   ├── IndexPage.tsx          ← NEW: Phase 24 delivery
│   ├── ExpertsPage.tsx        ← existing (uses useIngestStatus for tag-all)
│   └── ...
├── hooks/
│   └── useAdminData.ts        ← existing (useIngestStatus already here)
└── types.ts                   ← extend IngestStatus with 2 new optional fields
```

```
app/routers/
└── admin.py                   ← 3 surgical additions (Lock, last_rebuild_at, tsne_cache)
```

### Pattern 1: Route Registration

New page follows identical pattern to all existing admin pages.

**In `main.tsx`:**
```tsx
import IndexPage from './admin/pages/IndexPage.tsx'

// Inside the admin children array:
{ path: 'index', element: <IndexPage /> },
```

**In `AdminSidebar.tsx`, add to NAV_ITEMS (in the Intelligence section, index 3 onwards):**
```tsx
{
  to: '/admin/index',
  label: 'Index',
  end: false,
  icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M9 3h6M12 3v4M8 11h8M8 15h5" />
    </svg>
  ),
},
```

### Pattern 2: Status Badge Mapping

Map `IngestStatus.status` to color tokens consistent with the existing admin palette:

| Status | Text | Color class |
|--------|------|-------------|
| `'idle'` | Idle | `text-slate-400` / `bg-slate-700/40` |
| `'running'` | Rebuilding… | `text-yellow-400` / `bg-yellow-500/10` + `animate-pulse` |
| `'done'` | Complete | `text-green-400` / `bg-green-500/10` |
| `'error'` | Failed | `text-red-400` / `bg-red-500/10` |

```tsx
// Source: derived from IntelligenceDashboardPage.tsx and ExpertsPage.tsx patterns
const STATUS_CONFIG = {
  idle:    { label: 'Idle',         cls: 'text-slate-400 bg-slate-700/40 border-slate-600/40' },
  running: { label: 'Rebuilding…',  cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 animate-pulse' },
  done:    { label: 'Complete',     cls: 'text-green-400 bg-green-500/10 border-green-500/30' },
  error:   { label: 'Failed',       cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
}
```

### Pattern 3: Hook Consumption

`useIngestStatus` is already complete and tested (used in ExpertsPage). Consume it directly:

```tsx
// Source: frontend/src/admin/hooks/useAdminData.ts (lines 185–223)
const { ingest, triggerRun } = useIngestStatus()

// triggerRun('/ingest/run') → POSTs to /api/admin/ingest/run, sets status='running', starts polling
// ingest.status → 'idle' | 'running' | 'done' | 'error'
// ingest.started_at → unix timestamp (number | null)
// ingest.error → string | null
// ingest.last_rebuild_at → number | null  (new field, Phase 24)
// ingest.expert_count_at_rebuild → number | null  (new field, Phase 24)
```

### Pattern 4: Backend `asyncio.Lock` Guard

The planning notes require an `asyncio.Lock` to prevent double-rebuild OOM. The current guard is a string check (`if _ingest["status"] == "running"`), which has a tiny race window if two requests arrive simultaneously. Replace with a module-level Lock:

```python
# Source: admin.py — add at module level near line 68
import asyncio as _asyncio
_ingest_lock = _asyncio.Lock()

# In ingest_run endpoint — replace the current string check:
@router.post("/ingest/run")
async def ingest_run(request: Request):  # must be async to use Lock
    async with _ingest_lock:
        if _ingest["status"] == "running":
            raise HTTPException(status_code=409, detail="Ingest job already running")
        _ingest["status"] = "running"
    thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
    thread.start()
    return {"status": "started"}
```

**Important:** `asyncio.Lock` only works in async endpoints. Change `def ingest_run` to `async def ingest_run`. This is non-breaking because FastAPI handles both sync and async route functions.

### Pattern 5: Backend `_ingest` Dict Extension

Extend the global `_ingest` dict with fields needed by this phase and Phase 25:

```python
# Source: admin.py line 68 — update initial declaration
_ingest: dict = {
    "status": "idle",
    "log": "",
    "error": None,
    "started_at": None,
    "last_rebuild_at": None,          # NEW: Phase 24 — set on successful completion
    "expert_count_at_rebuild": None,  # NEW: Phase 24 + Phase 25 (Index Drift)
}

# Source: admin.py line 143 — update _run_ingest_job on success, before setting status='done'
_ingest["last_rebuild_at"] = time.time()
_ingest["expert_count_at_rebuild"] = len(app.state.metadata)
app.state.tsne_cache = []          # Phase 26: invalidate stale t-SNE projection
_ingest["status"] = "done"
```

### Pattern 6: Frontend Type Extension

Extend `IngestStatus` in `types.ts` with the two new optional backend fields:

```typescript
// Source: frontend/src/admin/types.ts lines 120–125
export interface IngestStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  log: string
  error: string | null
  started_at: number | null
  last_rebuild_at: number | null          // NEW: Phase 24
  expert_count_at_rebuild: number | null  // NEW: Phase 24 + 25
}
```

And update the initial state in `useIngestStatus`:

```typescript
// Source: frontend/src/admin/hooks/useAdminData.ts lines 186–190
const [ingest, setIngest] = useState<IngestStatus>({
  status: 'idle',
  log: '',
  error: null,
  started_at: null,
  last_rebuild_at: null,          // NEW
  expert_count_at_rebuild: null,  // NEW
})
```

### Anti-Patterns to Avoid

- **Do not add a new backend endpoint for status.** `GET /api/admin/ingest/status` already exists and returns `_ingest`. Only the dict shape changes.
- **Do not poll from the page independently.** The hook manages the interval internally. Two polling intervals would produce double requests.
- **Do not use `asyncio.to_thread` in the endpoint itself.** The planning notes say "asyncio.to_thread" conceptually, but the implementation correctly uses `threading.Thread`. The distinction matters: `asyncio.to_thread` requires an async context and the subprocess call is blocking. The current `threading.Thread` approach is correct and proven.
- **Do not change the `tag-all` endpoint.** `POST /api/admin/experts/tag-all` shares the `_ingest` dict state. After this phase, `last_rebuild_at` and `expert_count_at_rebuild` will remain `None` after a tag-only run (correct — those fields track full FAISS rebuilds only).
- **Do not render log output in the UI.** The `_ingest["log"]` field is present in the API response but can contain thousands of lines from subprocess output. Displaying it in the admin UI is a distraction and a performance hazard. Omit it from the status card.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polling loop | Custom `setInterval` in component | `useIngestStatus` hook (already built) | Hook handles cleanup, start/stop, stale-when-not-running |
| Auth-header fetch | Raw `fetch` with manual headers | `adminFetch` / `adminPost` from `useAdminData.ts` | Standardized, gets key from sessionStorage |
| Status-to-color mapping | Complex conditional renders | Simple `STATUS_CONFIG` lookup object | Flat map is readable and covers all four states |
| Double-rebuild prevention | Per-request state tracking | `asyncio.Lock` at module level | Lock is atomic; string check has a race window |

**Key insight:** Nearly all building blocks exist. The work is assembly, not invention.

---

## Common Pitfalls

### Pitfall 1: asyncio.Lock in a Sync Endpoint
**What goes wrong:** Calling `asyncio.Lock()` works at module level, but `async with _ingest_lock` raises a RuntimeError if the endpoint function is `def` (not `async def`).
**Why it happens:** `async with` requires an async context. Sync FastAPI endpoints run in a thread pool — no event loop available.
**How to avoid:** Change `def ingest_run` to `async def ingest_run` when adding the Lock. Verify with a test run.
**Warning signs:** `RuntimeError: no running event loop` in Railway logs.

### Pitfall 2: Polling Continues After Unmount
**What goes wrong:** If a user navigates away from IndexPage while a rebuild is running, the polling interval keeps firing and may cause React state-update warnings.
**Why it happens:** `setInterval` is not tied to component lifecycle.
**How to avoid:** The `useIngestStatus` hook already handles this via `useEffect(() => () => stopPolling(), [stopPolling])` on line 214. No additional cleanup needed in the page component.
**Warning signs:** Console warnings: "Can't perform a React state update on an unmounted component."

### Pitfall 3: `triggerRun` Called on the Wrong Path
**What goes wrong:** ExpertsPage calls `triggerRun('/experts/tag-all')` for tag-only runs. IndexPage must call `triggerRun('/ingest/run')` for the full FAISS rebuild. Mixing these up produces wrong behavior.
**Why it happens:** `triggerRun` is a generic helper that accepts a path parameter.
**How to avoid:** In IndexPage, always call `triggerRun('/ingest/run')` (the default). Do not pass a path argument or use a clear constant.
**Warning signs:** `last_rebuild_at` is never populated despite rebuild button being pressed.

### Pitfall 4: `tsne_cache` Attribute Not Initialized
**What goes wrong:** Adding `app.state.tsne_cache = []` in `_run_ingest_job` will AttributeError on first read if Phase 26 code checks `hasattr(app.state, 'tsne_cache')` but the server started before a rebuild ran.
**Why it happens:** `app.state` is a SimpleNamespace — attributes only exist after assignment.
**How to avoid:** Add `app.state.tsne_cache = []` in the startup lifespan in `main.py` alongside the existing state initialization (after line 198). This is a Phase 24 addition that Phase 26 depends on.
**Warning signs:** Phase 26's embedding map endpoint raises AttributeError at cold start.

### Pitfall 5: `last_rebuild_at` Populated by Tag-Only Runs
**What goes wrong:** If the tag-all endpoint is triggered via ExpertsPage and `_ingest["last_rebuild_at"]` gets set there too, Phase 25's Index Drift metric would show incorrect timestamps.
**Why it happens:** Both jobs share `_ingest`.
**How to avoid:** Only set `last_rebuild_at` and `expert_count_at_rebuild` in `_run_ingest_job`, NOT in `_run_tag_job`.
**Warning signs:** Index Drift shows "just rebuilt" even when only tags were updated, no FAISS change.

### Pitfall 6: Polling Interval and Component Re-mount on Route Navigation
**What goes wrong:** React Router unmounts and remounts the page component on navigation. If the user navigates away and back during a rebuild, `startPolling` is called again but `stopPolling` from the cleanup may not have fired yet, creating two intervals.
**Why it happens:** `useEffect` cleanup runs async relative to the new mount.
**How to avoid:** `useIngestStatus` calls `stopPolling()` at the start of `startPolling()` (line 203: `stopPolling()` then `setInterval`). This is already guarded. Verify the hook is not imported per-page but from the shared hooks file.
**Warning signs:** `/ingest/status` called twice per 3s tick in Network tab.

---

## Code Examples

### Complete `IndexPage.tsx`

This is the full deliverable for IDX-01, IDX-04 requirements:

```tsx
// frontend/src/admin/pages/IndexPage.tsx
import { useIngestStatus } from '../hooks/useAdminData'

const STATUS_CONFIG = {
  idle:    { label: 'Idle',         cls: 'text-slate-400 bg-slate-700/40 border-slate-600/40' },
  running: { label: 'Rebuilding…',  cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 animate-pulse' },
  done:    { label: 'Complete',     cls: 'text-green-400 bg-green-500/10 border-green-500/30' },
  error:   { label: 'Failed',       cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
} as const

function formatTs(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export default function IndexPage() {
  const { ingest, triggerRun } = useIngestStatus()
  const cfg = STATUS_CONFIG[ingest.status]

  async function handleRebuild() {
    await triggerRun('/ingest/run')
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Index</h1>
        <p className="text-slate-500 text-sm mt-1">
          Rebuild the FAISS expert index. Live search continues uninterrupted during rebuild.
        </p>
      </div>

      {/* Status card */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Rebuild Status</h2>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Last rebuild</p>
            <p className="text-slate-200 font-mono text-xs">{formatTs(ingest.last_rebuild_at ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Experts at rebuild</p>
            <p className="text-slate-200 font-mono text-xs">
              {ingest.expert_count_at_rebuild !== null && ingest.expert_count_at_rebuild !== undefined
                ? ingest.expert_count_at_rebuild
                : '—'}
            </p>
          </div>
          {ingest.started_at !== null && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Started at</p>
              <p className="text-slate-200 font-mono text-xs">{formatTs(ingest.started_at)}</p>
            </div>
          )}
        </div>

        {ingest.status === 'error' && ingest.error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-red-400 text-xs font-mono">
            {ingest.error}
          </div>
        )}

        <div className="pt-3 border-t border-slate-700/40">
          <button
            onClick={handleRebuild}
            disabled={ingest.status === 'running'}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              ingest.status === 'running'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/25'
            }`}
          >
            {ingest.status === 'running' ? 'Rebuilding…' : 'Rebuild Index'}
          </button>
          {ingest.status === 'running' && (
            <p className="text-xs text-slate-500 mt-2">
              This typically takes 2–10 minutes. Live search is unaffected.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Backend `_run_ingest_job` Additions (lines 143–146 region)

```python
# Source: app/routers/admin.py — replace lines 143–146
        _ingest["last_rebuild_at"] = time.time()
        _ingest["expert_count_at_rebuild"] = len(app.state.metadata)
        app.state.tsne_cache = []   # Phase 26: invalidate stale t-SNE projection
        _ingest["status"] = "done"
```

### Backend Lock Addition

```python
# Source: app/routers/admin.py — add after line 68 (_ingest dict declaration)
import asyncio as _asyncio
_ingest_lock = _asyncio.Lock()

# Replace the ingest_run endpoint:
@router.post("/ingest/run")
async def ingest_run(request: Request):
    """
    Trigger tag_experts.py + ingest.py in a background thread, then hot-reload FAISS.
    Returns 409 if a job is already running.
    asyncio.Lock prevents concurrent invocations causing OOM on Railway.
    """
    global _ingest
    async with _ingest_lock:
        if _ingest["status"] == "running":
            raise HTTPException(status_code=409, detail="Ingest job already running")
        _ingest["status"] = "running"
    thread = threading.Thread(target=_run_ingest_job, args=(request.app,), daemon=True)
    thread.start()
    return {"status": "started"}
```

### `app.state.tsne_cache` Startup Initialization

```python
# Source: app/main.py — add after line 198 (after faiss_index load)
app.state.tsne_cache = []   # Phase 26: t-SNE projection cache; invalidated on index rebuild
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No dedicated Index UI page | Rebuild was buried inside ExpertsPage actions bar | Phase 24 | Dedicated page gives admins clear visibility and avoids accidental triggers |
| String-check race guard on `ingest_run` | `asyncio.Lock` | Phase 24 | Eliminates the millisecond race window between two simultaneous POST requests |
| `_ingest` dict has 4 keys | 6 keys (adds `last_rebuild_at`, `expert_count_at_rebuild`) | Phase 24 | Enables Index Drift metric (Phase 25) without any new endpoints |

**Deprecated/outdated:**
- The `_ingest["status"] == "running"` check without Lock: replace with Lock pattern as above. The old check remains as a secondary guard inside the Lock.

---

## Open Questions

1. **Should "Rebuild Index" appear in the sidebar Analytics or Intelligence section?**
   - What we know: The sidebar has "Analytics" (Overview, Searches, Gaps) and "Intelligence" (Intelligence, Search Lab, Score Explainer, Leads, Experts, Settings). Index rebuilding is an operational action closer to Experts management.
   - What's unclear: Whether it fits better as the last item in Intelligence or as a new "Operations" section.
   - Recommendation: Add it to the Intelligence section (index 3 onwards) immediately after "Score Explainer" — that section already contains Experts and Settings which are operational.

2. **Should `_run_tag_job` reset `last_rebuild_at` and `expert_count_at_rebuild`?**
   - What we know: Tag-only runs update expert metadata but do not rebuild FAISS or swap `app.state.faiss_index`.
   - What's unclear: Whether a tag-only run should update the rebuild timestamp for drift purposes.
   - Recommendation: No. Only `_run_ingest_job` sets these fields. Tag-only runs leave them unchanged. This is the correct semantics for IDX-03 (atomic FAISS swap) and the future Index Drift metric.

3. **Is `app.state.tsne_cache = []` safe to set in a background thread?**
   - What we know: Python's GIL makes simple attribute assignment on a reference type safe from the thread context. `app.state` is a Starlette `State` object backed by a plain dict.
   - What's unclear: Whether Starlette's `State` object has any locking internally.
   - Recommendation: The assignment is a single operation on an attribute reference — safe under the GIL. This matches how `app.state.faiss_index` is already assigned in the same function (line 123).

---

## Sources

### Primary (HIGH confidence)

- Direct source audit: `app/routers/admin.py` lines 63–146 (ingest state, job function, endpoints)
- Direct source audit: `frontend/src/admin/hooks/useAdminData.ts` lines 185–223 (`useIngestStatus` hook — complete implementation)
- Direct source audit: `frontend/src/admin/types.ts` lines 120–125 (`IngestStatus` interface)
- Direct source audit: `frontend/src/main.tsx` (route registration pattern)
- Direct source audit: `frontend/src/admin/components/AdminSidebar.tsx` (NAV_ITEMS pattern)
- Direct source audit: `app/main.py` lines 102–235 (lifespan and `app.state` initialization)

### Secondary (MEDIUM confidence)

- PROJECT STATE.md — Phase 24 critical constraints: "Frontend-only. Backend swap already in admin.py `_run_ingest_job`. Extend `_ingest` dict with `last_rebuild_at` + `expert_count_at_rebuild`. Add `asyncio.Lock` for double-rebuild OOM prevention."
- REQUIREMENTS.md — IDX-01 through IDX-04 requirement text

### Tertiary (LOW confidence)

- None. All findings are from direct code audit.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already in the project, no new dependencies
- Architecture: HIGH — all patterns derived from direct code audit of existing admin pages
- Backend additions: HIGH — three surgical additions verified against actual function signatures
- Pitfalls: HIGH — all derived from actual code reading (real race conditions, real attribute initialization patterns)

**Research date:** 2026-02-22
**Valid until:** 2026-03-24 (30 days; stable admin codebase, no fast-moving dependencies)
