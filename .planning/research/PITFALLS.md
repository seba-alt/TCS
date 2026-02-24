# Domain Pitfalls

**Domain:** Adding Netflix-style Browse page, cross-page Sage navigation, photo serving, and route reorganization to an existing React + FastAPI expert marketplace
**Researched:** 2026-02-24
**Confidence:** HIGH — based on direct codebase analysis of the actual v2.3 system (`useSage.ts`, `useExplore.ts`, `store/index.ts`, `pilotSlice.ts`, `SageFAB.tsx`, `main.tsx`, `MarketplacePage.tsx`, `useUrlSync.ts`) plus targeted web research on each pitfall class

---

## Critical Pitfalls

Mistakes that cause rewrites, broken state, or production crashes.

---

### Pitfall 1: `resetPilot()` on Explorer Mount Destroys Cross-Page Sage Conversation History

**What goes wrong:**
`MarketplacePage.tsx` calls `resetPilot()` in a `useEffect` on mount (Phase 15 pattern). This clears `messages`, `isOpen`, `isStreaming`, and `sessionId` every time the Explorer page mounts. When Sage on Browse navigates the user to Explorer to show results, Explorer's mount immediately calls `resetPilot()`, wiping out the entire Sage conversation — including the search context Sage just explained. The user sees an empty panel with no history on Explorer.

**Why it happens:**
The `resetPilot()` on Explorer mount was added in Phase 15 to ensure a clean Sage state on page load. With only one page, this was correct. With two pages sharing the same store, Explorer mounting means "user arrived from Browse" as often as "user refreshed the page". The hook cannot distinguish between these cases.

**Consequences:**
- Sage conversation context is lost every time Browse navigates to Explorer
- Users cannot see what Sage just told them when they arrive at Explorer
- Sage results injected by Browse are wiped before ExpertGrid can render them

**Prevention:**
- Remove the unconditional `resetPilot()` from Explorer's `useEffect`.
- Add a `navigatedFromBrowse` flag to `pilotSlice` (non-persisted). Set it `true` before programmatic navigation from Browse. Check it in Explorer's mount: if `true`, skip `resetPilot()` and clear the flag. If `false` (direct URL load or refresh), call `resetPilot()` as before.
- Alternative: remove `resetPilot()` entirely from Explorer mount and let Sage panel state persist naturally across navigation — the existing `partialize` config already excludes `messages` from localStorage, so refreshes still clear it.

**Detection:**
- Sage panel is empty every time user lands on Explorer via Sage navigation from Browse
- `messages` array in Zustand DevTools is empty immediately after routing to Explorer

**Phase to address:** Phase introducing Sage cross-page navigation — the `resetPilot()` guard must be added before any programmatic navigation is implemented.

---

### Pitfall 2: `useUrlSync` Hook on Explorer Rewrites URL on Mount, Clobbering Sage Navigation Params

**What goes wrong:**
`useUrlSync` runs its "Store → URL" effect on every filter change, and its "URL → Store" effect once on mount. When Sage on Browse dispatches filters to Zustand then calls `navigate('/explore')`, Explorer mounts, `useUrlSync` reads the URL (which has no `?q=` params since the navigation was programmatic) and its "URL → Store" branch finds empty params. Then its "Store → URL" branch fires and writes the current filter state to the URL. If this races with the Sage filter dispatch that happened on Browse, the result depends on effect ordering — the URL may reflect partial state or cleared state.

**Why it happens:**
`useUrlSync` has a `skipFirst` ref that skips the first "Store → URL" render to avoid overwriting URL with localStorage state. But on a navigation from Browse, the filter state is already set (by Sage on Browse), the URL is empty (programmatic navigation has no params), and `skipFirst` is `true` only for the very first render cycle — by the time Sage has dispatched filters and `navigate()` fires, the next render is not considered "first" by `skipFirst`. The two effects are not ordered relative to each other.

**Consequences:**
- URL shows empty params even though Sage filters are active on Explorer
- Worse: a race where URL params overwrite Sage-dispatched filters with empty values
- Shareable Sage result URLs don't work

**Prevention:**
- Add a `sagePendingNavigation: boolean` field to the store. Set it `true` when Sage initiates Browse → Explorer navigation. In `useUrlSync`, check this flag: if `true`, skip the "URL → Store" read-on-mount (URL is empty by design; store already has correct state from Sage). Clear the flag after the mount effect runs.
- Alternatively: pass Sage filter state as URL search params in the `navigate()` call (`navigate('/explore?q=marketing+expert&tags=marketing')`). Then `useUrlSync` reads them correctly on mount, and no flag is needed. This also makes Sage result links shareable.

**Detection:**
- URL on Explorer shows `?` with no params after Sage navigation even though filters are active
- Filter state in Zustand DevTools is correct but URL is empty — confirms the race

**Phase to address:** Phase introducing Sage cross-page navigation — implement the navigation trigger before writing any URL sync logic.

---

### Pitfall 3: Horizontal Scroll Row Causes CLS When Expert Photos Load Without Reserved Dimensions

**What goes wrong:**
Each horizontal scroll card reserves space based on the card's rendered dimensions. If expert photos have unknown dimensions and no `aspect-ratio` or explicit `width`/`height` set, the browser allocates no space for the image until it loads. When images load inside a horizontally scrolling row, they expand the card height — pushing the row taller and causing the entire page to reflow (Cumulative Layout Shift). On slow connections, all cards in the row pop to different heights as images trickle in.

**Why it happens:**
The current `Expert` interface has no `photo_url` field. Photos are a new addition. Without `width` and `height` attributes (or CSS `aspect-ratio`), browsers cannot pre-calculate image dimensions. Horizontal scroll containers with `overflow-x: auto` do not virtualize — all cards in the row are in the DOM simultaneously. Every image that loads triggers a layout calculation.

**Consequences:**
- Visible layout shift as user watches the page; Lighthouse CLS score degrades
- Cards in horizontal rows resize inconsistently if some photos load faster than others
- Billboard hero image loading shifts the entire page down

**Prevention:**
- Set a fixed `aspect-ratio` on every card image container via CSS before the image loads: `aspect-ratio: 3/4` for portrait expert photos, `aspect-ratio: 16/9` for the billboard hero. This reserves space before the image arrives — no CLS.
- Use `object-fit: cover` on the `<img>` tag with explicit `width` and `height` attributes that match the CSS slot dimensions.
- For the billboard hero: use a CSS background-color placeholder (brand purple at low opacity) while the photo loads — avoids a jarring white flash.
- Never use `auto` height on any image wrapper in the horizontal row. Fixed height (`h-[200px]`, `h-[180px]`) is acceptable; `aspect-ratio` with `w-full` is better.

**Detection:**
- Chrome DevTools Performance tab shows "Layout" events when images load in horizontal rows
- Lighthouse CLS score > 0.1 on the Browse page
- Cards visibly shift height as different photos load

**Phase to address:** Browse page and photo serving phase — card image slot dimensions must be specified in the design before any card component is written.

---

### Pitfall 4: Expert Photos Served Over HTTP from Railway While Frontend Is HTTPS on Vercel — Mixed Content Block

**What goes wrong:**
Vercel serves the frontend over HTTPS. Railway serves the FastAPI backend over HTTPS in production. But if photos are served from a Railway persistent volume via FastAPI's `StaticFiles` mount, the photo URL constructed on the frontend might use `import.meta.env.VITE_API_URL` which is set to the Railway URL. If the Railway URL is accessed via HTTP (e.g., `http://...railway.app/photos/username.jpg`), modern browsers block the request as mixed content and the image fails silently — no error, just a broken image icon.

**Why it happens:**
Railway terminates TLS at the edge and forwards requests to the container over HTTP internally. The `X-Forwarded-Proto` header is not always forwarded into the FastAPI process. If `uvicorn` thinks the app is served over HTTP, any URL it generates (e.g., in a redirect or a constructed URL in JSON) will use `http://`. If the frontend constructs photo URLs from `VITE_API_URL` and that var is set to the https Railway URL, this specific pitfall won't occur — but if any code generates photo URLs server-side and returns them in JSON, those URLs may be `http://`.

**Consequences:**
- All expert photos fail to load in production with no console error (just broken image)
- Photos work in local dev (both HTTP) but break on Vercel (HTTPS required)
- Difficult to debug because the Network tab shows the request as "blocked" not "failed"

**Prevention:**
- Construct photo URLs entirely on the frontend: `${API_BASE}/photos/${expert.username}.jpg` where `API_BASE = import.meta.env.VITE_API_URL`. The Railway HTTPS URL is already in `VITE_API_URL` for production — never let the backend construct or return photo URLs.
- Add `app.mount("/photos", StaticFiles(directory="/data/photos"), name="photos")` in `main.py`. The directory must be the Railway persistent volume mount path (typically `/data` or the `$VAR_DIR` equivalent).
- Ensure `VITE_API_URL` in Vercel's environment variables starts with `https://` — verify this before photo phase begins.
- Add CORS headers for the `/photos` static route: Railway's `StaticFiles` mount doesn't automatically inherit the CORSMiddleware applied to the FastAPI app. Serving static files through FastAPI's `StaticFiles` mount bypasses middleware. Solution: set `ALLOW_ORIGINS` in Nginx/proxy level, OR serve photos through a FastAPI endpoint (`GET /api/photos/{username}`) that returns a `FileResponse` — this route goes through CORSMiddleware normally.

**Detection:**
- Photos load in `localhost:5173` (local dev) but show broken image on Vercel production URL
- DevTools Network tab shows photo requests as "blocked" or "mixed content" in production
- `StaticFiles` CORS issue: browser console shows `No 'Access-Control-Allow-Origin' header` for photo requests

**Phase to address:** Photo serving backend phase — verify HTTPS and CORS before any frontend photo rendering is built.

---

### Pitfall 5: Sage Navigation from Browse Triggers `useExplore` Before Store Is Fully Set — Stale Fetch

**What goes wrong:**
The intended flow: user asks Sage something on Browse → Sage dispatches filters to Zustand → Sage calls `navigate('/explore')` → Explorer mounts → `useExplore` fires with Sage's filters → grid shows Sage results. The actual flow: Sage dispatches filters → `navigate()` fires → React begins rendering Explorer → `useExplore`'s `useEffect` fires with the filter state at the moment of first render — which may still be the default state if Zustand's batch update hasn't flushed yet. `useExplore` fetches `/api/explore` with empty filters, returns all 530 experts, then Sage's filter dispatch arrives and triggers a second fetch. The user sees the grid flash "all experts" then re-filter to Sage results.

**Why it happens:**
Zustand dispatches are synchronous and immediate in the current render cycle. But `navigate()` causes a React commit, and `useEffect` fires after the paint. If the Sage dispatch and the `navigate()` call happen in the same event handler microtask queue, React may batch the render with the pre-dispatch state before committing the post-dispatch state. This is React 18 automatic batching — state updates inside `Promise.then()` and `setTimeout` are batched, but the batch may not include the preceding synchronous state updates before navigate.

**Consequences:**
- Grid flashes "530 experts" briefly before showing Sage results when navigating from Browse
- Two consecutive `/api/explore` fetches — wasteful on Railway
- Sage-injected `sageMode: true` may be overwritten by the first fetch's `setResults` call

**Prevention:**
- Set `sageMode: true` in Zustand BEFORE dispatching filters and before `navigate()`. `useExplore` has a guard: `if (sageMode) return` — this aborts the effect entirely when `sageMode` is true. Sage's direct result injection then sets results without competing with `useExplore`.
- Order of operations in Sage navigation handler: `store.setSageMode(true)` → `store.setResults(experts, total, null)` → `navigate('/explore')`. Never dispatch filters first, navigate second without setting `sageMode`.
- This is the same pattern already used in `useSage.ts` for in-page search: `setSageMode(true)` + `setResults` before any navigation.

**Detection:**
- DevTools Network tab shows two GET `/api/explore` requests when navigating from Browse
- Grid briefly shows all 530 experts on Explorer arrival before filtering
- `sageMode` in Zustand DevTools is `false` during the first Explorer render

**Phase to address:** Sage cross-page navigation phase — the `sageMode` guard in `useExplore` must be verified as active before implementing any navigation logic.

---

### Pitfall 6: Route Change from `/` to `/marketplace` to `/explore` Breaks Existing Bookmarks and Shared Filter URLs

**What goes wrong:**
The current routing has `/` → redirect to `/marketplace`, and `/marketplace` is the Explorer page. v3.0 changes `/` to Browse and `/explore` to Explorer (renaming `/marketplace`). Any user who bookmarked `https://tinrate.ai/marketplace?q=UX+designer&tags=ux` will land on a 404 after the route rename. Shared filter URLs (the `useUrlSync` feature) break for all existing shareable links.

**Why it happens:**
`createBrowserRouter` in `main.tsx` is the sole source of truth for route-to-component mapping. Renaming `/marketplace` to `/explore` in that config removes the old route entirely unless an explicit redirect is added. React Router client-side redirects don't help if the user visits the URL directly — the browser requests `/marketplace` from Vercel, which serves `index.html` (SPA fallback), and React Router then 404s because `/marketplace` is no longer in the config.

**Consequences:**
- All existing shared filter URLs break silently — users see a blank or error page
- Any admin or partner who bookmarked `/marketplace` loses their link
- SEO: if any links to `/marketplace` exist externally, they break

**Prevention:**
- Keep `/marketplace` in the router config as a redirect to `/explore`: `{ path: '/marketplace', element: <Navigate to="/explore" replace /> }`. This handles direct URL visits and bookmark cases.
- Keep the existing `{ path: '/', element: <Navigate to="/marketplace" replace /> }` in place until `/` becomes Browse, then switch it to render `<BrowsePage />` directly.
- The `Navigate to="/explore" replace` pattern is already established in the codebase for admin routes (e.g., `{ path: 'search-lab', element: <Navigate to="/admin/tools" replace /> }`) — use the same pattern.
- Test: after route changes, manually visit `/marketplace`, `/marketplace?q=test`, and `/` — all should resolve correctly.

**Detection:**
- Browser console shows React Router "No routes matched" warning after rename
- Visiting `/marketplace` directly shows a blank page or React Router error boundary

**Phase to address:** Route reorganization phase (whichever comes first in v3.0) — the redirect must be added in the same commit as the route rename.

---

### Pitfall 7: Photo File Not Found at Railway Volume Path on First Deploy — Silent 404s

**What goes wrong:**
Photos are ingested from a new CSV and stored on Railway's persistent volume. On first deploy, the `/data/photos/` directory may not exist on the volume, causing `StaticFiles(directory="/data/photos")` to raise a `RuntimeError` at startup that prevents the app from starting at all. Alternatively, photos are uploaded to `/data/photos/` but filenames don't match usernames in `metadata.json` — every photo request returns 404 but there's no console error on the frontend (broken image icon only).

**Why it happens:**
Railway persistent volumes persist between deploys but start empty on first mount. The directory must be created programmatically in the lifespan if it doesn't exist. Additionally, if the CSV uses `Username` as the key and photos are named `john.doe.jpg` while the code expects `johndoe.jpg`, every filename lookup misses. Photo ingestion is a one-time data operation that must match the serving key exactly.

**Consequences:**
- App fails to start entirely if `StaticFiles(directory=...)` path doesn't exist on Railway
- All photos show broken icons if filename convention doesn't match the lookup key
- Billboard hero shows no image — the most visually prominent failure in the UI

**Prevention:**
- In `main.py` lifespan, add: `os.makedirs("/data/photos", exist_ok=True)` before `app.mount("/photos", StaticFiles(directory="/data/photos"), ...)`. `exist_ok=True` makes this idempotent across all deploys.
- Establish filename convention as `{username.lower()}.jpg` (all lowercase, no spaces) and enforce it at photo ingestion time. The `username` field in `metadata.json` uses values like `"johndoe"` already — use that directly.
- Add a startup health check log: count files in `/data/photos/` and log the count. Zero files on first deploy is expected; log it as a warning not an error.
- Never rely on `StaticFiles` auto-discovery to surface missing files — add an admin endpoint `GET /api/admin/photos/status` that returns `{total_experts: N, photos_found: M, missing: [username, ...]}` for the first 20 missing.

**Detection:**
- Railway logs show `RuntimeError: directory '/data/photos' does not exist` on startup
- All photos return 404 in DevTools Network tab after the app starts
- `total_experts: 530, photos_found: 0` from the status endpoint

**Phase to address:** Photo ingestion backend phase — the `os.makedirs` guard must be the first task, before mounting `StaticFiles` or writing any ingest code.

---

### Pitfall 8: Horizontal Scroll Row Paint Jank from Non-Composited Properties

**What goes wrong:**
A naively implemented horizontal scroll row that animates card entrance with `opacity` + `translateY` on each card will trigger main thread paint on every scroll event. If 8–12 cards are in the DOM simultaneously (all rendered, not virtualized), and each card has `transition: all 0.3s ease` or a Framer Motion `AnimatePresence` exit animation, scrolling the row causes every card to repaint on the main thread. On mobile or lower-end hardware, this produces visible jank at 30fps or below.

**Why it happens:**
`overflow-x: auto` horizontal scroll containers do not virtualize — all cards are in the DOM. CSS `transform` and `opacity` are compositor-only and cheap. But `box-shadow`, `filter`, `border-radius` with `overflow: hidden`, and `background-color` transitions all trigger main-thread paint. The existing `ExpertCard` uses a CSS `box-shadow` hover effect which is fine for a stationary grid — but inside a scrolling row with many cards, scroll-triggered repaints compound.

**Consequences:**
- Horizontal scroll feels sluggish on mobile (iPhone SE, older Android)
- Cards "blur" or "stutter" during fast scroll
- Chrome DevTools Performance tab shows "Recalculate Style" and "Layout" events on every scroll frame

**Prevention:**
- Use `will-change: transform` on the scroll container (not individual cards) to promote the container to its own compositor layer. Do NOT use `will-change` on every card — this creates too many layers and increases GPU memory.
- Keep card hover effects to `transform` (scale, translateY) and `opacity` only — never animate `box-shadow`, `filter`, or `background-color` on scroll-adjacent elements.
- Disable card hover effects entirely during scroll: add a CSS class `is-scrolling` to the row container via a `scroll` event listener with a 150ms debounce, and apply `pointer-events: none` on cards while scrolling. Re-enable after scroll ends.
- For card entrance animations: use CSS `@keyframes` with `opacity` and `transform` only — not Framer Motion `AnimatePresence` (which adds JS overhead per card).

**Detection:**
- Chrome DevTools Performance tab shows "Layout" or "Paint" events during horizontal scroll
- Scroll frame rate drops below 60fps in DevTools overlay
- Disabling all card CSS transitions makes scroll feel smooth — confirms a paint trigger

**Phase to address:** Browse page horizontal scroll implementation phase — performance must be validated on a mobile viewport before shipping, not after.

---

## Moderate Pitfalls

Mistakes that degrade UX or require targeted fixes but don't cause complete breakdowns.

---

### Pitfall 9: SageFAB `prevFilterKey` Ref Fires Spurious Glow on Browse Page

**What goes wrong:**
`SageFAB.tsx` tracks filter changes via `prevFilterKey = useRef<string | null>(null)`. The first render sets `prevFilterKey.current` to the current filter state and skips glowing. But when the user navigates from Browse to Explorer, `SageFAB` stays mounted (it's a persistent UI element across both pages). On Explorer's first render, `useUrlSync` may dispatch filter state that changes `query`, `rateMin`, `rateMax`, or `tags`. `SageFAB` sees the filter key change — from whatever Browse had — and fires the blue "filter change" glow. The user sees the FAB glow unprompted on Explorer arrival.

**Why it happens:**
`prevFilterKey.current` was initialized on Browse with Browse's filter state. The URL sync on Explorer mount may change filter state. The FAB's `useEffect` fires after the state change with `prevFilterKey.current !== filterKey` — triggering a glow. The `null` initialization pattern in `SageFAB` only prevents the first mount from glowing; it doesn't handle cross-page state changes.

**Prevention:**
- Reset `prevFilterKey.current` to the current filter key whenever the route changes. Use `useLocation()` from React Router in `SageFAB` and add a `useEffect([location.pathname])` that resets `prevFilterKey.current = null` to reinitialize on each page.
- Alternatively: only mount `SageFAB` inside each page component (not at the router level) so it remounts on navigation and gets a fresh `prevFilterKey` initialization.

**Detection:**
- FAB glows blue immediately on Explorer arrival after navigating from Browse
- No filter change was made by the user — the glow was triggered by URL sync

**Phase to address:** Browse page phase — FAB must be tested across both pages before shipping.

---

### Pitfall 10: Aurora Transition Animation Blocks Perceived Navigation Speed

**What goes wrong:**
A full-screen aurora mesh transition between Browse and Explorer that takes 600–800ms to complete feels slow if the destination page's content isn't ready when the animation ends. Users experience two waits: one for the transition animation, one for the grid to load. The transition gives the illusion of "preparing content" but if Explorer's first data fetch takes 300ms (normal Railway latency), the total wait is 1100ms — well above the 300ms threshold for perceived instantaneity.

**Why it happens:**
Page transition animations are a UI layer over network latency. If the transition is purely cosmetic (not data-loading), the user waits for both. Common mistake: implement the transition first, then discover that data fetching hasn't been parallelized with the animation.

**Prevention:**
- Pre-fetch Explorer data on Browse before navigating: when Sage determines it will navigate to Explorer, trigger a background `useExplore`-equivalent fetch while still on Browse. By the time the aurora transition completes, Explorer's data is already in the Zustand store.
- This is already possible because `useExplorerStore` is shared — call `store.setResults(experts, total, null)` from Sage before calling `navigate()`. Explorer then renders with data immediately, no grid loading state.
- Keep the aurora transition to 400ms maximum. A longer transition causes perceived lag regardless of data readiness.

**Detection:**
- After transition ends, user sees loading skeleton for 300–500ms before results appear
- Total time from Sage button click to visible results is > 1000ms

**Phase to address:** Sage cross-page navigation and aurora transition phase — data must be in the store before `navigate()` fires, not after.

---

### Pitfall 11: Billboard Hero Expert Selection Is Static — Becomes Stale Without Refresh Logic

**What goes wrong:**
The Billboard Hero shows "algorithmically featured" expert. If the algorithm runs once at startup (e.g., picks the highest `findability_score` expert at app load) and caches the result in memory, the same expert is featured for hours or days until Railway restarts. If that expert has a poor photo or is deactivated, the hero shows stale content with no way to refresh without a Railway redeploy.

**Why it happens:**
Simplest implementation: select the featured expert in the lifespan at startup, store in `app.state.featured_expert`. This works but is static.

**Prevention:**
- Serve the featured expert from a dedicated `GET /api/browse/hero` endpoint that runs the selection query fresh on each request (with a 1-minute `Cache-Control` response header to avoid hammering Railway on every page load).
- The selection algorithm should be deterministic for a given time window: `selected_expert = sorted_by_findability[hour_of_day % len(experts)]` cycles through top experts hourly. No state stored on the server.
- Alternatively: make the featured expert configurable from the admin panel — add a `featured_expert_username` setting to the existing `settings` table (already built in v1.2). Admin can override the algorithm pick.

**Detection:**
- Same expert featured for 24+ hours without admin intervention
- Expert has `findability_score: null` or a placeholder photo but is still shown as hero

**Phase to address:** Browse page backend phase — decide static vs. dynamic hero selection before writing any hero component.

---

### Pitfall 12: Adding `photo_url` to Expert Interface Breaks All Existing Components That Destructure Expert

**What goes wrong:**
The `Expert` interface in `resultsSlice.ts` defines the shape of every expert object throughout the codebase. Adding `photo_url?: string` is backwards compatible. But if it's added as required (`photo_url: string`) or if any component starts requiring it, TypeScript will show errors across `ExpertCard.tsx`, `SageMessage.tsx` (if it renders experts), admin expert list, and any other component that constructs a partial Expert object in tests or mock data. Fixing TypeScript errors one-by-one without a plan is error-prone under time pressure.

**Why it happens:**
The `Expert` interface is a shared contract. New required fields force updates to every construction site. Mock data and test fixtures are the most likely to miss updates.

**Prevention:**
- Always add `photo_url` as optional: `photo_url?: string | null`. Never required.
- Add a `photoUrl` utility function used everywhere: `function expertPhotoUrl(expert: Expert): string | null { return expert.photo_url ?? null }`. Centralizes the "does this expert have a photo?" logic and makes it easy to change the URL construction strategy later.
- Update the backend's `/api/explore` response to include `photo_url` from the start — even for experts without photos (return `null`). Avoids a situation where some endpoints return the field and others don't.

**Detection:**
- TypeScript errors across multiple files after adding `photo_url` to the `Expert` interface
- Some expert cards show photos, others silently fail (inconsistent field presence)

**Phase to address:** Photo serving phase — add `photo_url?: string | null` to the interface immediately and propagate through the backend response.

---

### Pitfall 13: `useUrlSync` Runs on Browse Page If SageFAB or Any Component Imports It

**What goes wrong:**
`useUrlSync` is only called in `MarketplacePage.tsx` today. If Browse page uses `useExplorerStore` for filter state (to drive horizontal category rows), and some developer adds `useUrlSync()` to Browse by mistake or includes a component that calls it, Browse's URL will be overwritten with filter params every time a category is selected. Browse page should have no URL query params — its state is purely category/row-level.

**Why it happens:**
`useUrlSync` is a well-established pattern in the codebase. A developer building Browse page might add it "just in case" thinking it's harmless. It's not — it will add `?q=&rate_min=0&rate_max=5000` to the Browse URL on every filter state change, breaking the clean `/` URL for Browse.

**Prevention:**
- Do not call `useUrlSync` in `BrowsePage` or any component mounted only on Browse. The hook is an Explorer-specific concern.
- Add a JSDoc comment to `useUrlSync.ts`: `/** Only call from MarketplacePage (Explorer). Do not use on BrowsePage. */`
- Verify in code review: `grep -r "useUrlSync" frontend/src/` should only appear in `MarketplacePage.tsx` (now `ExplorePage.tsx`) and the hook definition itself.

**Detection:**
- Browse page URL shows `?q=&tags=` after selecting a category row
- Navigating to Browse from Explorer appends Explorer's filter params to the Browse URL

**Phase to address:** Browse page phase — verify `useUrlSync` is not imported in any Browse-related component before shipping.

---

## Minor Pitfalls

---

### Pitfall 14: Horizontal Scroll Containers on iOS Safari Break with `overflow-x: auto` Without `-webkit-overflow-scrolling`

**What goes wrong:**
On iOS Safari (pre-iOS 13), `overflow-x: auto` scroll containers don't have momentum scrolling by default — they scroll jerkily. Modern iOS (13+) enables it automatically, but the `-webkit-overflow-scrolling: touch` property is still recommended for maximum compatibility. Without it, horizontal scroll rows feel sticky and unresponsive on older iOS devices.

**Prevention:**
Add `overflow-x-auto` (Tailwind) plus the CSS property in global styles: `.horizontal-scroll-row { -webkit-overflow-scrolling: touch; scrollbar-width: none; }`. Hide the scrollbar on webkit: `.horizontal-scroll-row::-webkit-scrollbar { display: none; }` for the Netflix-clean look.

**Phase to address:** Browse page horizontal scroll implementation.

---

### Pitfall 15: Billboard Hero Renders with 404 Photo Before API Responds — Flash of Broken Image

**What goes wrong:**
If the hero expert is fetched from the API after component mount, there's a render cycle where `photo_url` is `undefined` and the `<img>` renders with an empty `src`. Browsers show a broken image icon for that frame. Even at 50ms API latency, this flickers visibly at 60fps.

**Prevention:**
- Always render a placeholder (CSS background color or a skeleton shimmer) when `photo_url` is null or the fetch is in flight.
- Use the `loading="lazy"` attribute on non-hero images. Use `loading="eager"` on the billboard hero image and add a `<link rel="preload">` in `index.html` if the hero image URL is known at build time (it won't be — so use the placeholder pattern instead).
- Use `onError` handler on `<img>` to swap to a CSS fallback if the photo 404s.

**Phase to address:** Billboard hero implementation phase.

---

### Pitfall 16: Category Row Data (`/api/browse/categories`) Makes N+1 Queries if Not Pre-Aggregated

**What goes wrong:**
Each horizontal category row (trending tags, recently joined, most clicked, highest findability) requires a different sort/filter of the expert pool. If the Browse page calls a separate API endpoint for each row — 4 endpoints × 530 experts each — that's 4 database queries plus 4 FAISS operations on every Browse page load. At 100 concurrent users, this becomes 400 simultaneous queries against Railway's SQLite.

**Why it happens:**
The simplest implementation: reuse `/api/explore` for each row with different params. Works fine in dev, becomes a bottleneck at scale.

**Prevention:**
- Serve all Browse category data from a single `GET /api/browse` endpoint that returns all rows in one response: `{ trending: [...], recently_joined: [...], most_clicked: [...], highest_findability: [...] }`. One endpoint, one request from the frontend.
- The backend runs 4 sorted SQLite queries and returns top 10–20 experts per category. No FAISS needed for Browse rows (category rows don't require semantic search). 4 simple SQLite queries in series is < 50ms.
- Cache the response with a 5-minute TTL using an in-memory dict (`app.state.browse_cache`): `{ data: ..., expires_at: datetime }`. Most Browse category content doesn't change in 5 minutes.

**Phase to address:** Browse page backend phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Route reorganization | Breaking `/marketplace` bookmarks and shareable filter URLs | Add `<Navigate to="/explore" replace />` for old route before removing it |
| Browse page (UI) | Horizontal scroll jank on mobile | `will-change: transform` on container; test on iPhone SE before merge |
| Browse page (UI) | CLS from photos without fixed dimensions | `aspect-ratio` CSS on all card image slots before any photo code |
| Browse page (backend) | Railway `StaticFiles` startup crash on missing `/data/photos` dir | `os.makedirs("/data/photos", exist_ok=True)` in lifespan before mount |
| Photo serving | Mixed content HTTPS/HTTP block | Construct photo URLs on frontend from `VITE_API_URL`; verify HTTPS in Railway env |
| Photo serving | CORS block on `StaticFiles` mount | Serve photos via `FileResponse` endpoint or configure CORS at proxy level |
| Sage cross-page navigation | `resetPilot()` wiping conversation on Explorer mount | Add `navigatedFromBrowse` flag or remove unconditional `resetPilot()` |
| Sage cross-page navigation | `useExplore` race before `sageMode` flag is set | Set `sageMode: true` before `navigate()` — existing guard in `useExplore` blocks competing fetch |
| Sage cross-page navigation | `useUrlSync` overwriting Sage filter state on Explorer mount | Pass filters as URL params in `navigate()` call, or use `sagePendingNavigation` flag |
| Aurora transition | Perceived lag if data not pre-fetched | Store results in Zustand before calling `navigate()` — user arrives at loaded page |
| Expert interface expansion | TypeScript errors across codebase from new required field | Add `photo_url?: string | null` (optional) to `Expert` interface; never required |
| SageFAB cross-page | Spurious filter glow on page arrival | Reset `prevFilterKey.current` on route change using `useLocation()` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Shared Zustand store across Browse + Explorer | Calling `resetPilot()` unconditionally on Explorer mount | Guard with `navigatedFromBrowse` flag; skip reset if navigating from Browse |
| `useUrlSync` on Browse page | Calling `useUrlSync()` in `BrowsePage` or any Browse component | Keep `useUrlSync` exclusively in the Explorer page component |
| Sage `navigate()` from Browse | Dispatching filters then navigating without setting `sageMode: true` | `setSageMode(true)` → `setResults(...)` → `navigate('/explore')` — never navigate without sageMode guard |
| FastAPI `StaticFiles` for photos | Mounting before creating the directory | `os.makedirs(exist_ok=True)` before `app.mount(...)` in lifespan |
| FastAPI `StaticFiles` CORS | Expecting CORSMiddleware to cover static files | Static files bypass middleware; serve via `FileResponse` endpoint, or configure CORS at Railway proxy level |
| Expert photos URL construction | Building photo URLs in backend JSON response | Build photo URLs on frontend from `VITE_API_URL` to guarantee HTTPS |
| Horizontal scroll card images | Unknown image dimensions at render time | Fixed `aspect-ratio` on image wrapper; `object-fit: cover` on `<img>` |
| Aurora page transition | Running animation then loading data | Store data in Zustand before `navigate()` so destination page renders immediately |
| `/marketplace` route rename | Removing old route from `createBrowserRouter` | Keep old route as `<Navigate to="/explore" replace />` in same commit |
| Billboard hero selection | Picking featured expert once at startup | Serve from API endpoint with time-window algorithm; do not cache in `app.state` |
| `photo_url` on `Expert` interface | Adding as required field | Always `photo_url?: string | null` — optional, with null for experts without photos |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 API calls for Browse category rows | 4 separate API requests on every Browse page load | Single `/api/browse` endpoint with all rows in one response | Immediately; 4× Railway latency on every Browse load |
| Non-composited CSS properties on horizontal scroll cards | Scroll jank at < 60fps on mobile | Only animate `transform` and `opacity`; avoid `box-shadow` transitions during scroll | On mobile/low-end hardware from day 1 |
| All horizontal scroll cards in DOM simultaneously | Memory grows with long rows; many images loading at once | Limit each row to 10–15 items (not all 530 experts) with a "View all" link to Explorer | With long rows on low-memory devices |
| `will-change: transform` on every card | Too many GPU compositor layers; GPU memory exhaustion | Apply `will-change` only to the scroll container, not individual cards | On mobile with many rows |
| Aurora transition delays data rendering | Perceived wait of 1000ms+ | Pre-fetch destination data before starting transition | Any time network latency > 200ms |
| Photos without `aspect-ratio` in scroll row | CLS; row height unstable during photo load | Fixed `aspect-ratio` on all image containers | From first page load on slow connections |

---

## "Looks Done But Isn't" Checklist

- [ ] **`resetPilot()` guard:** Navigate from Browse → Explorer → Sage panel still shows the conversation from Browse. Messages are NOT cleared on Explorer arrival.
- [ ] **`sageMode` before navigate:** DevTools Network tab shows zero GET `/api/explore` requests on Explorer mount when navigating from Sage (sageMode blocks the fetch).
- [ ] **Photo HTTPS:** Open the Vercel production URL in an Incognito window — photos load. DevTools Security tab shows no mixed content warnings.
- [ ] **Photo CORS:** Photos load from Vercel production domain without a `No 'Access-Control-Allow-Origin'` error in DevTools console.
- [ ] **Photo directory startup:** Railway logs show no `RuntimeError` for missing photos directory on first deploy after new photo code lands.
- [ ] **Horizontal scroll performance:** Chrome DevTools Performance tab on a throttled Mobile profile shows no "Layout" or "Paint" events during horizontal scroll of category rows.
- [ ] **CLS:** Lighthouse score for Browse page shows CLS < 0.1 with images loading on a simulated slow connection.
- [ ] **Route redirect:** Visiting `/marketplace` directly in the browser after the route rename resolves to Explorer (not a blank page or 404).
- [ ] **Spurious FAB glow:** Navigate from Browse to Explorer — FAB does NOT glow blue on arrival. Glow only fires on deliberate filter changes.
- [ ] **Browse URL clean:** The Browse page URL is exactly `/` with no query params after selecting any category row.
- [ ] **Billboard hero photo:** Hero shows a placeholder/skeleton while photo is loading — never a broken image icon.
- [ ] **Aurora transition speed:** Browse → Explorer transition completes in ≤ 400ms total; Explorer content is visible immediately after.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `resetPilot()` destroys cross-page conversation | LOW | Add `navigatedFromBrowse` flag to pilotSlice; one-file frontend change; redeploy (auto on push) |
| Photo CORS block in production | MEDIUM | Switch from `StaticFiles` mount to `GET /api/photos/{username}` `FileResponse` endpoint; one new backend route; redeploy |
| Photo HTTP/HTTPS mixed content | LOW | Verify `VITE_API_URL` starts with `https://` in Vercel env vars; rebuild frontend |
| Railway missing `/data/photos` crash | HIGH | App is down until fix deploys (~2 min); add `os.makedirs` to lifespan; push immediately; no data loss |
| `/marketplace` route broken after rename | LOW | Add `<Navigate to="/explore" replace />` to router config; push; auto-deploy |
| Horizontal scroll jank in production | MEDIUM | Add `will-change: transform` to container; disable card animations during scroll; frontend-only change; redeploy |
| Aurora transition too slow | LOW | Reduce transition duration from config; frontend CSS change; redeploy |
| Sage navigation stale fetch race | MEDIUM | Verify `setSageMode(true)` is called before `navigate()`; check `useExplore` sageMode guard is present |
| N+1 Browse API calls | MEDIUM | Consolidate 4 row fetches into one `/api/browse` endpoint; one new backend route + frontend refactor of Browse data loading |

---

## Sources

- Direct codebase analysis: `frontend/src/pages/MarketplacePage.tsx` — `resetPilot()` on mount, `useUrlSync()` call, pilot state management
- Direct codebase analysis: `frontend/src/hooks/useExplore.ts` — `sageMode` guard, AbortController, reactive deps array, `setResults` ownership
- Direct codebase analysis: `frontend/src/hooks/useSage.ts` — `setSageMode(true)` + `setResults` pattern for in-page Sage injection, `getState()` snapshot pattern
- Direct codebase analysis: `frontend/src/hooks/useUrlSync.ts` — `skipFirst` ref behavior, URL → Store vs Store → URL direction, `initialized` ref on mount
- Direct codebase analysis: `frontend/src/components/pilot/SageFAB.tsx` — `prevFilterKey = useRef<string | null>(null)` initialization, filter glow trigger logic
- Direct codebase analysis: `frontend/src/store/index.ts` + `pilotSlice.ts` + `resultsSlice.ts` — persist boundary (`partialize`), `sageMode` in resultsSlice, store ownership rules
- Direct codebase analysis: `frontend/src/main.tsx` — current router config with `/` → `/marketplace` redirect, existing `<Navigate replace />` pattern for admin routes
- Direct codebase analysis: `app/main.py` — lifespan sequence, `os.makedirs` opportunity, `StaticFiles` mounting location
- Zustand docs / GitHub discussions: reset state before navigate, persist boundary, cross-page state management patterns
- React Router v6 docs / GitHub discussions: `<Navigate replace>` for redirects, programmatic navigation with `useNavigate`, search params in navigation
- FastAPI GitHub discussions: `StaticFiles` CORS bypass of middleware (issue #6670), HTTPS scheme detection on Railway, mixed content production pitfalls
- MDN Web Docs: CLS, image `aspect-ratio` property, `loading="lazy"` vs `loading="eager"`, `will-change: transform` guidance
- Framer Motion + React Router GitHub discussions: `AnimatePresence` with `useLocation().key` pattern, exit animation timing, context freezing during transitions

---

*Pitfalls research for: v3.0 Netflix Browse & Agentic Navigation — Browse page, cross-page Sage navigation, photo serving, route reorganization*
*Researched: 2026-02-24*
