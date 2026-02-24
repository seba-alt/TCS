# Phase 36: Foundation - Research

**Phase:** 36
**Goal:** Routes, shared Zustand state, and Expert model are restructured so every v3.0 feature has its preconditions met before a line of Browse UI is written
**Requirements:** NAV-01, SAGE-04
**Researched:** 2026-02-24

## Codebase Findings

### 1. Current Route Architecture

**File:** `frontend/src/main.tsx`

The app uses `createBrowserRouter` from `react-router-dom` v7.13.0. Current routes:

```typescript
const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/marketplace" replace /> },
  { path: '/marketplace', element: <MarketplacePage /> },
  { path: '/chat', element: <App /> },
  { path: '/admin/login', element: <LoginPage /> },
  { path: '/admin', element: <RequireAuth />, children: [...] },
])
```

**What needs to change for NAV-01:**
- `'/'` currently redirects to `/marketplace` -- must render `<BrowsePage />` stub instead
- `'/marketplace'` renders `<MarketplacePage />` -- must be relocated to `'/explore'` and component renamed or aliased
- New `'/marketplace'` route must do a **permanent redirect** (301 via `<Navigate replace>` + `statusCode` or Vercel config) to `'/explore'` preserving query params
- `'/chat'` redirect behavior needs definition (currently renders standalone `App` component)

**Vercel config:** `frontend/vercel.json` has a single catch-all rewrite `/(.*) -> /index.html` for SPA routing. The `/marketplace` -> `/explore` permanent redirect should be a Vercel `redirects` entry (not a rewrite) so crawlers/bookmarks get a true 308 permanent redirect at the CDN level, not a client-side redirect.

### 2. MarketplacePage Component

**File:** `frontend/src/pages/MarketplacePage.tsx` (174 lines)

This is the main Explorer page. Key concerns for relocation:
- Uses `useUrlSync()` hook for bidirectional URL <-> Zustand filter sync
- Uses `useExplore()` for fetching `/api/explore` data
- Has `resetPilot()` call on mount (lines 33-36) -- **this is the highest-risk single change** noted in STATE.md. Currently resets pilot state unconditionally. When moving to `/explore`, this must be gated so Sage handoff from Browse doesn't get wiped.
- References `useExplorerStore`, `useFilterSlice`, `useNltrStore`
- Renders: Header, FilterSidebar, FilterChips, ExpertGrid, MobileFilterSheet, SageFAB, SagePanel, NewsletterGateModal

**Approach:** Rename the route path from `/marketplace` to `/explore`. The component can stay as `MarketplacePage.tsx` internally (minimizes diff) or be renamed. The route path change in `main.tsx` is what matters for NAV-01.

### 3. Zustand Store Architecture

**Files:**
- `frontend/src/store/index.ts` -- Combined store with `persist` middleware
- `frontend/src/store/filterSlice.ts` -- Filter state (persisted to localStorage)
- `frontend/src/store/resultsSlice.ts` -- Expert results + `sageMode` flag (NOT persisted)
- `frontend/src/store/pilotSlice.ts` -- Sage messages + panel state (NOT persisted)
- `frontend/src/store/nltrStore.ts` -- Separate newsletter store

**Current store type:** `ExplorerStore = FilterSlice & ResultsSlice & PilotSlice`

**Persistence config (partialize):** Only filter data fields are persisted: `query`, `rateMin`, `rateMax`, `tags`, `sortBy`, `sortOrder`. Results and pilot are excluded.

**For SAGE-04 (navigationSlice):**
The new `navigationSlice` must be added to the combined store BUT excluded from `partialize` (not persisted). Fields needed per CONTEXT.md decisions:
- `navigationSource: 'browse' | 'sage' | 'direct'` -- tracks user origin
- `pendingSageResults: Expert[] | null` -- Sage search results for handoff
- `pendingSearchQuery: string | null` -- Sage search text for contextual headers
- Actions: `setNavigationSource`, `setPendingSageResults`, `setPendingSearchQuery`, `clearPendingSageResults`

**Integration pattern:** Follow exact same `StateCreator` pattern as `pilotSlice.ts` and `resultsSlice.ts`. The combined type becomes `ExplorerStore = FilterSlice & ResultsSlice & PilotSlice & NavigationSlice`.

### 4. Expert SQLAlchemy Model

**File:** `app/models.py` (Expert class, lines 82-108)

Current Expert columns: `id`, `username`, `email`, `first_name`, `last_name`, `job_title`, `company`, `bio`, `hourly_rate`, `currency`, `profile_url`, `profile_url_utm`, `category`, `tags`, `findability_score`, `created_at`.

**No `photo_url` column exists.** Must add:
```python
photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

**Migration pattern (proven):** `app/main.py` lifespan function already handles idempotent ALTER TABLE migrations for both `conversations` and `experts` tables (lines 190-219). Pattern:
```python
with engine.connect() as _conn:
    for _col_ddl in ["ALTER TABLE experts ADD COLUMN photo_url TEXT"]:
        try:
            _conn.execute(_text(_col_ddl))
            _conn.commit()
        except Exception:
            pass  # Column already exists -- idempotent
```

This pattern is Railway-safe: on restart, the ALTER TABLE fails silently if column exists. On fresh deploy, `Base.metadata.create_all` creates the table with the column from the ORM model, and the ALTER TABLE also fails silently (column already exists from create_all).

### 5. resetPilot() Risk

**File:** `frontend/src/pages/MarketplacePage.tsx` lines 33-36

```typescript
const resetPilot = useExplorerStore((s) => s.resetPilot)
useEffect(() => { resetPilot() }, [resetPilot])
```

STATE.md explicitly warns: "unconditional resetPilot() in MarketplacePage.tsx must be removed or gated -- this is the highest-risk single change in the milestone."

**In Phase 36 scope:** The gating logic depends on the `navigationSlice`. When `navigationSource === 'browse'` (user came from Browse page), `resetPilot()` should NOT fire. When `navigationSource === 'direct'` (user typed `/explore` directly), it SHOULD fire to give a clean Sage panel.

This gate is a natural fit for Phase 36 since the `navigationSlice` is being created here and the gating logic is the primary consumer of `navigationSource`.

### 6. BrowsePage Stub

Success criteria says "Visiting `/` serves the BrowsePage stub (not Explorer)." This is a minimal stub -- no Browse UI is built until Phase 38.

**Stub requirements:**
- New file: `frontend/src/pages/BrowsePage.tsx`
- Renders something visible so the success criteria can be verified (e.g., a placeholder with "Browse" heading)
- Must be importable and routable from `main.tsx`
- No data fetching, no API calls -- it's a stub

### 7. Query Parameter Preservation for Redirect

Success criteria #2: "Visiting `/marketplace` in the browser redirects permanently to `/explore` with query params preserved."

**Two-layer approach:**
1. **Vercel CDN redirect** (`frontend/vercel.json`): Add `"redirects": [{ "source": "/marketplace", "destination": "/explore", "permanent": true }]`. Vercel supports query string pass-through by default for permanent redirects.
2. **Client-side fallback** (`main.tsx`): For SPA navigation, a React Router route at `/marketplace` renders a `<Navigate>` component that reads `useSearchParams()` and redirects to `/explore` preserving params. This catches cases where the user is already in the SPA and navigates to `/marketplace` via client-side routing.

**Note on 301 vs 308:** Vercel `permanent: true` sends a 308 Permanent Redirect, which preserves the HTTP method. This is correct for GET requests (bookmarks, crawlers).

### 8. /chat Route

Current `/chat` route renders the standalone `<App />` chat component. The roadmap doesn't mention changing this route, and no requirements reference it. NAV-01 only specifies: "Routes reorganized: `/` -> BrowsePage, `/explore` -> Explorer, `/marketplace` redirects to `/explore`, `/chat` redirects appropriately."

The `/chat` requirement says "redirects appropriately" -- since the old standalone chat is superseded by Sage (which is embedded in the Explorer), `/chat` should redirect to `/explore` to guide users to the current experience.

## Technical Risks

1. **resetPilot() gating:** Must not break direct `/explore` URL visits. If `navigationSource` defaults to `'direct'`, the gate works correctly: direct visits reset pilot (existing behavior), Browse->Explorer transitions preserve pilot state.

2. **Store type expansion:** Adding `NavigationSlice` to the combined `ExplorerStore` type changes the `StateCreator` generic parameter. All existing slices must be updated to reference the new combined type. However, since they already use `ExplorerStore` from `./index`, the type update cascades automatically.

3. **Zustand persist version:** The store uses `version: 1`. Adding a new slice that is excluded from `partialize` does NOT require a version bump since the persisted shape doesn't change.

4. **Vercel redirect vs rewrite ordering:** Vercel processes `redirects` before `rewrites`. Adding a redirect for `/marketplace` won't conflict with the existing catch-all rewrite.

## Implementation Approach

This phase decomposes naturally into 2 plans:

**Plan A: Route Restructure + BrowsePage Stub (Frontend)**
- Create BrowsePage stub component
- Update `main.tsx` routes: `/` -> BrowsePage, `/explore` -> MarketplacePage, `/marketplace` -> redirect to `/explore`
- Add `/chat` redirect to `/explore`
- Update `vercel.json` with permanent redirect
- Gate `resetPilot()` using navigationSource

**Plan B: Zustand NavigationSlice + Expert.photo_url (Full-stack)**
- Create `navigationSlice.ts` with fields from CONTEXT.md decisions
- Integrate into combined store (index.ts) without persisting
- Add `photo_url` column to Expert model
- Add idempotent ALTER TABLE migration in main.py lifespan
- Update Expert frontend type (if exposed in resultsSlice)

These can run as a single wave since Plan B doesn't depend on Plan A (the slice and the model column are independent of route changes).

## Requirement Coverage

| Requirement | Coverage |
|------------|---------|
| NAV-01 | Plan A: Route restructure (`/` -> BrowsePage, `/explore` -> Explorer, `/marketplace` redirect, `/chat` redirect) |
| SAGE-04 | Plan B: navigationSlice with `pendingSageResults`, `navigationSource`, `pendingSearchQuery` |

## RESEARCH COMPLETE
