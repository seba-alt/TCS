# Tinrate AI Concierge Chatbot

## What This Is

A professional Expert Marketplace for the Tinrate platform. Users discover vetted experts via an immersive aurora-aesthetic Explorer — glassmorphic Command Center header with autocomplete search (debounced suggestions for job titles, companies, and tags) and spring expert count; animated aurora mesh background; bento-style expert cards with profile photos and monogram fallback in grid or list view; animated claymorphic tag cloud with 18 domain tags plus industry-level tags (Finance, Healthcare, Tech, etc.) and proximity-based scaling. Mobile-optimized with inline filter controls (tag picker, sort, active chip row) and full-width search bar. Expert bookmarking with localStorage persistence. User behavior (card clicks, filter changes) is tracked for marketplace intelligence. GA4 analytics + Microsoft Clarity track every page view with SPA route change support. Expert email PII has been purged from all data stores. A newsletter gate captures leads on "View Full Profile". Intercom live chat provides real-time support. Admin panel secured with bcrypt+JWT authentication and rate limiting; streamlined sidebar with overview dashboard (stat cards, recent leads/searches), lead export CSV, bulk expert CSV import, and marketplace intelligence. Playful users can trigger barrel rolls and a "tinrate" header tilt easter egg.

## Core Value

A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## Requirements

### Validated

- ✓ User can type a problem description into a conversational chat interface — v1.0
- ✓ Backend embeds the query using Google GenAI embeddings and semantically searches the expert CSV — v1.0
- ✓ Gemini LLM generates a response recommending exactly 3 experts, each with "Name — Job Title @ Company" and a "Why them:" explanation — v1.0
- ✓ Frontend renders 3 visual Expert Cards below the AI response showing name, title, company, and hourly rate — v1.0
- ✓ Each Expert Card is a clickable link routing to that expert's profile page on Tinrate — v1.0
- ✓ Email gate captures leads before profile clicks; returning visitors auto-unlocked via localStorage — v1.0
- ✓ Thumbs up/down feedback on expert results, stored in DB with optional detail — v1.0
- ✓ Admin dashboard with login, search analytics, lead tracking, expert management — v1.0
- ✓ Application deployed publicly — Railway backend, Vercel frontend — v1.0
- ✓ Hybrid search backend (`/api/explore`) with SQLAlchemy pre-filter, FAISS IDSelectorBatch, FTS5 BM25 fusion, findability and feedback boosts — v2.0
- ✓ Zustand global state (`useExplorerStore`) with filter, results, and pilot slices; localStorage persist for filter preferences — v2.0
- ✓ Faceted sidebar: rate slider, domain tag multi-select, text search, filter chips; mobile vaul bottom-sheet drawer — v2.0
- ✓ Virtualized expert grid with react-virtuoso infinite scroll; cards show name, title, company, rate, tags, findability badge, match reason — v2.0
- ✓ Expert cards have CSS hover animation (lift + purple glow via `.expert-card` class); AnimatePresence for Sage FAB/panel and ProfileGateModal — v2.0
- ✓ Floating Sage AI co-pilot: FAB → 380px slide-in panel, Gemini function calling (`apply_filters`), full-screen on mobile — v2.0
- ✓ Free browsing without email gate; email gate only on "View Full Profile" — v2.0
- ✓ Email gate + localStorage bypass for returning visitors — v2.0
- ✓ URL reflects active filters as query params (shareable filtered views); filter state restores from URL on load — v2.0
- ✓ No-results state shows 6 alternative tag suggestions, a Sage CTA, and a clear-all option — v2.0
- ✓ FTS5 prefix-matching `/api/suggest` endpoint; SearchInput shows suggestions dropdown with AbortController — v2.0
- ✓ Infinite scroll with active text query sends correct `query` param (pagination bug fixed) — v2.0
- ✓ Rate filter chip reflects actual filter state on page load; RateSlider max=5000 aligned with store defaults — v2.0
- ✓ Atomic FAISS index swap with admin rebuild trigger (IDX-01 – IDX-04) — Phase 24
- ✓ OTR@K + Index Drift metrics + t-SNE embedding heatmap (INTEL-01 – INTEL-06) — Phases 24–26
- ✓ Newsletter subscription gate, Zustand-persisted (NLTR-01 – NLTR-04) — Phase 27
- ✓ Easter egg barrel roll on playful queries (FUN-01) — Phase 27
- ✓ Aurora mesh gradient background + glassmorphism surfaces (VIS-01 – VIS-05) — Phase 22
- ✓ Bento-style ExpertCard redesign (CARD-01 – CARD-03) — Phase 23
- ✓ Animated claymorphic tag cloud + "Everything is possible" element (DISC-01 – DISC-04) — Phase 23
- ✓ Sage calls `run_explore()` in-process via `search_experts` FunctionDeclaration; results narrated + grid synced via `validateAndApplyFilters()` — v2.3
- ✓ Sage panel and grid kept in sync — `search_performed: true` triggers filter slate clear + search param apply + useExplore re-fetch — v2.3
- ✓ Zero-result handling: Sage narrates fallback alternatives (grid stays); double-zero resets grid to all experts — v2.3
- ✓ Sage system prompt rewritten for "smart funny friend" voice — contractions, no filler affirmations, one-question hard cap with concrete options — v2.3
- ✓ Sage FAB animated boxShadow glow: purple on Sage reply, blue on filter change, inner button scale gestures unchanged — v2.3
- ✓ Expert card clicks tracked as events (expert_id, context, rank, active_filters snapshot) — v2.3
- ✓ Sage query interactions tracked (query_text, function_called, result_count, zero_results) — v2.3
- ✓ Filter usage events tracked for all three surfaces (debounced query, drag-end rate, add-only tags) — v2.3
- ✓ Admin Marketplace page shows unmet demand (zero-result queries by frequency) + expert click exposure — v2.3
- ✓ Admin Marketplace stacked BarChart shows daily Sage query volume with KPI pills — v2.3
- ✓ Cold-start empty state: no blank page when user_events table is empty — v2.3
- ✓ Sage discovery queries inject results directly into grid via `store.setResults()` — search bar stays empty, filters unchanged — v2.3
- ✓ Header expert count reflects Sage's actual FAISS result count; zero-result queries render empty-state UI — v2.3
- ✓ Any manual sidebar interaction exits Sage mode and restores normal filter-driven results — v2.3
- ✓ Glassmorphic Command Center header with aurora gradient, animated search placeholders, Sage-in-flight pulse, spring expert count — v2.3
- ✓ "tinrate" easter egg: 3-degree header tilt + emoji particle burst — v2.3
- ✓ Admin sidebar consolidation — 8 nav items across 3 sections (Analytics, Tools, Admin) — v2.3
- ✓ ToolsPage with hash-driven tab navigation (Search Lab, Score Explainer, Index) — v2.3
- ✓ OverviewPage dashboard — top zero-result queries card, Sage volume sparkline, API health above the fold — v2.3
- ✓ NULL gap detection fix — all 8 admin query sites correctly count zero-candidate searches — v2.3
- ✓ Dutch language auto-detection and server-side translation for Sage FAISS search — v2.3
- ✓ Expert profile photos: bulk CSV import, photo proxy endpoint with HTTPS/cache, monogram fallback — v3.0
- ✓ Route reorganization: `/` → Explorer (was `/marketplace`), legacy redirects preserved — v3.0
- ✓ Search autocomplete with debounced FTS5 suggestion dropdown (job titles, companies, tags) — v3.0
- ✓ Non-live grid updates: search commits on Enter key or suggestion selection — v3.0
- ✓ Mobile tap-expand expert cards within fixed VirtuosoGrid height — v3.0
- ✓ Sage bottom sheet (Vaul) for mobile with auto-close after discovery — v3.0
- ✓ Responsive layout: compact header on mobile, hidden expert count, hidden md:block split for Sage — v3.0
- ✓ Saved/bookmarked experts with localStorage persistence and toolbar button — v3.0
- ✓ Expert email PII purged from DB, CSV, and all import/add/seed paths — v3.1
- ✓ Photo proxy returns 404 (not 502) on upstream failure; frontend monogram fallback handles silently — v3.1
- ✓ FTS5 MATCH queries wrapped with try/except safety nets in explorer and suggest paths — v3.1
- ✓ Deprecated gemini-2.0-flash-lite replaced with gemini-2.5-flash-lite — v3.1
- ✓ React redirect loop eliminated — imperative useNavigate+useEffect replaces declarative Navigate — v3.1
- ✓ Search Lab aligned with run_explore() pipeline; legacy pipeline preserved for A/B validation — v3.1
- ✓ Mobile filters redesigned as inline controls (MobileInlineFilters) replacing Vaul drawer — v3.1
- ✓ Full-width search bar on mobile (logo hidden with hidden md:block) — v3.1
- ✓ Desktop tag cloud expanded from 12 to 18 visible tags — v3.1
- ✓ GA4 analytics (G-0T526W3E1Z) with SPA route change tracking via React Analytics component — v3.1
- ✓ Admin auth upgraded to bcrypt+JWT with rate limiting (SEC-01, SEC-02) — v4.0
- ✓ SQLite WAL mode with busy_timeout for concurrent traffic (SEC-03) — v4.0
- ✓ t-SNE embedding heatmap fixed (ADM-03) — v4.0
- ✓ Admin routes lazy-loaded with React.lazy + Suspense; vendor chunks split (PERF-01, PERF-02) — v4.0
- ✓ White search bar input with keyword placeholder (EXP-01, EXP-02) — v4.0
- ✓ Grid/list view toggle with localStorage persistence (EXP-03) — v4.0
- ✓ Sage single-render fix on desktop (EXP-04) — v4.0
- ✓ Mobile tap-expand / desktop direct-click behavior (EXP-05) — v4.0
- ✓ API error state with retry button (EXP-06) — v4.0
- ✓ Admin overview stat cards — Total Leads, Expert Pool, Sage volume (ADM-01) — v4.0
- ✓ Lead export CSV with search queries and card clicks (ADM-02) — v4.0
- ✓ Bulk expert CSV import with drag-drop, preview, column mapping (ADM-05) — v4.0
- ✓ Industry-level tag taxonomy — data model, Gemini batch-tagging, tag cloud UI, filter integration (DISC-01, DISC-02, DISC-03) — v4.0
- ✓ Unused admin tools removed, sidebar simplified (ADM-04) — v4.0

- ✓ Admin overview stats fixed + clickable stat cards + expert deletion with FAISS rebuild — v4.1
- ✓ Seeded findability-weighted random initial display, sort-by removed, search autofocused — v4.1
- ✓ No-results Intercom CTA + tag-first autocomplete + dynamic rate slider max — v4.1
- ✓ Responsive ExpertCard redesign (mobile photo-centric, desktop photo-left, tap-expand removed) — v4.1
- ✓ Mobile filter cleanup (no clear button, no search-within pickers, tag click clears query) — v4.1
- ✓ Purple saved card treatment + filter-independent saved view via backend `usernames` param — v4.1
- ✓ Anonymous search tracking + Microsoft Clarity analytics (vph5o95n6c) — v4.1

- ✓ Search results grouped by match quality tier (Top Match → Good Match → rest) — v5.0
- ✓ Currency displayed as symbols (€, $, £) instead of text codes (EUR, USD, GBP) — v5.0
- ✓ Mobile expert cards show company name and match badge when applicable — v5.0
- ✓ Mobile expert card name wraps to two lines when truncated — v5.0
- ✓ Mobile clear-all filter button clearly visible — v5.0
- ✓ Admin experts search by name — v5.0
- ✓ Backend performance: embedding cache (60s TTL), ExpertTag join table, settings/feedback caching (30s TTL) — v5.0
- ✓ Admin panel overhauled — URL routing, shared components, pagination with page jump, overview dashboard with period toggle — v5.0
- ✓ Admin Data page unified — Searches and Marketplace merged with shared date picker — v5.0
- ✓ Lead click tracking — click_count column on Leads page + Click Activity table — v5.0
- ✓ Sage AI co-pilot removed — all backend endpoints, frontend components, store slices, and admin views deleted — v5.0
- ✓ Intercom live chat integrated — react-use-intercom provider, IntercomIdentity component, replaces Sage for user support — v5.0

- ✓ Clear-all button only visible when filters are active (not on page load) — v5.1
- ✓ Build fix: unused totalTagCount removed from MobileInlineFilters.tsx — v5.1
- ✓ Lead journey timeline — expandable lead rows with chronological search/click history and time gap labels — v5.1
- ✓ Overview: top experts ranked by card click volume with period toggle — v5.1
- ✓ Overview: top search queries ranked by frequency with period toggle — v5.1
- ✓ Overview: zero-result queries as unmet demand signals with period toggle — v5.1

- ✓ Backend email column on user_events with idempotent startup migration — v5.2
- ✓ Frontend trackEvent() enrichment with email from Zustand persist store — v5.2
- ✓ Mandatory email entry gate on page load (no dismiss, synchronous bypass for returning subscribers) — v5.2
- ✓ Loops lead tagging with source: "page_entry" for gate submissions — v5.2
- ✓ Email-attributed Explorer events in admin lead timeline (search + click with distinct icons) — v5.2
- ✓ Admin overview accordion expansion on Top Experts and Top Searches cards (up to 50 items) — v5.2
- ✓ Vercel Speed Insights active on frontend — v5.2

### Active

(No active milestone — start next with `/gsd:new-milestone`)

### Out of Scope

- User authentication / accounts — users interact anonymously; admin uses bcrypt+JWT credentials
- Booking/payment flow — cards link to Tinrate profiles where booking happens
- Mobile native app — web-first
- Real-time availability or calendar integration — not in CSV data
- Full multi-language support — Dutch auto-detection added in v2.3, other languages deferred
- Offline mode — real-time retrieval is core value
- In-app match report download (LEAD-03) — deferred to v2.1 backlog
- Full GDPR compliance toolkit — email purge addresses the immediate data issue; full compliance deferred
- Custom analytics dashboard — GA4 dashboard is sufficient for launch

## Shipped Versions

### v5.2 Email-First Gate & Admin See-All — Shipped 2026-03-04
- Email gate moved to page entry — mandatory full-screen gate blocks Explorer until email submitted; returning subscribers bypass instantly via synchronous Zustand persist check
- Email tracking infrastructure — nullable indexed email column on user_events, trackEvent() enrichment from Zustand persist store
- Email-attributed lead timeline — admin sees Explorer search/click events matched by email with distinct icons (green/compass, amber/eye)
- Admin overview accordion — Top Experts and Top Searches cards expand in-place to full ranked lists (up to 50), single-slot accordion state
- Vercel Speed Insights active on frontend
- Audit gap closure — fixed explorer_click payload key bug, Phase 64 formally verified
- All 11 requirements satisfied across 4 phases
- Archive: `.planning/milestones/v5.2-ROADMAP.md`

### v5.1 Lead Insights & Overview — Shipped 2026-03-03
- See MILESTONES.md for details
- Archive: `.planning/milestones/v5.1-ROADMAP.md`

### v5.0 Platform Polish & Admin Overhaul — Shipped 2026-03-03
- Explorer UX bugs fixed: tier-sorted search results, currency symbols on all surfaces, mobile card completeness, OG meta tags
- Backend performance: embedding cache (60s TTL), settings cache (30s TTL), ExpertTag join table (55x speedup), admin monolith split into 10-module router package
- Admin frontend overhauled: URL child routes, shared components (AdminCard, AdminInput, AdminPagination, AdminPageHeader), pagination with page jump, overview dashboard with period toggle
- Audit gaps closed: CORS DELETE, currencySymbol() consistency, retroactive Phase 56 verification
- Admin dashboard enhanced: unified Data page, lead click tracking, active tag chips, Click Activity table
- Tech debt resolved: dead code removed, orphaned files deleted, ADMUI-03 closed as N/A
- All 23 requirements verified (22 satisfied + 1 N/A) across 6 phases
- Archive: `.planning/milestones/v5.0-ROADMAP.md`

### v4.1 UX Polish & Mobile Overhaul — Shipped 2026-03-03
- Admin overview stats fixed + clickable stat cards + expert deletion with FAISS rebuild
- Seeded random initial display, sort-by removed, search autofocused, Intercom no-results CTA
- Tag-first autocomplete, dynamic rate slider max from API
- Responsive ExpertCard: mobile photo-centric, desktop photo-left, tap-expand removed
- Mobile filter cleanup: no clear button, no search-within pickers, tag click clears query, scroll fix
- Purple saved card treatment + filter-independent saved view (backend `usernames` param) + anonymous search tracking + Microsoft Clarity
- All 20 requirements verified across 4 phases
- Archive: `.planning/milestones/v4.1-ROADMAP.md`

### v4.0 Public Launch — Shipped 2026-02-27
- Admin auth upgraded to bcrypt+JWT with rate limiting; SQLite WAL mode for concurrent traffic; t-SNE heatmap fixed
- Public bundle halved by lazy-loading 11 admin routes + Vite vendor chunk splitting (~711 kB vs ~1,261 kB)
- Explorer polished: white search bar, grid/list toggle, Sage double-render fix, desktop card click bypass, API error states
- Industry-level tag taxonomy: Gemini batch-tagging, backend filter, tag cloud UI section, independent filtering
- Admin streamlined: unused tools removed, lead export CSV, overview stat cards, bulk expert CSV import
- All 19 requirements verified across 6 phases — production-ready for public launch
- Archive: `.planning/milestones/v4.0-ROADMAP.md`

### v3.1 Launch Prep — Shipped 2026-02-26
- Expert email PII purged: idempotent startup migration blanks all Expert.email values; CSV Email column stripped; import/add/seed paths permanently closed
- Backend error hardening: photo proxy 502→404, FTS5 MATCH safety nets with structlog, gemini-2.0-flash-lite→2.5-flash-lite
- Search Lab aligned with run_explore() live pipeline; legacy pipeline preserved for A/B validation; pipeline badges in UI
- React redirect loop fixed (imperative useNavigate+useEffect); GA4 SPA tracking wired (G-0T526W3E1Z); desktop tag cloud expanded to 18 tags
- Mobile filters redesigned: inline MobileInlineFilters with TagPickerSheet, SortSheet, active chip row; Vaul drawer removed (kept for Sage)
- Full-width mobile search bar (logo hidden on mobile)
- Archive: `.planning/milestones/v3.1-ROADMAP.md`

### v3.0 Netflix Browse & Agentic Navigation — Shipped 2026-02-26
- Browse page built (Netflix-style horizontal category rows, glassmorphic cards, hero banner, Sage cross-page navigation) then removed in favor of Explorer-only architecture
- Expert photo system: bulk CSV import, photo proxy endpoint with HTTPS enforcement and 24h cache, monogram initials fallback
- Search autocomplete: debounced FTS5 suggestion dropdown with job titles, companies, and client-side tag matching; non-live grid (Enter to commit)
- Mobile optimization: tap-expand expert cards (content swap within fixed 180px VirtuosoGrid height), Sage bottom sheet via Vaul, responsive compact header
- Expert bookmarking: localStorage-persisted saved experts with toolbar button (mobile icon+count, desktop pill)
- Route simplification: Explorer at `/`, legacy `/marketplace` and `/explore` redirects, Browse page removed
- Archive: `.planning/milestones/v3.0-ROADMAP.md`

### v2.3 Sage Evolution & Marketplace Intelligence — Shipped 2026-02-24
- Sage active search engine: `search_experts` Gemini function calls `/api/explore` in-process; results narrated in panel + synced to grid; zero-result fallback handling
- Sage personality upgrade: "smart funny friend" system prompt, one-question hard cap, contractions, FAB animated boxShadow glow
- Sage direct grid injection: `sageMode` state machine, results appear without search bar pollution, any filter interaction exits Sage mode
- Command Center Header: glassmorphic frosted-glass panel, animated search placeholders, spring expert count, Sage-in-flight pulse, "tinrate" easter egg
- Behavior tracking: `UserEvent` model + `POST /api/events` (202, no auth) + `trackEvent()` fire-and-forget module function; tracks card clicks, Sage queries, filter changes
- Admin Marketplace Intelligence: unmet demand table, expert exposure distribution, daily Sage usage BarChart, cold-start empty state, CSV export
- Admin platform restructure: 3-section sidebar (8 items), ToolsPage with hash-driven tabs, DataPage with marketplace/intelligence tabs, OverviewPage dashboard uplift
- Dutch Sage: auto-detect Dutch queries via Gemini flash-lite, server-side translation for FAISS search
- NULL gap fix: all 8 admin query sites correctly count zero-candidate searches
- Archive: `.planning/milestones/v2.3-ROADMAP.md`

### v2.2 Evolved Discovery Engine — Shipped 2026-02-22
- Aurora mesh gradient background (OKLCH tokens, CSS keyframe animation) + glassmorphism on sidebar, search, Sage panel
- Bento-style ExpertCard redesign: four visual zones (name/role, rate+badge, tags, match reason) within h-[180px], aurora-palette OKLCH hover glow
- Animated claymorphic tag cloud: proximity-scale spring physics, FLIP layout reordering, "Everything is possible" cycling element
- Atomic FAISS index swap: admin rebuild trigger, asyncio.Lock OOM guard, atomic swap, live status polling
- Admin Intelligence: OTR@K 7-day rolling average, Index Drift (rebuild age + expert delta), t-SNE embedding scatter plot (Recharts, jewel-tone category colors)
- Newsletter gate: `newsletter_subscribers` table, subscription CTA modal, Zustand-persisted unlock, admin subscriber list + CSV export
- Easter egg: "barrel roll" / "do a flip" triggers 360° Framer Motion spin on ExpertGrid container; Sage short-circuits with canned response
- Archive: `.planning/milestones/v2.2-ROADMAP.md`

### v2.0 Extreme Semantic Explorer — Shipped 2026-02-22
- Hybrid search backend: three-stage pipeline (SQLAlchemy + FAISS 0.7 + BM25 0.3) with findability/feedback boosts
- Zustand global state with three slices, localStorage persist, Zustand selectors pattern
- Marketplace UI: faceted sidebar, mobile vaul bottom-sheet, filter chips, virtualized react-virtuoso grid
- Expert cards with CSS hover animation (lift + purple glow); AnimatePresence for modals and Sage panel
- Floating Sage AI co-pilot: FAB, slide-in panel, Gemini two-turn function calling, mobile full-screen
- Extended features: email gate (View Full Profile), URL filter sync, FTS5 suggestions, EmptyState with tag pills
- Bug fixes: pagination `q`→`query` param, FilterChips/RateSlider/MobileFilterSheet rate defaults (all aligned to 5000)
- Archive: `.planning/milestones/v2.0-ROADMAP.md`

### v1.2 Intelligence Activation & Steering Panel — Shipped 2026-02-21
- SQLite `settings` table with runtime flag storage — toggle HyDE/feedback without Railway redeploy
- GET/POST `/api/admin/settings` with SETTINGS_SCHEMA, native-typed values, source field (db/env/default)
- Admin Intelligence tab rewritten as live steering panel: toggle switches, threshold inputs, dirty tracking, inline save feedback
- Search Lab A/B comparison: side-by-side configs, amber/blue diff view, delta badges, per-run overrides
- Archive: `.planning/milestones/v1.2-ROADMAP.md`

### v1.1 Expert Intelligence & Search Quality — Shipped 2026-02-21
- AI batch-tagged all 1,558 experts with 3–8 domain tags (Gemini 2.5 Flash)
- Findability scoring (0–100) per expert, surfaced in admin with color-coded badges
- FAISS rebuilt with all 1,558 experts + tag-enriched embeddings
- Admin Expert tab overhauled: sort/filter/pagination, domain tag pills, worst-first findability sort
- HyDE query expansion + feedback-weighted re-ranking, gated by env var flags
- Admin Search Lab + Intelligence Dashboard for monitoring retrieval quality
- Archive: `.planning/milestones/v1.1-ROADMAP.md`

### v1.0 MVP — Shipped 2026-02-20
- Core AI chat with 3-expert recommendations, email gate, feedback, admin dashboard
- Archive: `.planning/milestones/v1.0-ROADMAP.md`

## Current State

**Deployed version:** v5.2 (Railway + Vercel, auto-deploys on push to main)
**Expert pool:** experts (growing weekly) (data/metadata.json), all AI-tagged with domain + industry tags; FAISS index at vectors (grows with expert pool); profile photos via proxy endpoint; expert email PII purged
**Search intelligence:** Three-stage hybrid pipeline live; HyDE + feedback re-ranking toggled via admin steering panel; FTS5 autocomplete suggestions with tag-first ranking; dynamic rate slider max from API; embedding cache (60s TTL) prevents duplicate Google API calls
**Explorer:** Single-page aurora-aesthetic marketplace at `/` with glassmorphic Command Center header, autofocused search with tag-first autocomplete, responsive cards (mobile photo-centric / desktop photo-left) in grid or list view, animated tag cloud (18 domain tags + industry tags), inline mobile filters (simplified — clear-all only when filters active), seeded random initial ordering, bookmarks with purple visual treatment and filter-independent saved view, Intercom no-results CTA, anonymous search tracking, newsletter gate, API error states with retry. Search results tier-sorted (Top Match → Good Match → rest). Currency symbols on all rate displays.
**Live chat:** Intercom (replaces Sage AI co-pilot, removed in phase 50.3)
**Admin panel:** Secured with bcrypt+JWT + rate limiting; 10-module router package; URL-based routing with shared components (AdminCard, AdminInput, AdminPagination, AdminPageHeader). Overview with period toggle (Today/7d/30d/All) + active tag chips + ranked insight cards (Top Experts, Top Searches, Unmet Demand). Unified Data page (merged Searches/Marketplace) with shared date picker. Experts page with name search + deletion. Leads page with expandable timeline (chronological search/click history with time gap labels), click count column + Click Activity table + CSV export. Settings/feedback caching (30s TTL).
**Analytics:** GA4 (G-0T526W3E1Z) + Microsoft Clarity (vph5o95n6c) + Vercel Speed Insights tracking all page views with SPA route change support

**Current milestone:** None (v5.2 shipped 2026-03-04)

## Context

- **Expert data:** SQLite table with profiles (growing weekly) (email PII purged); FAISS index at 530 tag-enriched vectors; all experts AI-tagged with 3–8 domain tags + findability scores
- **AI stack:** Google GenAI (gemini-embedding-001) for embeddings, Gemini 2.5 Flash for generation + Sage function calling, Gemini 2.5-flash-lite for Dutch detection
- **Codebase:** ~15,910 LOC TypeScript/TSX + Python
- **Deployed:** Railway (FastAPI + SQLite + FAISS) + Vercel (React/Vite/Tailwind v3)
- **Live since:** 2026-02-20
- **Behavior tracking:** `user_events` table with card_click, sage_query, filter_change events; fire-and-forget frontend instrumentation
- **Analytics:** GA4 (G-0T526W3E1Z) with SPA route change tracking, admin routes excluded
- **Admin dashboard:** Available at /admin — bcrypt+JWT auth with rate limiting; Overview (stat cards, recent leads/searches), Marketplace Intelligence, Experts (bulk CSV import), Leads (CSV export), Intelligence (t-SNE, OTR@K, Index Drift)

## Constraints

- **Tech stack:** React frontend, Python FastAPI backend — already decided
- **Hosting:** Vercel (frontend) + Railway (backend)
- **AI provider:** Google GenAI (embeddings) + Gemini (generation) — no switching to OpenAI
- **Output format:** Always exactly 3 expert recommendations per chat response (unless clarification needed)
- **Expert pool:** Growing weekly — all features must handle dynamic pool sizes (no hardcoded counts)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RAG over fine-tuning | CSV data changes; retrieval is more maintainable than a fine-tuned model | ✓ Good — live in production, retrieval quality sufficient |
| FAISS in-memory | profiles (growing weekly) is small enough; no vector DB needed | ✓ Good — fast retrieval, zero ops |
| Standalone site | Decoupled from main Tinrate app — faster to ship, easier to iterate | ✓ Good — shipped same day |
| Exactly 3 recommendations (chat) | Clear, decisive UX — avoids overwhelming users with choice | ✓ Good — user-verified in production |
| SQLite for v1 | Zero-config; Railway persistent volume; replace URL with Postgres for scale | ✓ Good — works on Railway, zero ops |
| Expert SQLite table | Seeded from experts.csv at first startup; replaces fragile file-read on Railway | ✓ Good — fixed "Failed to fetch" production crash |
| sessionStorage admin key | Replaces VITE_ADMIN_KEY baked into Vercel build — safer, no redeploy needed to rotate | ✓ Good — cleaner security model |
| GAP_THRESHOLD=0.60 | Lowered from 0.65 — was too strict; 0.60 returns results across diverse domains | ✓ Good — clarification rate acceptable |
| Email gate lazy localStorage | localStorage read in useState initializer (not useEffect) — prevents flash of locked state | ✓ Good — no FOUC for returning visitors |
| CORS allow_headers: X-Admin-Key | Added to CORSMiddleware to allow Vercel preflight for admin requests | ✓ Good — admin works from browser |
| DB-backed settings (no caching) | SELECT * on every chat request — 5-row max table; ensures zero-redeploy config changes | ✓ Good — immediate consistency, negligible perf cost |
| SETTINGS_SCHEMA as source of truth | Single dict powers GET response metadata + POST validation — no duplication | ✓ Good — clean, maintainable pattern |
| Per-thread SessionLocal in compare | ThreadPoolExecutor workers each create own SessionLocal() — thread-safe DB reads | ✓ Good — fixed race condition from audit |
| ToggleSwitch as plain button | button[role=switch] + aria-checked, no external library — keeps bundle small | ✓ Good — accessible, dependency-free |
| Search Lab A/B overrides in-memory | Per-run overrides merged in-memory, never written to DB — global settings unchanged | ✓ Good — matches admin mental model |
| VirtuosoGrid (not Virtuoso) for expert grid | Cards use fixed h-[180px] height → VirtuosoGrid's uniform-height assumption is correct | ✓ Good — correct tool for fixed-height cards |
| CSS hover animation for ExpertCard | Mount stagger removed — CSS hover (lift + purple glow) is lighter, avoids VirtuosoGrid conflicts | ✓ Good — MARKET-05 accepted as shipped |
| motion from 'motion/react' for modals/FAB | AnimatePresence for Sage FAB, panel, ProfileGateModal only | ✓ Good — Framer Motion where it adds real value |
| Expert interface snake_case | API returns snake_case — camelCase aliases removed entirely | ✓ Good — eliminated undefined field bug |
| Two-turn Gemini pattern for Sage | Turn 1: extract function args; Turn 2: send result for confirmation text | ✓ Good — aligns with Gemini function calling spec |
| search_experts FunctionDeclaration routing | Mutually exclusive descriptions for apply_filters vs search_experts | ✓ Good — 20/20 routing accuracy |
| search_experts in-process Python import | Direct `run_explore()` call in pilot_service.py — no HTTP self-call | ✓ Good — fast, no network overhead |
| trackEvent() as module function | Fire-and-forget void fetch with keepalive:true — no React hook constraints | ✓ Good — works across all 5 call sites |
| 3-section admin sidebar | Analytics/Tools/Admin grouping — 8 items total | ✓ Good — clear information architecture |
| Dutch detection via Gemini flash-lite | Lightweight structured JSON for language detection | ✓ Good — fast, minimal cost |
| Idempotent email purge at startup | UPDATE experts SET email='' runs every startup — re-sanitizes even restored backups | ✓ Good — guarantees PII removal |
| Photo proxy 404 (not 502) | Frontend onError already handles non-200 — 404 is HTTP-correct and silent | ✓ Good — eliminates Sentry noise |
| FTS5 belt-and-suspenders guard | _safe_fts_query() sanitizes + try/except around MATCH as safety net | ✓ Good — no more 500s from invalid queries |
| run_explore() as default Search Lab pipeline | Live pipeline as default; legacy preserved for A/B validation | ✓ Good — Search Lab matches production behavior |
| Imperative redirect pattern | useNavigate+useEffect([]) for redirects that preserve search params | ✓ Good — eliminated Maximum call stack exceeded |
| GA4 send_page_view:false | React Analytics component handles ALL page_view events to prevent double-counting | ✓ Good — single source of truth for analytics |
| Inline mobile filters (no drawer) | MobileInlineFilters with TagPickerSheet — always visible, no drawer interaction needed | ✓ Good — better mobile UX than Vaul drawer |
| Logo hidden on mobile for search | hidden md:block on logo — search bar fills full viewport width | ✓ Good — cleanest approach per research |
| Instant-apply tags (no draft buffer) | AbortController in useExplore deduplicates rapid requests — no need for draft buffer | ✓ Good — responsive UX |
| Bcrypt+JWT replacing session key | Proper credential auth with token expiry; dual-mode endpoint during deploy window | ✓ Good — production-grade admin security |
| slowapi rate limiting on login | 3 attempts/min from same IP — prevents brute force without external service | ✓ Good — simple, effective |
| SQLite WAL mode | WAL + 5000ms busy_timeout — handles concurrent public traffic without "database locked" | ✓ Good — zero-ops concurrency |
| React.lazy admin route splitting | All 11 admin components lazy-loaded — public bundle halved (~711 kB vs ~1,261 kB) | ✓ Good — significant bundle reduction |
| Separate industryTags field | `industryTags: string[]` in filterSlice, never shared with domain tags array | ✓ Good — clean separation |
| Atomic admin page removal | Frontend route + backend endpoint + background task removed together per page | ✓ Good — no orphaned computation |
| Single Suspense at RequireAuth | One boundary covers all nested admin children; loading fallback is admin-themed | ✓ Good — minimal Suspense boundaries |
| Spread factor 30 for weighted-random | Shuffles within findability tiers without pushing low-score experts to top | ✓ Good — varied initial display each load |
| Dual-layout ExpertCard (md:hidden / hidden md:flex) | Two separate JSX blocks for mobile vs desktop — cleaner than per-element breakpoints for different structures | ✓ Good — responsive without complexity |
| toggleTag clears query on add only | Removing a tag preserves text context; adding is a pivot action | ✓ Good — intuitive behavior |
| Saved view via `usernames` API param | Direct backend lookup by username list — no limit needed, scales to any pool size | ✓ Good — eliminated limit:500 hack |
| Clarity via index.html IIFE | Early-return for /admin routes, no React component needed | ✓ Good — zero bundle impact |
| Tier thresholds mirror frontend | Backend >=88 Top, >=75 Good matches findabilityLabel() | ✓ Good — consistent UX |
| ExpertTag join table | Normalized tags with composite indexes vs LIKE on JSON | ✓ Good — 55x speedup |
| Admin router 10-module split | Sub-module routers with no prefix, inherit from parent | ✓ Good — maintainable, under 400 LOC each |
| TTL-only embedding cache | 60s TTL, no invalidation — embeddings are stateless lookups | ✓ Good — simple, effective |
| Unified Data page | Single page with date picker, no tabs — merged Searches + Marketplace | ✓ Good — cleaner admin UX |
| ADMUI-03 closed as N/A | Sage data source retired, searches table not applicable | ✓ Good — honest requirement tracking |
| FilterChips null early-return | `if (chips.length === 0) return null` — no outer div, no spacing when inactive | ✓ Good — cleaner than conditional wrapper |
| In-memory merge-sort for timeline | Pagination after merge-sort — acceptable for per-lead data volumes | ✓ Good — simple, fast |
| Discriminated union for timeline events | TypeScript `type` field ('search' \| 'click') enables exhaustive narrowing | ✓ Good — type-safe event handling |
| Expert link to search page | No per-expert detail route exists; link to `/admin/experts` | ✓ Good — uses existing route |
| Skeleton loaders (not spinners) | Animated placeholder lines match card layout for loading state | ✓ Good — polished UX |
| Positive empty state for unmet demand | CheckCircle + "All searches returned results" — good news framing | ✓ Good — reduces alarm fatigue |
| Email gate at page entry | Mandatory gate before any browsing — maximizes lead capture vs old profile-click gate | ✓ Good — every visitor captured |
| Synchronous Zustand bypass | useState lazy initializer reads persist store — no useEffect flash | ✓ Good — instant bypass for subscribers |
| Email on user_events column | Dedicated indexed column vs payload JSON blob — queryable, filterable | ✓ Good — clean admin timeline queries |
| Single expandedCard accordion | One state slot — expanding one card collapses the other | ✓ Good — clean UX, simple state |
| 3s delayed Loops subscribe | Bundles first search event with subscribe call | ✓ Good — richer lead context |

---
*Last updated: 2026-03-04 after v5.2 milestone*
