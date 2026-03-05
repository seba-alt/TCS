# Phase 26: Embedding Heatmap - Research

**Researched:** 2026-02-22
**Domain:** t-SNE dimensionality reduction (scikit-learn) + Recharts ScatterChart (React)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Chart color palette:** Aurora-adjacent jewel tones — vibrant purples, teals, greens, pinks that complement the v2.2 aurora gradient. Palette should feel part of the v2.2 visual system, not generic charting defaults.
- **Post-rebuild behavior:** After Phase 24 triggers an index rebuild and t-SNE cache is invalidated, the scatter plot does NOT auto-detect the change. Fresh data loads on the admin's next visit to the Intelligence tab (reload required). No need to handle live invalidation while the admin is on the tab.
- **Chart library:** Recharts `ScatterChart` (confirmed in planning notes).
- **t-SNE parameters:** `PCA(n_components=50)` then `TSNE(perplexity=30, max_iter=1000, init='pca', random_state=42, metric='cosine')` — locked.
- **Backend pattern:** t-SNE MUST run post-yield via `asyncio.create_task(_compute_tsne_background(app))`. NEVER above the yield in lifespan.
- **202 guard:** If `not app.state.tsne_ready`, return `JSONResponse({"status": "computing"}, 202)`.
- **Cache location:** `app.state.embedding_map` (result); `app.state.tsne_cache` already initialized as `[]` in main.py lifespan (line 221).
- **Invalidation:** `app.state.tsne_cache = []` on index swap — already wired in `admin.py _run_ingest_job` (line 154).
- **New dependencies:** `scikit-learn==1.8.0` and `scipy==1.15.1` added to `requirements.txt`.
- **API parameter name:** Use `max_iter` NOT `n_iter` — `n_iter` was removed in sklearn 1.7.

### Claude's Discretion
All visualization, UX, and layout decisions deferred to Claude:
- Chart container style (glass card vs. darker panel)
- Title and description copy
- Legend placement (below, right, top)
- Computing state appearance (spinner, skeleton, progress message)
- Polling strategy (auto-poll 202 or manual refresh)
- Failure handling
- Click behavior (hover-only or clickable to profile)
- Zoom/pan capability
- Legend interactivity (toggle visibility)
- Tooltip content (name only, name + category, name + category + job title)
- Chart height (fixed px vs. responsive)
- Position in Intelligence tab (below Phase 25 metrics, side-by-side, sub-section)
- Collapsibility
- Last-updated timestamp display

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-05 | Backend exposes `/api/admin/embedding-map` returning t-SNE 2D projection (scikit-learn, computed at startup from FAISS index, cached in `app.state`) | Backend endpoint pattern, lifespan background task, app.state caching, 202 guard |
| INTEL-06 | Admin displays interactive embedding scatter plot (points colored by category, expert name on hover) | Recharts ScatterChart with CustomTooltip, category color mapping, jewel-tone palette |
</phase_requirements>

---

## Summary

Phase 26 adds an embedding visualization to the admin Intelligence tab. The backend reads all 530 FAISS vectors, runs PCA(50) then t-SNE to project them into 2D, and serves the result via `/api/admin/embedding-map`. The frontend renders the points as a Recharts ScatterChart colored by expert category with expert-name tooltips on hover.

The single highest-risk element is the t-SNE computation timing relative to FastAPI's lifespan `yield`. Running PCA + t-SNE on 530 × 768-dimensional vectors takes 10–30 seconds. If that runs above the `yield`, Railway's healthcheck times out and the container restarts in a loop. The fix is `asyncio.create_task` called immediately after the `yield` so the server accepts requests first.

Recharts is NOT currently in `package.json`. It must be installed. The chart integration is straightforward given the existing admin data-fetching pattern (`adminFetch` hook, `useAdminData.ts`).

**Primary recommendation:** Add `_compute_tsne_background` coroutine in `main.py` called post-yield via `asyncio.create_task`; add GET `/api/admin/embedding-map` to `admin.py`; add Recharts `ScatterChart` to `IntelligenceDashboardPage.tsx` below the existing metrics cards.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| scikit-learn | 1.8.0 | PCA + t-SNE computation | Only ML library in this stack; sklearn's TSNE is the reference implementation |
| scipy | 1.15.1 | scikit-learn dependency (sparse matrix ops) | Required by sklearn; must pin explicitly for Railway reproducibility |
| recharts | 2.x (latest) | React scatter chart | Already chosen; React-native, composable, no canvas dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | 2.2.* (already pinned) | Array operations for FAISS vectors | Already in requirements.txt — no version change needed |
| faiss-cpu | 1.13.* (already pinned) | Source of the embedding vectors | `index.reconstruct_n(0, index.ntotal)` to extract all vectors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| t-SNE | UMAP | UMAP produces better layouts but `umap-learn` is a heavy Railway dep — explicitly deferred to v2.3 in REQUIREMENTS.md |
| Recharts | Plotly.js | Plotly has better built-in zoom/pan but is 3× larger bundle; Recharts is already the admin chart library (Phase 25) |
| PCA pre-reduction | Direct t-SNE on full 768-dim | PCA(50) then t-SNE is 4–8× faster and standard practice; direct t-SNE on 768-dim takes minutes |

**Installation (backend):**
```bash
# Add to requirements.txt — no pip install command needed (Railway auto-installs on deploy)
scikit-learn==1.8.0
scipy==1.15.1
```

**Installation (frontend):**
```bash
cd frontend && npm install recharts
```

---

## Architecture Patterns

### Backend: Background t-SNE Computation

The pattern uses `asyncio.create_task` to schedule CPU-bound work in a thread after the lifespan `yield`. The coroutine wraps `asyncio.to_thread` to avoid blocking the event loop during the 10–30 second sklearn computation.

```
lifespan(app):
    # ... all existing startup logic ...
    app.state.tsne_cache = []       # already in main.py line 221
    app.state.tsne_ready = False    # NEW: readiness flag
    app.state.embedding_map = []    # NEW: result cache
    yield                           # server accepts requests HERE
    asyncio.create_task(_compute_tsne_background(app))  # fires post-yield
```

### Backend: Endpoint Guard Pattern

```python
@router.get("/embedding-map")
def get_embedding_map(request: Request):
    if not getattr(request.app.state, "tsne_ready", False):
        return JSONResponse({"status": "computing"}, status_code=202)
    return {"status": "ready", "points": request.app.state.embedding_map}
```

### Backend: Vector Extraction from FAISS

```python
import faiss
import numpy as np

index = app.state.faiss_index          # already loaded in app.state
n = index.ntotal                        # number of indexed vectors
vectors = np.zeros((n, index.d), dtype=np.float32)
faiss.rev_swig_ptr(index.sa_decode(...))  # use index.reconstruct_n instead:
vectors = index.reconstruct_n(0, n)    # shape (530, 768)
```

Note: `reconstruct_n` works on flat FAISS indexes. The current index is `faiss-cpu` built by `scripts/ingest.py` — verify it is an IndexFlatL2 or IndexFlatIP (both support `reconstruct_n`). If it is an IVF index, `reconstruct_n` may not be available; use `index.sa_decode` with stored codes, or store vectors separately during ingest.

### Frontend: Polling Hook Pattern

The existing project uses interval polling in `useIngestStatus`. Apply the same pattern for the embedding map:

```typescript
// In useAdminData.ts — new hook
export function useEmbeddingMap() {
  const [data, setData] = useState<EmbeddingMapResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'computing' | 'ready' | 'error'>('loading')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(() => {
    adminFetch<EmbeddingMapResponse | ComputingResponse>('/embedding-map')
      .then(res => {
        if ('status' in res && res.status === 'computing') {
          setStatus('computing')
          // keep polling
        } else {
          setStatus('ready')
          setData(res as EmbeddingMapResponse)
          clearInterval(intervalRef.current!)
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => clearInterval(intervalRef.current!)
  }, [poll])

  return { data, status }
}
```

### Frontend: Recharts ScatterChart Pattern

Recharts `ScatterChart` renders data as `[{x, y, ...payload}]` arrays, one `<Scatter>` per series. Each category is a separate `<Scatter>` component with its own color and data subset.

```typescript
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts'

// Group points by category
const byCategory = useMemo(() => {
  const groups: Record<string, EmbeddingPoint[]> = {}
  for (const pt of data?.points ?? []) {
    const cat = pt.category ?? 'Unknown'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(pt)
  }
  return groups
}, [data])

// One <Scatter> per category
<ResponsiveContainer width="100%" height={500}>
  <ScatterChart>
    <XAxis dataKey="x" type="number" hide />
    <YAxis dataKey="y" type="number" hide />
    <Tooltip content={<CustomTooltip />} />
    <Legend />
    {Object.entries(byCategory).map(([cat, pts]) => (
      <Scatter key={cat} name={cat} data={pts} fill={CATEGORY_COLORS[cat] ?? '#888'} />
    ))}
  </ScatterChart>
</ResponsiveContainer>
```

### Recommended Project Structure (additions only)

```
app/
├── main.py                          # Add: _compute_tsne_background coroutine
│                                    # Add: app.state.tsne_ready, app.state.embedding_map
├── routers/
│   └── admin.py                     # Add: GET /embedding-map endpoint

frontend/src/admin/
├── hooks/
│   └── useAdminData.ts              # Add: useEmbeddingMap hook + EmbeddingMapResponse type
├── types.ts                         # Add: EmbeddingPoint, EmbeddingMapResponse interfaces
└── pages/
    └── IntelligenceDashboardPage.tsx # Add: EmbeddingMapChart section below existing cards
```

### Anti-Patterns to Avoid
- **t-SNE above yield:** Running `_compute_tsne_background` before `yield` blocks Railway healthcheck → infinite restart loop. NEVER do this.
- **Blocking the event loop:** Calling `TSNE().fit_transform()` directly in an async function without `asyncio.to_thread` blocks all requests for 10–30 seconds.
- **Using `n_iter` parameter:** Removed in scikit-learn 1.7. Use `max_iter` exclusively.
- **Returning all 768-dim vectors to frontend:** Return only `[{x, y, name, category}]` — never the raw embeddings.
- **Setting `app.state.tsne_ready = True` before `fit_transform` completes:** Set it only after the result is stored in `app.state.embedding_map`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2D projection of high-dim embeddings | Custom PCA or MDS | `sklearn.decomposition.PCA` + `sklearn.manifold.TSNE` | Numerical stability, perplexity handling, convergence — all non-trivial |
| Scatter chart with tooltips | SVG/Canvas manually | `recharts.ScatterChart` | Tooltip positioning, responsive container, legend wiring already solved |
| Color assignment per category | Manual color cycle | Predefined `CATEGORY_COLORS` map (jewel tones) | Consistent colors across renders; no dynamic allocation needed |

**Key insight:** t-SNE has several gotchas (cosine metric requires normalized inputs, PCA initialization prevents random restarts affecting cluster shapes, perplexity must be < n_samples). The sklearn defaults cover all of these when parameters are set correctly.

---

## Common Pitfalls

### Pitfall 1: Railway Healthcheck Timeout (CRITICAL)
**What goes wrong:** t-SNE computation (10–30s) runs synchronously during lifespan startup, before `yield`. Railway considers the container unhealthy, kills it, restarts, repeating infinitely.
**Why it happens:** `asyncio.create_task` must be called after `yield`; any blocking code before `yield` delays the server from accepting connections.
**How to avoid:** Always call `asyncio.create_task(_compute_tsne_background(app))` in the first line after `yield` in the lifespan context manager.
**Warning signs:** Railway logs show repeated "healthcheck failed" + immediate restart; container never reaches "running" state.

### Pitfall 2: `n_iter` vs `max_iter` (sklearn 1.7+ breaking change)
**What goes wrong:** `TSNE(n_iter=1000)` raises `TypeError: __init__() got an unexpected keyword argument 'n_iter'` in scikit-learn 1.7+.
**Why it happens:** sklearn renamed the parameter in 1.7 and removed the old name entirely.
**How to avoid:** Always use `max_iter=1000`. The pinned version is 1.8.0 so this is mandatory.
**Warning signs:** ImportError or TypeError at startup during t-SNE computation.

### Pitfall 3: FAISS Index Type and `reconstruct_n`
**What goes wrong:** `reconstruct_n` is not available on all FAISS index types. Calling it on an IVF index raises a FAISS error.
**Why it happens:** Only flat indexes store raw vectors; IVF indexes store compressed codes.
**How to avoid:** Check the index type in `scripts/ingest.py`. If it is `IndexFlatL2` or `IndexFlatIP`, `reconstruct_n` works. If it uses IVF, store a separate numpy array of raw vectors during ingest, or use `index.sa_decode` with stored codes.
**Warning signs:** FAISS C++ exception at background task startup; t-SNE task silently fails.

### Pitfall 4: `tsne_ready` Flag Race Condition
**What goes wrong:** Frontend fetches embedding-map while background task is still running; gets a stale empty result instead of 202.
**Why it happens:** If `tsne_ready` is set to `True` before `embedding_map` is populated, a request arriving between those two lines gets an empty list.
**How to avoid:** Set `app.state.embedding_map = result` first, then `app.state.tsne_ready = True`. These assignments are GIL-protected in CPython — not a true race condition — but ordering matters for logical correctness.
**Warning signs:** Frontend shows empty scatter plot immediately without polling.

### Pitfall 5: Recharts Not Installed
**What goes wrong:** `import { ScatterChart } from 'recharts'` fails at build time.
**Why it happens:** `recharts` is NOT in the current `package.json` (confirmed by inspection). The project has not used it before.
**How to avoid:** `cd frontend && npm install recharts` before writing the component.
**Warning signs:** `Module not found: Error: Can't resolve 'recharts'` during `vite build`.

### Pitfall 6: Cosine Metric Requires Normalized Vectors
**What goes wrong:** t-SNE with `metric='cosine'` on un-normalized vectors produces inconsistent results because cosine distance on unit vectors equals L2 distance / 2.
**Why it happens:** FAISS embeddings from the Gemini embedder may or may not be unit-normalized depending on the model.
**How to avoid:** Normalize vectors before t-SNE: `vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)`. This is safe even if already normalized (no-op for unit vectors).
**Warning signs:** Clusters appear collapsed or non-separated in the scatter plot.

---

## Code Examples

### Backend: `_compute_tsne_background` coroutine

```python
# In main.py — add after existing imports
import asyncio
import numpy as np

async def _compute_tsne_background(app: FastAPI) -> None:
    """
    Compute t-SNE projection of FAISS embeddings in a background thread.
    Called via asyncio.create_task after lifespan yield.
    Sets app.state.tsne_ready = True on completion.
    """
    try:
        import structlog as _log
        log = _log.get_logger()
        log.info("tsne.background_task_started")

        index = app.state.faiss_index
        metadata = app.state.metadata
        n = index.ntotal

        if n == 0:
            log.warning("tsne.no_vectors")
            app.state.embedding_map = []
            app.state.tsne_ready = True
            return

        def _run() -> list[dict]:
            from sklearn.decomposition import PCA
            from sklearn.manifold import TSNE

            # Extract raw vectors from FAISS
            vectors = np.zeros((n, index.d), dtype=np.float32)
            for i in range(n):
                vectors[i] = index.reconstruct(i)

            # Normalize for cosine metric
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            vectors = vectors / norms

            # PCA pre-reduction (mandatory — cuts compute 4-8x)
            n_components = min(50, n - 1, vectors.shape[1])
            pca = PCA(n_components=n_components)
            reduced = pca.fit_transform(vectors)

            # t-SNE projection
            perplexity = min(30, n - 1)
            tsne = TSNE(
                perplexity=perplexity,
                max_iter=1000,
                init='pca',
                random_state=42,
                metric='cosine',
            )
            coords = tsne.fit_transform(reduced)  # shape (n, 2)

            # Build result list aligned with metadata
            points = []
            for i, row in enumerate(metadata):
                points.append({
                    "x": float(coords[i, 0]),
                    "y": float(coords[i, 1]),
                    "name": f"{row.get('First Name', '')} {row.get('Last Name', '')}".strip(),
                    "category": row.get("category") or "Unknown",
                    "username": row.get("Username", ""),
                })
            return points

        result = await asyncio.to_thread(_run)
        app.state.embedding_map = result
        app.state.tsne_ready = True
        import structlog as _sl
        _sl.get_logger().info("tsne.complete", points=len(result))

    except Exception as exc:
        import structlog as _sl
        _sl.get_logger().error("tsne.failed", error=str(exc))
        app.state.embedding_map = []
        app.state.tsne_ready = True  # Mark ready even on failure so 202 stops being returned
```

### Backend: Lifespan integration (post-yield)

```python
# In main.py lifespan — existing yield is at line 238
    yield
    # ADD IMMEDIATELY AFTER YIELD:
    asyncio.create_task(_compute_tsne_background(app))
```

Also add these two lines before `yield` (alongside `tsne_cache` which is already there):
```python
    app.state.tsne_ready = False
    app.state.embedding_map = []
```

### Backend: Admin endpoint

```python
# In admin.py — add to router (requires X-Admin-Key)
from fastapi.responses import JSONResponse

@router.get("/embedding-map")
def get_embedding_map(request: Request):
    """
    Return t-SNE 2D projection of all expert embeddings.
    Returns HTTP 202 while computation is in progress (up to 30s after startup).
    Returns HTTP 200 with points list when ready.
    """
    if not getattr(request.app.state, "tsne_ready", False):
        return JSONResponse({"status": "computing"}, status_code=202)
    return {
        "status": "ready",
        "points": request.app.state.embedding_map,
        "count": len(request.app.state.embedding_map),
    }
```

### Frontend: TypeScript types

```typescript
// Add to frontend/src/admin/types.ts

export interface EmbeddingPoint {
  x: number
  y: number
  name: string        // "First Last"
  category: string    // expert category or "Unknown"
  username: string
}

export interface EmbeddingMapResponse {
  status: 'ready'
  points: EmbeddingPoint[]
  count: number
}

export interface EmbeddingMapComputing {
  status: 'computing'
}
```

### Frontend: Jewel-tone category palette

```typescript
// Aurora-adjacent jewel tones — complement the v2.2 purple/teal/green/pink aurora
const CATEGORY_COLORS: Record<string, string> = {
  'Tech':         '#a855f7',   // vivid purple
  'Finance':      '#06b6d4',   // cyan-teal
  'Marketing':    '#10b981',   // emerald green
  'Sales':        '#f472b6',   // hot pink
  'Strategy':     '#818cf8',   // indigo-purple
  'HR':           '#34d399',   // mint green
  'Operations':   '#2dd4bf',   // teal
  'Legal':        '#c084fc',   // lavender purple
  'Healthcare':   '#38bdf8',   // sky blue
  'Real Estate':  '#fb7185',   // rose pink
  'Sports':       '#a3e635',   // lime green (accent)
  'Unknown':      '#475569',   // slate (neutral)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `TSNE(n_iter=1000)` | `TSNE(max_iter=1000)` | sklearn 1.7 (2024) | `n_iter` removed entirely — TypeErrors in production |
| Direct t-SNE on raw 768-dim | `PCA(50)` then `TSNE` | Standard practice | 4–8× faster with equivalent cluster quality |
| `@app.on_event("startup")` | `@asynccontextmanager async def lifespan` | FastAPI 0.90+ | `on_event` deprecated; lifespan is the current pattern (already used in this codebase) |

**Deprecated/outdated:**
- `TSNE(n_iter=...)`: Use `max_iter` in sklearn 1.7+
- `@app.on_event("startup")`: Already using lifespan pattern correctly in this project

---

## Open Questions

1. **FAISS index type compatibility with `reconstruct_n`**
   - What we know: The current index is built by `scripts/ingest.py` using `faiss-cpu`. The index file is `data/faiss.index`.
   - What's unclear: Whether it is IndexFlatL2/IndexFlatIP (supports `reconstruct_n`) or an IVF index (may not).
   - Recommendation: Check `type(app.state.faiss_index).__name__` in the background task. If it is not `IndexFlatL2` or `IndexFlat`, use a per-index loop with `index.reconstruct(i)` (works on all flat indexes) or store raw vectors separately.
   - **Safe fallback:** Use `index.reconstruct(i)` in a loop (works on all FAISS flat index types, slightly slower than batch `reconstruct_n` but acceptable for 530 vectors).

2. **Category field availability in metadata.json**
   - What we know: `metadata.json` has 530 experts; the `category` field is added dynamically (lowercase key per MEMORY.md). Categories are set by `_auto_categorize` at startup.
   - What's unclear: What fraction of experts will have `None` category after auto-classification.
   - Recommendation: Default to `"Unknown"` category in the t-SNE result builder when `category` is `None` or missing.

3. **Recharts version compatibility with React 19**
   - What we know: The project runs React 19.2.0. Recharts 2.x targets React 16-18; Recharts 2.13+ supports React 18.
   - What's unclear: Whether Recharts 2.x works correctly with React 19's new concurrent renderer.
   - Recommendation: Install `recharts@latest` (currently 2.x). If peer dep warnings appear for React 19, add `--legacy-peer-deps`. The library uses DOM refs and SVG — no known React 19 incompatibilities in the Recharts 2.x codebase.

---

## Sources

### Primary (HIGH confidence)
- Project codebase: `app/main.py` — lifespan pattern, `app.state` initialization, exact line where `tsne_cache = []` is set (line 221)
- Project codebase: `app/routers/admin.py` — endpoint patterns, `_run_ingest_job` invalidation (line 154), `_require_admin` dep, `JSONResponse` import patterns
- Project codebase: `frontend/src/admin/hooks/useAdminData.ts` — polling pattern from `useIngestStatus`, `adminFetch` signature
- Project codebase: `frontend/src/admin/types.ts` — existing TypeScript interface patterns
- Project codebase: `frontend/src/main.tsx` — router pattern; `/admin/intelligence` route already exists
- Project codebase: `frontend/package.json` — confirmed recharts is NOT installed (must be added)
- Project codebase: `.planning/STATE.md` — Phase 26 constraints verbatim

### Secondary (MEDIUM confidence)
- scikit-learn changelog (verified via knowledge): `n_iter` → `max_iter` rename in 1.7, removal in 1.7 final
- FAISS documentation (knowledge): `IndexFlat.reconstruct_n(start, end)` for vector extraction

### Tertiary (LOW confidence)
- Recharts + React 19 compatibility: Not explicitly verified against React 19 release notes; based on Recharts using stable DOM/SVG APIs

---

## Metadata

**Confidence breakdown:**
- Backend t-SNE pattern: HIGH — locked in planning notes + STATE.md constraints, codebase verified
- scikit-learn API (`max_iter`): HIGH — breaking change well-documented in sklearn 1.7 changelog
- FAISS vector extraction: MEDIUM — `reconstruct_n`/`reconstruct` semantics verified from knowledge; index type unknown until runtime
- Recharts ScatterChart API: HIGH — stable API, widely documented
- React 19 + Recharts compatibility: LOW — not explicitly tested

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (scikit-learn and Recharts APIs are stable; 30-day validity)
