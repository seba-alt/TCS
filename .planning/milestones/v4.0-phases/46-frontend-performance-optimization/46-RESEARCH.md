# Phase 46: Frontend Performance Optimization - Research

**Researched:** 2026-02-27
**Domain:** Vite code splitting, React.lazy, Suspense
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None — all implementation decisions are at Claude's discretion.

### Claude's Discretion

- All implementation decisions — this phase is purely technical with clear success criteria
- Loading fallback design (spinner, skeleton, or branded splash while admin chunks load)
- Vite manualChunks configuration strategy
- How aggressively to split beyond the required admin/vendor separation

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Admin routes lazy-loaded (React.lazy) for smaller public bundle | React.lazy + dynamic import on all admin route components in main.tsx; wrap router with Suspense |
| PERF-02 | Vite build splits large dependencies (recharts, react-table) into separate chunks | Vite manualChunks function in build.rollupOptions.output — assign recharts and @tanstack/react-table to named chunks |
</phase_requirements>

## Summary

The project currently builds a single 1,261 kB JS bundle (388 kB gzip). Admin JS — including Recharts (charts), @tanstack/react-table (data tables), and 8 admin page components — ships to every public user even though they will never visit `/admin`. Vite itself warns about this at build time: "Some chunks are larger than 500 kB after minification."

The fix is two-part. First, convert all admin route component imports in `main.tsx` from static imports to `React.lazy(() => import(...))` and wrap the router outlet with a `<Suspense>` boundary. Second, configure `build.rollupOptions.output.manualChunks` in `vite.config.ts` to route Recharts and @tanstack/react-table into dedicated vendor chunks rather than the monolithic bundle. These two changes are independent and can be applied in either order.

The Suspense fallback must avoid blank screens — a minimal spinner or "Loading…" text element is sufficient. The Sentry vite plugin already in `vite.config.ts` is fully compatible with code splitting and `manualChunks`; no changes needed to the Sentry configuration.

**Primary recommendation:** Apply `React.lazy` + `Suspense` to the entire admin subtree (wrapping `RequireAuth` or the individual admin routes), then add `manualChunks` to Vite config targeting `recharts` and `@tanstack/react-table` by node_modules path match.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React.lazy | React 19 (built-in) | Defer component import until first render | Built into React, no dependency, works with all bundlers |
| React Suspense | React 19 (built-in) | Render fallback while lazy chunk loads | Required pair for React.lazy; handles loading + error states |
| Vite manualChunks | Vite 7 (built-in) | Control how Rollup groups modules into output chunks | Part of Rollup's output.manualChunks API, exposed through Vite's build config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ErrorBoundary (custom class component) | React 19 | Catch lazy load failures (network error, chunk 404) | Wrap Suspense to prevent blank screen on chunk fetch failure |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React.lazy | @loadable/component | @loadable supports SSR; React.lazy is sufficient here — no SSR |
| Suspense fallback | react-router-dom `lazy` property (v7) | React Router v7 has its own lazy route API; simpler but less flexible, React.lazy + Suspense works perfectly with createBrowserRouter |

**Installation:** No new packages needed. React.lazy, Suspense, and Vite manualChunks are all built-in.

## Architecture Patterns

### Current State (what exists)

```
frontend/src/main.tsx
  Static imports (ALL included in initial bundle):
    - AdminApp.tsx
    - LoginPage.tsx
    - RequireAuth.tsx
    - admin/pages/OverviewPage.tsx
    - admin/pages/GapsPage.tsx
    - admin/pages/LeadsPage.tsx
    - admin/pages/ExpertsPage.tsx
    - admin/pages/SettingsPage.tsx
    - admin/pages/IntelligenceDashboardPage.tsx
    - admin/pages/ToolsPage.tsx
    - admin/pages/DataPage.tsx
```

### Target State (after phase)

```
frontend/src/main.tsx
  Static imports (public bundle only):
    - RootLayout.tsx
    - MarketplacePage.tsx
    - RedirectWithParams (inline)

  Lazy imports (admin chunk, loaded only on /admin/* navigation):
    - const AdminApp = lazy(() => import('./admin/AdminApp'))
    - const LoginPage = lazy(() => import('./admin/LoginPage'))
    - const RequireAuth = lazy(() => import('./admin/RequireAuth'))
    - const OverviewPage = lazy(() => import('./admin/pages/OverviewPage'))
    - ... (all admin pages)

frontend/vite.config.ts
  build.rollupOptions.output.manualChunks(id):
    - 'recharts' → 'vendor-charts'
    - '@tanstack/react-table' → 'vendor-table'
    - 'react' / 'react-dom' → 'vendor-react'  (optional but improves cache hits)
```

### Pattern 1: React.lazy with createBrowserRouter

**What:** Replace static imports with dynamic imports wrapped in `React.lazy`. The router's element receives the lazy component wrapped in `<Suspense>`.

**When to use:** Any route subtree that public users never visit.

**Example:**
```typescript
// Source: https://www.robinwieruch.de/react-router-lazy-loading/
import { lazy, Suspense } from 'react'

const AdminApp = lazy(() => import('./admin/AdminApp'))
const LoginPage = lazy(() => import('./admin/LoginPage'))
const RequireAuth = lazy(() => import('./admin/RequireAuth'))
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage'))
// ... repeat for each admin page

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <MarketplacePage /> },
    ],
  },
  {
    path: '/admin/login',
    element: (
      <Suspense fallback={<AdminLoadingFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/admin',
    element: (
      <Suspense fallback={<AdminLoadingFallback />}>
        <RequireAuth />
      </Suspense>
    ),
    children: [
      {
        element: <AdminApp />,   // no extra Suspense needed — parent covers it
        children: [
          { index: true, element: <OverviewPage /> },
          // ...
        ],
      },
    ],
  },
])
```

**Note on Suspense placement:** A single `<Suspense>` on the outermost lazy component in the `/admin` subtree covers all nested lazy children. There is no need to wrap every individual admin page separately.

### Pattern 2: Vite manualChunks (function form)

**What:** A function in `build.rollupOptions.output.manualChunks` inspects each module ID and returns a chunk name string.

**When to use:** When specific large libraries must be isolated for caching or to prevent them from inflating the initial bundle.

**Example:**
```typescript
// Source: https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/
// vite.config.ts
export default defineConfig({
  plugins: [...],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@tanstack/react-table')) return 'vendor-table'
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react'
          }
        },
      },
    },
  },
})
```

**Note:** The function form is preferred over the object form for this use case because it avoids enumerating internal module paths. Returning `undefined` (no explicit return) tells Rollup to use its default chunking for that module.

### Pattern 3: Minimal Suspense fallback

**What:** A lightweight component that renders during chunk download.

**Example:**
```tsx
function AdminLoadingFallback() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-slate-950"
      role="status"
      aria-live="polite"
    >
      <span className="text-slate-400 text-sm">Loading…</span>
    </div>
  )
}
```

The background matches AdminApp's `bg-slate-950` so there is no white flash before the dark admin UI renders.

### Anti-Patterns to Avoid

- **Over-wrapping Suspense:** Wrapping every individual admin page in its own `<Suspense>` is redundant when a parent route already has one. One boundary for the `/admin` subtree is sufficient.
- **Lazy-loading public routes:** `MarketplacePage` and `RootLayout` must stay as static imports — they are on the critical path for public users.
- **Forgetting ErrorBoundary:** `React.lazy` throws on network failure. Without an ErrorBoundary wrapping the Suspense, this results in a blank screen. A simple class-based ErrorBoundary around the Suspense prevents this.
- **Splitting too aggressively with manualChunks:** Every extra chunk adds an HTTP request. Target libraries that are (a) large and (b) only needed in admin. Recharts (~500 kB unminified) and @tanstack/react-table are the clear candidates in this project.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code splitting | Custom webpack/rollup config logic | Vite's built-in `build.rollupOptions.output.manualChunks` | Rollup handles module graph analysis, deduplication, and hashing correctly |
| Loading state | Custom loading detector | `React.lazy` + `Suspense` | React coordinates loading state with rendering; manual solutions have race conditions |
| Error recovery for chunk fetch | Custom fetch retry logic | ErrorBoundary class component + reset button | React's error boundary contract is the only reliable way to catch render-time errors |

**Key insight:** React.lazy + Suspense is the officially supported, zero-dependency mechanism for code splitting in React. Any alternative adds dependencies without solving additional problems in this project.

## Common Pitfalls

### Pitfall 1: Named exports with React.lazy

**What goes wrong:** `React.lazy` only accepts modules with a default export. Admin page components are default exports in this project, so this is not an issue currently — but if a future component uses a named export, `React.lazy(() => import('./Foo'))` will fail silently or throw.

**Why it happens:** The dynamic `import()` returns the whole module object; React.lazy expects `.default` on it.

**How to avoid:** All lazy-loaded components must have a default export. If a named-export component needs to be lazy-loaded, wrap it: `lazy(() => import('./Foo').then(m => ({ default: m.FooComponent })))`.

**Warning signs:** TypeScript error "Module has no exported member 'default'" or runtime "Element type is invalid" error.

### Pitfall 2: Suspense boundary too high (covers public routes)

**What goes wrong:** Placing `<Suspense>` at the `<RouterProvider>` level means the fallback can render while any route's chunk loads — including public routes.

**Why it happens:** Developers want "one Suspense to rule them all" for simplicity.

**How to avoid:** Keep the Suspense boundary scoped to the `/admin` subtree. Public routes (`MarketplacePage`) are static imports and never trigger Suspense.

**Warning signs:** Public Explorer page shows loading spinner on first visit.

### Pitfall 3: manualChunks circular dependency

**What goes wrong:** If `manualChunks` assigns module A to chunk X and module B to chunk Y, but A imports B (or vice versa), Rollup may emit a warning or produce incorrect output.

**Why it happens:** Splitting shared dependencies into separate chunks without accounting for their dependency graph.

**How to avoid:** Only split true leaf libraries — Recharts and @tanstack/react-table do not import each other or share internal modules with the admin app shell. The `vendor-react` chunk is safe because React is a pure leaf dependency.

**Warning signs:** Vite build warning "Circular dependency" or runtime "Cannot access before initialization" errors.

### Pitfall 4: White flash before dark admin UI

**What goes wrong:** The Suspense fallback has a white/light background, then the dark admin UI renders — jarring visual flash.

**Why it happens:** Default fallback components use white background or no background.

**How to avoid:** Match the fallback background to the admin app's background color (`bg-slate-950` / `#020617`).

### Pitfall 5: Sentry source map mismatch

**What goes wrong:** After splitting chunks, Sentry source map uploads may fail if chunk filenames change between builds.

**Why it happens:** manualChunks changes output filenames. Sentry's vite plugin already handles this correctly by running after Rollup output is finalized.

**How to avoid:** No action needed. The existing `sentryVitePlugin` in `vite.config.ts` uploads maps after the full build completes and is compatible with manualChunks. Keep `sourcemap: true` (already implied by Sentry plugin's `disable: !process.env.SENTRY_AUTH_TOKEN`).

## Code Examples

Verified patterns from official/current sources:

### Complete vite.config.ts (after change)

```typescript
// Source: Vite 7 docs + https://soledadpenades.com/posts/2025/use-manual-chunks-with-vite-to-facilitate-dependency-caching/
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@tanstack/react-table')) return 'vendor-table'
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
```

### main.tsx admin section (after change)

```typescript
// Source: https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/
import { lazy, Suspense } from 'react'

const AdminApp = lazy(() => import('./admin/AdminApp'))
const LoginPage = lazy(() => import('./admin/LoginPage'))
const RequireAuth = lazy(() => import('./admin/RequireAuth'))
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage'))
const GapsPage = lazy(() => import('./admin/pages/GapsPage'))
const LeadsPage = lazy(() => import('./admin/pages/LeadsPage'))
const ExpertsPage = lazy(() => import('./admin/pages/ExpertsPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const IntelligenceDashboardPage = lazy(() => import('./admin/pages/IntelligenceDashboardPage'))
const ToolsPage = lazy(() => import('./admin/pages/ToolsPage'))
const DataPage = lazy(() => import('./admin/pages/DataPage'))

function AdminLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950" role="status" aria-live="polite">
      <span className="text-slate-400 text-sm">Loading…</span>
    </div>
  )
}

// In createBrowserRouter:
{
  path: '/admin/login',
  element: (
    <Suspense fallback={<AdminLoadingFallback />}>
      <LoginPage />
    </Suspense>
  ),
},
{
  path: '/admin',
  element: (
    <Suspense fallback={<AdminLoadingFallback />}>
      <RequireAuth />
    </Suspense>
  ),
  children: [
    {
      element: <AdminApp />,
      children: [
        { index: true, element: <OverviewPage /> },
        { path: 'gaps', element: <GapsPage /> },
        { path: 'leads', element: <LeadsPage /> },
        { path: 'experts', element: <ExpertsPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'intelligence', element: <IntelligenceDashboardPage /> },
        { path: 'tools', element: <ToolsPage /> },
        { path: 'data', element: <DataPage /> },
        // Navigate redirects remain unchanged — no lazy needed
        { path: 'search-lab', element: <Navigate to="/admin/tools" replace /> },
        { path: 'score-explainer', element: <Navigate to="/admin/tools" replace /> },
        { path: 'index', element: <Navigate to="/admin/tools" replace /> },
        { path: 'searches', element: <Navigate to="/admin/data" replace /> },
        { path: 'marketplace', element: <Navigate to="/admin/data" replace /> },
      ],
    },
  ],
},
```

### Expected build output (after both changes)

Current: 1 chunk at 1,261 kB

Expected after changes:
```
dist/assets/index-[hash].js           ~50-100 kB   (public: React, router, MarketplacePage)
dist/assets/vendor-react-[hash].js    ~150 kB      (react + react-dom — stable, cached)
dist/assets/vendor-charts-[hash].js   ~400 kB      (recharts — loads only on admin visit)
dist/assets/vendor-table-[hash].js    ~80 kB       (@tanstack/react-table — loads only on admin visit)
dist/assets/admin-[hash].js           ~200 kB      (admin pages — auto-split by lazy imports)
```

Public users download only `index-[hash].js` + `vendor-react-[hash].js` on first visit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single bundle for all routes | React.lazy + Suspense per route subtree | React 16.6 (2018), standard by 2020 | Public bundle shrinks by ~80% in admin-heavy apps |
| Manual webpack chunk config | Vite manualChunks function in rollupOptions | Vite 2+ (2021) | Same result, much simpler config |
| @loadable/component for SSR | React.lazy built-in (for CSR) | React 18+ (2022 mainstream) | Zero extra dependency for CSR-only apps |

**Deprecated/outdated:**
- `React.lazy` + `React.Suspense` from `react-loadable`: `react-loadable` package is unmaintained; built-in `React.lazy` replaces it entirely for CSR.
- Webpack `splitChunks` optimization: irrelevant for this Vite project.

## Open Questions

1. **Should `vendor-react` chunk be split out?**
   - What we know: Separating `react` and `react-dom` into their own chunk enables long-term browser caching since React rarely updates between deployments
   - What's unclear: Whether the extra HTTP request is worth it given this app's traffic profile
   - Recommendation: Include it — the cache benefit is real and the implementation cost is zero (one additional `if` in manualChunks)

2. **Should individual admin pages be further split (per-page chunks)?**
   - What we know: Each admin page is a separate file; React.lazy already creates per-page chunks automatically when each page is its own lazy import
   - What's unclear: The CONTEXT.md says "how aggressively to split beyond required" is discretionary
   - Recommendation: The current approach (lazy per page) already achieves per-page splitting automatically. No extra work needed beyond the initial lazy conversion.

## Sources

### Primary (HIGH confidence)

- Vite 7 docs (build.rollupOptions.output.manualChunks is a Rollup API exposed in Vite config) — verified via build output
- React 19 built-in React.lazy and Suspense API — built into installed React version
- Actual build run on this project: confirmed 1,261 kB single bundle at `frontend/dist/assets/index-Cy69WYwB.js`

### Secondary (MEDIUM confidence)

- [Making My React App Feel Instant: Route-Level Code-Splitting with React.lazy, Suspense, and Vite manualChunks](http://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) — code examples verified against React/Vite docs
- [Taming Large Chunks in Vite + React](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/) — November 2025, current
- [Use manual chunks with Vite to facilitate dependency caching](https://soledadpenades.com/posts/2025/use-manual-chunks-with-vite-to-facilitate-dependency-caching/) — 2025, explains function form vs object form
- [React Router 7 Lazy Loading — Robin Wieruch](https://www.robinwieruch.de/react-router-lazy-loading/) — current, covers createBrowserRouter pattern

### Tertiary (LOW confidence)

- None — all claims verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — React.lazy/Suspense and Vite manualChunks are stable built-in APIs; confirmed with a live build on this project
- Architecture: HIGH — Pattern is straightforward; all admin components are default exports; no SSR complications; Sentry plugin is compatible
- Pitfalls: HIGH — Named export limitation is documented React behavior; white flash and circular dependency risks are standard Rollup/React concerns

**Research date:** 2026-02-27
**Valid until:** 2026-09-01 (stable built-in APIs; unlikely to change)
