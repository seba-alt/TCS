# Project Research Summary

**Project:** TCS Expert Marketplace — v3.0 Netflix Browse & Agentic Navigation
**Domain:** AI-powered Expert Marketplace (additive milestone on live v2.3 system)
**Researched:** 2026-02-24
**Confidence:** HIGH for architecture and pitfalls (direct codebase inspection); HIGH for stack (zero new packages confirmed); MEDIUM for Netflix browse UX patterns (well-documented but adapted from entertainment to professional context); LOW-MEDIUM for agentic cross-page navigation (emerging pattern, limited authoritative sources)

## Executive Summary

v3.0 adds a Netflix-style Browse landing page, horizontal scroll category rows, a Billboard Hero, expert photo cards, cross-page Sage navigation, aurora page transitions, and route reorganization to the existing live v2.3 Tinrate AI Concierge. The stack footprint is minimal — one new devDependency (`tailwind-scrollbar-hide`) covers the only missing capability; every other UI requirement is met by already-installed tools (Tailwind v3.4 scroll-snap, motion/react v12.34, React Router v7, Zustand v5, httpx 0.28). On the backend, two new routers (`browse.py`, `photos.py`) and one new service (`browse_service.py`) extend FastAPI without touching any existing endpoints. The architecture is purely additive: existing MarketplacePage becomes the Explorer page at `/explore`, while a new BrowsePage becomes the root at `/`, wrapped in a shared animated layout.

The recommended build order follows a strict dependency chain of five groups. The foundation (route restructure + navigationSlice + Expert.photo_url column) must land first because every subsequent feature depends on it. Backend endpoints (GET /api/browse and GET /api/photos/{username}) follow immediately after the model change. Browse UI components assemble on top of those endpoints. Sage cross-page navigation and aurora transitions are the final layer, both depending on the route structure established in Group 1. The most critical architectural decision is removing or gating the unconditional `resetPilot()` call in MarketplacePage — this single line, if left unchanged, will silently destroy every Sage conversation when the user navigates from Browse to Explorer.

The primary risks are concentrated in two areas. Photo serving has multiple failure modes: CORS blocks from third-party photo hosts, mixed HTTP/HTTPS content in production, Railway's persistent volume being empty on first deploy, and photo URLs not existing in the current data at all. The mitigation for all of them is the same: serve photos exclusively through the `GET /api/photos/{username}` proxy endpoint (never direct URLs in frontend), add `os.makedirs` in the lifespan before any `StaticFiles` mount, and treat monogram-initials fallback as a first-class feature rather than an afterthought. Cross-page Sage navigation has a different risk profile: `useUrlSync` may clobber Sage filter state on Explorer mount, a stale `useExplore` fetch may flash "530 experts" before Sage results appear, and the `useCallback` dependency array must include `isOnBrowsePage` to avoid a stale closure. Both risk areas have clear, well-tested mitigations documented in PITFALLS.md.

## Key Findings

### Recommended Stack

v3.0 adds one package: `tailwind-scrollbar-hide` (devDep, 42k weekly downloads, Tailwind v3 compatible, zero runtime JS). Everything else is already installed. Horizontal scroll rows use Tailwind v3.4's built-in snap utilities (`snap-x`, `snap-mandatory`, `snap-start`, `scrollbar-hide`). Page transitions use the existing `AnimatePresence` + `motion.div` from motion/react v12.34. Cross-page navigation uses React Router v7 `useNavigate` + `useLocation`. Sage state persistence across routes uses the existing Zustand in-memory store (no changes to `partialize`). Expert photo proxying uses `httpx 0.28.*`, already in `requirements.txt`.

**Core technologies (all existing except one):**
- `tailwind-scrollbar-hide ^1.3.1` — hide scrollbars on snap rows — ONLY new package
- `Tailwind v3.4 scroll-snap utilities` — `snap-x mandatory`, `snap-start` — horizontal rows, zero JS
- `motion/react v12.34` — AnimatePresence + motion.div — page transitions and card hover
- `React Router v7 useNavigate + useLocation` — cross-page navigation signals and "fromBrowse" state
- `Zustand v5.0.11 navigationSlice` — new slice for `pendingSageResults` cross-page handoff
- `httpx 0.28.*` — promoted from dev dep to production use for photo proxy
- `lucide-react 0.575` — ChevronLeft icon for "Continue Browsing" breadcrumb, already installed

**What NOT to add (confirmed unnecessary):**
- `react-snap-carousel`, `swiper`, `react-slick` — Tailwind scroll-snap handles it; added weight with zero benefit
- `aiohttp` — httpx already available; no reason for a second async HTTP client
- `pillow` — no server-side image resizing needed; proxy passthrough is sufficient
- Any WebGL/canvas library — aurora effect is pure CSS `@keyframes`; transitions are motion/react blur filter

### Expected Features

The Browse page must feel like a real product from day one. Missing any P1 feature makes it feel like a grid with a new label rather than a genuine discovery surface.

**Must have (P1 — milestone incomplete without these):**
- Billboard hero section — full-width featured expert with photo, name, title, rate, and 2 CTAs (monogram fallback when photo unavailable; never auto-rotate)
- Horizontal category rows (4–6 rows, 4 visible cards + 1 peek, "See All" integration, skeleton loading per row)
- Route reorganization: `/` becomes Browse, `/marketplace` redirects to `/explore`, Sage panel moved to root layout level
- Aurora page transition (AnimatePresence `mode="wait"` on route outlet, 350ms blur/fade, max 400ms total)

**Should have (P2 — high value, contained scope):**
- Expert photo cards in browse rows (monogram initials fallback — do NOT block on photo URL discovery)
- "Continue Browsing" breadcrumb above ExpertGrid when arriving from BrowsePage via "Start Discovery"
- "Ask Sage about this expert" CTA on billboard and hover cards (opens SagePanel pre-filled with "Tell me about [Name]")

**P3 — ship if P1/P2 complete, otherwise defer to v3.1:**
- Sage cross-page navigation intent (`navigate_to` Gemini function) — HIGH complexity, needs 15-query validation test before shipping
- Netflix-style card hover expand (scale 115% + info overlay) — MEDIUM complexity, pure motion/react
- Admin billboard control (is_featured flag on Expert model) — needs backend + admin UI; fallback to findability_score covers v3.0

**Defer to v3.1+:**
- Algorithmic billboard personalization (no per-user identity model before newsletter gate)
- Video preview on card hover (no video assets exist for any expert)
- Infinite horizontal scroll in rows (anti-feature — use "See All" as the escape valve)
- TCS-native deep link to expert cards (canonical URL is already the Tinrate profile page)

**Critical anti-feature note:** The existing `/marketplace` route must NOT become a fully separate page from Browse. The correct v3.0 layout adds the Billboard + Category Rows at the top of the existing page; the filter sidebar + VirtuosoGrid remain below as the "All Experts" section. Route rename only: `/marketplace` → `/explore`.

### Architecture Approach

v3.0 uses a five-group additive build order. All existing v2.3 components (useExplore, VirtuosoGrid, FilterSidebar, ExistingExpertCard, SageFAB, SagePanel, useUrlSync, all admin pages) are completely unchanged. New Browse components live in a dedicated `frontend/src/components/browse/` directory. The shared AnimatedOutlet wraps only the public routes (Browse + Explorer); admin routes remain outside it. A new `navigationSlice` in Zustand carries `pendingSageResults` across the Browse → Explorer route boundary; it is deliberately excluded from `partialize` so it never survives a browser refresh.

**Major components (new and modified):**
1. `BrowsePage` (NEW page) — assembles AuroraBackground, BrowseHeader, BillboardHero, CategoryRows, SageFAB, SagePanel
2. `GET /api/browse` endpoint + `browse_service.py` (NEW) — returns `{ featured, rows[4] }` from 4 SQL queries; no FAISS; cold-start guard on trending row
3. `GET /api/photos/{username}` proxy (NEW) — httpx passthrough with 24h Cache-Control; 404 → frontend monogram fallback
4. `navigationSlice` (NEW Zustand slice) — `pendingSageResults` ephemeral handoff; not persisted
5. `AnimatedOutlet` + `RootLayout` (NEW) — AnimatePresence `mode="wait"` keyed on `location.pathname`; wraps Browse + Explorer only
6. `useSage.ts` (MODIFIED) — adds `useLocation`, `useNavigate`, `isOnBrowsePage` branch; routes to `setPendingSageResults + navigate('/explore')` instead of direct `setResults`
7. `MarketplacePage.tsx` (MODIFIED) — removes unconditional `resetPilot()`, adds `pendingSageResults` consumer effect, adds "Continue Browsing" breadcrumb via `location.state`
8. `app/models.py` + `app/main.py` (MODIFIED) — adds nullable `photo_url` column to Expert; idempotent ALTER TABLE in lifespan

**Key patterns to follow:**
- Single ownership: `useExplore` remains the exclusive writer to `resultsSlice`; Sage uses `setPendingSageResults` for cross-page handoffs, never calls `setResults` directly from Browse
- Proxy-first photos: `GET /api/photos/{username}` is the only URL pattern; never expose third-party photo URLs to the frontend
- `mode="wait"` on AnimatePresence: without it, both pages render simultaneously during transition, causing z-index conflicts with SageFAB
- sageMode guard first: call `store.setSageMode(true)` before `navigate('/explore')` so `useExplore`'s guard fires on Explorer mount and prevents a competing 530-expert fetch
- useUrlSync is Explorer-only: never import or call it in any Browse component

### Critical Pitfalls

1. **`resetPilot()` on Explorer mount destroys cross-page Sage conversation** — Remove the unconditional `useEffect(() => { resetPilot() }, [resetPilot])` from MarketplacePage. Replace with a gated version: skip reset when `pendingSageResults` is present, or remove it entirely (pilot state is ephemeral; browser refresh already clears it). This is the single highest-risk change in v3.0 — get it wrong and every Sage interaction on Browse is silently wiped on arrival at Explorer.

2. **Photo serving HTTPS/CORS failure in production** — Construct all photo URLs on the frontend from `VITE_API_URL` (which is the Railway HTTPS URL). Never let the backend return photo URLs in JSON responses. Serve via `GET /api/photos/{username}` FastAPI endpoint (not `StaticFiles`) so CORSMiddleware applies. Verify `VITE_API_URL` starts with `https://` in Vercel env vars before any photo code ships.

3. **Stale `useExplore` fetch race on Sage navigation** — Set `sageMode: true` in Zustand BEFORE calling `navigate('/explore')`. The existing `if (sageMode) return` guard in `useExplore.ts` (line 35) will abort the competing fetch. Order: `store.setSageMode(true)` → `store.setResults(experts, total, null)` → `navigate('/explore')`. Never dispatch results after navigate.

4. **CLS from expert photos without reserved dimensions** — Set a fixed `aspect-ratio` on every card image container BEFORE writing any card component. `aspect-ratio: 3/4` for portrait cards in rows; `aspect-ratio: 16/9` for billboard hero. Never use `auto` height on image wrappers inside horizontal scroll rows. Lighthouse CLS < 0.1 is the acceptance criterion.

5. **`/marketplace` bookmark breakage on route rename** — In the same commit that renames the route, add `{ path: '/marketplace', element: <Navigate to="/explore" replace /> }` to `createBrowserRouter`. Test by visiting `/marketplace?q=test` directly in the browser after the rename — it must resolve to Explorer with params preserved.

6. **Railway `StaticFiles` startup crash (missing `/data/photos` directory)** — Add `os.makedirs("/data/photos", exist_ok=True)` in the lifespan BEFORE any `app.mount(...)` call. The Railway volume starts empty on first deploy. Without this guard, the app fails to start entirely.

7. **Horizontal scroll paint jank on mobile** — Apply `will-change: transform` to the scroll container (not individual cards). Keep card hover effects to `transform` + `opacity` only — never animate `box-shadow`, `filter`, or `background-color` on scroll-adjacent elements. Validate on a throttled Mobile profile in Chrome DevTools before shipping.

## Implications for Roadmap

Based on the combined research, the natural dependency order yields five build groups. The phase structure follows ARCHITECTURE.md's build order analysis exactly — no reordering is justified by the feature research.

### Phase 1: Foundation — Route Restructure + State Scaffolding

**Rationale:** Every subsequent feature depends on having `BrowsePage` at `/`, `MarketplacePage` at `/explore`, the `/marketplace` redirect in place, and the `navigationSlice` in the store. Stub `BrowsePage` with a placeholder div — full content comes in Phase 3. Do this first, deploy, verify routing works in production before touching any other file.
**Delivers:** `main.tsx` restructured with `RootLayout/AnimatedOutlet` layout wrapper; `BrowsePage` stub at `/`; `/marketplace` permanent redirect; `navigationSlice` in Zustand store; `Expert.photo_url` nullable column added via idempotent ALTER TABLE
**Addresses:** Route redirect preservation (FEATURES.md table stakes); sageMode guard precondition (ARCHITECTURE.md Group 1)
**Avoids:** Pitfall 6 (bookmark breakage — redirect is in same commit); Pitfall 5 (stale fetch — navigationSlice exists before any Sage navigation code)

### Phase 2: Backend Endpoints — Browse API + Photo Proxy

**Rationale:** Browse UI (Phase 3) and photo cards (Phase 4) both block on these endpoints existing. Both are pure additive FastAPI routes — no risk to existing endpoints. The trending row's cold-start guard (fall back to top_findability when user_events is empty) must be implemented now, not retrofitted later.
**Delivers:** `GET /api/browse` → `{ featured, rows[4] }` from 4 SQL queries (no FAISS, no Gemini); `GET /api/photos/{username}` httpx proxy with 24h Cache-Control and 404 fallback; `POST /api/admin/experts/photos` bulk CSV ingest; `app/main.py` router registrations; `ExpertCard` Pydantic schema gains `photo_url: str | None = None`
**Uses:** httpx 0.28.* (promoted from dev dep); SQLAlchemy existing patterns; existing `_require_admin` dependency for admin ingest endpoint
**Avoids:** Pitfall (Railway startup crash) — `os.makedirs("/data/photos", exist_ok=True)` in lifespan; Pitfall (CORS/HTTPS) — proxy endpoint goes through CORSMiddleware; Pitfall (N+1 queries) — single `/api/browse` endpoint returns all rows

### Phase 3: Browse UI — BrowsePage + Category Rows + Billboard

**Rationale:** Assembles the complete Browse surface from the backend endpoints built in Phase 2. Build bottom-up: `BrowseExpertCard` → `CategoryRow` → `CategoryRows` → `BillboardHero` → `BrowseHeader` → `useBrowse` hook → `BrowsePage`. The photo proxy is live (Phase 2) so photo cards can be built with real data. Skeleton loading per row must be implemented before any real data is wired — blank rows during fetch are the most visible jank in browse UIs.
**Delivers:** All browse components (`frontend/src/components/browse/`); `useBrowse` hook (single GET /api/browse fetch); `BrowseFeaturedExpert` and `BrowseRow` TypeScript types; `frontend/src/constants/photos.ts` utility; per-row horizontal skeleton (5 card-width pulse placeholders); "See All" dispatching `store.setTags(row.tags)` + scroll to ExpertGrid; aurora-gradient row headers (CSS only)
**Uses:** `tailwind-scrollbar-hide` (the one new package); Tailwind snap utilities; motion/react whileHover for card scale
**Avoids:** Pitfall (CLS) — `aspect-ratio: 3/4` on all card image wrappers established in first component written; Pitfall (scroll jank) — `will-change: transform` on container, hover effects on `transform` + `opacity` only; Pitfall (useUrlSync on Browse) — `useUrlSync` never imported in any Browse component

### Phase 4: Sage Navigation + "Continue Browsing" Breadcrumb

**Rationale:** This is the highest-complexity phase. It modifies two critical files (`useSage.ts` and `MarketplacePage.tsx`) and introduces the cross-page Sage handoff pattern. BrowsePage must exist (Phase 3) before this can be tested end-to-end. The `resetPilot()` gate in MarketplacePage is the single most dangerous change in the milestone — it must be the first thing modified and first thing verified.
**Delivers:** `useSage.ts` gains `useLocation`, `useNavigate`, `isOnBrowsePage`; Browse → Explorer Sage search navigates with `pendingSageResults` handoff; apply_filters from Browse also navigates to Explorer; `MarketplacePage.tsx` unconditional `resetPilot()` removed; `pendingSageResults` consumed on Explorer mount before any other effect; "Continue Browsing" breadcrumb shown when `location.state?.from === 'browse'`; `SageFAB` prevFilterKey reset on route change to prevent spurious glow
**Avoids:** Pitfall 1 (`resetPilot` destroying cross-page conversation — gated/removed); Pitfall 3 (stale fetch race — `setSageMode(true)` before `navigate()`); Pitfall 2 (useUrlSync clobber — Sage results in store before Explorer mounts)
**Research flag:** Requires end-to-end testing of the full Browse → Explorer → conversation-preserved flow before shipping. Verify in Zustand DevTools that `messages[]` is intact on Explorer arrival.

### Phase 5: Aurora Page Transition

**Rationale:** The `AnimatedOutlet` wrapping is partially in place from Phase 1 (RootLayout exists). This phase completes the transition behavior: `PageTransition` component with blur/opacity, `AnimatePresence mode="wait"`, and AuroraBackground handling. Independent of all Sage navigation work — can be built in parallel with Phase 4 if bandwidth allows.
**Delivers:** `PageTransition.tsx` (motion.div with `blur(8px)` → `blur(0)` transition, 350ms); `AnimatedOutlet.tsx` (location-keyed AnimatePresence `mode="wait"`); `RootLayout.tsx` (thin wrapper); aurora background stays `position: fixed` — persists across transitions; transition capped at 400ms total
**Uses:** motion/react AnimatePresence (already installed, already imported in MarketplacePage)
**Avoids:** Pitfall (perceived lag) — Sage pre-fetches Explorer data before calling navigate(), so Explorer renders with data immediately after transition; Pitfall (SageFAB animation conflict) — FAB is never animated during route transitions, appears stationary as persistent co-pilot anchor

### Phase Ordering Rationale

- Phase 1 before everything: routes and store slice must exist before any feature can be built or tested
- Phase 2 before Phase 3: Browse UI calls real API endpoints; stubs acceptable for development but integration needs live endpoints
- Phase 3 before Phase 4: Sage navigation requires BrowsePage to exist for end-to-end testing; the `isOnBrowsePage` check in useSage.ts is meaningless without a real Browse page
- Phase 4 is the most dangerous: two critical file modifications with subtle ordering requirements; separate from UI work to reduce blast radius
- Phase 5 is independent: can be parallelized with Phase 4 if team bandwidth allows; AnimatedOutlet stub can be a passthrough from Phase 1 until Phase 5 completes
- Photo URL investigation is a Phase 0 prerequisite: spend max 30 minutes determining whether Tinrate photos are accessible at a predictable CDN path. If not found in 30 minutes, commit to monogram fallback and proceed. Do not block any phase on this investigation.

### Research Flags

Phases likely needing deeper verification during implementation:

- **Phase 4 (Sage cross-page navigation):** Emerging pattern with no canonical reference implementation. The 3-effect ordering in MarketplacePage (pendingSageResults consumer vs resetPilot gate) has subtle race conditions documented in ARCHITECTURE.md lines 840–856. The recommended resolution (remove resetPilot entirely) must be validated against the original Phase 15 rationale before committing. Run the full Browse → Sage query → Explorer → conversation preserved flow in staging before merging.
- **Phase 2 (Photo proxy HTTPS/CORS):** Must be verified in production (Vercel + Railway), not just local dev. Local dev is both HTTP, so CORS and mixed-content issues only surface in production. Deploy Phase 2 to production and verify photos load from the Vercel HTTPS URL before building any Browse photo UI.
- **Phase 0 prerequisite (Photo URL availability):** Not a phase — a spike. Inspect Tinrate app network requests when a profile page loads. Check `https://cdn.tinrate.com/[username].jpg`, `https://api.tinrate.com/users/[username]/avatar`, etc. 30-minute timebox. Result determines whether BrowseExpertCard v3.0 ships with real photos or polished monogram fallback.

Phases with standard patterns where additional research is not needed:

- **Phase 1 (Route restructure):** Direct modification of `main.tsx` routing config. The `<Navigate replace />` pattern is already used in admin routes. No new patterns.
- **Phase 3 (Browse UI components):** Tailwind scroll-snap and motion/react hover patterns are well-documented and already in use. The glassmorphic card pattern matches existing ExpertCard design language.
- **Phase 5 (Aurora transition):** AnimatePresence `mode="wait"` with `location.pathname` key is the canonical React Router + Framer Motion transition pattern. Already imported in MarketplacePage.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new package (`tailwind-scrollbar-hide`). All other tools confirmed from current `package.json` and `requirements.txt`. httpx 0.28.* in requirements.txt confirmed. Zero version conflicts. |
| Features | MEDIUM | Netflix browse UX patterns adapted from entertainment to professional marketplace — well-documented UX literature but no direct equivalent reference at this scale. AI cross-page navigation is LOW-MEDIUM: emerging pattern, no authoritative implementation reference. Photo serving and route reorganization are HIGH — standard patterns. |
| Architecture | HIGH | All component boundaries, data flow, hook patterns, and file paths derived from direct codebase inspection of v2.3 source. The resetPilot risk, sageMode guard, useUrlSync race, and pendingSageResults slice design are all grounded in actual code analysis, not inference. |
| Pitfalls | HIGH | All 8 critical pitfalls and 5 moderate pitfalls derived from direct inspection of `useSage.ts`, `useExplore.ts`, `MarketplacePage.tsx`, `useUrlSync.ts`, `SageFAB.tsx`, `store/index.ts`, `app/main.py`, `app/models.py`. Race conditions and failure modes are observable from existing code patterns. |

**Overall confidence:** HIGH for the implementation path. The five-group build order is well-justified by dependency analysis. MEDIUM for Sage cross-page navigation UX — the feature works technically but its Gemini function routing behavior must be empirically validated with real queries.

### Gaps to Address

- **Photo URL availability (Phase 0 spike, 30-minute timebox):** The current `metadata.json` and `experts.csv` contain no photo URLs. The Expert SQLAlchemy model has no `photo_url` column. Whether Tinrate profile photos are accessible at a predictable CDN URL from `username` is unknown. If not found in 30 minutes, commit to monogram-initials fallback as the v3.0 standard and document photo ingestion as a v3.1 task.

- **Gemini `navigate_to` function routing (Phase 4 P3 feature):** If the Sage cross-page navigation intent (`navigate_to` third Gemini function) is included in v3.0, it must be tested against at least 15 real queries from the `conversations` table before shipping — same protocol as the v2.3 dual-function validation. The three function descriptions (`apply_filters`, `search_experts`, `navigate_to`) must be mutually exclusive. Budget one iteration of description tuning.

- **resetPilot() removal impact:** The `resetPilot()` call in MarketplacePage was added in Phase 15 for a reason — to clear stale Sage state on page revisit. Removing it unconditionally may surface a regression where old conversation history bleeds into a fresh Explorer visit. Verify that: (1) browser refresh on Explorer correctly clears messages (ephemeral, not persisted), and (2) direct URL navigation to `/explore` without a prior Browse session starts with a clean Sage panel.

- **Aurora background double-mount during transitions:** When BrowsePage and MarketplacePage both internally render `<AuroraBackground>`, the AnimatedOutlet exit/enter cycle may flicker if two aurora canvases exist simultaneously for 350ms. ARCHITECTURE.md recommends hoisting AuroraBackground to RootLayout and removing it from individual pages if flicker is observed. Confirm in visual testing before shipping.

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `frontend/src/main.tsx` — current route config, Navigate pattern for admin routes
- `frontend/src/hooks/useSage.ts` — Sage hook architecture, no routing imports today, getState() snapshot pattern
- `frontend/src/hooks/useExplore.ts` — sageMode guard at line 35, AbortController pattern
- `frontend/src/hooks/useUrlSync.ts` — skipFirst ref behavior, URL → Store vs Store → URL directions
- `frontend/src/pages/MarketplacePage.tsx` — resetPilot() useEffect (lines 33–36), useUrlSync call site
- `frontend/src/components/pilot/SageFAB.tsx` — prevFilterKey ref initialization, filter glow trigger
- `frontend/src/store/index.ts` + `pilotSlice.ts` + `resultsSlice.ts` — persist boundary (partialize), sageMode in resultsSlice
- `app/models.py` — Expert model (no photo_url today)
- `app/services/explorer.py` — ExpertCard Pydantic schema
- `app/main.py` — lifespan migration block, router registration pattern
- `frontend/package.json` + `requirements.txt` — confirmed installed packages and versions

### Secondary (MEDIUM confidence)
- [Tailwind v3 scroll-snap-type docs](https://v3.tailwindcss.com/docs/scroll-snap-type)
- [tailwind-scrollbar-hide npm](https://www.npmjs.com/package/tailwind-scrollbar-hide)
- [motion/react AnimatePresence docs](https://motion.dev/docs/react-animate-presence)
- [React Router v7 useNavigate](https://reactrouter.com/api/hooks/useNavigate)
- [React Router v7 View Transitions](https://reactrouter.com/how-to/view-transitions)
- [Netflix UX Case Study — Pixel Plasma](https://medium.com/@pixelplasmadesigns/netflix-ux-case-study-the-psychology-design-and-experience-afecb135470f)
- [Horizontal Scrolling Lists in Mobile — UX Collective](https://uxdesign.cc/best-practices-for-horizontal-lists-in-mobile-21480b9b73e5)
- [Beware Horizontal Scrolling — Nielsen Norman Group](https://www.nngroup.com/articles/horizontal-scrolling/) (HIGH confidence, NN/G authoritative)
- [Product Lists Hover Best Practices — Baymard Institute](https://baymard.com/blog/secondary-hover-information) (HIGH confidence, authoritative UX research)
- [What's new in view transitions (2025) — Chrome Developers](https://developer.chrome.com/blog/view-transitions-in-2025)
- [httpx Async Support](https://www.python-httpx.org/async/)
- [FastAPI StreamingResponse patterns](https://johal.in/fastapi-streamingresponses-generators-async-iterators-2025/)

### Tertiary (LOW confidence)
- [AI Agent-Driven UIs — AppInventiv](https://appinventiv.com/blog/ai-ui-replacing-apps-and-buttons/) — agentic navigation patterns; emerging, single source
- [Automated intent recognition 2025 — eesel AI](https://www.eesel.ai/blog/automated-intent-recognition) — Sage navigate_to intent classification; non-authoritative

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
