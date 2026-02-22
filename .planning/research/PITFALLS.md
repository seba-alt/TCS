# Pitfalls Research

**Domain:** Expert Marketplace — v2.2 Evolved Discovery Engine (adding features to existing React 19 + FastAPI 0.129 system)
**Researched:** 2026-02-22
**Confidence:** HIGH for FAISS thread safety, Zustand persist, backdrop-filter stacking context (all verified against official docs and GitHub issues); MEDIUM for Framer Motion proximity scale and VirtuosoGrid animation (community issue trackers + official Motion docs)

---

## Critical Pitfalls

### Pitfall 1: `overflow: hidden` on Existing Layout Ancestor Silently Kills `backdrop-filter` Blur

**What goes wrong:**
Adding `backdrop-blur-md` (or any `backdrop-filter`) to FilterSidebar (VIS-02), SearchInput (VIS-03), or SagePanel (VIS-04) renders as a transparent rectangle — no glass effect, no blur. This fails silently: the Tailwind class is applied, DevTools shows the property is active, but the visual result is identical to having no blur at all. The failure is consistent across Chrome, Firefox, and Safari. The root cause is an ancestor element in the existing layout that has `overflow: hidden`, `overflow: auto`, or `overflow: scroll` — which creates a new CSS stacking context and clips the backdrop to that ancestor's own background (typically a solid `bg-gray-50` or similar), not the aurora gradient behind it.

**Why it happens:**
`backdrop-filter` blurs everything visually painted *behind* the element within the same stacking context. The properties `overflow: hidden/auto/scroll`, `transform`, `will-change: transform`, `filter`, `clip-path`, and `isolation: isolate` all force a new stacking context. The existing marketplace layout uses `overflow: hidden` or flex containers with clipping behavior on the sidebar column and the VirtuosoGrid wrapper (`flex-1 min-h-0`). A glassed child inside any of these is sandboxed — it blurs only the parent's own background, not the aurora gradient behind it.

**How to avoid:**
1. Before writing any glass styles, trace the full ancestor chain from the target element up to `<body>` in DevTools and note every element that creates a stacking context. Flag `overflow`, `transform`, `filter`, `will-change`, `clip-path`, and `isolation` properties.
2. If an `overflow: hidden` ancestor cannot be removed (e.g., the VirtuosoGrid's height-constraining flex container), escape the stacking context by rendering the blurred background via a `::before` pseudo-element at a higher DOM level, or by using a Tailwind `before:` variant:

```tsx
// Escape the overflow: hidden ancestor via before: pseudo-element
// The ::before sits outside the clipping boundary at z-index: -1
<div className="relative before:absolute before:inset-0 before:-z-10
                before:backdrop-blur-md before:bg-white/8 before:rounded-2xl
                before:border before:border-white/15">
  {/* sidebar content renders on top of the pseudo-element backdrop */}
</div>
```

3. Always include `-webkit-backdrop-filter` alongside `backdrop-filter` for Safari. Tailwind's `backdrop-blur-*` utilities generate only the unprefixed property in Tailwind v3 — add the prefixed version in the Tailwind plugin or via a `@layer utilities` rule.

**Warning signs:**
- Glass surface renders as opaque or fully transparent; no blur visible despite the Tailwind class being present in DevTools.
- The effect works correctly in an isolated CodeSandbox/Storybook demo but not inside the actual marketplace layout.
- Blur only appears when the element is moved to the top of the DOM tree (outside the layout containers) — this confirms a stacking context problem, not a browser support problem.
- The aurora gradient is not visible through the sidebar at all, even faintly.

**Phase to address:** Phase 22 (VIS-02, VIS-03, VIS-04) — before writing any glass utility class, open DevTools and trace the ancestor chain. Document every stacking context source. Add this as step 1 of Phase 22's acceptance criteria.

---

### Pitfall 2: Nested Glass Surfaces Double-Blur — SagePanel Over Blurred Background Washes Out to White

**What goes wrong:**
SagePanel (VIS-04) overlaps the FilterSidebar (VIS-02) or the main content area which already has a glass/blur layer applied. If SagePanel applies its own `backdrop-filter`, it blurs the *already-blurred* composited layer beneath it instead of the aurora gradient. With pastel aurora colors (low inherent contrast), double-blur rapidly washes out to near-white. Text inside SagePanel falls below the required 4.5:1 contrast ratio (VIS-05) and the panel appears broken — the aurora colors are invisible through the panel.

**Why it happens:**
`backdrop-filter` applies to whatever is visually behind the element at the time the browser composites the stacking contexts. If a parent or sibling already has `backdrop-filter` applied, the child's blur operates on the already-composited blur result, not the original aurora gradient. The effect compounds multiplicatively.

**How to avoid:**
Apply glass surfaces at the same stacking level, not nested. The SagePanel slides over the main content via absolute/fixed positioning — give it a slightly different glass recipe (higher opacity, slightly different blur) rather than nesting it inside the sidebar's stacking context. Test contrast directly over the aurora gradient using a contrast analyzer, not over white. A white `bg-white/15` over the aurora may meet 4.5:1 but `bg-white/5` will not — measure the actual rendered colors.

**Warning signs:**
- SagePanel appears white or milky-white when the aurora gradient is active but correct on a white/gray background.
- Contrast checker passes when testing the panel in isolation but fails when tested over the actual deployed aurora gradient.
- The panel's apparent background changes depending on which sidebar is visible — indicates the panel is blurring an intermediate layer, not the aurora.

**Phase to address:** Phase 22 (VIS-04, VIS-05) — add an explicit contrast audit checklist item: test each glass surface over the aurora gradient at the actual deployed opacity.

---

### Pitfall 3: Tag Cloud Proximity Scale Uses `useState` per Mouse Move — 60 Re-renders/sec on 40+ Items

**What goes wrong:**
The proximity-based scale effect (DISC-02) is implemented by tracking mouse X/Y in React state (`useState`) and computing each tag's distance to the cursor inside the render function. With 40+ domain tags (the current tag set has 40+ entries in `constants/tags.ts`), every `mousemove` event fires `setState`, which schedules a React re-render, which forces distance calculations for all 40+ tag items per frame. At 60 mouse events per second × 40+ renders per event, the React DevTools Profiler shows constant orange-highlighted re-renders across the entire tag cloud parent. On mid-range mobile hardware this produces visible jank; on desktop it causes the Sage panel and VirtuosoGrid (which are simultaneously mounted) to also stutter because they share the same React render budget.

**Why it happens:**
`useState` + `onMouseMove` is the natural first implementation. It works correctly in isolation (a standalone tag cloud demo with nothing else on the page). The problem emerges only when the tag cloud is embedded in the marketplace page alongside VirtuosoGrid, which has its own scroll listeners and layout computations running simultaneously. The React re-render cascade hits everything mounted in the same tree.

**How to avoid:**
Use `useMotionValue` and `useTransform` from Framer Motion exclusively. MotionValues bypass React's render cycle entirely — they communicate directly with the Motion renderer on each animation frame without calling `setState`:

```tsx
// Parent cloud container — captures mouse position as MotionValues, zero React re-renders
const containerRef = useRef<HTMLDivElement>(null)
const mouseX = useMotionValue(0)
const mouseY = useMotionValue(0)

function handleMouseMove(e: React.MouseEvent) {
  // .set() does NOT trigger a React re-render
  mouseX.set(e.clientX)
  mouseY.set(e.clientY)
}

// Per-tag component — scale derived from distance, also zero React re-renders
function TagItem({ tag, centerX, centerY }: TagItemProps) {
  const scale = useTransform(
    [mouseX, mouseY],
    ([mx, my]) => {
      const dx = mx - centerX
      const dy = my - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      return Math.max(1.0, 1.45 - dist / 100)
    }
  )
  // style={{ scale }} reads the MotionValue directly — no React state involved
  return <motion.button style={{ scale }}>{tag}</motion.button>
}
```

Do NOT add a `useSpring` wrapper per tag — a spring per item with 40 simultaneous items creates animation frame budget pressure and produces a spongy, overly-reactive feel. Use a CSS `transition: transform 80ms ease-out` on the `motion.button` instead of a per-item spring, so the spring cost is zero.

**Warning signs:**
- React DevTools Profiler shows the tag cloud parent component highlighted in orange/red continuously during mouse movement.
- Chrome Performance panel shows `[Violation] 'mousemove' handler took >50ms`.
- The tag cloud feels smooth in a minimal demo but stutters when embedded in the full marketplace page.
- React re-render count in DevTools Profiler exceeds 10 renders/second while the mouse is moving over the tag cloud.

**Phase to address:** Phase 23 (DISC-02) — the phase spec must mandate `useMotionValue` + `useTransform`. Prohibit `useState` for any value that changes on `mousemove`.

---

### Pitfall 4: t-SNE `fit_transform` in FastAPI Lifespan Above `yield` Blocks Railway Healthcheck — Deploy Fails

**What goes wrong:**
`sklearn.manifold.TSNE.fit_transform()` on 530 vectors × 768 dimensions is a CPU-bound synchronous operation taking 8–30 seconds (depending on `n_iter` and `method`). If called inside the existing `lifespan()` async context manager *above* the `yield` statement (following the same pattern used for `faiss.read_index()`), it blocks the entire asyncio event loop for its full duration. Railway's healthcheck endpoint (`/health`) is a GET request that the event loop cannot service while the t-SNE computation holds the GIL. Railway marks the deploy as unhealthy and triggers a restart — producing an infinite restart loop on every deploy. The app never serves any requests.

**Why it happens:**
The existing lifespan pattern (`faiss.read_index()` above `yield`) is safe because it takes ~10ms. Developers follow the same pattern for t-SNE assuming compute time is comparable. `asyncio.to_thread` does *not* help when called inside `lifespan()` above `yield` — `await asyncio.to_thread(tsne.fit_transform, vectors)` moves the work to a thread, but the lifespan coroutine is still suspended waiting for it to complete, which means the `yield` is never reached and the server never starts accepting connections.

**How to avoid:**
Run t-SNE as a background task that starts *after* the `yield` — the server starts, healthcheck passes immediately, and t-SNE computes in the background:

```python
import asyncio
from sklearn.manifold import TSNE
import numpy as np

async def _compute_tsne_background(app_ref):
    """Compute t-SNE in background after startup. Does not block healthcheck."""
    app_ref.state.tsne_ready = False
    app_ref.state.tsne_points = None
    try:
        # Extract vectors from the already-loaded FAISS index
        n = app_ref.state.faiss_index.ntotal
        dim = app_ref.state.faiss_index.d
        vectors = np.zeros((n, dim), dtype=np.float32)
        app_ref.state.faiss_index.reconstruct_n(0, n, vectors)

        # PCA pre-reduction to 50 dims before TSNE — reduces memory and compute time
        from sklearn.decomposition import PCA
        vectors_50d = await asyncio.to_thread(
            PCA(n_components=50).fit_transform, vectors
        )
        # n_iter=300 is sufficient for 530 points; default 1000 is overkill
        points = await asyncio.to_thread(
            TSNE(n_components=2, perplexity=30, n_iter=300,
                 method='barnes_hut', random_state=42).fit_transform,
            vectors_50d
        )
        app_ref.state.tsne_points = points.tolist()
        app_ref.state.tsne_ready = True
        log.info("tsne: computation complete", n_points=n)
    except Exception as e:
        log.error("tsne: computation failed", error=str(e))
        app_ref.state.tsne_ready = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... existing FAISS, DB, metadata startup (fast — stays above yield) ...
    app.state.tsne_ready = False
    app.state.tsne_points = None
    yield  # Server starts here — healthcheck passes immediately
    # Background t-SNE runs AFTER yield — non-blocking
    asyncio.create_task(_compute_tsne_background(app))
```

The `/api/admin/embedding-map` endpoint must guard with `if not app.state.tsne_ready: return JSONResponse({"status": "computing"}, 202)`.

**Warning signs:**
- Railway deploy logs show uvicorn startup lines but the `/health` endpoint never responds before Railway's timeout (typically 60s).
- Railway marks deploy as failed; redeploys immediately; same failure repeats.
- Local dev works (no Railway healthcheck; process starts fine) but every Railway deploy fails.
- t-SNE code is inside `lifespan()` above the `yield` line.
- `await asyncio.to_thread(tsne.fit_transform, ...)` is called above `yield` (this still blocks the `yield` from being reached).

**Phase to address:** Phase 26 (INTEL-05) — the t-SNE computation pattern must be specified as a post-yield background task in the phase spec before any code is written. The phase acceptance criteria must include a successful Railway deploy with `/health` responding in under 5 seconds.

---

### Pitfall 5: FAISS In-Place Index Mutation During Rebuild — Race Condition Against Concurrent Search Requests

**What goes wrong:**
The admin-triggered index rebuild (IDX-02) mutates `app.state.faiss_index` in-place by calling `app.state.faiss_index.reset()` followed by re-adding vectors, or by re-assigning `app.state.faiss_index` to a partially-built object mid-construction. Concurrent search requests from the explore endpoint read `app.state.faiss_index` during this window and encounter either: (a) an empty index (after `reset()` but before re-add completes), returning zero results for all queries; or (b) a partially-built index with fewer vectors than expected, producing biased search results. FAISS CPU indices are thread-safe for concurrent reads but explicitly not thread-safe for concurrent read + modify operations.

**Why it happens:**
Python's GIL makes simple attribute assignment (`app.state.faiss_index = new_obj`) effectively atomic at the bytecode level (a single `STORE_ATTR` instruction). Developers assume this means the swap is safe. The race is not in the assignment — the race is in the *construction* of the new index when using the naive pattern of modifying the existing object in-place. If the rebuild calls methods on `app.state.faiss_index` (`.reset()`, `.add()`) rather than building a separate object, those method calls are not atomic. Concurrent `faiss_index.search()` calls from other threads (FastAPI sync endpoints run in a threadpool) interleave with the `.reset()` and `.add()` calls.

**How to avoid:**
Build the new index into a completely separate in-memory object, then perform a single reference swap. Never mutate `app.state.faiss_index` directly:

```python
import asyncio
from datetime import datetime

# Module-level lock prevents concurrent rebuild attempts (admin double-click)
_rebuild_lock = asyncio.Lock()

async def rebuild_faiss_index(app) -> dict:
    """
    Rebuild FAISS index atomically. Old index serves all requests until swap.
    Returns status dict for admin response.
    """
    if _rebuild_lock.locked():
        return {"status": "already_running"}

    async with _rebuild_lock:
        app.state.rebuild_status = "running"
        try:
            # _build_new_index is a pure function — creates and returns a NEW object.
            # It never touches app.state.faiss_index.
            new_index, new_metadata = await asyncio.to_thread(_build_new_index_from_db)

            # Single reference swap — GIL ensures this is atomic at the bytecode level.
            # Old index remains untouched until this line; all searches before this line
            # read the old (valid) index.
            app.state.faiss_index = new_index
            app.state.metadata = new_metadata
            app.state.rebuild_status = "complete"
            app.state.index_rebuilt_at = datetime.utcnow().isoformat()
            return {"status": "complete", "vectors": new_index.ntotal}
        except Exception as e:
            app.state.rebuild_status = "failed"
            log.error("faiss: rebuild failed", error=str(e))
            raise

def _build_new_index_from_db() -> tuple[faiss.IndexFlatIP, list[dict]]:
    """
    Pure function — builds and returns a NEW faiss.IndexFlatIP.
    Must never read or write app.state.faiss_index.
    """
    index = faiss.IndexFlatIP(768)  # New object — old index untouched
    # ... embed and add vectors ...
    return index, new_metadata
```

**Warning signs:**
- Search results return zero results or wrong experts during or immediately after a rebuild.
- The rebuild function calls `app.state.faiss_index.reset()` anywhere in its code path.
- The rebuild assigns `app.state.faiss_index` to a new object before that object's `.add()` calls are complete (the assignment is inside the loop, not after).
- No `asyncio.Lock` or equivalent guard on the rebuild trigger endpoint — two simultaneous rebuild requests can both run, consuming double the Railway memory.

**Phase to address:** Phase 24 (IDX-02, IDX-03) — "build new object, then swap reference" must be a non-negotiable constraint in the phase spec. The acceptance criteria must include: trigger rebuild, send concurrent search requests, confirm zero search failures.

---

### Pitfall 6: `motion.div` with `initial` Prop on ExpertCard Causes Scroll-Triggered Re-animations in VirtuosoGrid

**What goes wrong:**
The bento card redesign (CARD-01 through CARD-03) adds Framer Motion to `ExpertCard` with enter animations (`initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`). Every time the user scrolls down and back up, cards that re-enter the VirtuosoGrid viewport are unmounted and remounted by the virtualizer. Each remount triggers Framer Motion's `initial` state, causing cards to fade in and slide up again on every scroll-up pass. With 530 expert cards, a user who scrolls through the list experiences constant animation — the grid feels broken rather than polished. This is an inherent consequence of virtualization: DOM nodes are recycled, and Framer Motion interprets each remount as a new enter animation.

The existing decision from Phase 17 (CSS hover animations for ExpertCard; Framer Motion only for modals and FAB) is correct and must be maintained for the bento redesign.

**Why it happens:**
VirtuosoGrid unmounts cards that scroll outside the `overscan` boundary (currently `overscan={200}` — 200px above/below the viewport). Framer Motion has no awareness that a remounted card was previously visible — it sees a fresh mount and runs the `initial → animate` transition. `computeItemKey` using `expert.username` helps React reuse component *instances* for data identity but does not prevent VirtuosoGrid from unmounting and remounting the *DOM node* when it leaves the overscan window.

**How to avoid:**
Preserve the existing pattern: ExpertCard uses CSS-only hover animations. For the aurora-adapted hover glow (CARD-03), extend the `.expert-card` CSS class with new OKLCH-based `box-shadow` values — do not switch to `whileHover` Framer Motion props:

```css
/* tailwind.config.js plugin or index.css @layer components */
.expert-card {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.expert-card:hover {
  transform: translateY(-3px);
  /* Aurora-adapted glow — OKLCH purple-violet matching the aurora palette */
  box-shadow: 0 0 24px oklch(65% 0.22 300 / 0.40), 0 4px 16px oklch(65% 0.22 300 / 0.15);
}
```

For FUN-01 (barrel roll on playful queries, Phase 27): the barrel roll animation must be applied *outside* the VirtuosoGrid, not on individual cards. Gate the animation behind a Zustand state flag (`isBarrelRolling`), apply a CSS keyframe animation class to the VirtuosoGrid container element, then reset the flag after the animation completes via a `setTimeout`.

**Warning signs:**
- `motion.div` with `initial` prop appears inside the `ExpertCard` component file.
- Cards visibly fade in or translate upward whenever the user scrolls up through a previously-seen section of the list.
- Framer Motion is imported inside `ExpertCard.tsx` (the component rendered by `itemContent`).
- `whileHover` is used on the card container instead of CSS `transition`.

**Phase to address:** Phase 23 (CARD-01, CARD-02, CARD-03) — the phase spec must include: "ExpertCard uses CSS hover only. No Framer Motion `initial`, `animate`, `whileHover` on the card container. Framer Motion import is not added to ExpertCard.tsx."

---

### Pitfall 7: Zustand Newsletter Slice Storage Key Collision Silently Overwrites `explorer-filters` Store

**What goes wrong:**
Adding the newsletter subscription slice (NLTR-03) as a second `persist()` store using the same `name: 'explorer-filters'` key (by copy-paste from the existing store) causes silent state corruption. Zustand's `persist` middleware uses the `name` string as the localStorage key. Two stores sharing the same key write their state to the same JSON blob. On hydration, whichever store loads last performs a shallow merge — the newsletter state (`{ subscribed: false, email: '' }`) overwrites the filter state fields (`query`, `tags`, `rateMin`, `rateMax`, `sortBy`), wiping the user's saved filter preferences on every page load. No error is thrown; users simply lose their saved filters silently.

**Why it happens:**
Copy-pasting the store boilerplate from `store/index.ts` brings the `name: 'explorer-filters'` value along. Developers change the store's contents but forget to change the `name`. The conflict is completely invisible in development unless localStorage state is manually inspected in DevTools. The symptom (filter preferences not persisting) appears after the newsletter feature ships to production and is difficult to trace back to a key collision.

**How to avoid:**
Use a distinct, version-namespaced key for every persisted store. If newsletter state is a separate `create()` store (recommended for clarity and isolation from filter state):

```ts
// store/newsletterStore.ts
export const useNewsletterStore = create<NewsletterStore>()(
  persist(
    (set) => ({
      subscribed: false,
      email: '',
      setSubscribed: (email: string) => set({ subscribed: true, email }),
      reset: () => set({ subscribed: false, email: '' }),
    }),
    {
      name: 'tinrate-newsletter-v1', // Unique key — never conflicts with 'explorer-filters'
      version: 1,
      // Persist only the subscription status — not actions
      partialize: (state) => ({
        subscribed: state.subscribed,
        email: state.email,
      }),
    }
  )
)
```

If newsletter state is added as a fourth slice inside the existing `useExplorerStore`, extend the `partialize` function to include the newsletter fields and do *not* create a second `persist()` wrapper. Two `persist()` middlewares on a single `create()` call produce undefined behavior.

**Warning signs:**
- Users' saved filter tags reset to empty on every page load after the newsletter feature ships.
- localStorage DevTools show `explorer-filters` key containing newsletter fields alongside filter fields.
- `version` mismatch between what's in localStorage and what the store expects (indicates the blob was written by a different store).
- The `explorer-filters` localStorage value is larger than expected after newsletter ships.

**Phase to address:** Phase 27 (NLTR-03) — the phase spec must name the storage key explicitly as `'tinrate-newsletter-v1'` before any code is written. Include a localStorage key audit step in the acceptance criteria.

---

### Pitfall 8: Newsletter Gate Flashes Locked State for Returning Subscribers Due to Async Zustand Hydration

**What goes wrong:**
A returning newsletter subscriber loads the page. For one render frame (or occasionally several frames on slow devices), Zustand `persist` hydrates asynchronously — the store initializes with `subscribed: false` (the default), renders the "Subscribe to unlock" gate, then hydrates `subscribed: true` from localStorage and hides the gate. On fast devices this is a barely-visible flash. On slow mobile devices or on slow 3G connections, this can be a full-second flash of the locked state, which may trigger the gate modal to open and close visibly. The existing email gate (`useEmailGate.ts`) avoids this with a synchronous `localStorage` read in the `useState` initializer — the newsletter store must use the same approach.

**Why it happens:**
Zustand `persist` hydration is asynchronous in React 18/19 — the store subscribes to `useSyncExternalStore` which schedules hydration as a separate task after the initial render. The first render always uses the store's default values. This is by design (to avoid SSR hydration mismatches) but causes a visible flash in client-only SPAs where the default state is more restrictive than the persisted state.

**How to avoid:**
Read subscription status synchronously in the initial state, matching the existing `useEmailGate.ts` pattern. Do not rely on Zustand hydration for rendering the gate UI:

```ts
// Option 1 — synchronous localStorage read in initial state (matches useEmailGate pattern)
const _readStoredSubscription = () => {
  if (typeof window === 'undefined') return { subscribed: false, email: '' }
  try {
    const raw = localStorage.getItem('tinrate-newsletter-v1')
    if (!raw) return { subscribed: false, email: '' }
    const parsed = JSON.parse(raw)
    return {
      subscribed: Boolean(parsed?.state?.subscribed),
      email: String(parsed?.state?.email || ''),
    }
  } catch {
    return { subscribed: false, email: '' }
  }
}

const useNewsletterStore = create<NewsletterStore>()(
  persist(
    (set) => ({
      ..._readStoredSubscription(), // Synchronous initial read — no flash
      setSubscribed: (email) => set({ subscribed: true, email }),
    }),
    { name: 'tinrate-newsletter-v1', version: 1 }
  )
)
```

Do NOT use `onRehydrateStorage` with a `set()` call inside the callback — Zustand issue #1527 documents that calling store setter functions inside `onRehydrateStorage` does not update the store state. Use `onFinishHydration()` with a separate `hasHydrated` flag if gating an entire UI section, but prefer the synchronous read approach for a simple subscribed/unsubscribed toggle.

**Warning signs:**
- Newsletter gate briefly appears and immediately hides for returning subscribers on page load.
- The flash only occurs on the first cold page load, not on client-side navigation (confirms it is a hydration timing issue, not a logic error).
- Works correctly during development (fast HMR, localStorage warm) but the flash is visible in production cold loads or in Lighthouse simulated slow-3G tests.
- `useNewsletterStore` initial state for `subscribed` is `false` (hardcoded), not derived from a synchronous localStorage read.

**Phase to address:** Phase 27 (NLTR-03) — the synchronous initial state read must be specified in the phase before implementation. The acceptance criteria must include: "hard-reload as a returning subscriber — no visible gate flash."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| t-SNE computation inside lifespan above `yield` | Matches existing FAISS load pattern; simple code | Railway healthcheck timeout → infinite deploy restart loop; app never serves traffic | Never |
| Mutate `app.state.faiss_index` in-place during rebuild (`.reset()` + `.add()`) | Avoids creating a temporary index object | Race condition: concurrent searches read partially-built index; zero results during rebuild | Never — always build new object, swap reference |
| `useState` + `onMouseMove` for proximity scale across 40+ tags | Familiar React pattern; quick to prototype | 60 re-renders/sec; visible jank alongside VirtuosoGrid; worsens with tag count | Never — use `useMotionValue` from the start |
| `motion.div` with `initial`/`animate` on ExpertCard inside VirtuosoGrid | Easy enter animation in demos | Cards re-animate on every scroll-up pass; looks broken; conflicts with virtualization | Never — CSS hover is the correct pattern for VirtuosoGrid items |
| Reuse `'explorer-filters'` localStorage key for newsletter store | Zero thought required | Silent shallow-merge overwrites user's saved filter preferences on every page load | Never — unique keys are non-negotiable |
| Add `backdrop-blur` without auditing ancestor `overflow` properties | Fast to implement; works in isolation | Blur silently fails in production layout; no error thrown; user sees no glass effect | Acceptable only in isolated demos; never in the actual layout |
| Synchronous `TSNE.fit_transform()` call anywhere in the FastAPI lifespan | Simple linear startup code | Blocks the event loop; Railway healthcheck never responds; deploy fails | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `backdrop-filter` + existing Tailwind layout containers | Adding `backdrop-blur-md` to a component inside an `overflow-hidden` flex ancestor | Audit ancestor chain first; use `before:backdrop-blur-md before:-z-10` pseudo-element escape hatch if needed |
| Nested glass surfaces (SagePanel over sidebar) | Both surfaces applying their own `backdrop-filter` | Apply glass at the same DOM level; test contrast over the actual aurora gradient, not over white |
| Framer Motion + VirtuosoGrid cards | Adding `initial`/`animate`/`whileHover` Framer Motion props to the `itemContent` component | CSS `transition` and `.expert-card:hover` only for card animations; Framer Motion stays outside VirtuosoGrid |
| Framer Motion proximity scale + many tags | `useState` for mouse position driving 40+ item scale calculations per frame | `useMotionValue` + `useTransform` per tag — zero React re-renders on mousemove |
| scikit-learn TSNE + FastAPI lifespan | Placing `TSNE.fit_transform()` above the `yield` in `lifespan()`, even wrapped in `asyncio.to_thread` | Start as `asyncio.create_task` *after* the `yield`; guard the endpoint with a `tsne_ready` flag |
| FAISS rebuild + `asyncio.to_thread` | Operating on `app.state.faiss_index` inside the rebuild thread (`.reset()`, `.add()`) | Build a fresh `faiss.IndexFlatIP(768)` inside the thread; return it; swap `app.state.faiss_index` only after `asyncio.to_thread` resolves |
| Zustand newsletter persist + existing `explorer-filters` persist | Same `name` value copy-pasted from existing store | Always set an explicit, unique `name` (`'tinrate-newsletter-v1'`) per persisted store |
| `onRehydrateStorage` + `set()` call | Calling store actions inside `onRehydrateStorage` to post-process hydrated state | Use synchronous localStorage read in the initial state function; or `onFinishHydration()` with a `hasHydrated` flag |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `useState` for mousemove-driven proximity scale (40+ tags) | React DevTools Profiler: continuous orange highlights; Chrome shows `[Violation] 'mousemove' handler took >50ms` | `useMotionValue` + `useTransform` — bypasses React render cycle entirely | Immediately visible with 15+ tags on mid-range hardware |
| `useSpring` per tag item (40+ springs simultaneously) | Spring interference; over-reactive feel; animation frame budget pressure | Single `useMotionValue` for mouse; `useTransform` per tag with CSS `transition` fallback | At 20+ tags on mobile |
| `layout` Framer Motion prop on items inside VirtuosoGrid | Layout measurement triggers Virtuoso position recalculation; visible jitter on scroll | Never use `layout` prop on VirtuosoGrid `itemContent` elements | Immediately on any scroll interaction |
| t-SNE with default `n_iter=1000` on Railway | 30–60 second background compute; Railway memory spike; background task may time out | `n_iter=300`, `method='barnes_hut'`, PCA pre-reduction to 50 dims before TSNE | With 768-dim vectors and `n_iter >= 500` |
| t-SNE without PCA pre-reduction on 768-dim vectors | Higher RAM pressure during TSNE; risk of OOM on Railway 512MB tier | `PCA(n_components=50).fit_transform(vectors)` before TSNE input | With 768-dim embeddings at any `n_iter` value |
| Two simultaneous FAISS rebuilds (no lock) | Double memory consumption; Railway OOM; corrupted swap | `asyncio.Lock()` on rebuild; return `409 Conflict` if rebuild already in progress | Any time admin double-clicks the rebuild button |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `/api/admin/embedding-map` response includes expert email addresses | Email harvest via an admin API that has no rate limiting | Embedding map response must contain only: 2D coordinates, expert username, first_name, last_name, category — never email, phone, or contact info |
| FAISS rebuild endpoint with no rebuild lock or auth check | Concurrent rebuild requests exhaust Railway 512MB memory; any user can trigger it | `asyncio.Lock` on rebuild coroutine; rebuild endpoint requires `X-Admin-Key` header (existing `_require_admin` dependency) |
| Newsletter emails stored without UNIQUE constraint | Duplicate subscriptions inflate subscriber count; single email counts multiple times | `UNIQUE` constraint on `newsletter_subscribers.email`; use SQLite `INSERT OR IGNORE` pattern |
| Barrel roll trigger phrase matching substrings (e.g. "barrel" matches "software barrel architecture") | Unexpected animation during legitimate expert searches; undermines trust | Exact phrase-list match only: `any(phrase in query.lower() for phrase in ["barrel roll", "do a flip", "do a barrel roll"])`; not `"barrel" in query` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Glass surface contrast only tested on white background | Sidebar text illegible on aurora gradient (low-contrast pastels + low-opacity glass) | Test `text-gray-900` on the actual aurora gradient colors at the deployed glass opacity; use a contrast analyser; ≥ 4.5:1 required (VIS-05) |
| t-SNE endpoint returns empty scatter plot until ready, with no loading state | Admin believes the embedding map is broken; refreshes repeatedly | Show explicit "Computing embedding map — check back in ~30s" loading state; auto-poll `/api/admin/embedding-map` every 5s until `status: "ready"` |
| Tag cloud proximity scale radius too large (200px) | Cursor accidentally scales tags while user moves toward the search input above the cloud | Tune proximity radius to 80–100px; add 80ms ease-out CSS transition so scale feels deliberate, not jumpy |
| Newsletter gate not migrating returning `emailGateUnlocked` users | Returning users who passed the v2.0 email gate now see the newsletter gate again — feels like regression | On newsletter gate mount, check `localStorage.getItem('emailGateUnlocked') === 'true'`; if present, auto-mark as newsletter subscribed and migrate to new key |
| Barrel roll (FUN-01) triggers on partial keyword "barrel" in legitimate queries | Unexpected full-page animation during a genuine search; breaks user trust | Exact phrase match only (`"barrel roll"`, `"do a flip"`, `"do a barrel roll"`); never partial keyword matching |

---

## "Looks Done But Isn't" Checklist

- [ ] **Glass surfaces (VIS-02, VIS-03, VIS-04):** Blur appears correct on the white dev background — verify by rendering the actual aurora gradient CSS as the page background during development and confirming the blur is still visible through each glass surface.
- [ ] **Safari glass (VIS-05):** `backdrop-blur-*` Tailwind utility generates only the unprefixed property in Tailwind v3 — verify Safari renders the blur by testing on actual Safari (not Chrome's Responsive Design Mode which uses Blink). Add `-webkit-backdrop-filter` in `@layer utilities` if needed.
- [ ] **t-SNE readiness guard (INTEL-05):** The endpoint returns 200 with data immediately — verify `tsne_ready` is checked and the endpoint returns 202 with `{"status": "computing"}` while the background task runs. Verify that a Railway cold deploy passes the healthcheck before t-SNE finishes.
- [ ] **FAISS rebuild object isolation (IDX-03):** "Swap complete" log appears but `app.state.faiss_index.ntotal` still shows the old vector count — verify the swap is of the new object reference. Run `grep -r "app.state.faiss_index.reset\|app.state.faiss_index.add" app/` — must return zero results.
- [ ] **Newsletter localStorage key uniqueness:** After newsletter feature ships, open DevTools → Application → localStorage — confirm `explorer-filters` key contains only filter fields (query, tags, rateMin, rateMax, sortBy); confirm `tinrate-newsletter-v1` key exists and is separate.
- [ ] **Newsletter gate migration (NLTR-01):** Returning users who had the v2.0 email gate passed (localStorage `emailGateUnlocked: true`) — verify they are not shown the newsletter gate. Hard-reload a session with `emailGateUnlocked: true` in localStorage before `tinrate-newsletter-v1` exists.
- [ ] **Tag cloud keyboard navigation (DISC-04):** Tags appear keyboard-focusable (Tab cycles through) — verify that pressing Enter or Space on a focused tag toggles it in the filter store. Test without a mouse.
- [ ] **Zustand `version` bump (NLTR-03):** If newsletter state is added to the existing `useExplorerStore` via `partialize`, confirm `version` is bumped from 1 to 2 and a `migrate` function is added to handle the schema change for existing localStorage entries.
- [ ] **ExpertCard has no Framer Motion import (CARD-01 through CARD-03):** Run `grep -r "from 'motion/react'\|from 'framer-motion'" frontend/src/components/marketplace/ExpertCard.tsx` — must return zero results after the bento redesign.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Glass surfaces broken by `overflow: hidden` ancestor | LOW | Switch to `before:backdrop-blur-md before:-z-10` pseudo-element technique; no structural layout refactor needed |
| t-SNE blocking Railway startup (deploy restart loop) | LOW | Move t-SNE call below `yield` as `asyncio.create_task`; push to Railway; deploy succeeds in < 30s |
| FAISS in-place mutation race condition discovered in production | MEDIUM | Patch `_build_new_index_from_db` to return a new `faiss.IndexFlatIP(768)` object; add `asyncio.Lock`; redeploy; no data loss (FAISS index file on disk is untouched) |
| VirtuosoGrid scroll-triggered card re-animations | LOW | Remove `initial`/`animate` props from `ExpertCard`; replace with CSS `.expert-card { transition: ... }` hover rule; redeploy |
| Zustand key collision wiping user filter preferences | LOW | Rename newsletter store key to `'tinrate-newsletter-v1'`; redeploy; existing users lose newsletter subscription state (must re-subscribe; acceptable trade-off) |
| Newsletter gate flash for returning subscribers | LOW | Add synchronous localStorage read in newsletter store initial state; redeploy |
| Double-blur SagePanel contrast failure | LOW | Increase glass opacity (`bg-white/20` instead of `bg-white/8`) or add a solid color accent strip behind text-heavy areas; no structural change needed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `overflow: hidden` ancestor breaks `backdrop-filter` | Phase 22 (VIS-02, VIS-03, VIS-04) | DevTools ancestor chain audit completed before writing glass classes; blur visible on aurora gradient |
| Nested glass double-blur (SagePanel contrast) | Phase 22 (VIS-04, VIS-05) | Contrast audit on each glass surface over aurora gradient; ≥ 4.5:1 confirmed |
| Tag cloud proximity scale `useState` re-render storm | Phase 23 (DISC-02) | React DevTools Profiler: no render highlights during mouse movement over tag cloud |
| VirtuosoGrid card re-animation on scroll | Phase 23 (CARD-01, CARD-02, CARD-03) | Scroll 50+ cards in VirtuosoGrid twice (down and up); no visible enter animations during second scroll-up pass |
| FAISS rebuild race condition (in-place mutation) | Phase 24 (IDX-02, IDX-03) | Trigger rebuild; send concurrent explore requests; confirm zero search failures or empty results |
| Two concurrent rebuild requests (no lock) | Phase 24 (IDX-01, IDX-04) | Double-click rebuild button; confirm `409 Conflict` on second request |
| t-SNE blocking Railway startup (above `yield`) | Phase 26 (INTEL-05) | Railway deploy completes and `/health` responds in < 10s; t-SNE status starts as "computing" |
| Zustand newsletter key collision | Phase 27 (NLTR-03) | Post-deploy localStorage inspection: `explorer-filters` contains only filter fields; `tinrate-newsletter-v1` is a separate key |
| Newsletter gate hydration flash | Phase 27 (NLTR-03) | Hard-reload as returning subscriber; no visible gate flash (test on simulated slow-3G in Chrome) |

---

## Sources

- FAISS thread safety for concurrent search and write: [Threads and asynchronous calls — FAISS Wiki](https://github.com/facebookresearch/faiss/wiki/Threads-and-asynchronous-calls)
- FAISS thread-safe reads, not-safe writes: [Are search operations thread safe? — FAISS Issue #367](https://github.com/facebookresearch/faiss/issues/367)
- FastAPI concurrent race conditions with global variables: [The Concurrency Trap in FastAPI — DataSci Ocean](https://datasciocean.com/en/other/fastapi-race-condition/)
- `asyncio.Lock` for FastAPI shared state: [FastAPI Concurrency docs](https://fastapi.tiangolo.com/async/)
- FastAPI blocking CPU operations in threads: [Running Blocking ML Operations Asynchronously — apxml.com](https://apxml.com/courses/fastapi-ml-deployment/chapter-5-async-operations-performance/running-blocking-ml-operations)
- FastAPI event loop blocking case study: [Fixing FastAPI Event Loop Blocking — techbuddies.io](https://www.techbuddies.io/2026/01/10/case-study-fixing-fastapi-event-loop-blocking-in-a-high-traffic-api/)
- FastAPI startup event blocking: [Stuck on "Waiting for application startup" — FastAPI Discussion #6526](https://github.com/fastapi/fastapi/discussions/6526)
- scikit-learn TSNE memory issues: [t-SNE runs out of memory — scikit-learn Issue #18966](https://github.com/scikit-learn/scikit-learn/issues/18966)
- `backdrop-filter` fails with positioned children: [Why backdrop-filter Fails — Medium/@aqib-2](https://medium.com/@aqib-2/why-backdrop-filter-fails-with-positioned-child-elements-0b82b504f440)
- `backdrop-filter` + `overflow: hidden` parent: [CSS Backdrop-Filter Blur Not Working with Overflow Hidden — copyprogramming.com](https://copyprogramming.com/howto/transitioning-backdrop-filter-blur-on-an-element-with-overflow-hidden-parent-is-not-working)
- Tailwind `backdrop-blur` child conflict: [Tailwind backdrop-blur bug — GitHub Discussion #15103](https://github.com/tailwindlabs/tailwindcss/discussions/15103)
- `backdrop-filter` stacking context: [Next-level frosted glass — Josh W. Comeau](https://www.joshwcomeau.com/css/backdrop-filter/)
- `backdrop-filter` MDN reference: [backdrop-filter — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- Framer Motion MotionValues bypass React re-renders: [Motion Values — Motion docs](https://motion.dev/docs/react-motion-value)
- Framer Motion `useTransform` composable values: [useTransform — Motion docs](https://www.framer.com/motion/use-transform/)
- Framer Motion + VirtuosoGrid animation conflicts: [Animated item positions — react-virtuoso Issue #115](https://github.com/petyosi/react-virtuoso/issues/115)
- VirtuosoGrid unmount/remount behavior: [Disable/control unmounting — react-virtuoso Issue #298](https://github.com/petyosi/react-virtuoso/issues/298)
- Zustand persist storage key must be unique: [Persisting store data — Zustand docs](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- Zustand multiple persist slices issues: [Multiple persist slices under one store — Zustand Issue #800](https://github.com/pmndrs/zustand/issues/800)
- Zustand `onRehydrateStorage` + `set()` bug: [Calling state setter in onRehydrateStorage not working — Zustand Issue #1527](https://github.com/pmndrs/zustand/issues/1527)
- Zustand hydration race condition fix: [Wait for rehydration — Zustand Discussion #426](https://github.com/pmndrs/zustand/discussions/426)
- Python GIL and attribute assignment atomicity: [Grok the GIL — emptysqua.re](https://emptysqua.re/blog/grok-the-gil-fast-thread-safe-python/)
- Existing system code inspected: `app/main.py` (lifespan pattern), `frontend/src/store/index.ts` (persist config, `name: 'explorer-filters'`), `frontend/src/components/marketplace/ExpertGrid.tsx` (VirtuosoGrid config), `frontend/src/components/marketplace/ExpertCard.tsx` (CSS hover pattern)

---

*Pitfalls research for: Tinrate AI Concierge v2.2 Evolved Discovery Engine*
*Researched: 2026-02-22*
