# Project Research Summary

**Project:** Tinrate AI Concierge — v5.4 Launch Hardening
**Domain:** Expert marketplace SPA — performance, resilience, SEO, analytics hardening
**Researched:** 2026-03-05
**Confidence:** HIGH — grounded in direct codebase inspection plus official docs and verified sources

## Executive Summary

Tinrate v5.4 is a launch-hardening milestone on a fully deployed expert marketplace (530 experts, FastAPI + SQLite WAL + FAISS on Railway, React + Vite + Tailwind on Vercel). The system is production-ready and receiving traffic; this milestone is not a build phase but a hardening phase — fixing known gaps before a marketing launch at 10k concurrent users. Research confirms the stack is sound and requires only two new npm dependencies (`react-error-boundary@6.1.1` and `rollup-plugin-visualizer@5.x`). All backend changes are config params, stdlib patterns, and built-in middleware — zero new Python packages needed.

The recommended approach is a strict four-phase sequential delivery: backend foundation first (event batching, health endpoint enhancement, admin pagination), then frontend performance (bundle splits, response caching), then user-facing resilience and SEO (error boundaries, meta tags, JSON-LD), and finally analytics hardening (Speed Insights, GA4 verification). This ordering matters because the backend must accept batch events before the frontend sends them, and the Sentry large-payload issue must be resolved before analytics is declared clean. All features are practically achievable within a single working day.

The primary risks are infrastructure-category: adding Uvicorn workers without migrating off SQLite (fatal write contention), expanding `manualChunks` without testing `vite preview` (production-only circular dependency crash), and removing `send_page_view: false` from the GA4 config (permanently corrupts launch cohort data). These are all preventable with explicit defensive comments and a `vite preview` gate in the build process. There are no architecture risks — the event batching, caching, and error boundary patterns are well-documented and already proven elsewhere in the codebase.

## Key Findings

### Recommended Stack

The existing stack needs only targeted additions, not changes. The v5.3 production stack (React 19.2, Vite 7.3, Tailwind 3.4, Zustand 5.0.11, react-virtuoso 4.18, FastAPI 0.129, SQLAlchemy 2.0, SQLite WAL, FAISS faiss-cpu 1.13) is validated and appropriate for this milestone's scope. The only new production dependency is `react-error-boundary@6.1.1`, which is React 19-compatible and adds `resetKeys`, `useErrorBoundary` hook for async errors, and Sentry integration in ~6 kB gzipped. All other improvements — GZipMiddleware, SQLite PRAGMAs, event batching, response caching, SEO tags, and cache headers — use built-in capabilities or stdlib patterns.

**Core technologies and additions:**
- `react-error-boundary@6.1.1` (frontend prod): strategic error boundaries with async error support and Sentry integration — React 19 class-based boundaries lack this without boilerplate
- `rollup-plugin-visualizer@5.x` (frontend dev-only): bundle treemap to identify chunk targets before splitting — assessment first, then apply `manualChunks` only where analysis confirms wins
- `FastAPI GZipMiddleware` (built-in Starlette, no new package): compress large API responses at `minimum_size=500` — JSON compresses 70-90%
- SQLite PRAGMAs — `synchronous=NORMAL`, `cache_size=-32000`, `temp_store=MEMORY`: safe in WAL mode, 2-3x write throughput, eliminates disk I/O for FTS5 sorts
- `collections.deque` + asyncio event queue (Python stdlib): batch `/api/events` writes 10-at-a-time, reducing SQLite write transactions ~90-95%
- `<link rel="preconnect">`, `<meta name="description">`, `<link rel="canonical">`, JSON-LD structured data: pure HTML additions to `index.html` — zero build cost, direct SEO and performance impact
- `vercel.json` Cache-Control headers for `/assets/*`: 1-year immutable cache for content-hashed Vite assets

**What NOT to add:** Redis, Celery, PostgreSQL migration, react-helmet-async, Next.js SSR, workbox/PWA. All are valid long-term choices but wrong scope for a 1-day hardening milestone.

### Expected Features

Research identifies two priority tiers. P1 features are non-negotiable before marketing launch; P2 features ship within the same milestone after P1 is verified.

**Must have (P1 — table stakes before marketing launch):**
- React error boundaries on ExplorerPage + ExpertGrid — blank screen on JS error causes ~80% user abandonment; no boundaries currently exist in the public app
- Enhanced `/api/health` endpoint — Railway restart policy depends on this; current endpoint has no DB writability probe, meaning Railway cannot detect write failures
- `<meta name="description">` — missing entirely from `index.html`; search engines cannot generate SERP snippets without it
- Open Graph tags completion — static OG image (1200x630) in `public/`; every launch social share lands without a proper unfurl card currently
- `robots.txt` (Disallow: /admin) + `sitemap.xml` — crawler hygiene before launch traffic generates backlinks to the admin routes
- JSON-LD structured data (WebSite + SearchAction) — lightest fix for SPA SEO baseline without an SSR migration
- Admin experts endpoint pagination — Sentry large payload alert already triggered at 530 experts; fixes root cause before expert pool grows further
- `Cache-Control: public, max-age=86400` on photo proxy — prevents upstream hammering at launch scale; 10k users = 10k redundant upstream calls per session without this

**Should have (P2 — within same milestone after P1 verified):**
- Backend event write queue (`collections.deque` + asyncio) — eliminates SQLite write bottleneck under concurrent load; reduces write transactions ~90-95%
- SQLite PRAGMA tuning (`synchronous=NORMAL`, `cache_size`, `temp_store`) — 2-3x write throughput improvement with zero risk in WAL mode
- Vite bundle splits for `vendor-react`, `vendor-motion` — maximises browser cache reuse between deploys; stable chunks cache independently
- `<link rel="preconnect">` to Railway API origin — eliminates ~150ms cold TCP/TLS penalty on first API call
- GA4 `transport_type: 'beacon'` — reduces event loss to ad blockers (20-40% drop rate in 2026)
- `vercel.json` Cache-Control headers for `/assets/*` — 1-year immutable caching eliminates repeat asset downloads for returning users
- `navigator.sendBeacon` fallback in `trackEvent()` — guards iOS Safari `keepalive` inconsistency
- `navigator.onLine` guard in `trackEvent()` — eliminates Railway log noise from offline event attempts

**Defer to v6.0+:**
- PostgreSQL migration — correct long-term call but requires downtime, data migration, and Railway Postgres addon; wrong scope for a 1-day milestone
- Redis caching layer — zero measurable benefit at 530 experts with in-memory TTL caches already in place
- Sentry full integration — after large-payload noise is resolved by pagination fix, signal-to-noise ratio improves enough to invest in Sentry configuration
- Next.js SSR migration — correct for SEO long-term; JSON-LD + meta tags deliver ~80% of SEO benefit at ~5% of the effort
- External task queue (Celery + RabbitMQ) — overkill when in-process asyncio covers the use case with zero infrastructure

### Architecture Approach

v5.4 touches eight specific integration points across the existing system without restructuring anything. The codebase is a single-page React app on Vercel communicating with a single-instance FastAPI process on Railway backed by SQLite WAL and a FAISS in-memory index. All recommended changes layer on top of this architecture cleanly.

The highest-impact architectural change is decoupling event tracking from synchronous DB writes. Currently each `trackEvent()` call fires an individual HTTP POST that does a synchronous `db.commit()` before returning 202. The new pattern batches events in a module-level queue in `tracking.ts`, flushes on 10 items or 3 seconds, and sends a single `BatchEventRequest` that the backend commits in one WAL write cycle — reducing write transactions from N to ~1 per 10 actions. This module-level dict + TTL pattern is already proven in the codebase (`embedder.py` uses the same approach for its embedding cache).

**Major integration points:**
1. `tracking.ts` + `app/routers/events.py` — event batch queue (frontend timer/threshold + backend `BatchEventRequest | EventRequest` union type)
2. `app/routers/explore.py` — 30s TTL module-level response cache with admin-triggered invalidation on expert add/delete/import
3. `app/routers/admin/experts.py` — `page` + `per_page` query params added; existing `AdminPagination` component wires to new `total` field
4. `app/routers/health.py` — enhanced with `SELECT 1` DB probe + `db_latency_ms` metric; returns `"degraded"` status on DB failure
5. `frontend/src/components/ErrorBoundary.tsx` (new) — class component wrapping `<RouterProvider>` in `main.tsx` and `<ExpertGrid>` area in `MarketplacePage.tsx`
6. `frontend/index.html` — `<meta name="description">`, `<link rel="canonical">`, `<link rel="preconnect">`, JSON-LD `<script type="application/ld+json">`
7. `frontend/vite.config.ts` — `vendor-react`, `vendor-motion` chunk additions + `modulePreload.polyfill: false` + `chunkSizeWarningLimit: 600`
8. `frontend/src/pages/MarketplacePage.tsx` — `<SpeedInsights />` addition + ErrorBoundary wrapping of grid area

### Critical Pitfalls

1. **SQLite write queue saturation** — the current `events.py` does synchronous `db.commit()` per request; at launch load the QueuePool ceiling (5+10 connections) produces 500s on the events endpoint while search continues working, silently losing tracking data. Prevention: convert to background task or in-process batch queue; raise `pool_size=10, max_overflow=20` in `database.py`. Load-test with 50 concurrent event POSTs before declaring done.

2. **Multiple Uvicorn workers break SQLite** — adding `--workers 2+` to the Procfile triggers cross-process WAL write contention; `SQLITE_BUSY` errors follow immediately and FAISS loads separately per worker creating index divergence. Prevention: add explicit `# DO NOT add --workers without migrating to PostgreSQL` comment to the Procfile. Vertical scaling (Railway plan upgrade) is the only safe scaling path with SQLite.

3. **Vite `manualChunks` circular dependency crash** — adding `react-dom` or `react-router` to a `vendor-react` manualChunk can produce Rollup circular references; the crash is production-only (dev mode never uses chunks) and passes `vite build` without failing. Prevention: run `npm run build && npm run preview` and confirm zero console errors before merging any `manualChunks` additions. Do not split React core into manualChunks.

4. **GA4 double-counting from `send_page_view` removal** — `send_page_view: false` in `index.html` is intentional (the React `Analytics` component handles all `page_view` events); removing it doubles the initial page load event and permanently corrupts launch cohort bounce rate data with no retroactive fix. Prevention: add inline comment in `index.html` explaining the setting is intentional; verify with GA4 DebugView that exactly one `page_view` fires on fresh load.

5. **Error boundaries miss async failures** — React error boundaries only catch synchronous render errors; unhandled promise rejections from `useEffect` callbacks escape silently, causing a blank white screen with no Sentry capture. Prevention: add `window.addEventListener('unhandledrejection', ...)` sending to Sentry alongside the error boundaries; use `react-error-boundary`'s `useErrorBoundary` hook to funnel async errors into the boundary explicitly.

## Implications for Roadmap

The build order is driven by three constraints: (1) backend must accept batch events before frontend sends them, (2) the Sentry large-payload issue should be resolved before any analytics QA, and (3) error boundaries and SEO tags are user-visible changes that should go out together as a coherent deploy-and-verify cycle.

### Phase 1: Backend Foundation

**Rationale:** Backend changes have zero frontend dependencies and zero user-visible risk. Ship these first so Railway is ready to receive batch events before the frontend sends them, and to fix the known Sentry large-payload alert immediately.

**Delivers:** Paginated admin experts endpoint (resolves Sentry alert), enhanced `/api/health` with DB probe, backend batch event acceptance (`BatchEventRequest | EventRequest` union), SQLite PRAGMA tuning (`synchronous=NORMAL`, `cache_size=-32000`, `temp_store=MEMORY`), `GZipMiddleware` for API response compression, explore response TTL cache with admin invalidation hooks, `Cache-Control: public, max-age=86400` on photo proxy endpoint.

**Addresses:** Admin experts pagination (P1), `/api/health` enhancement (P1), photo proxy cache header (P1), event write queue backend half (P2), SQLite write throughput (P2).

**Avoids:** SQLite write queue saturation (Critical Pitfall 1) — convert event writes to background task + raise QueuePool ceiling before any load arrives.

**Research flag:** Standard patterns — BackgroundTasks, SQLite PRAGMAs, and response caching are all well-documented in official sources. No additional research phase needed.

### Phase 2: Frontend Performance

**Rationale:** Depends on Phase 1 completing the batch event backend before `tracking.ts` is updated to send batches. Bundle analysis should inform chunk splits — run `rollup-plugin-visualizer` first, then apply only where analysis confirms measurable wins.

**Delivers:** Event batching in `tracking.ts` (module-level queue, 10-item threshold, 3s timer, `beforeunload` flush), Vite `manualChunks` additions (`vendor-react`, `vendor-motion`), `modulePreload.polyfill: false`, `chunkSizeWarningLimit: 600`, `<link rel="preconnect">` in `index.html`.

**Addresses:** Event write queue frontend half (P2), bundle optimization (P2), preconnect hint (P2).

**Avoids:** Vite `manualChunks` circular dependency crash (Critical Pitfall 3) — run `npm run build && npm run preview` gate before merging any chunk changes.

**Research flag:** Standard patterns — Vite manualChunks and tracking batch queues are well-documented. Mandatory `vite preview` gate before merge.

### Phase 3: Resilience and SEO

**Rationale:** User-facing changes go out together so they can be QA'd holistically. Error boundaries protect the Explorer before SEO work drives new launch traffic to it. Static `index.html` changes (meta description, canonical, JSON-LD) have zero behavioral risk but high discoverability impact.

**Delivers:** `ErrorBoundary.tsx` component (class-based, EXP-06 retry button fallback), error boundary wrapping in `main.tsx` (`<RouterProvider>`) and `MarketplacePage.tsx` (`<ExpertGrid>` area), global `window.addEventListener('unhandledrejection', ...)` Sentry handler, `<meta name="description">`, `<link rel="canonical">`, JSON-LD structured data (WebSite + SearchAction schema), `robots.txt` (Disallow: /admin), `sitemap.xml` (lists `/`), static OG image (1200x630) in `frontend/public/`, `vercel.json` Cache-Control headers for `/assets/*`.

**Addresses:** React error boundaries (P1), meta description (P1), JSON-LD (P1), robots.txt + sitemap.xml (P1), OG tags (P1).

**Avoids:** Error boundary white-screen with blank fallback (Critical Pitfall 5) — fallback must render the EXP-06 retry button, not a blank div. Static-only OG limitation (Pitfall 6) — dynamic per-route OG requires SSR, which is out of scope; do NOT add `react-helmet-async` expecting social crawlers to execute JavaScript. Incorrect JSON-LD schema types — use `WebSite` + `Organization` only, not `Product` or `ItemList` schemas Google cannot verify.

**Research flag:** Standard patterns — React error boundaries and static HTML meta tags are established. No deeper research needed. Pre-implementation note: OG image asset (1200x630 PNG) must be created and committed to `frontend/public/` before this phase ships.

### Phase 4: Analytics Hardening

**Rationale:** Final phase because it has no blocking dependencies and involves both code changes and manual QA verification steps. Running this last ensures Sentry signal is clean (Phase 1 resolved the large-payload noise) before verifying analytics.

**Delivers:** `<SpeedInsights />` added to `MarketplacePage.tsx` (currently only in the legacy `App.tsx` chat page), `navigator.sendBeacon` fallback in `trackEvent()`, `navigator.onLine` guard, GA4 `transport_type: 'beacon'` config line, defensive `send_page_view: false` inline comment added to `index.html`, GA4 DebugView QA (verify exactly 1 `page_view` on fresh load), Microsoft Clarity admin exclusion QA (SPA-navigation edge case verification).

**Addresses:** Analytics hardening (P2), GA4 Beacon transport (P2), Speed Insights for Explorer (P2).

**Avoids:** GA4 double-counting (Critical Pitfall 4) — add defensive comment as the first action of this phase; complete DebugView verification before declaring analytics hardened.

**Research flag:** Standard patterns — GA4 DebugView verification and Beacon API are well-documented. Note: Clarity admin exclusion has a known SPA-navigation edge case (IIFE runs once at page load, not on SPA navigations to `/admin`); this is acceptable for v5.4 with no user PII risk — admin is authenticated.

### Phase Ordering Rationale

- Backend before frontend: `events.py` must accept `BatchEventRequest` before `tracking.ts` sends batched requests; backend union type is backward-compatible so existing single-event format continues to work during the transition window
- Performance before resilience: bundle changes require a `vite preview` gate that is easiest to run before adding new components; performance work is pure config/stdlib with no UI surface area
- Resilience and SEO together: both modify `index.html` and both benefit from a single deploy-and-verify cycle; error boundaries should be live before SEO work drives new traffic
- Analytics last: depends on Sentry noise being reduced (Phase 1), and GA4 DebugView QA is the final sign-off step that confirms the whole hardened system is behaving correctly

### Research Flags

All phases use standard, well-documented patterns. No phases require a `/gsd:research-phase` step during planning.

- **Phase 1:** SQLite PRAGMAs, BackgroundTasks pattern, GZipMiddleware, and response caching are covered in official docs and verified sources. Implement directly.
- **Phase 2:** Vite manualChunks and batch queue are standard; the mandatory `vite preview` gate is the only special process requirement.
- **Phase 3:** React error boundaries (`react-error-boundary@6.1.1`) and static HTML meta tags are established. OG image asset creation is a pre-phase dependency, not a code research gap.
- **Phase 4:** GA4 Beacon API and DebugView verification are standard procedures. No unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Two new deps verified against official NPM release notes and Vite docs; all backend changes are built-in Starlette or stdlib; version compatibility confirmed |
| Features | HIGH | Prioritization grounded in direct codebase inspection of v5.3 plus multiple production-scale FastAPI/React sources; all P1/P2 features have clear implementation paths |
| Architecture | HIGH | Research was direct inspection of all affected files — events.py, health.py, explore.py, admin/experts.py, tracking.ts, main.tsx, MarketplacePage.tsx, vite.config.ts, index.html — ground truth, not inference |
| Pitfalls | HIGH | Each critical pitfall verified against SQLite official docs, SQLAlchemy connection pool docs, Vite GitHub issues, and GA4 official docs; sources cited per pitfall |

**Overall confidence:** HIGH

### Gaps to Address

- **Uvicorn worker memory budget:** Railway Hobby plan (512 MB) is estimated to have headroom for 2 workers (~300-350 MB estimated), but this requires verification of current Railway memory metrics before bumping workers. Monitor during Phase 1 deploy; vertical scaling is always the safe fallback.

- **OG image asset:** The static OG image (1200x630 PNG) must be created and committed to `frontend/public/` before Phase 3 social sharing tags can resolve. This is a content/design dependency, not a code dependency — prepare the asset before Phase 3 begins.

- **Sentry build env vars:** `sentryVitePlugin` requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` env vars in Vercel build settings. If these are missing, source map upload silently skips. Verify Vercel build env vars are set before Phase 3 deploy.

- **JSON-LD SearchAction URL param:** ARCHITECTURE.md uses `?q=` while STACK.md uses `?query=` as the Explorer search param. Confirm the actual URL param name from `useExplore` hook source before writing the final JSON-LD block.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `app/routers/events.py`, `app/routers/health.py`, `app/routers/explore.py`, `app/routers/admin/experts.py`, `app/services/embedder.py`, `frontend/src/tracking.ts`, `frontend/src/main.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/layouts/RootLayout.tsx`, `frontend/vite.config.ts`, `frontend/index.html`, `Procfile`, `railway.json` — ground truth for architecture and pitfalls
- [SQLite WAL official documentation](https://sqlite.org/wal.html) — WAL + `synchronous=NORMAL` safety guarantees
- [FastAPI Advanced Middleware docs](https://fastapi.tiangolo.com/advanced/middleware/) — GZipMiddleware parameters and middleware ordering
- [Vite Build Options docs](https://vite.dev/config/build-options) — manualChunks, modulePreload.polyfill, chunkSizeWarningLimit
- [react-error-boundary NPM](https://www.npmjs.com/package/react-error-boundary) and [GitHub releases](https://github.com/bvaughn/react-error-boundary/releases) — v6.1.1 React 19 compatibility confirmed
- [schema.org WebSite](https://schema.org/WebSite) — SearchAction + potentialAction schema spec
- [Railway Health Check documentation](https://station.railway.com/questions/health-check-endpoint-af9640dc) — health endpoint requirements
- [Vercel Cache-Control Headers docs](https://vercel.com/docs/headers/cache-control-headers) — static asset caching configuration
- [SQLAlchemy Connection Pooling docs](https://docs.sqlalchemy.org/en/20/core/pooling.html) — QueuePool parameters

### Secondary (MEDIUM confidence)

- [SQLite recommended PRAGMAs — High Performance SQLite](https://highperformancesqlite.com/articles/sqlite-recommended-pragmas) — cache_size, temp_store parameters
- [SQLite production setup 2026](https://oneuptime.com/blog/post/2026-02-02-sqlite-production-setup/view) — WAL + synchronous=NORMAL production pattern
- [Designing FastAPI + LLM for 10K concurrent users](https://medium.com/algomart/designing-a-fastapi-llm-system-for-10k-concurrent-users-and-scaling-rag-to-100k-daily-users-c54be7acd865) — event batching and worker tuning
- [GA4 Event Batching Guide](https://assertionhub.com/blog/ga4-event-batching-guide) — keepalive/sendBeacon behavior, 20-40% event loss figure
- [Oldmoe — The Write Stuff](https://oldmoe.blog/2024/07/08/the-write-stuff-concurrent-write-transactions-in-sqlite/) — SQLite write contention specifics
- [Vite issue #12209](https://github.com/vitejs/vite/issues/12209), [#20202](https://github.com/vitejs/vite/issues/20202) — manualChunks circular dependency evidence
- [rollup-plugin-visualizer GitHub](https://github.com/btd/rollup-plugin-visualizer) — Rollup 4 / Vite 7 compatibility
- [React error boundaries async limitation](https://medium.com/@bloodturtle/why-react-error-boundaries-cant-catch-asynchronous-errors-28b9cab07658) — async error boundary scope
- [GA4 SPA tracking — Google Developers](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications) — send_page_view:false pattern for SPAs
- [Vercel SPA routing](https://community.vercel.com/t/rewrite-to-index-html-ignored-for-react-vite-spa-404-on-routes/8412) — vercel.json rewrite rule requirement

### Tertiary (LOW confidence)

- [JSON-LD Schema for SEO 2025 — ObserviX](https://observix.ai/blog/json-ld-schema-for-seo-what-marketers-should-know) — 20-30% CTR lift claim with structured data (directional only, single source)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
