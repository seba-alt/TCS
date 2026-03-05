# Pitfalls Research

**Domain:** Launch hardening — adding performance, resilience, SEO, and analytics reliability to a live FastAPI + SQLite + React/Vite expert marketplace
**Researched:** 2026-03-05
**Confidence:** HIGH — based on direct codebase analysis (database.py, main.py, events.py, tracking.ts, vite.config.ts, main.tsx, index.html, Procfile, railway.json) plus verified web research for each failure domain.

This is a SUBSEQUENT MILESTONE document. The system is already deployed and receiving traffic. Every pitfall here is a mistake that could be introduced by the v5.4 hardening work itself, not pre-existing bugs. The context: single Uvicorn worker (no `--workers` flag in Procfile), SQLAlchemy QueuePool default (5 connections, 10 overflow), WAL mode already enabled with 5000ms busy_timeout, fire-and-forget tracking via `fetch + keepalive: true`, no error boundaries anywhere in the React tree, OG tags in static `index.html` only, GA4 with `send_page_view: false` already configured.

---

## Critical Pitfalls

Mistakes that cause data loss, broken deploys, or silent analytics corruption at launch scale.

---

### Pitfall 1: SQLite Write Queue Saturation from Event Ingestion Spike

**What goes wrong:**
At launch with 10k concurrent users, every page load fires at least one `POST /api/events` (search_query or filter_change). The current `events.py` endpoint does a synchronous `db.commit()` inside the request handler — not a background task. SQLite in WAL mode serializes all writers: when concurrent events arrive faster than SQLite can commit them, requests queue behind the write lock. The QueuePool default (5 connections, max_overflow=10) means at most 15 simultaneous DB operations. Beyond that, SQLAlchemy raises `QueuePool limit of size 5 overflow 10 reached` rather than returning 202.

The specific failure: tracking events start returning 500s while search (`/api/explore`) continues working fine, because explore uses read-heavy FAISS (in-memory) with only an occasional DB read. The events endpoint is the only high-write-rate path. This goes unnoticed until the admin Lead timeline shows gaps in launch-day data.

**Why it happens:**
The event endpoint was designed for the pre-launch traffic volume where fire-and-forget 202 responses were always fast. At launch scale, the synchronous `db.commit()` per event, combined with the QueuePool ceiling, creates a write bottleneck. The `keepalive: true` on the frontend means these requests don't get dropped on navigation — they pile up.

**How to avoid:**
Convert `record_event` to use FastAPI `BackgroundTasks` — accept the request and return 202 immediately, then write to the DB in the background. This decouples the response latency from the write latency and prevents the QueuePool ceiling from manifesting as HTTP errors on the tracking endpoint. Alternatively, buffer events in-memory for 1s and batch-commit. Also increase the pool ceiling: `create_engine(..., pool_size=10, max_overflow=20)`.

```python
# In events.py — decoupled write
@router.post("/api/events", status_code=202)
async def record_event(body: EventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(_write_event, body)
    return {"status": "accepted"}

def _write_event(body: EventRequest):
    with SessionLocal() as db:
        # write here
```

**Warning signs:**
- `/api/events` returns 500 errors while `/api/explore` and `/api/health` continue working
- Sentry shows `QueuePool limit of size 5 overflow 10 reached` errors during high-traffic periods
- Admin lead timeline shows gaps in event history on launch day despite confirmed user activity (GA4 shows page views but no events in admin)
- Railway metrics show DB connection count pinned at 15 continuously

**Phase to address:** Backend performance optimization phase — convert event write to background task before launch.

**Severity:** CRITICAL — silently loses tracking data at the exact moment (launch) when it matters most.

---

### Pitfall 2: Multiple Uvicorn Workers Break SQLite (If Workers Are Added for Scaling)

**What goes wrong:**
The current Procfile runs a single Uvicorn worker (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`, no `--workers` flag). This is correct for SQLite. However, the natural response to seeing the single worker saturate at launch is to add `--workers 4` or switch to `gunicorn -w 4 -k uvicorn.workers.UvicornWorker`. When multiple workers fork from the same process, each inherits a copy of the SQLAlchemy engine with connections pointing at the same SQLite file. The FAISS index (`app.state.faiss_index`) is also in-memory per process — each worker loads its own copy, but the SQLite single-writer lock is shared across all worker processes via the OS. Two workers writing simultaneously trigger `SQLITE_BUSY` errors that WAL mode does not fully protect against when the writers are separate OS processes (not threads within one process).

This is a complete crash scenario: adding workers to fix performance breaks data integrity.

**Why it happens:**
SQLite's WAL mode solves the multi-reader + single-writer problem within one process. Across forked OS processes, file-level locking still applies, and `busy_timeout=5000` does not help when the contention is between multiple active writers (not readers waiting for a single writer).

**How to avoid:**
Do NOT add `--workers` to the Procfile without migrating to PostgreSQL first. If Railway's single worker is genuinely saturating under load, scale vertically (upgrade Railway plan for more CPU/RAM to the single process) rather than horizontally. The correct horizontal scaling path requires PostgreSQL, not SQLite. Document this constraint explicitly in the Procfile as a comment.

```
# DO NOT add --workers without migrating to PostgreSQL.
# Multiple workers + SQLite = cross-process write contention.
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Warning signs:**
- `SQLITE_BUSY: database is locked` errors in Railway logs shortly after adding `--workers`
- Events and explore results intermittently fail (500) while health check passes
- FAISS index appears empty for some requests (each worker loads independently; if one worker's lifespan fails, its FAISS is empty)

**Phase to address:** Resilience phase — document explicitly that single-worker is mandatory for SQLite. If load testing reveals saturation, escalate to PostgreSQL migration (out of v5.4 scope) rather than adding workers.

**Severity:** CRITICAL if workers are added without awareness. LOW if team knows never to add workers.

---

### Pitfall 3: Vite `manualChunks` Circular Dependency Runtime Crash

**What goes wrong:**
The current `vite.config.ts` uses `manualChunks` to split `recharts` → `vendor-charts` and `@tanstack/react-table` → `vendor-table`. This is currently correct and safe because these are leaf dependencies with no circular relationship to each other. The risk arises when v5.4 adds MORE `manualChunks` entries (e.g., `react`, `react-dom`, `framer-motion`, `zustand` into a `vendor-react` chunk). If any module in the app imports from a chunk that in turn imports from another chunk that hasn't loaded yet, Rollup generates circular chunk references. The symptom is a runtime crash: `Cannot read properties of undefined (reading 'createContext')` or similar, where a React API is `undefined` because the vendor-react chunk hasn't initialized before a component chunk tried to use it.

This is a particularly insidious failure mode because it passes `vite build` cleanly, passes dev mode (`vite dev` never uses chunks), and only manifests in production after deploy.

**Why it happens:**
Developers add `manualChunks` entries incrementally without verifying that all shared dependencies between chunks resolve cleanly. The Rollup bundler produces a warning about circular chunk dependencies during build (hidden in build output), but it doesn't fail the build — it only fails at runtime.

**How to avoid:**
When expanding `manualChunks` in v5.4, follow the rule: only split libraries that have no shared imports with other chunks being created. The current config (charts + table) is safe. If adding a `vendor-react` chunk, verify with `npx vite build --debug` that the build output contains no "circular dependency" warnings before deploying. Test the production build locally (`npx vite preview`) against the actual Vercel domain, not `localhost`, since module loading order can differ.

Never add React core (`react`, `react-dom`) to `manualChunks` — Vite already handles React correctly in the default chunk and splitting it creates more problems than it solves.

**Warning signs:**
- `vite build` output contains lines like `Circular dependency: vendor-react → index → vendor-charts`
- Production app (Vercel preview deploy) throws `TypeError: Cannot read properties of undefined` on load while dev mode works fine
- The admin panel (which lazy-loads all 11 components) crashes on login in production but not in dev

**Phase to address:** Frontend bundle optimization phase — verify with `vite preview` after any `manualChunks` additions before merging.

**Severity:** HIGH — production-only crash, not caught by dev mode.

---

### Pitfall 4: GA4 Double-Counting from Reinstating `send_page_view: true`

**What goes wrong:**
The current `index.html` correctly sets `gtag('config', 'G-0T526W3E1Z', { send_page_view: false })`. The `Analytics` component (added in v3.1) handles ALL `page_view` events manually on route changes. This is the correct single-source-of-truth pattern. The failure risk in v5.4: when adding "analytics hardening" or reviewing GA4 setup, someone removes `send_page_view: false` to "fix" what looks like a misconfiguration (it looks wrong to someone unfamiliar with the SPA pattern). GA4 then fires the initial `page_view` automatically on script load, AND the `Analytics` component fires a second `page_view` on mount. Every subsequent route change fires once (correct). Only the first page load fires twice.

The result: all sessions show exactly 2 page views minimum, bounce rate is artificially lowered (users with 2 page views are not counted as bounces), and launch-day cohort data is permanently corrupted.

**Why it happens:**
`send_page_view: false` is a counter-intuitive setting — it disables something that sounds like it should be enabled. Engineers unfamiliar with the SPA tracking pattern assume it's a bug and "fix" it. The Google Analytics documentation presents the default (auto page views) as the happy path, so the explicit disable looks like a misconfiguration.

**How to avoid:**
Add a comment in `index.html` explaining WHY `send_page_view: false` is intentional:
```html
<!-- send_page_view: false — React Analytics component handles all page_view events.
     Enabling this would double-count the initial page load. DO NOT REMOVE. -->
gtag('config', 'G-0T526W3E1Z', { send_page_view: false });
```
Verify in GA4 DebugView (available in GA4 dashboard → Admin → DebugView) that a fresh page load fires exactly one `page_view` event, and navigating between routes fires one additional `page_view` per navigation.

**Warning signs:**
- GA4 DebugView shows two `page_view` events firing within 100ms of page load
- Average pages per session is slightly above 1.0 for single-visit sessions
- Bounce rate looks unusually low (under 30%) for a discovery marketplace

**Phase to address:** Analytics hardening phase — add the defensive comment as first action; verify DebugView before declaring analytics hardened.

**Severity:** HIGH — permanently corrupts launch cohort data. Not recoverable retroactively.

---

### Pitfall 5: React Error Boundaries Don't Catch Async Failures — The Explorer Can White-Screen Silently

**What goes wrong:**
React Error Boundaries (class component `componentDidCatch`) only catch errors thrown during the synchronous React render phase. They do NOT catch:
- Errors in `useEffect` async callbacks
- Rejected promises from `fetch` calls in event handlers
- Errors in `setTimeout`/`setInterval` callbacks
- Errors thrown inside `onClick` handlers that trigger async operations

The current codebase has no Error Boundaries anywhere (confirmed by grep). In v5.4, when adding error boundaries as part of "resilience hardening," there is a trap: adding `<ErrorBoundary>` around `<MarketplacePage>` gives a false sense of safety. If the FAISS-backed `/api/explore` call rejects (Railway backend crashes, cold start timeout, Railway health check failing), the `useExplore` hook's `catch` block handles this — the existing "API error state with retry button" (EXP-06) already manages this correctly. But if an unhandled promise rejection escapes (e.g., from `trackEvent()` on a bad network, or from Zustand persist read failure), the error boundary won't catch it. The page will white-screen with an unhandled rejection that neither the error boundary nor the existing EXP-06 retry covers.

**Why it happens:**
Error boundaries are added as a box-checking exercise without understanding their scope. `trackEvent()` is fire-and-forget (`void fetch(...)`) so its errors are already swallowed correctly. The real risk is async code in render effects: if any `useEffect` in `MarketplacePage` throws an unhandled rejection, it's invisible to error boundaries.

**How to avoid:**
Add a global `window.addEventListener('unhandledrejection', ...)` handler that logs to Sentry (already integrated via `instrument.ts`) in addition to error boundaries. Error boundaries should wrap the entire Explorer (`<MarketplacePage>`) with a fallback that shows the retry button — NOT a blank white screen. The fallback component already exists conceptually (EXP-06 pattern) and just needs to be used as the boundary fallback. Use `react-error-boundary` library (the `useErrorBoundary` hook allows async errors to be passed to the boundary explicitly).

```tsx
// instrument.ts already sets up Sentry — add unhandled rejection capture
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason)
})
```

**Warning signs:**
- Explorer white-screens on a device/network where `localStorage` access fails (Safari private mode restrictions)
- Error boundary catches render-phase errors but Sentry shows unhandled rejection events that the boundary didn't catch
- `trackEvent()` silently fails (already handled correctly — this is the good case)

**Phase to address:** Resilience phase — add error boundary with non-blank fallback + global unhandledrejection Sentry capture together.

**Severity:** HIGH — white-screen at launch with no user recovery path.

---

### Pitfall 6: Social Crawler OG Tags Are Static and Shared Across All Routes

**What goes wrong:**
The current `index.html` has static OG tags (`og:title: "Tinrate"`, `og:description: "Describe any problem..."`, `og:image` pointing to the single OG image). This is correct for the main Explorer page. The problem in v5.4 SEO hardening: if the milestone adds structured data or improves meta tags, developers may add `react-helmet-async` to set per-page dynamic tags. On Vercel (pure SPA static hosting), social crawlers (Facebook, Twitter/X, LinkedIn, Slack unfurling) receive the raw `index.html` with the static OG tags — they don't execute JavaScript. So any dynamically injected OG tags via `react-helmet-async` are completely invisible to social crawlers. Sharing a filtered URL (e.g., `/?tags=Finance&q=CFO`) on LinkedIn shows the generic Tinrate description rather than anything context-specific.

For this project (single-route SPA at `/`), this is acceptable as-is. The risk is spending time on `react-helmet-async` implementation expecting dynamic OG tags to work on social platforms, then discovering at launch that they don't.

**Why it happens:**
`react-helmet-async` documentation focuses on SEO (Google crawlers), which do execute JavaScript via Googlebot. But social sharing crawlers (WhatsApp, Slack, LinkedIn) are simpler bots that parse raw HTML only. Developers conflate "SEO meta tags" with "social sharing tags" — they require different approaches (CSR works for Google, SSR/prerendering required for social).

**How to avoid:**
For v5.4, do NOT use `react-helmet-async` to solve social OG tags — it won't work without SSR/prerendering. Instead, improve the static OG tags in `index.html` directly:
- Add a real `og:image` that has actual dimensions (1200x630px) and is publicly accessible
- Add `og:site_name`, `og:locale`
- Add `<meta name="description">` for Google (different from og:description)
- Add JSON-LD structured data as a static `<script type="application/ld+json">` in `index.html` for the Organization and WebSite schemas

Dynamic per-page OG tags for filtered views require a Vercel Edge Function or prerendering — out of scope for v5.4. Accept the single static description for now.

**Warning signs:**
- LinkedIn "Post Inspector" (linkedin.com/post-inspector/) shows the old cached OG tags even after deploy
- Slack unfurls show generic description regardless of URL shared
- `react-helmet-async` tags appear in browser DevTools `<head>` but not in `curl https://tcs-three-sigma.vercel.app`

**Phase to address:** SEO phase — set correct expectations upfront: static OG improvement in `index.html` is what's achievable; dynamic OG requires a future SSR migration.

**Severity:** MEDIUM — functional gap (social sharing is generic) but doesn't break anything.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping synchronous `db.commit()` in events endpoint | No code change | Events endpoint becomes the bottleneck and returns 500s under launch load | Never for high-write paths — move to BackgroundTasks |
| Adding `--workers 4` to Procfile to handle load | More throughput | Cross-process SQLite write contention; SQLITE_BUSY errors under concurrent writes | Never with SQLite; only safe with PostgreSQL |
| Using `react-helmet-async` for social OG tags in an SPA | Looks like "SEO is done" | Social crawlers (Slack, LinkedIn, WhatsApp) get the static index.html — dynamic tags are invisible | Never for social sharing; only valid for Google |
| Expanding `manualChunks` without testing `vite preview` | Smaller chunks (looks good in build output) | Circular dependency runtime crash in production only | Never skip the preview test |
| Adding error boundaries without global unhandledrejection handler | "We have error boundaries" checkbox | Async errors silently escape the boundary; white-screen with no Sentry capture | Only acceptable if all async code is fully guarded with try/catch |
| Commenting out `send_page_view: false` because it "looks wrong" | Seems to fix GA4 config | Permanently corrupts launch cohort with double-counted page views | Never — the comment is intentional |

---

## Integration Gotchas

Common mistakes when connecting to external services during v5.4 hardening.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GA4 + React Analytics component | Removing `send_page_view: false` from gtag config | Keep `send_page_view: false`; add inline comment explaining why it's intentional |
| Microsoft Clarity + CORS | Clarity IIFE in `index.html` already skips `/admin` — adding a new admin sub-path (e.g., `/admin/perf`) that doesn't start with `/admin/` would inadvertently load Clarity on it | The current prefix check `pathname.startsWith('/admin')` is correct; all admin routes use this prefix |
| Sentry + Vite build | `sentryVitePlugin` requires `SENTRY_AUTH_TOKEN` env var in Vercel build settings; missing it silently skips source map upload | Verify Vercel has `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set; check Sentry releases dashboard after deploy |
| Railway health check + FAISS warmup | The health endpoint (`/api/health`) returns `{"status": "ok"}` before FAISS index finishes loading if the FAISS load is slow | The current lifespan pattern loads FAISS synchronously before `yield` — this is correct. Do not make it async without ensuring the health check only returns 200 after FAISS is ready |
| Vercel + SPA routing | Missing `vercel.json` rewrite rule means direct URL access to non-root paths (e.g., `/admin/login` from bookmark) returns 404 | Add `"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]` to `vercel.json` |
| fetch keepalive + cross-origin | `keepalive: true` fetch requests that cross origins are limited to 64KB body and max 9 inflight per renderer process | The current event payload is tiny (<500 bytes); no action needed unless payload grows substantially |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous `db.commit()` in events endpoint with QueuePool default (5+10) | Events endpoint returns 500 during traffic spikes; tracking data has gaps | Move to BackgroundTasks + raise pool ceiling to pool_size=10, max_overflow=20 | At ~50+ concurrent users all firing events simultaneously |
| Single Uvicorn worker handling all traffic | Response latency climbs under load; requests queue | Acceptable with SQLite; vertical scale Railway plan if needed | At ~200 concurrent keep-alive connections |
| FAISS index loaded in-memory per process | If workers are ever added, each worker reloads FAISS from disk at startup — slow cold start multiplied by worker count | Keep single worker; or pre-load FAISS into shared memory with mmap if workers are needed | Immediately if `--workers > 1` is added |
| Admin `GET /api/admin/experts` returning all experts in one payload | Sentry large payload warning already flagged in PROJECT.md | Add pagination (`limit`, `offset`) to the endpoint | Already breaking — noted as a v5.4 target |
| Aurora gradient CSS animation running on all 530 expert cards during scroll | GPU/CPU load on low-end mobile; janky scroll | Reduce-motion media query respect; limit animation to visible cards | On mid-range Android devices with 200+ cards rendered |

---

## Security Mistakes

Domain-specific security issues relevant to v5.4 hardening work.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding GZip middleware AFTER CORSMiddleware in FastAPI | CORS preflight OPTIONS requests are processed by GZip before CORS headers are added — browsers reject the response | Always add CORSMiddleware LAST in the middleware stack (FastAPI processes middleware in reverse registration order — last added = first executed for requests) |
| Exposing detailed DB error messages in health endpoint response | Attacker learns DB schema from error traces in health response | Current health endpoint returns `{"status": "ok", "index_size": N}` — do not add DB query results or file path info to this endpoint |
| Adding `/api/health/db` with raw SQL query results | Exposes table names and row counts | Keep health check minimal; DB connectivity check should be a simple `SELECT 1` with a boolean result |
| Setting `allow_origins=["*"]` "temporarily" to debug a CORS issue during hardening | Opens all endpoints to cross-origin requests from any domain | The current ALLOWED_ORIGINS env var pattern is correct; debug CORS by checking the Railway env var value, not by widening origins |

---

## UX Pitfalls

Common user experience mistakes when adding performance/resilience features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Error boundary fallback renders a blank white div | User sees blank screen with no recovery path | Fallback must show the retry button (EXP-06 pattern already exists) and a human-readable message |
| Skeleton loaders added to Explorer that flash briefly even on fast connections | Visual noise; users perceive the app as slower than it is | Delay skeleton by 150–200ms: only show if load takes longer than that threshold |
| Adding a `<link rel="preload">` for the aurora background image without `fetchpriority="low"` | Browser treats it as high priority, competing with critical JS/CSS — LCP worsens | Background decorative images should use `fetchpriority="low"` or be loaded via CSS background-image (no preload needed) |
| Structured data (JSON-LD) added with `itemtype` that doesn't match actual page content | Google Search Console reports structured data errors; eligible rich results disappear | Use `WebSite` + `Organization` schemas only (appropriate for a marketplace homepage); do not add `Product` or `ItemList` schemas that claim structured expert data Google can't verify |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces specific to v5.4 hardening.

- [ ] **Backend event write decoupled:** `POST /api/events` returns 202 before DB write, not after — verify with a load test that 50 concurrent events don't produce 500s
- [ ] **GA4 DebugView verified:** Exactly one `page_view` event fires on fresh load, and one more per route navigation — test in GA4 DebugView (not just browser console)
- [ ] **Error boundary fallback is functional:** When the Explorer API call fails, the fallback renders the retry button — not a blank div or "Something went wrong" with no action
- [ ] **Global unhandledrejection capture:** `window.addEventListener('unhandledrejection', ...)` sends to Sentry — verify a manually thrown rejected promise appears in Sentry Issues
- [ ] **OG image publicly accessible:** `curl -I https://tcs-three-sigma.vercel.app/og-image.png` returns 200 (not 404) — confirm the file is in `frontend/public/`
- [ ] **Vercel SPA rewrite rule:** Direct navigation to `/admin/login` returns the React app (200), not a Vercel 404 — test by pasting URL in a fresh browser tab
- [ ] **vite preview tested after manualChunks changes:** `npm run build && npm run preview` runs without console errors on the production bundle — do not skip this step
- [ ] **`send_page_view: false` still present in index.html:** After any edits to `index.html` for SEO/meta tag improvements, confirm this line was not accidentally removed
- [ ] **Admin experts endpoint paginated:** `GET /api/admin/experts` no longer returns all 530+ experts in one response — Sentry large payload warning should disappear
- [ ] **Railway health check still passing after changes:** After any backend deploy, `curl https://<railway-url>/api/health` returns `{"status": "ok", "index_size": 530}` (or current expert count, non-zero)
- [ ] **SQLite pool ceiling raised:** `create_engine` call in `database.py` includes `pool_size=10, max_overflow=20` — confirm this parameter is present

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Events endpoint 500s under launch load | MEDIUM | Add `BackgroundTasks` to events endpoint and increase pool ceiling; redeploy Railway (~2 min). No data loss for in-flight requests that already returned 202, but events that returned 500 are permanently lost. |
| Workers added breaking SQLite | HIGH | Revert Procfile to single-worker immediately; redeploy. Check Railway SQLite file for corruption (`PRAGMA integrity_check`) via Railway Shell. If integrity check fails, restore from last Railway volume snapshot. |
| `manualChunks` circular dependency crash | LOW | Revert vite.config.ts to previous manualChunks configuration; rebuild and redeploy to Vercel (~3 min). No data loss. |
| GA4 double-counting (send_page_view removed) | HIGH | Restore `send_page_view: false` immediately; redeploy. The corrupted historical data cannot be fixed retroactively in GA4. Note the date range of corruption in a GA4 annotation. |
| Error boundary white-screen with blank fallback | LOW | Update fallback component to render retry button; redeploy Vercel (~1 min). |
| Social OG tags not working despite react-helmet-async | LOW | Accept limitation; improve static index.html OG tags instead. Remove react-helmet-async to reduce bundle size. |

---

## Pitfall-to-Phase Mapping

How v5.4 roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SQLite event write bottleneck | Backend performance phase — BackgroundTasks + pool ceiling | Load test: 50 concurrent POST /api/events all return 202, no 500s |
| Multiple workers breaking SQLite | Resilience phase — add comment to Procfile documenting constraint | Procfile contains explicit "DO NOT add --workers" comment |
| manualChunks circular dependency | Frontend bundle phase — test with `vite preview` after any chunk change | `npm run preview` shows no runtime errors in browser console |
| GA4 double-counting | Analytics hardening phase — add defensive comment to index.html first | GA4 DebugView shows exactly 1 page_view on load |
| Missing error boundaries | Resilience phase — add ErrorBoundary with functional fallback + global rejection handler | Manually force an API failure; error boundary catches it and renders retry button |
| Static-only OG tags | SEO phase — align expectations upfront | LinkedIn Post Inspector shows correct static OG image and description |
| Admin experts large payload | Admin pagination phase — paginate GET /api/admin/experts | Sentry large payload alert no longer fires after deploy |
| Vercel SPA 404 on direct URL | SEO/resilience phase — verify vercel.json rewrite rule | Direct navigation to /admin/login in a fresh browser tab loads the React app |

---

## Sources

- Direct codebase analysis: `app/database.py` (QueuePool default, WAL pragma), `app/main.py` (middleware ordering, single CORS middleware, no GZip), `app/routers/events.py` (synchronous db.commit pattern), `frontend/src/tracking.ts` (keepalive: true, fire-and-forget pattern), `frontend/vite.config.ts` (current manualChunks: recharts, @tanstack/react-table), `frontend/src/main.tsx` (11 lazy-loaded admin routes, single Suspense boundary, no ErrorBoundary), `frontend/index.html` (send_page_view: false confirmed, static OG tags confirmed, no robots.txt), `Procfile` (single worker, no --workers flag), `railway.json` (healthcheckPath: /api/health confirmed)
- SQLite WAL single-writer limitation: [Oldmoe's blog — The Write Stuff](https://oldmoe.blog/2024/07/08/the-write-stuff-concurrent-write-transactions-in-sqlite/), [SQLite WAL official docs](https://sqlite.org/wal.html), [Fly.io — How SQLite Scales Read Concurrency](https://fly.io/blog/sqlite-internals-wal/), [Ten Thousand Meters — SQLite concurrent writes](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- SQLAlchemy QueuePool exhaustion: [FastAPI Discussion #10450](https://github.com/fastapi/fastapi/discussions/10450), [SQLAlchemy Connection Pooling docs](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- SQLite + multiple workers: [Open WebUI HA docs — multi-replica SQLite](https://docs.openwebui.com/troubleshooting/multi-replica/), [Skypilot blog — abusing SQLite for concurrency](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/)
- Vite manualChunks circular dependency: [Vite issue #12209](https://github.com/vitejs/vite/issues/12209), [Vite issue #20202](https://github.com/vitejs/vite/issues/20202), [Soledad Penadés — Use manualChunks with Vite](https://soledadpenades.com/posts/2025/use-manual-chunks-with-vite-to-facilitate-dependency-caching/)
- FastAPI middleware ordering: [FastAPI advanced middleware docs](https://fastapi.tiangolo.com/advanced/middleware/), [Medium — CORS Dilemma in FastAPI middleware ordering](https://medium.com/@saurabhbatham17/navigating-middleware-ordering-in-fastapi-a-cors-dilemma-8be88ab2ee7b)
- fetch keepalive limits: [WHATWG fetch spec issue #679](https://github.com/whatwg/fetch/issues/679), [Stefan Judis — fetch keepalive](https://www.stefanjudis.com/today-i-learned/fetch-supports-a-keepalive-option-to-make-it-outlive-page-navigations/)
- GA4 SPA double-counting: [Google Developers — Measure SPAs](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [Analytics Mania — SPA tracking](https://www.analyticsmania.com/post/single-page-web-app-with-google-tag-manager/), [OptimizeSmart — GA4 cannot fully track SPA by default](https://www.optimizesmart.com/ga4-cannot-fully-track-spa-single-page-application-by-default/)
- React error boundaries async limitation: [React error boundaries legacy docs](https://legacy.reactjs.org/docs/error-boundaries.html), [Medium — Why Error Boundaries can't catch async errors](https://medium.com/@bloodturtle/why-react-error-boundaries-cant-catch-asynchronous-errors-28b9cab07658), [Kent C. Dodds — react-error-boundary](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)
- SPA SEO with social crawlers: [Medium — Dynamic OG Tags for React SPA on Vercel](https://medium.com/@fadingbeat/dynamic-og-tags-for-react-spa-on-vercel-with-ssr-and-vite-cee5771380be), [DEV — SEO Optimization for React + Vite](https://dev.to/ali_dz/optimizing-seo-in-a-react-vite-project-the-ultimate-guide-3mbh)
- Vercel SPA 404 routing: [Vercel Community — Rewrite to index.html for SPA](https://community.vercel.com/t/rewrite-to-index-html-ignored-for-react-vite-spa-404-on-routes/8412)

---
*Pitfalls research for: v5.4 Launch Hardening — FastAPI + SQLite + React/Vite performance, resilience, SEO, analytics*
*Researched: 2026-03-05*
