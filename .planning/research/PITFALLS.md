# Pitfalls Research

**Domain:** Adding production-hardening features to a live React + FastAPI expert marketplace (v3.1 → v4.0 Public Launch)
**Researched:** 2026-02-27
**Confidence:** HIGH — based on direct codebase analysis of `RootLayout.tsx`, `LoginPage.tsx`, `RequireAuth.tsx`, `admin.py`, `ExpertGrid.tsx`, `MarketplacePage.tsx`, `ExpertCard.tsx`, `filterSlice.ts`, `store/index.ts`, `vite.config.ts`, `package.json` plus targeted web research on each specific failure class.

The seven change areas in v4.0 each carry distinct, non-obvious failure modes:
1. Auth migration — replacing single-key login with username+password+hashed credentials
2. Grid/list view toggle — switching between VirtuosoGrid and Virtuoso in a live virtualized list
3. Tag taxonomy — adding industry tags alongside existing AI-generated domain tags
4. Admin simplification — removing tools from a live admin panel without breaking hidden dependencies
5. Performance optimization — lazy loading and code splitting on a Framer Motion + Virtuoso app
6. SQLite under public traffic — going live with a single-file database on Railway
7. Admin security exposure — a sessionStorage-based single-key admin on the same public domain

---

## Critical Pitfalls

Mistakes that cause lockouts, rewrites, or production crashes.

---

### Pitfall 1: Auth Migration Locks Out the Admin Before New Credentials Work

**What goes wrong:**
The current auth flow stores the raw `ADMIN_SECRET` value in `sessionStorage` as `admin_key`, and every admin endpoint reads `X-Admin-Key` and compares it to `ADMIN_SECRET` directly. When migrating to username + hashed password, there is a deployment window where the backend expects hashed credential verification but the frontend still sends the raw key (or vice versa). If the backend is deployed first, the existing `sessionStorage` token no longer passes validation and the admin is immediately locked out. If the frontend is deployed first, the new login form submits a password hash that the old backend cannot verify.

Additionally, `RequireAuth.tsx` only checks `sessionStorage.getItem('admin_key')` — a string existence check. If the migration changes the key name or format (e.g., to a JWT stored under a different key), `RequireAuth` passes even when the stored token is expired or malformed, because it never validates the token's content client-side.

**Why it happens:**
Auth is touched in three places simultaneously: the `/api/admin/auth` backend endpoint, the `LoginPage.tsx` form, and `RequireAuth.tsx` guard. Developers often migrate the backend and frontend in the same commit but deploy to Railway and Vercel at different times (Railway deploys first, Vercel can take 30–90 seconds longer). The gap creates a broken state.

**How to avoid:**
- Keep the existing `/api/admin/auth` endpoint functioning with the old single-key path until the new credentials are confirmed working in production. Add the new username+password path alongside, not as a replacement.
- Deploy backend first with the new `/api/admin/auth` accepting EITHER the old raw key OR the new credentials (dual-mode for one deploy cycle). After verifying new login works, remove the old path.
- Store a backup of `ADMIN_SECRET` in Railway env vars even after switching to hashed credentials — needed for rollback.
- Test the full login → dashboard → API call cycle in a Railway preview environment before merging to main.
- Never rename the `sessionStorage` key without clearing the old one first: `sessionStorage.removeItem('admin_key')` before setting the new key name.

**Warning signs:**
- Railway logs show `401 Unauthorized` on `/api/admin/auth` immediately after deploy
- Admin dashboard shows blank page or redirects to `/admin/login` in a loop
- `RequireAuth` passes but all subsequent admin API calls return 401 (token format changed but guard didn't update)

**Phase to address:** Admin auth migration phase — implement dual-mode auth endpoint, test before removing old path.

---

### Pitfall 2: VirtuosoGrid → Virtuoso List Toggle Causes Scroll Jumps, Height Breakage, and Remount Storms

**What goes wrong:**
`ExpertGrid.tsx` uses `VirtuosoGrid` with fixed-height cards (`h-[180px]`) in a CSS grid layout. Adding a list view requires switching to `Virtuoso` (variable-height list component). Three concrete failure modes emerge:

**A — Height container breakage:** Both `VirtuosoGrid` and `Virtuoso` require the parent container to have an explicit, non-zero height. The current container is `style={{ height: '100%' }}` inside a flexbox chain from `MarketplacePage`. If the toggle conditionally renders `<VirtuosoGrid>` or `<Virtuoso>` without forcing the parent to re-measure, the list component may inherit `height: 0` on initial render and show nothing, or render all items un-virtualized (defeating the purpose).

**B — Remount storm from inline component definitions:** `VirtuosoGrid` and `Virtuoso` accept `components` and `itemContent` props. If `components.Header`, `components.Footer`, or `itemContent` are defined as arrow functions inside the `ExpertGrid` render function, React treats them as new component types on every render. Switching the toggle causes the entire list to unmount and remount — Virtuoso re-initializes, all cards re-render, and scroll position is lost. This is a documented react-virtuoso issue that surfaces under conditional rendering.

**C — Scroll position loss on toggle:** When the user scrolls down 200 experts in grid view and toggles to list view, the VirtuosoGrid scroll position (measured in pixels from a CSS grid layout) does not translate to Virtuoso's scroll position (measured by item index). The list resets to index 0. Using `getState()`/`restoreStateFrom` on VirtuosoGrid does not work with Virtuoso — they are different components with different state shapes.

**Why it happens:**
`VirtuosoGrid` and `Virtuoso` are not interchangeable siblings — they have different internal measurement models. Developers assume that toggling between them is like toggling a CSS class, but each component bootstraps its own ResizeObserver, scroll event listener, and item measurement loop on mount.

**How to avoid:**
- Define all `components` objects (`Header`, `Footer`, `ItemWrapper`) as `const` outside the `ExpertGrid` render function, or use `useMemo` with a stable dependency array. This prevents remount storms on re-render.
- Use a `key` prop to explicitly control remounting: when the view mode changes, set `key={viewMode}` on the Virtuoso component to signal intentional remount rather than letting React diff the old VirtuosoGrid against the new Virtuoso (which would cause subtle internal state bugs).
- Accept scroll position loss on toggle — this is the correct UX behavior for a view switch. Do not attempt to preserve scroll position across incompatible component types.
- Test height at all viewport breakpoints with Chrome DevTools before merging: the flexbox chain that feeds `height: '100%'` into the Virtuoso container must resolve to a non-zero pixel value on every breakpoint.
- Keep `itemClassName="min-h-0"` from the current grid on the list wrapper too — `min-h-0` prevents grid/flex row blowout that can cause height calculation loops in Virtuoso.

**Warning signs:**
- Expert grid renders 0 items but no empty state (height is 0, Virtuoso renders nothing)
- Console shows `ResizeObserver loop limit exceeded` — Virtuoso remounting rapidly
- Every filter change remounts all cards (visible as card images reloading) — inline component definitions are the cause
- Network tab shows `GET /api/explore` firing twice on toggle (filter change + component remount both trigger useExplore)

**Phase to address:** Grid/list toggle phase — define component types outside render before wiring the toggle.

---

### Pitfall 3: Industry Tags and Domain Tags Collide in the Filter Store and Tag Cloud

**What goes wrong:**
The current `tags` array in `filterSlice.ts` is a flat string array with no type distinction. Domain tags (AI-generated, e.g., "Machine Learning", "B2B Sales") and industry tags (manually categorized, e.g., "Finance", "Healthcare") will be stored in the same array. The `/api/explore` backend receives `tags` as a query parameter and performs FTS5 or FAISS filtering without knowing which tags are domain tags vs. industry tags.

Three failure modes:

**A — Filter collision:** A user who selects industry tag "Finance" and domain tag "Financial Modeling" sends both to the backend. The backend's `CATEGORY_KEYWORDS` dict in `admin.py` maps "Finance" as an industry category, while the FAISS search uses "Finance" as a semantic tag. The two interpretations can conflict — the backend may filter to `category = 'Finance'` AND search for experts tagged with "Finance", double-filtering and dramatically reducing results.

**B — Tag cloud visual mixing:** The `TagCloud.tsx` component renders all 18 tags from the expert data without type distinction. If industry tags ("Finance", "Tech") appear alongside domain tags ("LLM Engineering", "Growth Hacking") in the same cloud, users cannot distinguish their function. Clicking "Finance" with the expectation of filtering by industry but actually filtering by FAISS semantic tag (or vice versa) produces confusing results.

**C — Zustand persist schema conflict:** The `explorer-filters` localStorage persist key (version 1) stores `tags: string[]`. If the tag taxonomy change adds a new shape (e.g., `tags: { domain: string[], industry: string[] }`) and a user visits with old persisted state, Zustand's `onRehydrateStorage` merges the old flat array into the new structure, corrupting state. The persist `version` must be bumped and a `migrate` function provided.

**Why it happens:**
The filter store was designed for a single tag namespace. Adding a second namespace without updating the backend filter logic, the persist schema, and the tag cloud rendering in a coordinated way creates three independent failure points that are easy to miss in code review.

**How to avoid:**
- Decide the filter model before writing code: either (a) keep one flat `tags` array and let the backend distinguish by value (risky — requires the backend to know all industry tag names), or (b) add a separate `industryTags: string[]` field to the filter store and send it as a separate query param to the backend.
- Option (b) is safer. Add `industry_tags` as an optional query param to `/api/explore`, have the backend apply it as a `WHERE category IN (...)` pre-filter before FAISS, and keep domain `tags` as the existing semantic search input.
- Bump the Zustand persist `version` from `1` to `2` and add a `migrate` function that converts old `{tags: [...]}` to `{tags: [...], industryTags: []}` — this prevents stale localStorage from breaking state for returning users.
- Visually distinguish the two tag types in `TagCloud.tsx` with color or section headers so users understand their different functions.
- Add industry tags to `FilterChips.tsx` render logic — if a user selects an industry tag, it must appear as an active chip and clearing it must work the same way as domain tag chips.

**Warning signs:**
- Users report "Finance" filter returns 0 results (double-filter collision)
- Tag cloud shows 30+ tags after adding industry tags — cloud overflows or wraps beyond the proximity-scale animation's design capacity
- Returning users see a blank grid on page load (Zustand rehydration failure from schema mismatch — corrupted `tags` field)
- `resetFilters()` in filterSlice only resets `tags: []` but not `industryTags: []` (missing from `filterDefaults`)

**Phase to address:** Tag taxonomy phase — define the backend query param contract and Zustand schema before touching the UI.

---

### Pitfall 4: Admin Panel Cleanup Removes Functionality That Other Parts Depend On

**What goes wrong:**
The admin panel has inter-page dependencies that are not obvious from the navigation structure alone. Removing a page or tool can break a page that remains. Three specific risks:

**A — `SearchLabPage` depends on the `compare` endpoint also used by hidden features:** `POST /api/admin/compare` in `admin.py` is called by `SearchLabPage.tsx` for A/B pipeline testing. If `SearchLabPage` is removed as "unused", the endpoint itself may be left in the backend but the frontend fetch hook (`useAdminData.ts`) may still reference it. Conversely, if `SearchLabPage` is kept but the `ToolsPage` hash navigation to `#search-lab` is removed, users cannot reach it but the page component remains in the bundle.

**B — `IntelligenceDashboardPage` (t-SNE) and the embedding heatmap are broken (always loading) but the t-SNE background task is still running at startup:** Removing the dashboard page would stop the broken UI from being visible, but `_compute_tsne_background` still runs on every Railway startup (async task in `main.py` line 105–140), consuming CPU for data nobody sees. The fix is removing both the UI page AND the startup task together.

**C — `SettingsPage` writes to the `settings` table; the steering panel toggles (HyDE, feedback boost) are read at runtime by `search_intelligence.py`:** If `SettingsPage` is removed but the `settings` table keeps being read by the backend, the settings become permanently frozen at their last written values. This is acceptable but must be a conscious decision — the page removal should be documented as "settings are now fixed at [current values]".

**Why it happens:**
Admin pages look independent but share backend endpoints, background tasks, and runtime state. Cleanup that focuses on the frontend routing (removing route entries from `AdminApp.tsx` or the sidebar links) leaves the backend machinery running. The inverse — removing backend endpoints without removing their frontend callers — causes 404 errors on the pages that remain.

**How to avoid:**
- For each admin page to be removed, audit: (1) which backend endpoint it calls, (2) whether that endpoint is called anywhere else, (3) whether removing the page also means removing a background task or scheduled job.
- Create a dependency map before cutting: list every `adminFetch()` or `adminPost()` call in the page being removed and trace each to its backend route.
- Remove frontend route + sidebar link + backend endpoint + background task in the same PR when they are exclusive to the removed page. Separate PRs for backend and frontend removals create a window where 404s appear in the admin.
- For `IntelligenceDashboardPage` (t-SNE): remove the page, the hash tab entry in `ToolsPage`, AND the `asyncio.create_task(_compute_tsne_background(app))` call in `main.py` lifespan. Keep the `tsne_cache` attribute on `app.state` as an empty list (other code may reference it) but remove the computation.
- After cleanup, run a grep for every deleted route string across the frontend — `grep -r "tsne\|intelligence\|score-explainer"` — to catch dangling references in test files, type definitions, or hooks.

**Warning signs:**
- Railway logs show `asyncio.Task exception was never retrieved` from removed background task
- Admin sidebar shows links to pages that return 404 (route removed but link not removed)
- `useAdminData.ts` fetch hooks call deleted endpoints — React Query / SWR / manual fetch shows 404 in network tab on pages that remain visible

**Phase to address:** Admin cleanup phase — build the dependency map first, remove all three layers (frontend route, backend endpoint, background task) atomically.

---

### Pitfall 5: Lazy Loading Framer Motion or Vite Code Splitting Cause Performance Regressions

**What goes wrong:**
Two specific regressions can occur when adding code splitting or lazy loading to this specific stack:

**A — LazyMotion vendor chunk bypass:** The current app imports `motion` from `motion/react` (Framer Motion v12 equivalent, ~34kb gzipped). Adding `LazyMotion` and swapping to the `m` component reduces initial bundle but requires Vite's `manualChunks` to not place the full motion library in the vendor chunk. Vite's default behavior eagerly bundles all `node_modules` into a single vendor chunk, making `LazyMotion`'s deferred loading ineffective — the 34kb is still loaded immediately. This is a documented Vite + Framer Motion compatibility issue.

**B — React.lazy + Suspense on admin pages flashes loading state on the public Explorer:** If `React.lazy()` is used for admin page components (sensible, since admin is rarely visited), the Suspense fallback displays while the admin chunk loads. If the Suspense boundary is placed too high in the component tree — e.g., wrapping `<RouterProvider>` — then every cold navigation (first visit to any route) shows a loading flash, including the public Explorer on first load.

**C — VirtuosoGrid and motion animation competing:** The current `ExpertGrid.tsx` uses `animate()` from `motion/react` for the barrel roll easter egg. `VirtuosoGrid` uses `ResizeObserver` internally. If an animation runs on the `containerRef` that wraps `VirtuosoGrid`, the element's layout changes during animation can trigger `ResizeObserver` callbacks inside Virtuoso, causing scroll position recalculation mid-animation. This is a known react-virtuoso issue (GitHub issue #440 — rapid padding changes causing screen shake).

**Why it happens:**
Performance optimization on an existing app often means adding lazy loading as an afterthought without auditing which modules are in which chunks. The Framer Motion issue specifically affects apps that look like they should benefit from `LazyMotion` but are prevented by Vite's bundling defaults.

**How to avoid:**
- Do not add `LazyMotion` unless also setting `build.rollupOptions.output.manualChunks` to exclude `motion/react` from the vendor chunk — otherwise the optimization is purely cosmetic.
- Place `Suspense` boundaries at the route level, not at the router level: wrap individual route `element` values in `<Suspense fallback={<SkeletonGrid />}>` so only that route's chunk triggers a loading state.
- For the barrel roll animation: wrap the `animate()` call with a `requestAnimationFrame` guard or use CSS transforms (instead of layout-affecting properties) to avoid triggering Virtuoso's ResizeObserver. The current implementation uses `rotate: 360` which is a transform — this is safe. Do not change it to `width` or `height` animations.
- The most impactful performance gain for this app is not code splitting but rather ensuring `VirtuosoGrid`'s `overscan={200}` is tuned correctly. Too-high overscan pre-renders unnecessary cards; too-low causes blank patches during fast scrolling.
- Run `npx vite build --analyze` (or Rollup visualizer) before and after any bundling change to verify chunk sizes actually decreased.

**Warning signs:**
- Bundle size unchanged after adding LazyMotion (Framer Motion still in vendor chunk)
- First paint shows loading flash on the public Explorer (Suspense boundary too high)
- Screen shakes when barrel roll animation triggers while user is mid-scroll (ResizeObserver conflict)
- Console warning: `ResizeObserver loop limit exceeded` during animation

**Phase to address:** Performance optimization phase — audit bundle composition before changing anything; use `--analyze` as first step.

---

### Pitfall 6: SQLite Under Real Public Traffic Hits "Database Is Locked" Without WAL Mode

**What goes wrong:**
SQLite in default journal mode (DELETE/rollback) blocks readers during any write operation. Railway runs a single FastAPI process, but FastAPI is async — multiple concurrent requests run in the same event loop, and SQLAlchemy's async session management can queue multiple write transactions that compete for the write lock. Under real public traffic (not just admin use), the `user_events` table receives a `POST /api/events` write on every card click, Sage query, and filter change. These fire-and-forget writes arrive concurrently and can cause `sqlite3.OperationalError: database is locked` if `busy_timeout` is not configured.

The specific scenario: 10 users browse simultaneously, each triggering filter events every few seconds → 20–50 concurrent `INSERT INTO user_events` calls → the write lock queue backs up → SQLAlchemy raises `OperationalError` → the `/api/events` endpoint returns 500 (even though it should be fire-and-forget — the 500 is logged by Sentry, creating noise).

Additionally, the `search_intelligence.py` runs complex multi-table reads during every `/api/explore` call. If a write is in progress (even a tiny `user_events` insert), those reads queue behind it without WAL mode.

**Why it happens:**
SQLite's default journal mode was set for single-user desktop use. WAL mode requires explicit configuration: `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` (5s wait before giving up). SQLAlchemy does not set either by default. The issue only surfaces under real concurrent traffic — dev and soft-launch with a few users never hits this threshold.

**How to avoid:**
- Add WAL mode and busy_timeout configuration to the SQLAlchemy engine in `database.py`:
  ```python
  from sqlalchemy import event as sa_event

  @sa_event.listens_for(engine, "connect")
  def set_sqlite_pragmas(dbapi_connection, _):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA journal_mode=WAL")
      cursor.execute("PRAGMA busy_timeout=5000")
      cursor.execute("PRAGMA synchronous=NORMAL")
      cursor.close()
  ```
- Keep write transactions short — the existing `POST /api/events` is already fire-and-forget and fast (single INSERT), which is correct.
- Do not run long-running write transactions (e.g., FAISS rebuild + FTS5 rebuild) in the same SQLite connection that handles user requests. The existing `_ingest_lock` (`asyncio.Lock`) already prevents concurrent rebuilds — verify it holds during the FTS5 `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` call.
- WAL mode creates a `-wal` and `-shm` file alongside the SQLite db file on Railway's volume. Verify Railway's persistent volume mount includes these files or SQLite falls back to DELETE mode on restart.

**Warning signs:**
- Sentry shows `sqlite3.OperationalError: database is locked` from `events.py` or `explore.py` under load
- Railway logs show 500 responses on `/api/events` after public launch
- FAISS rebuild hangs indefinitely (the `_ingest_lock` is blocked by a WAL checkpoint that can't complete due to concurrent readers — WAL checkpoint starvation)

**Phase to address:** Production hardening phase — add WAL pragma on engine connect before public launch day.

---

### Pitfall 7: Single-Key Admin on the Same Public Domain Has No Brute Force Protection

**What goes wrong:**
The `/api/admin/auth` endpoint in `admin.py` accepts any POST with a `{"key": "..."}` body and returns `200 {"ok": true}` or `401`. There is no rate limiting, no lockout after failed attempts, no IP blocking, and no request logging for auth failures. Once the marketplace goes fully public, bots and crawlers that discover the `/api/admin/auth` URL (it appears in the Vercel-deployed JS bundle since `VITE_API_URL` is baked in) can brute-force the admin key with no friction.

`sessionStorage` for the admin key has one specific security property worth preserving: unlike `localStorage`, it is cleared when the browser tab closes, so a stolen session does not persist indefinitely. However, if the admin visits the public site on the same browser (same origin), any XSS vulnerability in the public Explorer could read the admin `sessionStorage` key and send it to an attacker. This is the "same domain" risk — public user content (future expert bios, review text, etc.) could be used as an XSS vector against the admin session.

The single-key approach also means key rotation requires updating a Railway env var and notifying all admin users simultaneously (currently just one person, but worth noting).

**Why it happens:**
The single-key auth was deliberately simple for internal use. The risk profile changes when the site goes public because the attack surface (the `/api/admin/auth` URL) becomes discoverable by anyone inspecting network requests or the JS bundle.

**How to avoid:**
- Add rate limiting to `/api/admin/auth` using `slowapi` (the FastAPI-compatible rate limiter): limit to 5 attempts per IP per minute. This is a 3-line change:
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address
  limiter = Limiter(key_func=get_remote_address)
  @auth_router.post("/auth")
  @limiter.limit("5/minute")
  def authenticate(request: Request, body: AuthBody): ...
  ```
- Log all failed auth attempts with `structlog`: `log.warning("admin.auth_failure", ip=request.client.host)` — this creates an audit trail without requiring external infrastructure.
- If migrating to username+password (per v4.0 target), use bcrypt via `passlib`: `CryptContext(schemes=["bcrypt"])`. A bcrypt hash takes ~100ms to verify, which is the single most effective brute-force defense (makes automated attacks infeasibly slow).
- The admin panel is at `/admin` which is a well-known path — consider renaming to a non-obvious path (e.g., `/dashboard-internal`) as a low-effort obscurity measure, though this is not a substitute for rate limiting.
- If the admin logs in from the same browser as public users: use a separate browser profile or a private window for admin access until the session key is rotated to a dedicated admin browser.

**Warning signs:**
- Railway logs show hundreds of POST requests to `/api/admin/auth` from varying IPs within minutes of public launch
- Sentry shows spike in 401 responses from the auth endpoint (brute force in progress)
- Admin dashboard becomes inaccessible due to Railway receiving bot traffic (rate limited at Railway infrastructure level, not application level)

**Phase to address:** Auth security hardening phase — add rate limiting to `/api/admin/auth` before or alongside the auth migration, not after.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping sessionStorage for admin token instead of HttpOnly cookie | Simple migration, no CSRF complexity | XSS on public Explorer can steal admin session if both use same origin | Acceptable only if admin never logs in on the public domain's browser tab |
| Single flat `tags` array for both domain and industry tags | No schema change, no migration | Backend must distinguish tag types by value matching (fragile), or users see confusing filter behavior | Never — separate the namespaces before launch |
| Removing admin pages without removing backend endpoints | Faster cleanup, fewer backend changes | Dead endpoints remain in API surface, occupying route slots and confusing future contributors | Acceptable if endpoints are truly harmless no-ops; unacceptable if they accept writes |
| Skipping WAL mode until after public launch | No immediate visible problem | First day of real traffic may produce locked database errors; Sentry fills with 500s | Never — add WAL mode in production hardening phase before public launch |
| Adding `React.lazy` to admin pages without a `Suspense` boundary | Smaller initial bundle | Any navigation to admin shows a blank screen until chunk loads (no loading indicator) | Never without a Suspense boundary |

---

## Integration Gotchas

Common mistakes when connecting to internal systems during v4.0 changes.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Zustand persist + new tag schema | Bumping tag filter shape without bumping `version` | Set `version: 2` and add `migrate: (state) => ({ ...state, industryTags: [] })` to the persist config |
| VirtuosoGrid + list toggle | Defining `components` prop inline in render function | Define `components` as module-level constants outside the component function |
| FastAPI + SQLite WAL | Setting WAL mode via raw SQL before SQLAlchemy pool init | Use SQLAlchemy `event.listens_for(engine, "connect")` — fires on every connection, including pool connections |
| slowapi rate limiter + FastAPI | Forgetting to add `SlowAPIMiddleware` to the app | `app.add_middleware(SlowAPIMiddleware)` is required alongside the `@limiter.limit()` decorator |
| bcrypt + passlib | Using `bcrypt` directly without `passlib.CryptContext` | `CryptContext` handles algorithm agility and future migration; direct `bcrypt` is harder to upgrade |
| Framer Motion + Vite LazyMotion | Expecting vendor chunk exclusion automatically | Must set `rollupOptions.output.manualChunks` explicitly to split motion from vendor chunk |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SQLite without WAL mode | `database is locked` errors under concurrent writes | Add WAL + busy_timeout pragmas on engine connect | At ~10+ concurrent active users |
| VirtuosoGrid overscan too high | High memory usage, slow initial render on mobile | Keep `overscan={200}` (current); go no higher than `{400}` | At 530+ items with mobile devices |
| Inline `components` prop in Virtuoso | All cards remount on every parent re-render | Define component types outside render function | Immediately on first filter change |
| No rate limiting on auth endpoint | Sentry fills with 401s; Railway CPU spike | Add `slowapi` rate limit before public launch | At first bot discovery of `/api/admin/auth` |
| Industry tags in same FAISS search as domain tags | Empty results when both tag types are active (over-filtered) | Separate industry tags into SQL `WHERE category IN` pre-filter, keep domain tags in FAISS | At first user who selects both tag types simultaneously |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No rate limiting on `/api/admin/auth` | Brute force of single admin key; key discovered = full admin access | Add `slowapi` limit + bcrypt verification (slow hash = natural rate limit) |
| Admin key in sessionStorage on public domain | XSS on Explorer page can read admin sessionStorage | Use separate browser profile for admin; or move admin to a subdomain with separate origin |
| Shipping plaintext password in admin migration | If Railway env vars leak, password is exposed | Store only bcrypt hash as `ADMIN_PASSWORD_HASH` env var; never store plaintext |
| Industry tag names overlapping with SQL injection vectors | FTS5 MATCH on tag names could be exploited | The existing `_safe_fts_query()` sanitizer already handles this; apply it to industry tag filter values too |
| Removing `_require_admin` dependency from a cleanup endpoint | Endpoint becomes publicly accessible | Double-check that every route on `router` (not `auth_router`) has the `Depends(_require_admin)` inherited from the router-level dependency |

---

## UX Pitfalls

Common user experience mistakes in this v4.0 context.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Grid/list toggle resets scroll to top | Users lose their place after toggling view | Accept this as expected behavior; add a visual affordance ("View changed — showing from top") |
| Industry tags displayed identically to domain tags in cloud | Users cannot tell "Finance" (industry) from "Financial Modeling" (domain) | Use distinct visual treatment: section labels, color, or icon prefix |
| Admin login shows no error for wrong username (only wrong password) | Admin cannot diagnose whether username or password is wrong | Return generic "Invalid credentials" message for both — do not distinguish which field was wrong (security best practice) |
| Auth migration leaves old sessionStorage key on existing admin sessions | Admin appears logged in but all API calls fail (new backend rejects old key format) | Add a `useEffect` in `RequireAuth.tsx` that validates the stored token against `/api/admin/auth` on mount; redirect to login if 401 |
| List view card design not specified before implementation | Developer invents card layout that doesn't match the bento-card aesthetic | Define list card design (what information shows, what's hidden) in the phase spec before coding |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth migration:** New login form works in dev — verify token validation against the live Railway backend, not just localhost; check that old sessionStorage sessions are invalidated on first visit after migration
- [ ] **Auth migration:** Rate limiting added — verify `SlowAPIMiddleware` is registered in `main.py` (not just the decorator on the endpoint)
- [ ] **Grid/list toggle:** Toggle works in dev — verify at mobile viewport (375px) that the list view's height container resolves to a non-zero pixel value
- [ ] **Grid/list toggle:** `components.Header` and `components.Footer` defined outside render — verify by checking that cards do NOT flash/remount on filter change in the React DevTools Profiler
- [ ] **Industry tags:** `industryTags` field added to `filterSlice.ts` `filterDefaults` — verify `resetFilters()` also clears `industryTags: []`
- [ ] **Industry tags:** Zustand persist version bumped to 2 with `migrate` function — verify by opening the app with old `explorer-filters` localStorage data and confirming no console errors and a clean initial state
- [ ] **Admin cleanup:** t-SNE background task removed from `main.py` lifespan — verify Railway startup logs no longer show `tsne.background_task_started`
- [ ] **Admin cleanup:** No 404s on pages that remain after removing sibling pages — check every `adminFetch` URL in remaining pages against the backend route list
- [ ] **WAL mode:** `PRAGMA journal_mode=WAL` fires on engine connect — verify by checking Railway logs for `sqlite3.OperationalError` under simulated concurrent load (ApacheBench or k6 with 10 concurrent users)
- [ ] **WAL mode:** Railway volume persists `-wal` and `-shm` files — verify by checking Railway volume contents after restart

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Admin locked out during auth migration | HIGH | Revert backend to previous deploy via Railway; old `ADMIN_SECRET` env var is still set; admin can log in with old key |
| VirtuosoGrid height is 0 after list toggle | LOW | Add explicit `minHeight: '400px'` to the container as a fallback; redeploy Vercel |
| Industry tags corrupt Zustand state for returning users | MEDIUM | Bump persist version + add migrate function; returning users get fresh state on next visit (filter preferences lost, but data intact) |
| Admin page removed but endpoint still needed | MEDIUM | Restore the route in `AdminApp.tsx` with a minimal stub component; full page can be deferred |
| `database is locked` errors in production | MEDIUM | Add WAL pragma via hotfix; Railway redeploy takes ~60s; no data loss since SQLite WAL is non-destructive |
| Brute force on `/api/admin/auth` | LOW | Add `slowapi` rate limit via hotfix; or temporarily change `ADMIN_SECRET` in Railway env vars to invalidate in-progress brute force |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Admin lockout during auth migration | Admin auth phase — dual-mode endpoint | New login works in Railway preview before merging to main |
| VirtuosoGrid/Virtuoso height breakage | Grid/list toggle phase — height test first | Chrome DevTools shows non-zero container height at 375px, 768px, 1280px |
| Inline component definitions cause remount storm | Grid/list toggle phase — code review gate | React DevTools Profiler shows no card remounts on filter change |
| Industry + domain tag filter collision | Tag taxonomy phase — backend contract defined first | Selecting "Finance" (industry) + "Financial Modeling" (domain) returns results, not 0 |
| Zustand persist schema mismatch | Tag taxonomy phase — version bump and migrate | Old localStorage state does not cause console errors on first visit |
| Admin cleanup breaks remaining pages | Admin cleanup phase — dependency audit | All admin pages that remain return 200 with data after cleanup deploy |
| LazyMotion in Vite vendor chunk | Performance phase — bundle analysis before/after | `npx vite build --analyze` shows motion chunk size decreased |
| SQLite database locked under traffic | Production hardening phase — WAL before public launch | k6 10-concurrent-user test shows 0 `database is locked` errors |
| No brute force protection on auth | Auth security phase — rate limit added same PR as migration | POST to `/api/admin/auth` 6 times in 1 minute returns 429 on 6th attempt |
| XSS risk from same-domain admin | Auth security phase — document and decide | Decision recorded: separate browser profile for admin, OR subdomain separation deferred to v5.0 |

---

## Sources

- Direct codebase analysis: `frontend/src/layouts/RootLayout.tsx`, `frontend/src/admin/LoginPage.tsx`, `frontend/src/admin/RequireAuth.tsx`, `frontend/src/admin/AdminApp.tsx`, `frontend/src/components/marketplace/ExpertGrid.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/marketplace/ExpertCard.tsx`, `frontend/src/store/filterSlice.ts`, `frontend/src/store/index.ts`, `frontend/vite.config.ts`, `frontend/package.json`, `app/routers/admin.py`, `app/main.py`
- [react-virtuoso GitHub Issues #440, #479, #703, #801](https://github.com/petyosi/react-virtuoso/issues) — VirtuosoGrid height, padding shake, mixed-height scroll bugs
- [react-virtuoso Troubleshooting Guide](https://virtuoso.dev/react-virtuoso/troubleshooting/) — inline component definition remount cause, getState/restoreStateFrom API
- [Vite code splitting ineffective with vendor chunk #3731](https://github.com/vitejs/vite/issues/3731) — Framer Motion LazyMotion bypass via vendor chunk
- [Motion docs: Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) — LazyMotion requires manualChunks to be effective
- [SQLite WAL mode](https://sqlite.org/wal.html) — WAL internals, checkpoint starvation, concurrent readers/writers
- [SQLite "database is locked" solutions](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) — WAL + busy_timeout pattern
- [Solving SQLITE_BUSY with WAL Mode](https://coldfusion-example.blogspot.com/2026/01/solving-sqlitebusy-database-is-locked.html) — production WAL configuration
- [FastAPI OAuth2 with JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — bcrypt + passlib pattern for FastAPI auth
- [FastAPI session guide](https://byo.propelauth.com/post/fastapi-session-guide) — session vs token storage tradeoffs
- [JWT storage and XSS](https://blog.ropnop.com/storing-tokens-in-browser/) — sessionStorage, localStorage, HttpOnly cookie tradeoffs
- [Lack of Brute-Force Protection on Auth Endpoints](https://github.com/ethyca/fides/security/advisories/GHSA-7q62-r88r-j5gw) — real-world advisory for unprotected admin login
- [Zustand version migration](https://dev.to/diballesteros/how-to-migrate-zustand-local-storage-store-to-a-new-version-njp) — version + migrate function pattern for schema changes
- [Taxonomy and IA: Categories vs Tags](https://medium.com/design-bootcamp/categories-or-tagging-differences-in-taxonomy-and-ia-b9944ee73da8) — domain-specific tag conflict analysis
- [FastAPI Security best practices 2025](https://blog.greeden.me/en/2025/10/14/a-beginners-guide-to-serious-security-design-with-fastapi-authentication-authorization-jwt-oauth2-cookie-sessions-rbac-scopes-csrf-protection-and-real-world-pitfalls/) — session fixation, CSRF, XSS countermeasures

---
*Pitfalls research for: v4.0 Public Launch — auth migration, grid/list toggle, tag taxonomy, admin cleanup, performance, SQLite hardening, auth security*
*Researched: 2026-02-27*
