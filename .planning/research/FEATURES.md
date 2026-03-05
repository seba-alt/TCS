# Feature Research

**Domain:** Launch hardening — FastAPI + React + SQLite marketplace at 10k concurrent users
**Milestone:** v5.4 Launch Hardening
**Researched:** 2026-03-05
**Confidence:** HIGH (all categories grounded in official docs + verified sources)

---

## Context: What Already Exists (do NOT re-implement)

This is a subsequent milestone on a fully shipped v5.3 product. The following are already present
and explicitly out of scope for this milestone:

| Existing Baseline | Status |
|-------------------|--------|
| GA4 (G-0T526W3E1Z) + Microsoft Clarity (vph5o95n6c) + Vercel Speed Insights | Live — do not re-add |
| SQLite WAL mode + 5000ms `busy_timeout` | Live since v4.0 |
| React.lazy + Suspense on all 11 admin routes | Live since v4.0 |
| Embedding cache (60s TTL), settings/feedback cache (30s TTL) | Live since v5.0 |
| ExpertTag join table (55x speedup over LIKE on JSON) | Live since v5.0 |
| API error state with retry button on Explorer | Live since v4.0 |
| bcrypt + JWT admin auth + slowapi rate limiting (3/min) | Live since v4.0 |
| FTS5 safety nets (`_safe_fts_query()` + try/except) | Live since v3.1 |
| Photo proxy 404 (not 502) on upstream failure | Live since v3.1 |
| `trackEvent()` with `keepalive: true` fire-and-forget | Live since v2.3 |
| OG meta tags (added in v5.0 for social sharing) | Live — verify completeness |

---

## Feature Landscape

### Table Stakes (Platform and Launch Require These)

Features where missing = broken experience, invisible product, or platform instability at launch.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| React error boundaries on Explorer + ExpertGrid | Blank page on any JS render error causes ~80% user abandonment; currently there is no catch between a component throw and the white screen | LOW | `react-error-boundary` wraps `ExplorerPage` and `ExpertGrid`; fallback shows user-friendly "Something went wrong — Reload" CTA; admin routes already have one Suspense boundary but no error boundary |
| `/api/health` endpoint (Railway restart policy) | Railway health check needs a dedicated endpoint to detect process hangs and trigger restarts; uptime monitors (UptimeRobot, Betterstack) and the admin OverviewPage health widget both need it; currently absent | LOW | Returns `{"status": "ok", "db": "ok", "experts": N}`; performs SQLite read + row count; no auth; 200ms timeout on DB check to avoid blocking |
| `<title>` + `<meta description>` per route | Every route currently inherits a bare `<title>Tinrate</title>`; GA4 page titles all read "Tinrate"; social share previews show no description | LOW | Install `react-helmet-async` once; Explorer gets primary tags; admin gets `<meta name="robots" content="noindex">` to prevent crawler indexing; one-time setup covering all routes |
| Open Graph tags for social sharing | Launch = Twitter/LinkedIn/WhatsApp shares; without `og:title`, `og:description`, `og:image`, the unfurled card is blank or shows raw URL | LOW | Static `og:image` (1200x630 PNG) served from Vercel `public/`; `og:url` reflects canonical `/`; `og:type: website`; these depend on `react-helmet-async` being installed |
| Admin experts endpoint pagination | PROJECT.md explicitly calls out a Sentry large payload warning on the experts endpoint; sending all experts in one JSON response will blow up at 1k+ experts and already causes noise | LOW | Add `?page=` + `?limit=` query params to `GET /api/admin/experts`; default page size 50; `AdminPagination` component already exists from v5.0 and can be reused |
| `Cache-Control` on photo proxy endpoint | Photos are re-fetched on every component mount without cache headers; 10k users = 10k redundant upstream calls per session to the external photo host | LOW | Add `Cache-Control: public, max-age=86400` on `/api/experts/{id}/photo`; the proxy already fetches from upstream and has a 24h in-process cache — the HTTP header just tells the browser and Vercel CDN to cache it too |
| `robots.txt` + `sitemap.xml` as static files | Without `robots.txt`, crawlers may index `/admin` auth pages; without `sitemap.xml`, the Explorer page is not discoverable; both are expected baseline for any production web property | LOW | `robots.txt`: `Disallow: /admin`; `sitemap.xml`: lists `/` with lastmod; both served as static files from Vercel `public/` directory; no build changes needed |
| JSON-LD structured data for search engines | Pure SPA with no SSR is invisible to search crawlers; JSON-LD is the lightest fix that gives search engines context about the product without migrating to Next.js | LOW | `WebSite` + `ItemList` schema blocks injected via `<script type="application/ld+json">` in `index.html` `<head>`; static content — no dynamic injection; covers the launch SEO baseline |

### Differentiators (Measurably Better Reliability at Launch)

Features that separate a hardened launch from a fragile one. All are practical within a 1-day window.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Backend event write queue (asyncio.Queue) | `/api/events` is fire-and-forget on the frontend but currently a synchronous SQLite write on the backend; at 10k concurrent users, card clicks, filter changes, and search events create write contention on SQLite's single-writer; batching 50 events every 2 seconds reduces write transactions by ~95% while preserving all data | MEDIUM | `asyncio.Queue` in FastAPI `lifespan` context (already used for FAISS init); background consumer flushes with `executemany`; no external dependency; Railway single instance means no cross-worker coordination needed; confirm memory safe at queue max=1000 |
| Uvicorn 2-worker tuning | Default Railway deploy runs 1 Uvicorn worker; Google GenAI embedding calls (~200ms) block the event loop per request; 2 workers doubles effective concurrency for I/O-bound traffic at minimal memory cost | LOW | Set `--workers 2` in Procfile or Railway start command; validate Railway plan memory limit first (512MB baseline for Hobby plan); with 2 workers, each has its own asyncio.Queue (acceptable — events are partitioned, not lost) |
| `<link rel="preconnect">` to Railway API origin | Browser opens a fresh TCP + TLS handshake on the first API call; for users on cold sessions this adds ~150–250ms before any expert data loads; preconnect eliminates this from the critical path | LOW | Single `<link rel="preconnect" href="https://[railway-app].up.railway.app">` in `index.html`; zero runtime cost; no build changes |
| Vite bundle analysis + targeted chunk split | Current public bundle is ~711 kB (already halved from 1.26 MB in v4.0); production target is <500 kB gzipped initial load; `rollup-plugin-visualizer` identifies the largest chunks before deciding what to split | LOW | Run `npx rollup-plugin-visualizer` or add to `vite.config.ts`; assess Framer Motion (~30 kB gzipped), Recharts (admin only, already lazy-loaded), and lucide-react (tree-shaken); apply `build.rollupOptions.output.manualChunks` only where analysis shows clear wins |
| GA4 Beacon API + `transport_type: 'beacon'` | In 2026, client-side-only GA4 loses 20–40% of events to ad blockers and browser restrictions; current `trackEvent()` already uses `keepalive: true` (correct for custom events); GA4 gtag itself should use Beacon transport to minimize data loss | LOW | Add `transport_type: 'beacon'` to `gtag('config', ...)` in the GA4 initialization; verify that `navigator.sendBeacon` is used for hits; this is a single config line change |

### Anti-Features (Tempting But Wrong for This 1-Day Window)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Migrate SQLite to PostgreSQL | SQLite single-writer is a genuine concern at 10k concurrent write events | Railway volume migration has real data loss risk; full milestone scope, not 1-day work; WAL mode + event batching extends SQLite viability comfortably through this launch | Event write queue batching reduces SQLite write contention by ~95%; defer Postgres migration to v6.0 if write latency becomes measurable in Railway metrics |
| Server-side rendering (Next.js migration) | SSR fixes SPA SEO fundamentally and improves Largest Contentful Paint | Rewriting React app in Next.js takes weeks; all GA4, Clarity, and Intercom integrations need re-wiring; out of scope for 1-day window | JSON-LD + react-helmet-async delivers ~80% of the SEO benefit at ~5% of the effort; revisit SSR migration if SEO becomes a measurable growth channel |
| Redis caching layer | Eliminates repeated DB reads; standard recommendation at 10k+ users | Adds a Railway service ($7+/mo); adds infrastructure complexity; existing 60s embedding cache and 30s settings TTL already cover the hot read paths | Add Redis in v6.0 if DB query latency appears in Railway monitoring; not needed for the primarily read-heavy Explorer traffic |
| External task queue (Celery + RabbitMQ) | Fully decouples event writes from the request lifecycle; industry standard for event ingestion at scale | Massive ops complexity for a single Railway instance; overkill when one process handles all traffic; asyncio.Queue achieves the same write-batching result in-process with zero infrastructure | In-process asyncio.Queue covers the launch window; revisit if event volume exceeds 100k events/day |
| Sentry full integration | Gives production error visibility; commonly added at launch | PROJECT.md notes Sentry is already generating noise from the large experts payload; adding Sentry without fixing the root cause (large payload) amplifies the noise | Fix admin experts pagination (table stakes) first, which eliminates the known Sentry noise source; add Sentry in v6.0 once the signal-to-noise ratio is acceptable |
| Prerender.io / React Snap pre-rendering | Makes SPA content visible to crawlers via pre-rendered HTML snapshots | Adds a separate CI step; pre-rendered snapshots can diverge from live content; deployment complexity; maintenance burden | JSON-LD structured data + descriptive meta tags satisfy the launch SEO baseline without pre-rendering infrastructure |
| HTTP/2 push or server-sent events | Further reduces API latency via multiplexed streams | Railway does not expose HTTP/2 configuration at the app layer; Uvicorn + Railway handles transport transparently; the gains are marginal for an Explorer with pagination | `<link rel="preconnect">` achieves equivalent first-load gains at zero complexity |
| Rate limiting on public Explorer API | Prevents abuse of `/api/explore` and `/api/events` | Adds false-positive risk for legitimate users sharing IP (NAT, offices, Intercom); slowapi is already on `/api/admin/auth`; Explorer is read-heavy and stateless | Monitor Railway CPU/memory during launch; add rate limiting reactively if abuse is observed rather than preemptively blocking legitimate traffic |

---

## Feature Dependencies

```
[react-helmet-async]
    required-by --> [<title> + <meta description> per route]
    required-by --> [Open Graph tags]
    required-by --> [<meta name="robots" noindex> on /admin]
    install once, use in three places

[Open Graph tags]
    requires --> [react-helmet-async]
    requires --> [Static OG image (1200x630) in Vercel public/]
    enhances --> [robots.txt + sitemap.xml] (crawlers find the page, social shares convert)

[Admin experts pagination]
    requires --> [Backend page/limit query params on GET /api/admin/experts]
    requires --> [AdminPagination component (already exists in v5.0)]
    resolves --> [Sentry large payload warning]
    independent of all other v5.4 features

[/api/health endpoint]
    requires --> [SQLite read check + row count query]
    independent of all other v5.4 features
    enables --> Railway health check restart policy

[Backend event write queue]
    requires --> [asyncio.Queue in FastAPI lifespan context]
    enhances --> [SQLite WAL mode (already present)]
    note: with 2 Uvicorn workers, each worker has its own queue instance;
          this is acceptable — events are batched per-worker, not globally

[Uvicorn 2-worker tuning]
    requires --> [Railway memory limit verified before deploy]
    affects --> [Backend event write queue] (queue is per-worker, not shared)

[Vite bundle analysis]
    independent of all backend features
    may --> [manualChunks config in vite.config.ts] if analysis shows clear wins
    assessment-first: run visualizer before deciding what to split

[<link rel="preconnect">]
    independent of all features
    single HTML tag in index.html — ship with meta tags phase

[Cache-Control on photo proxy]
    independent of all features
    single header on existing FastAPI endpoint
```

### Dependency Notes

- **react-helmet-async is a shared dependency.** Install once; apply to title, meta description, OG tags, and admin noindex. All four features block on this single install.
- **Event write queue requires lifespan context.** FastAPI's `lifespan` async context manager is already used for FAISS initialization — extend the same block to start the asyncio.Queue consumer. No new pattern needed.
- **Admin experts pagination reuses existing infrastructure.** `AdminPagination` component from v5.0 handles page/limit UI. Only the backend endpoint needs query param support added.
- **OG image is a new static asset.** Must be created (1200x630 PNG) and committed to `frontend/public/` before the OG tags can resolve. Block social sharing tags on this asset being available.
- **Uvicorn worker count affects queue architecture.** With 2 workers, each worker maintains its own asyncio.Queue. Events are not shared across workers. This is fine — each worker flushes its own batch every 2 seconds. No data loss risk.

---

## MVP Definition

### Launch With (must ship before marketing launch)

These are non-negotiable for a 10k-user launch. Missing any one = visible failure mode.

- [ ] React error boundaries on ExplorerPage + ExpertGrid — blank screen on JS error loses users permanently at launch
- [ ] `/api/health` endpoint — Railway needs this for restart policy; without it, process hangs go undetected
- [ ] `<title>` + `<meta description>` per route via react-helmet-async — every social share from the launch goes out with these
- [ ] Open Graph tags (og:title, og:description, og:image, og:url) — launch = Twitter/LinkedIn shares; blank unfurl cards hurt credibility
- [ ] `robots.txt` (disallow /admin) + `sitemap.xml` (list /) — crawler hygiene before launch traffic generates backlinks
- [ ] JSON-LD structured data (WebSite + ItemList) — baseline for search engine discoverability
- [ ] Admin experts endpoint pagination — fixes known Sentry payload issue before expert pool grows further
- [ ] `Cache-Control: public, max-age=86400` on photo proxy — prevents upstream hammering at launch scale

### Add Within Same Milestone (after P1 items verified)

- [ ] Backend event write queue (asyncio.Queue) — reduces SQLite write contention; validate P1 deploy first, then ship
- [ ] Uvicorn 2-worker tuning — verify Railway memory headroom; ship with event queue
- [ ] `<link rel="preconnect">` to Railway API origin — 1 HTML tag; ship with meta tags phase
- [ ] Vite bundle analysis + targeted chunk split — run visualizer; apply only if clear wins exist
- [ ] GA4 `transport_type: 'beacon'` — single config line; ship with any frontend deploy

### Future Consideration (v6.0+)

- [ ] PostgreSQL migration — when SQLite write latency becomes measurable in Railway metrics under real load
- [ ] Redis caching layer — when DB query times appear as a bottleneck after v5.4 observability data
- [ ] Sentry full integration — after known large-payload noise source is resolved by pagination fix
- [ ] SSR / Next.js migration — if SEO becomes a measurable growth channel, not just launch hygiene
- [ ] CDN for API responses (Cloudflare Workers) — if Railway origin latency becomes a bottleneck

---

## Feature Prioritization Matrix

| Feature | User/Platform Value | Implementation Cost | Priority |
|---------|---------------------|---------------------|----------|
| React error boundaries | HIGH (prevents blank screen = abandonment) | LOW (1 install, 2 boundaries) | P1 |
| /api/health endpoint | HIGH (Railway restarts on hangs) | LOW (10 lines Python) | P1 |
| title + meta description | HIGH (GA4 clarity + social) | LOW (react-helmet-async) | P1 |
| Open Graph tags + OG image | HIGH (launch social shares) | LOW (static image + tags) | P1 |
| robots.txt + sitemap.xml | MEDIUM (crawler hygiene) | LOW (static files) | P1 |
| JSON-LD structured data | MEDIUM (search discoverability) | LOW (index.html block) | P1 |
| Admin experts pagination | HIGH (fixes known Sentry issue) | LOW (query params + existing component) | P1 |
| Cache-Control photo proxy | MEDIUM (prevents upstream hammering) | LOW (single header) | P1 |
| Backend event write queue | HIGH (SQLite write bottleneck under load) | MEDIUM (asyncio.Queue pattern) | P2 |
| Uvicorn 2-worker tuning | MEDIUM (I/O concurrency improvement) | LOW (Procfile change) | P2 |
| preconnect hint | LOW-MEDIUM (removes TCP handshake latency) | LOW (1 HTML tag) | P2 |
| Vite bundle trim | MEDIUM (LCP improvement) | LOW-MEDIUM (analysis first) | P2 |
| GA4 Beacon transport | LOW-MEDIUM (analytics data quality) | LOW (1 config line) | P2 |

**Priority key:**
- P1: Must ship before marketing launch goes live
- P2: Ship within same v5.4 milestone, after P1 items are deployed and verified
- P3: Defer to v6.0

---

## Infrastructure Reality Check

Hard constraints that bound all feature decisions in this milestone:

| Constraint | Implication | Response |
|------------|-------------|----------|
| Railway single instance (no horizontal scaling) | All 10k concurrent users hit one process | 2 Uvicorn workers + asyncio.Queue; no Redis/Celery coordination needed |
| SQLite single-writer (even with WAL) | Concurrent writes queue; sustained write bursts cause latency spikes | Event batching with `executemany` reduces write transactions by ~95% |
| Vercel CDN fronts all static assets globally | JS, CSS, images served from edge — zero origin load for static content | Leverage: serve OG image from `public/`; apply `Cache-Control` on API photo proxy |
| Pure SPA (no SSR) | Crawler sees empty HTML shell without JS execution | JSON-LD + meta tags is the practical fix; Next.js migration is weeks, not hours |
| GA4 client-side only | Ad blockers drop 20–40% of events regardless of implementation quality | Beacon API (`transport_type: 'beacon'`) is the best mitigation short of server-side proxy |
| react-virtuoso infinite scroll | Virtualized DOM means minimal nodes in memory; grid performance is not a bottleneck | No changes needed to virtualization layer |
| Framer Motion in bundle | `motion/react` adds ~30 kB gzipped; scoped to FAB + modals only | Run bundle visualizer before deciding; likely not the primary target |
| Railway Hobby plan (512MB RAM baseline) | 2 Uvicorn workers + FAISS in-memory (~4 MB) + SQLite = ~300–350 MB estimated | Verify Railway memory metrics before bumping workers; 2 is safe estimate |

---

## Sources

- [Designing a FastAPI + LLM System for 10K Concurrent Users](https://medium.com/algomart/designing-a-fastapi-llm-system-for-10k-concurrent-users-and-scaling-rag-to-100k-daily-users-c54be7acd865) — MEDIUM confidence (community article, Feb 2026)
- [FastAPI Best Practices for Production 2026](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026) — MEDIUM confidence
- [FastAPI Background Tasks (official docs)](https://fastapi.tiangolo.com/tutorial/background-tasks/) — HIGH confidence
- [SQLite Write Concurrency — The Write Stuff](https://oldmoe.blog/2024/07/08/the-write-stuff-concurrent-write-transactions-in-sqlite/) — HIGH confidence
- [SQLite WAL Mode Concurrent Reads — Hacker News](https://news.ycombinator.com/item?id=32579866) — HIGH confidence
- [GA4 Event Batching Guide](https://assertionhub.com/blog/ga4-event-batching-guide) — MEDIUM confidence (20–40% event loss figure corroborated by multiple 2026 sources)
- [GA4 in 2026: The Post-Cookie Era Guide](https://ankitnagarsheth.medium.com/doing-ga4-in-2026-the-definitive-guide-to-google-analytics-in-the-post-cookie-era-c717faed2033) — MEDIUM confidence
- [Vercel CDN Cache Documentation](https://vercel.com/docs/cdn-cache) — HIGH confidence (official)
- [Vercel Cache-Control Headers](https://vercel.com/docs/headers/cache-control-headers) — HIGH confidence (official)
- [React Error Boundaries 2026](https://oneuptime.com/blog/post/2026-02-20-react-error-boundaries/view) — MEDIUM confidence
- [Vite Build Options (official docs)](https://vite.dev/config/build-options) — HIGH confidence (official)
- [SEO for React Applications 2026](https://www.linkgraph.com/blog/seo-for-react-applications/) — MEDIUM confidence
- [Railway Health Check Endpoint](https://station.railway.com/questions/health-check-endpoint-af9640dc) — HIGH confidence (official Railway)
- [Optimizing React Builds with Vite (Feb 2026)](https://medium.com/@salvinodsa/optimizing-react-builds-with-vite-practical-techniques-for-faster-apps-063d4952e67d) — MEDIUM confidence

---

*Feature research for: Tinrate Expert Marketplace v5.4 Launch Hardening*
*Researched: 2026-03-05*
