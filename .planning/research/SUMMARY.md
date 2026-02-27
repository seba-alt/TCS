# Project Research Summary

**Project:** Tinrate Expert Marketplace — v4.0 Public Launch
**Domain:** Expert Marketplace SPA — production hardening and admin overhaul on top of live v3.1
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

Tinrate v4.0 is a polish-and-hardening milestone on a fully-shipped production system (v3.1). The project is not greenfield — a 530-expert marketplace with FastAPI + SQLAlchemy + SQLite + FAISS on Railway and React 19 + Vite + Zustand on Vercel is already live and earning. Every change in v4.0 is surgical: two new Python packages (bcrypt 5.0, PyJWT 2.11), zero new frontend packages, and no architectural rewrites. The highest-leverage work is security hardening the admin auth, fixing a known bug in the t-SNE embedding heatmap, and adding the grid/list toggle that marketplaces universally offer. Industry tags (the most complex feature) belong in v4.1 — shipping them simultaneously with the grid toggle creates risky merge conflicts on shared files and introduces high-complexity Gemini batch-tagging work that should wait until post-launch traffic validates the domain tag model.

The recommended approach is to execute v4.0 in strict dependency order: auth and infrastructure first (security-critical, blocks safe testing of everything else), then frontend performance optimization, then user-facing public explorer polish (grid/list toggle, white search input, error states), then admin features (lead export, overview stats), and finally admin cleanup (destructive removals). Each phase is independently deployable. The codebase already contains all necessary abstractions — existing CSV export pattern, idempotent startup migrations, Zustand filterSlice, and react-virtuoso's dual Virtuoso/VirtuosoGrid exports — so each change is an extension of an existing pattern, not a new pattern.

The three non-negotiable risks to manage before public launch day: (1) SQLite without WAL mode will produce "database is locked" errors under concurrent public traffic — add `PRAGMA journal_mode=WAL` and `busy_timeout=5000` before launch; (2) the admin auth migration has a deployment-window lockout risk if backend and frontend are not deployed atomically — use a dual-mode endpoint that accepts both old and new credentials for one deploy cycle; (3) there is no brute-force protection on `/api/admin/auth` — add `slowapi` rate limiting in the same PR as the auth migration.

## Key Findings

### Recommended Stack

The existing production stack is correct and requires no changes beyond two new Python packages. `bcrypt==5.0.*` (password hashing, maintained by the pyca org, replaces the abandoned passlib which throws DeprecationWarning on Python 3.13+) and `PyJWT==2.11.*` (JWT token issuance, released January 2026, replaces the effectively-abandoned python-jose). No frontend packages are needed — react-virtuoso already exports both `Virtuoso` (list) and `VirtuosoGrid` (grid), `React.lazy` + `Suspense` are built into React 19, and lucide-react already includes the grid/list toggle icons. The t-SNE fix is a 2-line code move (task placed after `yield` instead of before it), not a dependency change.

**Core technologies (net-new for v4.0):**
- `bcrypt==5.0.*`: Admin password hashing — replaces passlib (abandoned 2020, DeprecationWarning on Python 3.13+), mirrors FastAPI official template migration in PR #1539
- `PyJWT==2.11.*`: Admin session tokens — replaces python-jose (unmaintained since 2023, open security issues), released January 2026

**Confirmed rejections:**
- `passlib`: Abandoned; FastAPI official template migrated away
- `python-jose`: Near-abandoned, known security issues
- `alembic`: No existing setup; startup raw SQL is the established project pattern
- `@loadable/component`: React.lazy handles this natively in React 19
- `react-window`: react-virtuoso already installed and covers all virtualization needs
- `vite-plugin-compression`: Vercel serves gzip/brotli automatically on all assets
- `slowapi`: Recommended for auth rate limiting — needs to be added to requirements.txt

### Expected Features

**Must have (v4.0 launch blockers):**
- Admin login with username + bcrypt-hashed password — plaintext env var key comparison is not defensible for a public-facing product
- SQLite WAL mode — required before public traffic hits concurrent writes to `user_events`
- Error state on public explorer grid — blank grid on 5xx is unacceptable for public launch
- White search input with keyword placeholders — current `bg-slate-900` input blends into dark header; signals incomplete product
- Grid / list view toggle — table stakes for any browsable marketplace; users expect density control
- Lead export CSV (email + search history) — enables post-launch outreach; no cross-referenced export currently exists
- Admin one-snap overview additions (total leads + expert pool stat cards) — two card swaps in existing KPI grid
- Sage double-rendering fix — desktop + mobile panel overlap due to missing visibility guards
- t-SNE heatmap fix — background task placed after `yield` in lifespan (fires at shutdown, not startup); 2-line fix
- Auth rate limiting — no brute-force protection on `/api/admin/auth` before public launch

**Should have (v4.1 — after launch traffic validates domain tag model):**
- Industry tags alongside domain tags — high complexity (6+ files, Gemini batch-tagging script, curated 15-tag taxonomy, Zustand persist version bump); defer until launch validates the domain tag model first
- Card click to email lead correlation — requires `session_id → email` data model addition not in v4.0 scope; document gap for v4.1

**Defer (v5+):**
- Multi-admin user management with roles
- Export with date-range filtering
- Saved filter presets
- Admin password reset via email (SMTP integration disproportionate for solo operator)
- Real-time live admin events (WebSocket complexity for marginal benefit)

### Architecture Approach

v4.0 integrates seven feature areas into the existing v3.1 architecture with minimal structural change. The system remains a React SPA on Vercel communicating over HTTPS to a FastAPI backend on Railway with a Railway-volume SQLite database. No new infrastructure, no new services, no SSR migration. The two architectural additions that matter most are: (1) route-level code splitting via `React.lazy` + `Suspense` on admin routes only (never on the public Explorer), reducing the public bundle by an estimated 30-50%; and (2) auth upgraded from raw string comparison to bcrypt verification with PyJWT tokens while keeping the existing `X-Admin-Key` header and `sessionStorage` mechanisms unchanged.

**Major components changed in v4.0:**

1. `app/routers/admin.py` — auth endpoint upgraded (username + bcrypt); new `GET /export/leads.csv` endpoint; rate limiting decorator
2. `frontend/src/components/marketplace/ExpertList.tsx` — NEW; `Virtuoso`-based list renderer for the list view toggle
3. `frontend/src/store/filterSlice.ts` — add `viewMode: 'grid' | 'list'` field + `setViewMode` action; persist to localStorage
4. `frontend/src/main.tsx` — convert all admin page imports to `React.lazy()` dynamic imports with Suspense wrappers
5. `app/main.py` — t-SNE task moved before `yield`; `PRAGMA journal_mode=WAL` + `busy_timeout=5000` on engine connect
6. `frontend/src/pages/MarketplacePage.tsx` — conditional `ExpertGrid` vs `ExpertList` render based on `viewMode`; toggle button

**Key architectural patterns in use:**
- Idempotent SQLite column migration in lifespan (`ALTER TABLE ADD COLUMN` wrapped in try/except)
- Dual-renderer with shared store data (`VirtuosoGrid` and `Virtuoso` both consume `resultsSlice.experts[]` — no separate fetch)
- Additive filter parameters (empty array = no filter applied; loop body never executes)
- Client-side session expiry timestamp alongside sessionStorage key (8h TTL, tab-close clears)
- Industry tags as Stage 1 SQL `WHERE` pre-filter only — FAISS index is not rebuilt for v4.0

### Critical Pitfalls

1. **Auth migration lockout during Railway → Vercel deployment gap** — Railway deploys before Vercel; old sessionStorage token fails new backend verification in the 30-90s gap between the two deploys. Prevention: ship a dual-mode `/api/admin/auth` that accepts BOTH the old raw key AND the new username+password for one deploy cycle. Remove the old path after confirming new login works in production.

2. **VirtuosoGrid → Virtuoso remount storm from inline component definitions** — if `components.Header`, `components.Footer`, or `itemContent` are defined as arrow functions inside the render function, React treats them as new types on every render and unmounts/remounts the entire list on every filter change. Prevention: define all `components` objects as module-level constants outside the component function; use `key={viewMode}` on the Virtuoso component when toggling.

3. **SQLite "database is locked" under concurrent public traffic** — SQLite default journal mode blocks readers during any write; concurrent `user_events` inserts under real traffic produce `OperationalError`. Prevention: add `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` via SQLAlchemy `event.listens_for(engine, "connect")` before public launch.

4. **Industry + domain tag filter collision** — if both tag types share the same `tags: string[]` array in filterSlice, the backend cannot distinguish them and may double-filter (Stage 1 SQL AND FAISS semantic search on the same value), producing near-zero results. Prevention: keep `industryTags: string[]` as a separate field, sent as a separate query param, applied only in Stage 1 SQL pre-filter (never in FAISS). Also requires Zustand persist `version` bump from 1 to 2 with a `migrate` function.

5. **Admin panel cleanup removes live dependencies atomically** — removing the `IntelligenceDashboardPage` (t-SNE) without also removing `asyncio.create_task(_compute_tsne_background(app))` in lifespan leaves CPU-consuming computation running for no visible output. Removing `SettingsPage` freezes HyDE/feedback boost toggles at their last written values permanently. Prevention: remove frontend route + sidebar link + backend endpoint + background task in the same PR. Grep all deleted route strings across frontend before merging.

6. **No brute-force protection on `/api/admin/auth`** — the endpoint is discoverable from the public JS bundle; bots will find it within hours of public launch. Prevention: add `slowapi` rate limiting (5 attempts/minute/IP) in the same PR as the auth migration. bcrypt verification's ~100ms cost provides a natural additional rate limit against automated attacks.

## Implications for Roadmap

Based on combined research, a 5-phase structure is recommended. The ordering is driven by: (1) security and infrastructure must be solid before user-facing work and testing begins, (2) the t-SNE bug fix is trivial and slots into the infrastructure phase, (3) code splitting improves the public experience and is cleanest when done before new components are added, (4) the grid/list toggle is independent of industry tags and should ship before them to reduce merge conflict risk on shared files, and (5) admin cleanup (destructive removals) comes last to avoid removing something still being tested.

### Phase 1: Security and Infrastructure Hardening

**Rationale:** Auth migration and SQLite WAL mode are non-negotiable before public launch. Auth must be first so all subsequent testing uses the new auth flow. Rate limiting on the auth endpoint ships in the same PR. The t-SNE 2-line fix is trivial and slots here alongside other `main.py` changes.

**Delivers:**
- Admin login with username + bcrypt-hashed password (bcrypt 5.0 + PyJWT 2.11 added to requirements.txt)
- Rate limiting on `/api/admin/auth` via slowapi (5 attempts/minute/IP + failed auth logging via structlog)
- Dual-mode auth endpoint for safe deployment transition (old key + new username/password accepted for one cycle)
- Client-side session expiry (8h TTL timestamp in sessionStorage alongside admin key)
- SQLite WAL mode + busy_timeout (adds `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000` on engine connect via SQLAlchemy event listener)
- t-SNE background task moved before `yield` in lifespan (was running at shutdown, never at startup)

**Features addressed:** Admin bcrypt password login, SQLite production hardening, t-SNE heatmap fix, auth brute-force protection

**Pitfalls avoided:** Auth migration lockout (dual-mode endpoint), brute-force auth attack (slowapi + bcrypt), SQLite database locked errors (WAL mode)

**Research flag:** Standard patterns — all packages verified, code change locations identified. No additional research needed.

---

### Phase 2: Frontend Performance Optimization

**Rationale:** Code splitting is pure optimization with no functional change — safe to ship early. Establishing lazy-loaded admin routes before new components are added is cleaner than retrofitting lazy loading later. This also reduces public bundle size immediately, setting a good baseline for measuring the Explorer's performance at launch.

**Delivers:**
- All admin routes converted to `React.lazy()` dynamic imports with Suspense wrappers in `main.tsx`
- Optional `manualChunks` for recharts and @tanstack/react-table in `vite.config.ts`
- Expected 30-50% reduction in initial public bundle size (admin-specific code no longer downloaded by public users)

**Features addressed:** Frontend performance optimization for public launch

**Pitfalls avoided:** Suspense boundary placed at route level (not router level) — prevents loading flash on public Explorer; admin code excluded from public bundle; `MarketplacePage` remains statically imported (not lazy-loaded)

**Research flag:** Standard pattern — React.lazy + Suspense on route level is React 19 built-in and well-documented. No additional research needed.

---

### Phase 3: Public Explorer Polish

**Rationale:** User-facing features that directly affect first impressions at public launch. Grid/list toggle is the most complex item here; white search input and error states are quick wins that can ship together. Sage and mobile fixes are grouped here as public-facing polish.

**Delivers:**
- Grid / list view toggle: `viewMode: 'grid' | 'list'` in filterSlice (localStorage persist), new `ExpertList.tsx` using `Virtuoso` (variable-height), toggle buttons in toolbar with lucide-react `LayoutGrid` / `List` icons
- White search input with keyword placeholders in `Header.tsx` (`bg-white text-gray-900 placeholder-gray-400`)
- Inline error card on explorer grid ("`Having trouble loading experts. Try refreshing.`" + Retry button; handled in `useExplore` hook on non-200 response)
- Sage double-rendering fix (`md:hidden` on mobile sheet, `hidden md:block` on desktop panel)
- Mobile single-tap profile expand (change from double-tap to single-tap)

**Features addressed:** Grid/list view toggle, white search input, error states, Sage fix, mobile polish

**Pitfalls avoided:** VirtuosoGrid/Virtuoso remount storm (define `components` as module-level constants; use `key={viewMode}` on toggle); height container breakage (test container height resolves to non-zero px at 375px / 768px / 1280px before merging)

**Research flag:** Grid/list toggle height behavior at breakpoints warrants a dev-build verification step before merging. Not a research task — add to phase acceptance criteria.

---

### Phase 4: Admin Features

**Rationale:** Admin functionality requires auth to be working (Phase 1) but is otherwise independent of the public Explorer changes. Grouped to minimize context-switching across admin files. Lead export follows the existing `export_newsletter_csv` pattern exactly — low implementation risk.

**Delivers:**
- Lead export CSV: new `GET /api/admin/export/leads.csv` endpoint; joins `newsletter_subscribers` LEFT JOIN `conversations` on email; columns: email, first_seen, last_active_at, search_count, gap_searches, recent_queries (pipe-separated); "Export Leads CSV" button on `LeadsPage.tsx` using existing fetch-blob pattern
- Admin one-snap overview: replace "Match Rate" and "Gaps" KPI cards with "Total Leads" and "Expert Pool" stat cards; two new fields in `GET /api/admin/stats` response (`total_leads`, `expert_count`)

**Features addressed:** Lead export CSV, admin one-snap overview additions

**Pitfalls avoided:** Session-to-email correlation not fabricated — card click data gap documented for v4.1 (fix: include `session_id` in email gate submission); new `/export/leads.csv` endpoint added to `router` (not `auth_router`) with `_require_admin` dependency inherited

**Research flag:** Standard pattern — follows existing `export_newsletter_csv` implementation. No additional research needed.

---

### Phase 5: Admin Dashboard Cleanup

**Rationale:** Destructive work (removing pages, routes, background tasks) comes last, after new features are confirmed working and tested. Removing a page that is still being tested during previous phases would cause unnecessary 404s and complicate debugging.

**Delivers:**
- Admin sidebar simplified (remove low-use nav items per final operator decision)
- `IntelligenceDashboardPage` (t-SNE) removed — frontend route + sidebar link removed; `asyncio.create_task(_compute_tsne_background)` removed from lifespan; `app.state.tsne_cache` kept as empty list (other code may reference it)
- Score Explainer hash tab removed from `ToolsPage` and page component deleted (if decided)
- `OverviewPage` expanded: unmet demand summary pulled in from Gaps page

**Features addressed:** Admin dashboard simplification

**Pitfalls avoided:** Atomic removal (frontend route + backend endpoint + background task in same PR); dependency audit (grep all deleted route strings across frontend before merging: `grep -r "tsne|intelligence|score-explainer"`)

**Research flag:** Requires a pre-phase dependency audit (~30 minutes) to map all callers before cutting any page. Not an external research task. Final decision on which pages to remove must come from the operator before planning this phase.

---

### Phase Ordering Rationale

- **Security first:** Auth migration lockout and brute-force risks are production-breaking; they must be resolved before any other testing uses the admin panel.
- **Infrastructure before features:** WAL mode must be in place before public traffic arrives; it cannot be safely retrofitted as a hotfix on launch day.
- **Performance before new components:** Code splitting is cleanest when done before adding `ExpertList.tsx` and other new components to the tree.
- **Explorer features before admin features:** Public-facing polish (grid toggle, error states) has higher user visibility and is independent of the admin work.
- **Cleanup last:** Destructive removals happen after all new features are confirmed working to avoid removing something still being actively tested.
- **Industry tags deferred to v4.1:** The 6-file scope, Gemini batch-tagging pipeline, and Zustand persist version bump make industry tags a post-launch feature. Shipping after launch traffic validates the domain tag model is the correct sequencing.

### Research Flags

**Needs deeper research during planning:** None of the 5 phases require `/gsd:research-phase`. All technology choices are verified, code change locations are identified, and implementation patterns are established in the codebase.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** bcrypt + PyJWT usage verified against PyPI and FastAPI official template migration. WAL mode pattern verified against SQLite docs and production SQLAlchemy patterns.
- **Phase 2:** React.lazy + Suspense on route level is React 19 built-in. Vite manualChunks is standard Rollup config.
- **Phase 3:** VirtuosoGrid / Virtuoso conditional render is documented in react-virtuoso API. Height test at breakpoints is a dev-build verification step, not a research task.
- **Phase 4:** Lead export follows existing `export_newsletter_csv` pattern exactly.
- **Phase 5:** Dependency audit (grep) is the pre-work. Final cleanup decisions are operator decisions, not research tasks.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against PyPI and current package.json/requirements.txt. Two new packages confirmed (bcrypt 5.0, PyJWT 2.11). All rejected packages have documented abandonment or redundancy rationale. |
| Features | HIGH | Codebase fully inspected. Feature list derived from direct file analysis + 2025/2026 marketplace UX sources. Industry tags complexity and v4.1 deferral is well-justified with specific conflict risks identified. |
| Architecture | HIGH | All touch points identified from direct code inspection. Component boundaries, data flows, and migration patterns confirmed against existing codebase patterns. Build order derived from actual file dependencies. |
| Pitfalls | HIGH | Root causes identified from direct code inspection (t-SNE misplacement confirmed at `app/main.py` lines 334-335; auth gap from Railway/Vercel deploy timing measured). External pitfalls verified against react-virtuoso GitHub issues, SQLite WAL docs, and FastAPI security sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Industry tags Gemini tagging accuracy:** Batch-tagging 530 experts with a curated 15-tag taxonomy has MEDIUM confidence — accuracy depends on bio content quality. Experts with thin bios may get imprecise industry assignments. Address during v4.1 planning by testing the Gemini enum-constrained prompt on a sample of 20 experts before committing to full batch tagging.

- **Card click to email correlation:** `user_events.session_id` cannot be reliably joined to `email_leads.email` without a data model addition. This gap is documented and deferred to v4.1. Fix: include `session_id` in the email gate submission payload so future events can be attributed to leads.

- **Admin dashboard simplification scope:** The exact set of pages to remove (Score Explainer, IntelligenceDashboard, GapsPage, DataPage) needs a final decision from the operator before Phase 5 begins. The dependency audit in Phase 5 prep will produce the impact map needed for that decision.

- **SessionStorage XSS risk on shared origin:** Admin key stored in `sessionStorage` on the same origin as the public Explorer is a documented risk if the public Explorer ever renders user-controlled content. Currently not a risk (expert bios are admin-controlled), but should be recorded as a constraint for any future user-generated content feature.

- **slowapi package not in requirements.txt:** `slowapi` is recommended for auth rate limiting but is not currently installed. Needs to be added to `requirements.txt` and `SlowAPIMiddleware` registered in `main.py`. Verify Railway Python environment compatibility before Phase 1 begins.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `app/routers/admin.py`, `app/main.py`, `app/models.py`, `app/services/explorer.py`, `app/routers/explore.py`, `frontend/src/main.tsx`, `frontend/src/store/filterSlice.ts`, `frontend/src/store/resultsSlice.ts`, `frontend/src/components/marketplace/ExpertGrid.tsx`, `frontend/src/admin/LoginPage.tsx`, `frontend/src/admin/RequireAuth.tsx`, `frontend/src/admin/hooks/useAdminData.ts`, `frontend/package.json`, `requirements.txt`
- [bcrypt 5.0.0 on PyPI](https://pypi.org/project/bcrypt/) — Python >=3.8, Apache-2.0, verified 2026-02-27
- [PyJWT 2.11.0 on PyPI](https://pypi.org/project/PyJWT/) — released 2026-01-30, Python >=3.9, verified 2026-02-27
- [FastAPI official template passlib → bcrypt migration PR #1539](https://github.com/fastapi/full-stack-fastapi-template/pull/1539)
- [passlib abandonment — fastapi/fastapi #11773](https://github.com/fastapi/fastapi/discussions/11773)
- [python-jose abandonment — fastapi/fastapi #9587](https://github.com/fastapi/fastapi/discussions/9587)
- [FastAPI lifespan events docs](https://fastapi.tiangolo.com/advanced/events/) — startup vs shutdown semantics confirmed
- [SQLite WAL mode](https://sqlite.org/wal.html) — WAL internals, concurrent readers/writers, checkpoint starvation
- [react-virtuoso API reference](https://virtuoso.dev/react-virtuoso/api-reference/) — VirtuosoGrid vs Virtuoso, uniform vs variable height distinction
- [react-virtuoso troubleshooting guide](https://virtuoso.dev/react-virtuoso/troubleshooting/) — inline component definition remount cause, getState/restoreStateFrom API

### Secondary (MEDIUM confidence)

- [Vite code splitting 2025 case study](https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) — 30-50% bundle size reduction estimate with route splitting
- [Nielsen Norman Group — Filter Categories and Values](https://www.nngroup.com/articles/filter-categories-values/) — separate domain vs industry filter dimension UX rationale
- [SQLite "database is locked" solutions](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) — WAL + busy_timeout production pattern
- [Zustand version migration](https://dev.to/diballesteros/how-to-migrate-zustand-local-storage-store-to-a-new-version-njp) — version bump + migrate function for schema changes
- [react-virtuoso GitHub Issues #440, #479, #703, #801](https://github.com/petyosi/react-virtuoso/issues) — height, padding shake, and scroll bugs
- [Vite code splitting vendor chunk issue #3731](https://github.com/vitejs/vite/issues/3731) — Framer Motion LazyMotion bypass via vendor chunk
- [FastAPI Security best practices 2025](https://blog.greeden.me/en/2025/10/14/a-beginners-guide-to-serious-security-design-with-fastapi-authentication-authorization-jwt-oauth2-cookie-sessions-rbac-scopes-csrf-protection-and-real-world-pitfalls/) — session fixation, XSS countermeasures

### Tertiary (LOW confidence)

- [Lack of Brute-Force Protection advisory (GHSA-7q62-r88r-j5gw)](https://github.com/ethyca/fides/security/advisories/GHSA-7q62-r88r-j5gw) — real-world unprotected admin login advisory, motivates slowapi recommendation
- [Smart SaaS Dashboard Design Guide 2026 — F1Studioz](https://f1studioz.com/blog/smart-saas-dashboard-design/) — F-pattern layout guidance for KPI card ordering on overview page

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
