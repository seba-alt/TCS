# Phase 15: Zustand State & Routing - Research

**Researched:** 2026-02-21
**Domain:** Zustand v5 global state management (slices + persist middleware) + React Router v7 routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Store name:** `useExplorerStore` — single Zustand store for all explorer/marketplace state
- **Slices:** filter slice, results slice, pilot slice
- **Persist scope:** `query`, `rateMin`, `rateMax`, `tags`, `sortBy`, sort order — filter slice only; results and pilot never persisted
- **On load with restored filters:** auto-trigger a search with the restored filter state (seamless UX)
- **localStorage sync:** immediately on every filter change, including clear/reset
- **Stale/schema-mismatch:** clear silently and start fresh (no migration needed for v1)
- **Pilot slice:** holds message history, loading/streaming flag, session ID or thread reference, open/closed panel state
- **Pilot state resets on navigation away** (survives in-session tab switches, not reloads)
- **Pilot slice can read current filter state** — tight integration with filter slice is intentional
- **Homepage:** `/` renders `MarketplacePage`; old chat interface removed from homepage
- **This phase is store shape only** — no API calls wired; real fetching comes in a later phase

### Claude's Discretion

- Whether old interface moves to `/chat` or is removed entirely
- Store export pattern (single `useExplorerStore` vs named slice hooks)
- Results slice shape (array only vs full loading/error/pagination)
- Admin/auth store structure (separate store or Claude decides)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-01 | Zustand `useExplorerStore` manages filters, results, and pilot conversation slices | Slices pattern with `StateCreator` — combine three slice creators into one `create()` call; no Provider needed |
| STATE-02 | Filter slice persists to localStorage via `persist` middleware with `partialize` (results and pilot excluded) | `persist()` wrapping the combined creator with `partialize: (s) => ({ query, rateMin, rateMax, tags, sortBy, sortOrder })` and `version: 1` |
| STATE-03 | Homepage `/` renders `MarketplacePage`; chat interface is removed | Replace `element: <App />` on the `'/'` route in `main.tsx` with `element: <MarketplacePage />`; create the placeholder component |
</phase_requirements>

---

## Summary

Phase 15 introduces the shared Zustand store (`useExplorerStore`) that all subsequent marketplace UI phases will build on. The store is composed of three slices — filter, results, and pilot — using Zustand's slices pattern. The `persist` middleware wraps the combined creator and uses `partialize` to scope localStorage persistence to the filter slice only. The results and pilot slices are never written to storage.

The routing change is minimal: the existing `createBrowserRouter` config in `main.tsx` already works; only the `'/'` route element changes from `<App />` to `<MarketplacePage />`. Creating a shell `MarketplacePage` component is sufficient for this phase — real API wiring happens in a later phase.

Zustand v5 (current: 5.0.11) is compatible with the project's React 19 stack. There are two important v5 behavioral changes to respect: selectors that return new object/array references must use `useShallow` to avoid infinite loops, and the `persist` middleware no longer persists the initial state during store creation (only after a user-driven state change). Both are easily handled with the recommended patterns documented below.

**Primary recommendation:** Use one `create()` call with `persist()` wrapping the spread of all three slice creators. Type each slice with `StateCreator<ExplorerStore, [['zustand/persist', FilterSlice]], [], SliceType>`. Export a single `useExplorerStore` hook; add domain-specific custom hooks (`useFilterSlice`, `useResultsSlice`, `usePilotSlice`) as thin wrappers using `useShallow` for object selectors.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.11 | Global state without Provider | Provider-free, tiny bundle, first-class TypeScript, React 19 compatible |
| zustand/middleware — persist | (bundled) | localStorage persistence with partialize | Official middleware; handles serialization, version, migrate, onRehydrateStorage |
| react-router-dom | 7.13.0 (already installed) | `createBrowserRouter` + `RouterProvider` | Already in project; v7 is non-breaking upgrade from v6 API |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/shallow (`useShallow`) | (bundled with zustand 5) | Shallow-equal comparison for object/array selectors | Any selector that returns a new object/array literal — required in v5 to avoid infinite loop |
| zustand/middleware — devtools | (bundled) | Redux DevTools browser extension integration | Development builds; wrap around persist for best DX |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zustand slices pattern | Multiple separate Zustand stores | Multiple stores work but make cross-slice reads (pilot reading filter state) awkward; single store is the right choice here |
| `persist` middleware | Manual `localStorage.setItem` in actions | Custom solution misses schema migration, versioning, rehydration lifecycle — don't hand-roll |
| `useShallow` | `shallow` equality fn via `createWithEqualityFn` | Both work; `useShallow` is the v5-idiomatic inline approach |

**Installation:**
```bash
npm install zustand
```
(zustand is not yet in the project's package.json)

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── store/
│   ├── index.ts            # create() call + export useExplorerStore
│   ├── filterSlice.ts      # FilterSlice type + createFilterSlice
│   ├── resultsSlice.ts     # ResultsSlice type + createResultsSlice
│   └── pilotSlice.ts       # PilotSlice type + createPilotSlice
├── pages/
│   └── MarketplacePage.tsx # Shell component (placeholder for Phase 16+)
└── main.tsx                # Route: '/' → MarketplacePage
```

---

### Pattern 1: Slices with Combined `create()` and `persist`

**What:** Each slice is a `StateCreator` function typed against the full store shape. The `create()` call spreads all three slices inside a `persist()` wrapper. `partialize` returns only filter fields so results/pilot never hit localStorage.

**When to use:** Any time you need multiple logical state domains in one store with selective persistence.

**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs/guides/slices-pattern
//         https://zustand.docs.pmnd.rs/middlewares/persist
//         Verified via https://github.com/pmndrs/zustand/discussions/2164

import { create, StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// --- Types ---

export interface FilterSlice {
  query: string
  rateMin: number
  rateMax: number
  tags: string[]
  sortBy: 'relevance' | 'rate_asc' | 'rate_desc'
  sortOrder: 'asc' | 'desc'
  setQuery: (q: string) => void
  setRateRange: (min: number, max: number) => void
  toggleTag: (tag: string) => void
  setSortBy: (sortBy: FilterSlice['sortBy']) => void
  resetFilters: () => void
}

export interface ResultsSlice {
  experts: Expert[]          // Expert type defined from API contract
  total: number
  cursor: number | null
  loading: boolean
  error: string | null
  setResults: (experts: Expert[], total: number, cursor: number | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetResults: () => void
}

export interface PilotSlice {
  messages: PilotMessage[]
  isOpen: boolean
  isStreaming: boolean
  sessionId: string | null
  addMessage: (msg: PilotMessage) => void
  setOpen: (open: boolean) => void
  setStreaming: (streaming: boolean) => void
  resetPilot: () => void
}

export type ExplorerStore = FilterSlice & ResultsSlice & PilotSlice

// --- Slice creators ---
// Each slice types itself against ExplorerStore so cross-slice reads work.
// The middleware tuple [['zustand/persist', FilterSlice]] tells TypeScript
// which middleware is wrapping the combined store.

type FilterCreator = StateCreator<
  ExplorerStore,
  [['zustand/persist', FilterSlice]],
  [],
  FilterSlice
>

export const createFilterSlice: FilterCreator = (set) => ({
  query: '',
  rateMin: 0,
  rateMax: 5000,
  tags: [],
  sortBy: 'relevance',
  sortOrder: 'desc',
  setQuery: (q) => set({ query: q }),
  setRateRange: (min, max) => set({ rateMin: min, rateMax: max }),
  toggleTag: (tag) =>
    set((s) => ({
      tags: s.tags.includes(tag)
        ? s.tags.filter((t) => t !== tag)
        : [...s.tags, tag],
    })),
  setSortBy: (sortBy) => set({ sortBy }),
  resetFilters: () =>
    set({ query: '', rateMin: 0, rateMax: 5000, tags: [], sortBy: 'relevance', sortOrder: 'desc' }),
})

// Results and pilot slices follow the same pattern with StateCreator<ExplorerStore, ...>

// --- Combined store ---

export const useExplorerStore = create<ExplorerStore>()(
  persist(
    (...a) => ({
      ...createFilterSlice(...a),
      ...createResultsSlice(...a),
      ...createPilotSlice(...a),
    }),
    {
      name: 'explorer-filters',        // localStorage key
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Scope persistence to filter fields ONLY — results and pilot are never stored
      partialize: (state): FilterSlice => ({
        query: state.query,
        rateMin: state.rateMin,
        rateMax: state.rateMax,
        tags: state.tags,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        // Actions are not serializable — omit them; they are reconstructed on init
        setQuery: state.setQuery,
        setRateRange: state.setRateRange,
        toggleTag: state.toggleTag,
        setSortBy: state.setSortBy,
        resetFilters: state.resetFilters,
      }),
      // Silent clear on schema mismatch: if version doesn't match,
      // default behavior is to discard the stored state and start fresh.
      // No explicit migrate() needed for v1 — that's what version: 1 achieves.
    }
  )
)
```

**Note on partialize and actions:** The `partialize` return value is serialized to JSON. Action functions are not JSON-serializable. In practice, omit action keys from `partialize` — persist only the data fields. The slice creator always re-initializes the actions on store creation. A cleaner approach:

```typescript
partialize: (state) => ({
  query: state.query,
  rateMin: state.rateMin,
  rateMax: state.rateMax,
  tags: state.tags,
  sortBy: state.sortBy,
  sortOrder: state.sortOrder,
}),
```

The return type of `partialize` is automatically inferred as the persisted state type; TypeScript accepts this without manual annotation in most cases.

---

### Pattern 2: Custom Slice Hooks with `useShallow`

**What:** Thin wrapper hooks over `useExplorerStore` that select a slice and use `useShallow` to prevent re-renders when the slice reference is stable.

**When to use:** In every component. Never call `useExplorerStore` directly with an object/array selector — always go through a custom hook or `useShallow`.

**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
import { useShallow } from 'zustand/react/shallow'
import { useExplorerStore } from '@/store'

// Thin wrapper: picks only filter-slice fields
export function useFilterSlice() {
  return useExplorerStore(
    useShallow((s) => ({
      query: s.query,
      rateMin: s.rateMin,
      rateMax: s.rateMax,
      tags: s.tags,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
      setQuery: s.setQuery,
      setRateRange: s.setRateRange,
      toggleTag: s.toggleTag,
      setSortBy: s.setSortBy,
      resetFilters: s.resetFilters,
    }))
  )
}
```

Alternatively — and even simpler — pick individual primitives directly (no `useShallow` needed for scalars):

```typescript
// Safe: scalar selectors never return new references
const query = useExplorerStore((s) => s.query)
const setQuery = useExplorerStore((s) => s.setQuery)
```

---

### Pattern 3: Auto-trigger Search After Rehydration

**What:** After localStorage rehydrates the filter slice, trigger a search immediately so the user lands with both filters and results visible (per locked decision).

**When to use:** On store creation, using `onRehydrateStorage`.

**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs/middlewares/persist (onRehydrateStorage)
persist(
  (...a) => ({ /* slices */ }),
  {
    name: 'explorer-filters',
    version: 1,
    partialize: (state) => ({ /* filter fields */ }),
    onRehydrateStorage: () => (state) => {
      // Called after hydration completes.
      // At this point state.query/tags/etc are restored from localStorage.
      // Dispatch the search action — but the actual fetch function is wired in
      // a later phase. For Phase 15, this can be a no-op or set a flag.
      if (state) {
        state.setLoading(false) // ensure clean starting state
        // Phase 16+ will hook up: state.triggerSearch()
      }
    },
  }
)
```

Because Phase 15 is store shape only (no API calls), the `onRehydrateStorage` can set up the hook point without the actual fetch. The Phase 16 implementation adds `state.triggerSearch()` here.

---

### Pattern 4: Routing — Replace `'/'` Route

**What:** The existing `createBrowserRouter` config in `main.tsx` already handles the admin routes correctly. Only the `'/'` route element needs to change.

**When to use:** This is a one-line change to `main.tsx` plus a new `MarketplacePage` component file.

**Example:**
```typescript
// Source: existing main.tsx + react-router-dom v7 (already installed at 7.13.0)
// Before:
{ path: '/', element: <App /> }

// After:
{ path: '/', element: <MarketplacePage /> }
```

For the old interface: move `App` to `/chat` (Claude's discretion — recommended over deletion for safety):
```typescript
{ path: '/', element: <MarketplacePage /> },
{ path: '/chat', element: <App /> },   // preserved but not linked
```

The `MarketplacePage` for Phase 15 is a shell:
```typescript
// frontend/src/pages/MarketplacePage.tsx
export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-white">
      <p className="p-8 text-gray-400">Marketplace — coming in Phase 16</p>
    </div>
  )
}
```

---

### Pattern 5: Imperative Store Access (for pilot-reads-filter)

**What:** The pilot slice needs to read the current filter state to suggest filter updates. Use `useExplorerStore.getState()` for imperative reads outside the render cycle (e.g., in event handlers, SSE callbacks).

**Example:**
```typescript
// Source: https://zustand.docs.pmnd.rs (getState documented as part of public API)
// In a pilot action handler (not in render):
const applyAIFilters = (suggested: Partial<FilterSlice>) => {
  const { setQuery, setRateRange, toggleTag } = useExplorerStore.getState()
  if (suggested.query) setQuery(suggested.query)
  if (suggested.rateMin !== undefined && suggested.rateMax !== undefined) {
    setRateRange(suggested.rateMin, suggested.rateMax)
  }
}
```

---

### Anti-Patterns to Avoid

- **Object selector without `useShallow`:** `useExplorerStore(s => ({ a: s.a, b: s.b }))` creates a new object every render in Zustand v5 → infinite loop or excessive re-renders. Always use `useShallow` or pick scalars individually.
- **Persisting actions:** `partialize` should return only data fields, not functions. Functions are not JSON-serializable and will silently serialize as `undefined`.
- **Persisting results/pilot:** Never include results or pilot state in `partialize` return — these reset on reload by design.
- **Calling `useExplorerStore` without a selector:** `useExplorerStore()` subscribes to the entire store — any state change re-renders the component. Always use a selector.
- **Multiple stores for cross-slice reads:** The pilot reading filter state requires both in the same store. Don't split into separate stores.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| localStorage persistence | Custom `useEffect` + `JSON.stringify` | `persist` middleware | Misses: versioning, schema migration, rehydration timing, storage errors, SSR safety |
| Schema version management | Manual version checks in components | `version` + `migrate` options in `persist` | Race conditions on partial writes, no rollback logic |
| Shallow equality for selectors | Custom `isEqual` util | `useShallow` from `zustand/react/shallow` | Already tuned for Zustand's subscription model; avoids v5 infinite loop edge cases |
| Cross-slice reads | Duplicating state across slices | Single `ExplorerStore` type + `get()` in slice creators | Source of truth stays single; slices can call `get().filterField` |

**Key insight:** Zustand's `persist` middleware handles the full localStorage lifecycle (read, write, version check, error recovery). A custom `useEffect` approach has well-known race conditions and misses schema migration entirely.

---

## Common Pitfalls

### Pitfall 1: Infinite Loop from Object Selector in Zustand v5

**What goes wrong:** Component enters an infinite render loop or triggers excessive re-renders.
**Why it happens:** Zustand v5 uses `useSyncExternalStore` natively. If a selector returns a new object or array reference on every call, React sees a changed snapshot every render and re-renders again. This is a **breaking behavior change from v4**.
**How to avoid:** Use `useShallow` from `zustand/react/shallow` for any selector returning an object or array. For scalar values, plain selectors are fine.
**Warning signs:** `Maximum update depth exceeded` React error; components re-rendering on unrelated state changes.

---

### Pitfall 2: Actions Serialized in localStorage

**What goes wrong:** `partialize` accidentally includes action functions; they serialize as `undefined` and are lost.
**Why it happens:** TypeScript `FilterSlice` type includes both data and action fields. If you spread `state` in `partialize`, all keys go in including functions.
**How to avoid:** `partialize` must explicitly list only data keys: `({ query, rateMin, rateMax, tags, sortBy, sortOrder }) => ({ query, rateMin, rateMax, tags, sortBy, sortOrder })`.
**Warning signs:** After reload, filter state is restored but calling `setQuery()` throws "not a function"; localStorage entry contains `"setQuery": null`.

---

### Pitfall 3: `persist` Middleware No Longer Persists Initial State (v5 behavior)

**What goes wrong:** On first app load (empty localStorage), the store initializes with defaults — then the user changes a filter — but you notice the old default state was never saved to localStorage.
**Why it happens:** v5 (and v4.5.5+) removed the behavior of persisting initial state at store creation time. State is now only written to storage when it changes.
**How to avoid:** This is actually correct behavior and requires no workaround. On first load, defaults are fine. The first user interaction triggers a write. The `onRehydrateStorage` callback fires even on first load (with empty rehydrated data), which is the right hook for the auto-search trigger.
**Warning signs:** Assuming localStorage will have data immediately after store creation — it will not until the first state change.

---

### Pitfall 4: TypeScript Type Errors When Combining Persist + Slices

**What goes wrong:** TypeScript raises `"Type 'string' is not assignable to type 'never'"` or similar when trying to type `StateCreator` with persist middleware tuple.
**Why it happens:** The middleware type tuple must be specified in `StateCreator`'s second type parameter. If mismatched, TypeScript cannot infer the mutator type.
**How to avoid:** Use `StateCreator<ExplorerStore, [['zustand/persist', FilterSlice]], [], SliceType>` for all slice creators. The key: pass the type to `persist<ExplorerStore>()`, not to `create<ExplorerStore>()`.
**Warning signs:** Red squiggles on `StateCreator` import; TypeScript complaining about middleware mutator types.

---

### Pitfall 5: Pilot Slice Not Resetting on Navigation

**What goes wrong:** User navigates to `/` → co-pilot panel retains previous conversation from another session.
**Why it happens:** Zustand state persists in memory for the lifetime of the JS module. Navigation does not reset in-memory state.
**How to avoid:** Call `useExplorerStore.getState().resetPilot()` in a `useEffect` with the route location as a dependency (in `MarketplacePage`), or wire it to the `RouterProvider`'s `onNavigate` callback. Since pilot state is not persisted, it auto-clears on hard reload but not on soft navigation.
**Warning signs:** Opening the co-pilot on `/` shows messages from a previous `/chat` session.

---

## Code Examples

Verified patterns from official sources:

### Zustand v5 Install

```bash
# Source: https://github.com/pmndrs/zustand — package.json version 5.0.11
npm install zustand
```

### Minimal Combined Store with Persist

```typescript
// Source: https://zustand.docs.pmnd.rs/guides/slices-pattern
//         https://github.com/pmndrs/zustand/discussions/2164
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useExplorerStore = create<ExplorerStore>()(
  persist(
    (...a) => ({
      ...createFilterSlice(...a),
      ...createResultsSlice(...a),
      ...createPilotSlice(...a),
    }),
    {
      name: 'explorer-filters',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        query:     state.query,
        rateMin:   state.rateMin,
        rateMax:   state.rateMax,
        tags:      state.tags,
        sortBy:    state.sortBy,
        sortOrder: state.sortOrder,
      }),
      onRehydrateStorage: () => (_state) => {
        // Phase 15: hook point for auto-search on load.
        // Phase 16+ wires: _state?.triggerSearch()
      },
    }
  )
)
```

### useShallow for Object Selector

```typescript
// Source: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
import { useShallow } from 'zustand/react/shallow'

export function useFilterSlice() {
  return useExplorerStore(
    useShallow((s) => ({
      query:        s.query,
      tags:         s.tags,
      rateMin:      s.rateMin,
      rateMax:      s.rateMax,
      sortBy:       s.sortBy,
      sortOrder:    s.sortOrder,
      setQuery:     s.setQuery,
      toggleTag:    s.toggleTag,
      setRateRange: s.setRateRange,
      setSortBy:    s.setSortBy,
      resetFilters: s.resetFilters,
    }))
  )
}
```

### Scalar Selector (no useShallow needed)

```typescript
// Primitives return same value reference — safe without useShallow
const query = useExplorerStore((s) => s.query)
const isOpen = useExplorerStore((s) => s.isOpen)
```

### Route Change in main.tsx

```typescript
// Source: existing main.tsx pattern (react-router-dom 7.13.0 already installed)
import MarketplacePage from './pages/MarketplacePage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MarketplacePage />,   // CHANGED from <App />
  },
  {
    path: '/chat',                  // ADDED — old interface preserved but unlinked
    element: <App />,
  },
  // ... admin routes unchanged
])
```

### Pilot Reset on Navigation

```typescript
// Source: Zustand getState() pattern — https://github.com/pmndrs/zustand README
// In MarketplacePage.tsx — reset pilot state when user arrives at the marketplace
import { useEffect } from 'react'
import { useExplorerStore } from '@/store'

export default function MarketplacePage() {
  const resetPilot = useExplorerStore((s) => s.resetPilot)

  useEffect(() => {
    // Reset pilot conversation when navigating to marketplace
    resetPilot()
  }, [resetPilot])

  return (/* ... */)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand v4 custom equality via `create(fn, shallow)` | Zustand v5 `createWithEqualityFn` or `useShallow` hook | v5.0.0 (Oct 2024) | Must use `useShallow` for object selectors; plain `create` no longer accepts equality fn |
| `import { persist } from 'zustand/middleware'` wraps state type | `persist<StoreType>()` receives type; `create<T>()` wraps outer | v5 (clarified in v5 TypeScript guide) | Middleware type parameters must be on `persist()`, not `create()`, for slices to type-check |
| `react-router-dom` separate package | `react-router` is the canonical package; `react-router-dom` re-exports it | v7 (Nov 2024) | Project uses `react-router-dom` 7.13.0 — fine to keep, no migration needed for this phase |
| Persist writes initial state at store creation | Persist only writes when state changes | v4.5.5 / v5 | First-load storage is empty until first user interaction — expected behavior |

**Deprecated/outdated:**
- `use-sync-external-store` shim: Zustand v5 uses the native React 18+ `useSyncExternalStore` directly — the shim package is no longer needed and is not a peer dep for React 18+.
- UMD/SystemJS builds: Removed in v5 — not relevant for this Vite project.

---

## Open Questions

1. **Results slice shape: array-only vs full loading/error/pagination**
   - What we know: CONTEXT.md marks this as Claude's discretion. The API (`/api/explore`) returns `experts[]`, `total`, `cursor`, `took_ms`.
   - What's unclear: Whether loading/error should live in the results slice or be computed per-request in a hook.
   - Recommendation: Include `loading`, `error`, `total`, `cursor` alongside `experts[]` in the results slice. This gives the pilot slice and any component clean access to loading state without prop-drilling. Matches the pattern documented in STATE.md accumulated context: "results slice scope — whether to include loading/error/pagination alongside expert array is Claude's discretion."

2. **Admin/auth store structure**
   - What we know: Admin uses `sessionStorage` key, separate from the marketplace. CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether to create a separate `useAdminStore` or keep admin state in component-local state.
   - Recommendation: Keep admin state local to admin components (it already works this way). Do not create a Zustand admin store in this phase — admin pages manage auth via `sessionStorage` directly and `RequireAuth` reads it. Adding a Zustand admin store would add complexity without benefit in Phase 15.

3. **`useShallow` import path in Zustand v5**
   - What we know: Import changed in v5. The correct v5 import is `from 'zustand/react/shallow'`.
   - What's unclear: Whether `from 'zustand/shallow'` (v4 path) still works in v5.
   - Recommendation: Always use `import { useShallow } from 'zustand/react/shallow'` — this is the documented v5 path. Verify at install time that the path resolves.

---

## Sources

### Primary (HIGH confidence)
- https://zustand.docs.pmnd.rs/guides/slices-pattern — slices pattern, combine store with persist middleware
- https://zustand.docs.pmnd.rs/middlewares/persist — full persist API (name, storage, partialize, version, migrate, onRehydrateStorage)
- https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow — `useShallow` in v5
- https://github.com/pmndrs/zustand/blob/main/package.json — confirmed version 5.0.11, React >=18 peer dep
- https://github.com/pmndrs/zustand/discussions/2164 — confirmed TypeScript fix: type on `persist<T>()` not `create<T>()`
- https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md — partialize, version, migrate patterns
- Existing `/Users/sebastianhamers/Documents/TCS/frontend/src/main.tsx` — confirmed `createBrowserRouter` already in use with react-router-dom 7.13.0

### Secondary (MEDIUM confidence)
- https://pmnd.rs/blog/announcing-zustand-v5 — v5 breaking changes summary (no initial-state persist, useShallow requirement)
- https://github.com/pmndrs/zustand/discussions/2790 — infinite loop in v5 with object selectors confirmed by maintainers
- https://reactrouter.com/upgrading/v6 — v6→v7 is non-breaking; `react-router-dom` still valid in v7

### Tertiary (LOW confidence)
- None — all critical claims verified from primary or secondary sources above.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zustand 5.0.11 confirmed on npm; react-router-dom 7.13.0 already installed
- Architecture (slices + persist): HIGH — patterns verified against official Zustand docs and GitHub discussions
- Pitfalls: HIGH — v5 infinite loop and persist behavior changes confirmed by official migration guide and maintainer discussions
- Routing change: HIGH — trivially confirmed from existing `main.tsx`

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (Zustand 5.x stable; no major release imminent)
