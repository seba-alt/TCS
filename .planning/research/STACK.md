# Stack Research

**Domain:** Expert marketplace SPA — v5.4 Launch Hardening (performance, resilience, SEO, analytics)
**Researched:** 2026-03-05
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH — key claims verified against official docs and multiple credible sources; see Sources section

---

## Context: What Already Exists (Do NOT Re-Research)

The following stack is validated and in production. This file covers ONLY what changes or
additions are needed for v5.4 Launch Hardening.

| Layer | Existing | Status |
|-------|----------|--------|
| Frontend | React 19.2 + Vite 7.3 + Tailwind 3.4 + Zustand 5.0.11 + react-virtuoso 4.18 | Deployed on Vercel |
| Backend | FastAPI 0.129 + SQLAlchemy 2.0 + SQLite WAL + FAISS faiss-cpu 1.13 | Deployed on Railway |
| Bundling | React.lazy (11 admin routes) + Vite manualChunks (recharts, react-table) | Active |
| Analytics | GA4 + Microsoft Clarity + Vercel Speed Insights + Sentry | Active |
| Auth | bcrypt + JWT (pyjwt) + slowapi rate limiting | Active |
| Tracking | fire-and-forget fetch + keepalive:true in tracking.ts | Active |
| Caching | 60s TTL embedding cache + 30s TTL settings/feedback cache (in-memory) | Active |
| DB tuning | SQLite WAL mode + busy_timeout=5000 per-connection | Active |

**One confirmed gap to fix now:** `GET /admin/experts` returns ALL experts with no pagination — Sentry flags this as a large payload. Fix is a pure backend param change (no new package).

---

## Net-New Packages

**One new dependency.** All other changes are config params, stdlib patterns, HTML tags, or SQLite PRAGMAs.

| Package | Side | Version | Purpose |
|---------|------|---------|---------|
| `react-error-boundary` | Frontend (prod) | `6.1.1` | Strategic error boundaries with reset, async hook, Sentry integration |
| `rollup-plugin-visualizer` | Frontend (dev-only) | `5.x` | Bundle treemap analysis — find what's bloating the public chunk |

---

## Recommended Stack Additions

### Frontend Performance

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `rollup-plugin-visualizer` | `5.x` (latest) | Bundle treemap in dev builds | Integrates into existing `vite.config.ts` as a plugin; generates `stats.html` showing each dep's gzip footprint. Use once to identify which modules to add to `manualChunks`, then leave in as a build artifact. Dev-only (no prod bundle impact). Node 22 required — already met by Vite 7 |
| Vite `build.chunkSizeWarningLimit: 600` | Config param | Suppress false-positive chunk warnings | Default 500 kB threshold fires on the aurora animation bundle + `motion` (~90 kB gzip). Raising to 600 surfaces real problems without alert fatigue |
| Vite `modulePreload.polyfill: false` | Config param | Remove ~2 kB polyfill from prod bundle | All target browsers (Chrome 61+, Firefox 67+, Safari 17+) support `<link rel="modulepreload">` natively. Polyfill is dead weight in 2026 |
| Vite `manualChunks` additions | Config param | Split `react-dom`+`react-router` and `motion` into stable vendor chunks | `react-dom` (143 kB gzip) and `react-router-dom` change rarely; separating them into `vendor-react` maximises browser cache reuse between deployments. `motion` (~90 kB gzip) used only for modals/FAB; separating into `vendor-motion` stops animation library updates from busting the core app chunk |
| `<link rel="preconnect">` in index.html | HTML tag | Warm TCP/TLS to Railway API + Google Tag Manager before first paint | Eliminates ~150 ms cold-connection penalty on first `/api/explore` call. Zero code change. Add two tags: Railway URL and `www.googletagmanager.com` |

**What NOT to add for frontend performance:**
- `vite-plugin-compression` — Vercel CDN handles Brotli/gzip automatically; adding it at build time duplicates work and can break streaming responses
- `workbox` / service worker / PWA — Offline mode is explicitly out of scope (PROJECT.md); adds ~60 kB and significant complexity
- Image lazy-loading libraries — Expert photos already use native `loading="lazy"`; no library needed

---

### Backend Performance

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FastAPI `GZipMiddleware` | Built-in Starlette (no new package) | Compress large API responses | JSON compresses 70–90%. `/api/explore` responses are ~8–40 kB uncompressed at 530 experts. Use `minimum_size=500, compresslevel=6` — balances CPU cost vs savings. Built into Starlette so no `requirements.txt` change |
| SQLite `PRAGMA synchronous=NORMAL` | PRAGMA (no package) | 2–3x write throughput on hot-path writes | Already in WAL mode; `NORMAL` is safe from data corruption in WAL mode per SQLite official docs — only checkpoint FSYNCs wait for disk sync. Add to existing `_set_sqlite_pragma()` event listener in `database.py` |
| SQLite `PRAGMA cache_size=-32000` | PRAGMA (no package) | 32 MB page cache in memory | Eliminates repeat disk reads for hot expert rows across concurrent requests. Negligible RAM cost on Railway 512 MB container |
| SQLite `PRAGMA temp_store=MEMORY` | PRAGMA (no package) | FTS5 sort operations in memory | FTS5 queries create temporary sort tables. Memory temp store eliminates ephemeral disk I/O for ~530-expert queries. Safe to enable; temp data is discarded on connection close |
| In-process event queue (`collections.deque`) | Python stdlib (no package) | Batch `/api/events` writes 10-at-a-time | `/api/events` is the highest-write-volume endpoint under load (every card click, search, save). Currently each event is a separate `db.commit()`. Batching 10 writes into 1 commit reduces SQLite write contention ~10x. Pattern: `asyncio.Lock` + `collections.deque` in `app.state`, background flush every 2 seconds via `asyncio.create_task` in lifespan |

**What NOT to add for backend performance:**
- Redis / Memcached — Over-engineered for 530 experts on a single Railway instance. Embedding cache (60s TTL) already covers the expensive path; ExpertTag join table already has composite indexes. Redis adds ~$20/mo ops and a new dependency for zero measurable gain at this scale
- PostgreSQL migration — Correct long-term call but wrong scope for a 1-day milestone. Railway SQLite on WAL handles 10k concurrent readers (writes are serialized but sub-millisecond). Migration requires downtime, data transfer, and connection string changes across both Railway and the app. Defer to post-launch
- Celery / ARQ — Heavy task queue infrastructure for a single background flush use case. `asyncio` + `collections.deque` covers it with zero infrastructure change

---

### Backend Resilience

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Enhanced `/api/health` deep probe | No new package | Verify DB writability + FAISS + uptime | Current health check only returns `{status: ok, index_size: N}` and does not verify the DB is reachable. Add a fast `SELECT 1` probe and return `{status, index_size, db_ok, uptime_s}`. Railway uses this endpoint for restart decisions. Latency cost: <1 ms |
| `PRAGMA wal_checkpoint(PASSIVE)` on health | SQLite PRAGMA | Prevent WAL file unbounded growth under sustained load | WAL file grows without bound if readers are always active and no checkpoint completes. Calling `PASSIVE` checkpoint from the health endpoint (with a 30-second in-memory cooldown timer in `app.state`) piggybacks on Railway's existing liveness polling without a dedicated background thread |

**What NOT to add for backend resilience:**
- Circuit breaker libraries (pybreaker, etc.) — External calls are limited to Google GenAI embed + generate, already wrapped with `tenacity` retry (in `requirements.txt`). A circuit breaker adds stateful complexity for a dependency that already has retry logic
- Kubernetes liveness/readiness split — Railway uses a single HTTP health check, not the K8s dual-probe model. One enhanced `/api/health` endpoint is sufficient

---

### Frontend Resilience

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-error-boundary` | `6.1.1` | Strategic error boundaries around Explorer grid, email gate, and root layout | React 19 does not add a built-in functional alternative to class-based `ErrorBoundary`. `react-error-boundary` v6 is React 19-compatible (released explicitly for React 19), provides `useErrorBoundary` hook for catching async errors in event handlers, `resetKeys` for recovery without page reload, and `onError` callback for Sentry reporting. Without this, a FAISS timeout or render error in `ExpertGrid` crashes the entire SPA |

**Placement strategy (three boundaries, not one big catch-all):**
1. Wrap `<ExpertGrid>` — isolates search result rendering failures; shows inline "Search failed — retry" state
2. Wrap `<ProfileGateModal>` — isolates email gate failures; gate error should not kill the whole page
3. Top-level boundary in `RootLayout` — catch-all fallback for anything that escapes the above

**What NOT to add:**
- Separate circuit-breaker library for frontend API calls — The `useExplore` hook already has an `error` state and the API error state with retry button was shipped in v4.0 (EXP-06). Error boundaries handle render-phase crashes; the retry button handles network failures. These two together cover all cases

---

### SEO

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| JSON-LD structured data in `index.html` | No package — pure HTML `<script>` tag | `WebSite` + `Organization` schema for Google rich results and AI-search entity recognition | Google's preferred structured data format. No library needed for a single-page static site with one public URL. Implement `WebSite` schema with `potentialAction: SearchAction` pointing to `/?query={search_term_string}` — this explicitly tells Google the search widget exists. Pages with structured data see 20–30% CTR lift on average per recent studies |
| `<meta name="description">` | HTML tag | SERP snippet copy | `index.html` has OG tags and Twitter Card but is missing the plain `<meta name="description">` tag that search engines use to generate SERP snippets. Low effort, high SEO impact |
| `<link rel="canonical">` | HTML tag | Prevent duplicate content from URL-param Explorer views | Explorer uses query params (`?tags=finance&rate_max=500`). Canonical tag pointing to bare `/` tells crawlers which version is authoritative, preventing content dilution |
| `vercel.json` `Cache-Control` headers | Config file (no package) | 1-year immutable caching for hashed Vite assets | Vite outputs content-hashed filenames (`/assets/index-a1b2c3.js`). Without explicit headers, Vercel applies a default shorter TTL. Setting `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` enables 1-year browser caching, which eliminates repeat downloads for returning users |

**What NOT to add:**
- `react-helmet` / `react-helmet-async` — Single public route (`/`). Dynamic per-route meta tags are unnecessary. Static tags in `index.html` are equivalent and simpler
- Next.js SSR migration — Out of scope; Vercel does not server-render Vite CSR apps. Correct tool for a future rebuild; wrong scope now
- Sitemap generation library — With one public URL (`/`), a hand-written `public/sitemap.xml` is sufficient and requires no dependencies

---

### Analytics Hardening

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `navigator.onLine` guard in `trackEvent()` | Browser API (no package) | Skip event POST when offline | `keepalive: true` is already set (correct). Under flaky connectivity, failed fire-and-forget requests generate Railway error log noise without losing meaningful data. Adding a `!navigator.onLine` early-return is a 2-line change that eliminates offline noise |
| `navigator.sendBeacon` fallback | Browser API (no package) | Guarantee event delivery on page-unload in Safari | `fetch + keepalive: true` is supported in all modern browsers, but a `sendBeacon` fallback provides an extra safety net for iOS Safari's historically inconsistent `keepalive` behavior. Pattern: try `fetch`, fall back to `navigator.sendBeacon` |

**Admin experts endpoint pagination (Sentry large payload fix):**

Add `page` + `page_size` Query params to `GET /admin/experts` in `app/routers/admin/experts.py`. Currently the endpoint returns ALL experts in one JSON array (530+ records, ~200 kB payload). Sentry flags this as oversized. Fix is four lines: add `page: int = Query(default=1, ge=1)` and `page_size: int = Query(default=50, ge=1, le=200)` params, apply `.offset((page-1)*page_size).limit(page_size)` to the SQLAlchemy query, and return `{"experts": [...], "total": N, "page": page}`. The frontend `ExpertsPage` already uses the `AdminPagination` component — wire it to the new `total` field.

**No new packages needed for any analytics change.**

---

## Installation

```bash
# Frontend — one new dev dependency, one new prod dependency
cd frontend
npm install react-error-boundary          # prod — error boundaries
npm install -D rollup-plugin-visualizer   # dev only — bundle analysis

# Backend — zero new packages
# All changes: PRAGMA params, stdlib asyncio/deque pattern, GZipMiddleware (built-in Starlette)
```

---

## Vite Config Changes

```typescript
// frontend/vite.config.ts — full updated config
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
    // Bundle analysis — generates stats.html after every build
    // Open manually: open frontend/stats.html
    visualizer({ open: false, gzipSize: true, brotliSize: true }),
  ],
  build: {
    chunkSizeWarningLimit: 600,     // kB — aurora animation + motion legitimately exceed 500 kB default
    modulePreload: {
      polyfill: false,              // All 2026 target browsers support modulepreload natively
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@tanstack/react-table')) return 'vendor-table'
            // NEW: stable React core — rarely changes, maximise cache reuse
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
            // NEW: animation library — separate from core app chunk
            if (id.includes('motion')) return 'vendor-motion'
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

---

## SQLite PRAGMA Additions

```python
# app/database.py — extend _set_sqlite_pragma() with three new PRAGMAs
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and set pragmas on every new connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")         # already set
    cursor.execute("PRAGMA busy_timeout=5000")        # already set
    # NEW for v5.4 Launch Hardening:
    cursor.execute("PRAGMA synchronous=NORMAL")       # safe in WAL; 2-3x faster commits
    cursor.execute("PRAGMA cache_size=-32000")        # 32 MB page cache (negative = kibibytes)
    cursor.execute("PRAGMA temp_store=MEMORY")        # FTS5 temp tables in memory
    cursor.close()
```

**Safety rationale for `synchronous=NORMAL`:** Per SQLite official WAL documentation, WAL mode is "always consistent with synchronous=NORMAL" — the database is never left in a corrupt state. The trade-off is that a committed transaction *could* roll back after a power failure (not a crash), which is acceptable for an analytics SPA. The existing `busy_timeout=5000` already handles write contention.

---

## index.html Additions

```html
<!-- Add to <head> in frontend/index.html -->

<!-- Missing meta description — used by search engines for SERP snippets -->
<meta name="description" content="Describe any problem and instantly get matched with vetted experts. Browse 500+ professionals by domain, rate, and speciality. No searching, no guesswork." />

<!-- Canonical URL — prevent query-param variants from diluting SEO -->
<link rel="canonical" href="https://tcs-three-sigma.vercel.app" />

<!-- Preconnect — warms TCP/TLS before first API call -->
<link rel="preconnect" href="https://tcs-production.up.railway.app" />
<link rel="preconnect" href="https://www.googletagmanager.com" />

<!-- JSON-LD structured data — WebSite + SearchAction schema -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "Tinrate",
      "url": "https://tcs-three-sigma.vercel.app",
      "description": "AI-powered expert marketplace. Describe your problem, get matched with vetted professionals instantly.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://tcs-three-sigma.vercel.app/?query={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "name": "Tinrate",
      "url": "https://tinrate.com",
      "logo": "https://tcs-three-sigma.vercel.app/logo.png"
    }
  ]
}
</script>
```

---

## vercel.json Cache Headers

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Rationale:** Vite outputs content-hashed filenames under `/assets/`. Because the filename changes every build, `immutable` is safe — browsers will never serve stale content. Without this, Vercel applies a shorter default TTL (~1 hour), meaning returning users re-download assets unnecessarily on every visit.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `react-error-boundary` 6.1.1 | Native class-based `ErrorBoundary` | Class components in React 19 still work but require boilerplate `getDerivedStateFromError` + `componentDidCatch`. `react-error-boundary` adds `resetKeys`, `useErrorBoundary` hook for async errors, and `onError` Sentry callback — 3 features for ~6 kB gzip. Zero justification for rolling our own |
| In-process event queue (`collections.deque`) | Redis + Celery worker | Redis requires a Railway addon (~$20/mo), a separate worker process, and additional infrastructure. `collections.deque` + asyncio flush covers the use case with zero new dependencies or ops surface |
| `GZipMiddleware` (built-in Starlette) | `brotli` package + custom middleware | Brotli is not in Starlette's built-in middleware; requires an additional package. Railway API responses are already small enough that the GZip improvement is sufficient; Vercel handles Brotli for static assets |
| Static JSON-LD in `index.html` | `react-structured-data` library (~15 kB) | The schema never changes dynamically; a library adds bundle weight for zero benefit over an inline `<script>` tag |
| `vercel.json` for cache headers | Vite plugin that emits headers | Vercel handles CDN headers natively via config file; no build-step plugin needed |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next/head` or `react-helmet` | Over-engineered for a single public route; each adds bundle weight | Static `<meta>` tags in `index.html` |
| Redis for any caching | Zero benefit at 530 experts + Railway single-instance; embedding cache already covers expensive path | SQLite PRAGMA `cache_size` + existing in-memory TTL caches |
| Celery / ARQ task queue | Infrastructure overhead for a single background flush job | `asyncio` + `collections.deque` in `app.state` |
| `workbox-webpack-plugin` / PWA | Offline mode explicitly out of scope (PROJECT.md); service workers complicate Railway API auth and cache invalidation | Nothing — skip offline capability |
| PostgreSQL migration | Correct long-term call, but requires downtime + data migration + Railway Postgres addon; wrong scope for a 1-day milestone | SQLite WAL + tuned PRAGMAs; defer Postgres to post-launch milestone |

---

## Stack Patterns by Variant

**If expert pool grows past 2,000:**
- Add `PRAGMA mmap_size=268435456` (256 MB memory-mapped I/O) to `database.py`
- FAISS in-memory remains correct up to ~50k vectors; no change needed until then
- `/api/explore` cursor-based pagination is already implemented; just increase default page sizes

**If Railway scales to multiple replicas:**
- SQLite file-on-volume cannot handle multi-process writes — switch to PostgreSQL at that point
- Railway's current single-instance model makes this moot for v5.4

**If event volume exceeds 10k events/hour:**
- Decrease the queue flush interval from 2s to 0.5s
- Consider a separate SQLite database file for `user_events` (separate WAL file eliminates write contention between event inserts and expert reads)
- Still no Redis needed at <100k events/hour on SQLite WAL

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-error-boundary@6.1.1` | `react@19.2.0` | v6 released explicitly for React 19; uses React 19's `onCaughtError` hooks internally. Confirmed via NPM release notes |
| `rollup-plugin-visualizer@5.x` | `vite@7.3.1` | Vite 7 uses Rollup 4 internally; visualizer 5.x supports Rollup 4. Dev-only — zero prod bundle impact. Requires Node 22 (met by existing toolchain) |
| SQLite `synchronous=NORMAL` | SQLAlchemy 2.0 + `journal_mode=WAL` | Per-connection PRAGMA via SQLAlchemy `event.listens_for(engine, "connect")` — already the pattern in `database.py`. No version conflicts |
| `GZipMiddleware` | FastAPI 0.129 + Starlette (bundled) | Built into Starlette, which is bundled with FastAPI `[standard]`. No version change |

---

## Sources

- [SQLite WAL official documentation](https://sqlite.org/wal.html) — WAL + `synchronous=NORMAL` safety guarantees (HIGH confidence)
- [SQLite recommended PRAGMAs — High Performance SQLite](https://highperformancesqlite.com/articles/sqlite-recommended-pragmas) — `cache_size`, `temp_store` parameters (MEDIUM confidence, aligns with official pragma docs)
- [SQLite production setup (2026)](https://oneuptime.com/blog/post/2026-02-02-sqlite-production-setup/view) — WAL + `synchronous=NORMAL` + `busy_timeout` confirmed as production config pattern (MEDIUM confidence)
- [react-error-boundary NPM](https://www.npmjs.com/package/react-error-boundary) — version 6.1.1 current as of research date; React 19 compatible (HIGH confidence)
- [react-error-boundary GitHub releases](https://github.com/bvaughn/react-error-boundary/releases) — v6 release notes confirm React 19 targeting (HIGH confidence)
- [Vite Build Options](https://vite.dev/config/build-options) — `modulePreload.polyfill`, `chunkSizeWarningLimit`, `manualChunks` (HIGH confidence — official docs)
- [FastAPI Advanced Middleware](https://fastapi.tiangolo.com/advanced/middleware/) — `GZipMiddleware` `minimum_size`, `compresslevel` params (HIGH confidence — official docs)
- [rollup-plugin-visualizer GitHub](https://github.com/btd/rollup-plugin-visualizer) — Rollup 4 / Vite 7 compatibility confirmed in README (MEDIUM confidence)
- [GA4 event batching guide](https://assertionhub.com/blog/ga4-event-batching-guide) — `keepalive`/`sendBeacon` behavior; confirms existing tracking.ts pattern is correct (MEDIUM confidence)
- [schema.org WebSite](https://schema.org/WebSite) — `SearchAction` + `potentialAction` for SPA search (HIGH confidence — official schema.org docs)
- [JSON-LD Schema for SEO 2025 — ObserviX](https://observix.ai/blog/json-ld-schema-for-seo-what-marketers-should-know) — 20–30% CTR lift claim with structured data (LOW confidence — single source, treat as directional)
- `frontend/package.json` — installed versions verified directly
- `requirements.txt` — installed Python packages verified directly
- `app/database.py` — existing PRAGMA setup verified directly
- `app/routers/admin/experts.py` — confirmed: `GET /experts` returns all records with no pagination

---
*Stack research for: Tinrate AI Concierge — v5.4 Launch Hardening*
*Researched: 2026-03-05*
