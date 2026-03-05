# Requirements: Tinrate AI Concierge

**Defined:** 2026-03-05
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.4 Requirements

Requirements for launch hardening. Preparing for 10k concurrent users from marketing launch.

### Backend Performance

- [ ] **BPERF-01**: Health check endpoint returns DB status, expert count, and latency metric
- [ ] **BPERF-02**: Admin experts endpoint supports pagination (page/limit query params, default 50)
- [ ] **BPERF-03**: Photo proxy endpoint returns Cache-Control header (public, max-age=86400)
- [ ] **BPERF-04**: Event writes batched via asyncio queue (flush every 2-3s or 10 items, executemany commit)
- [ ] **BPERF-05**: SQLite PRAGMAs tuned (synchronous=NORMAL, cache_size=-32000, temp_store=MEMORY, mmap_size=128MB, wal_autocheckpoint=1000)
- [ ] **BPERF-06**: GZipMiddleware compresses API responses over 500 bytes
- [ ] **BPERF-07**: Explore endpoint caches responses with 5-minute TTL (300s) (invalidated on expert add/delete/import)
- [ ] **BPERF-08**: Connection pool explicitly configured (pool_size=5, max_overflow=10, pool_pre_ping=True)

### Railway Config

- [ ] **RAIL-01**: Railway region set to europe-west4 (Netherlands) in railway.json
- [ ] **RAIL-02**: Uvicorn tuned with --timeout-keep-alive 75 --log-level warning --no-access-log
- [ ] **RAIL-03**: healthcheckTimeout reduced to 120s with ON_FAILURE restart policy in railway.json

### Frontend Performance

- [ ] **FPERF-01**: Event tracking batched client-side (module-level queue, flush on 10 items / 3s timer / beforeunload)
- [ ] **FPERF-02**: Vite manualChunks expanded (vendor-motion, vendor-virtuoso, vendor-icons, vendor-intercom, vendor-router)
- [ ] **FPERF-03**: Preconnect hint to Railway API origin added to index.html

### Vercel Config

- [ ] **VCFG-01**: Cache-Control immutable headers for /assets/* in vercel.json (public, max-age=31536000, immutable)
- [ ] **VCFG-02**: Cache-Control for static images in vercel.json (public, max-age=86400, stale-while-revalidate=604800)

### Resilience

- [ ] **RSIL-01**: React error boundaries wrap Explorer page and ExpertGrid with user-friendly fallback UI
- [ ] **RSIL-02**: Global unhandled rejection handler catches async errors (window.addEventListener)

### SEO

- [ ] **SEO-01**: Meta description tag present on Explorer route
- [ ] **SEO-02**: robots.txt serves Disallow: /admin
- [ ] **SEO-03**: sitemap.xml lists root URL with lastmod

### Analytics

- [ ] **ANLT-01**: GA4 transport_type set to beacon in gtag config
- [ ] **ANLT-02**: navigator.onLine guard in trackEvent() prevents offline error noise
- [ ] **ANLT-03**: navigator.sendBeacon fallback in trackEvent() for iOS Safari keepalive edge case
- [ ] **ANLT-04**: Defensive inline comment on send_page_view: false in index.html

## Future Requirements

Deferred to v6.0+ based on research.

### Infrastructure

- **INFRA-01**: Migrate SQLite to PostgreSQL for horizontal scaling
- **INFRA-02**: Add Redis caching layer for DB query results
- **INFRA-03**: Full Sentry integration with source maps and alerting

### SEO Advanced

- **SEOA-01**: Next.js SSR migration for dynamic meta tags
- **SEOA-02**: JSON-LD structured data (WebSite + SearchAction)
- **SEOA-03**: Open Graph image and dynamic OG tags per route

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple Uvicorn workers | Cross-process SQLite write contention breaks WAL mode |
| PostgreSQL migration | Requires downtime, data migration — wrong scope for 1-day milestone |
| Redis caching | Zero measurable benefit at 530 experts with existing TTL caches |
| Next.js / SSR migration | Weeks of work; static meta tags deliver ~80% of SEO benefit |
| External task queue (Celery) | Overkill for single Railway instance; asyncio covers the use case |
| Rate limiting on public API | False-positive risk for shared IPs; monitor first, react if needed |
| Edge middleware (Vercel) | API on Railway origin — cannot proxy through Vercel edge |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BPERF-01 | Phase 71 | Pending |
| BPERF-02 | Phase 71 | Pending |
| BPERF-03 | Phase 71 | Pending |
| BPERF-04 | Phase 71 | Pending |
| BPERF-05 | Phase 71 | Pending |
| BPERF-06 | Phase 71 | Pending |
| BPERF-07 | Phase 71 | Pending |
| BPERF-08 | Phase 71 | Pending |
| RAIL-01 | Phase 71 | Pending |
| RAIL-02 | Phase 71 | Pending |
| RAIL-03 | Phase 71 | Pending |
| FPERF-01 | Phase 72 | Pending |
| FPERF-02 | Phase 72 | Pending |
| FPERF-03 | Phase 72 | Pending |
| VCFG-01 | Phase 72 | Pending |
| VCFG-02 | Phase 72 | Pending |
| RSIL-01 | Phase 73 | Pending |
| RSIL-02 | Phase 73 | Pending |
| SEO-01 | Phase 73 | Pending |
| SEO-02 | Phase 73 | Pending |
| SEO-03 | Phase 73 | Pending |
| ANLT-01 | Phase 74 | Pending |
| ANLT-02 | Phase 74 | Pending |
| ANLT-03 | Phase 74 | Pending |
| ANLT-04 | Phase 74 | Pending |

**Coverage:**
- v5.4 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
