# Milestones

## v4.1 UX Polish & Mobile Overhaul (Shipped: 2026-03-03)

**Phases completed:** 4 phases (51-54), 8 plans, 16 tasks
**Timeline:** 2 days (2026-03-02 → 2026-03-03)
**Files modified:** 17 (+475 / -474)
**Git range:** feat(51-01) → fix(saved-view)

**Key accomplishments:**
1. Admin overview stats fixed (lead count, matches, searches) + clickable stat cards navigating to detail pages + expert deletion with automatic FAISS rebuild
2. Seeded findability-weighted random ordering on every page load, sort-by dropdown removed, search bar autofocused, Intercom CTA on empty results
3. Tag-first autocomplete ranking with individual FTS5 tag extraction + dynamic rate slider max derived from API response
4. Responsive ExpertCard redesign — mobile photo-centric (80px centered photo), desktop photo-left orientation, tap-expand removed for direct navigation
5. Mobile filter cleanup — clear button removed, search-within pickers removed, tag click clears query, smooth scroll fix
6. Purple visual treatment on saved cards, filter-independent saved view (backend usernames lookup), anonymous search tracking, Microsoft Clarity analytics

**Tech debt (from audit):**
- BOOK-02 limit:500 saved-view fetch vs 530 experts (fixed post-audit: backend now accepts `usernames` param for direct lookup)

**Archive:**
- Roadmap: `.planning/milestones/v4.1-ROADMAP.md`
- Requirements: `.planning/milestones/v4.1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v4.1-MILESTONE-AUDIT.md`

---

## v1.0 MVP (Shipped: 2026-02-20)

**Phases completed:** 7 phases (1–7), 23 plans
**Timeline:** 2026-02-20 (single day, automated execution)
**Codebase:** ~5,000 LOC Python + TypeScript
**Live:** https://tcs-three-sigma.vercel.app | Backend: https://web-production-fdbf9.up.railway.app

**Key accomplishments:**
1. RAG pipeline live — Google GenAI embeddings + FAISS vector search + Gemini LLM returns exactly 3 expert recommendations from 1,558-expert database
2. Email gate UX — expert cards appear immediately greyed-out until email submitted; localStorage persists unlock for returning visitors; leads captured in SQLite
3. Thumbs up/down feedback — FeedbackBar on latest result set, DownvoteModal for detail, all votes stored in DB linked to conversation
4. Analytics dashboard v2 — login flow (sessionStorage, no baked-in env var), Overview with speedometer, Searches/Gaps tables, Leads, Experts (category management), Score Explainer, Settings
5. Expert SQLite DB — 1,558 experts seeded from CSV at first startup; replaces fragile file-read approach; admin experts endpoint reliable in production
6. Full deployment pipeline — Railway (FastAPI + SQLite + FAISS) + Vercel (React + Vite) + GitHub Actions CI (ruff + tsc) + Sentry error monitoring

**Archive:**
- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`

---

## v1.1 Expert Intelligence & Search Quality (Shipped: 2026-02-21)

**Phases completed:** 3 phases (8–10), 9 plans
**Timeline:** 2026-02-21 (single day, automated execution)

**Key accomplishments:**
1. AI batch-tagged all 1,558 experts with 3–8 domain tags via Gemini 2.5 Flash; findability scoring (0–100) per expert
2. FAISS index rebuilt with all 1,558 experts + tag-enriched embeddings (from 530-vector partial index)
3. Admin Expert tab overhauled: sort/filter/pagination, domain tag pills, color-coded findability badges, worst-first default sort
4. HyDE query expansion (weak-query detection + hypothetical bio embedding) + feedback-weighted re-ranking, gated by env var flags
5. Admin Search Lab (SSE single-query debug) + Intelligence Dashboard (live stats display) for monitoring retrieval quality

**Archive:**
- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`

---

## v1.2 Intelligence Activation & Steering Panel (Shipped: 2026-02-21)

**Phases completed:** 3 phases (11–13), 6 plans
**Timeline:** 2026-02-21 (single day, automated execution)
**Codebase:** ~8,000 LOC Python + TypeScript

**Key accomplishments:**
1. SQLite `settings` table — 5 intelligence flags/thresholds stored as DB key/value rows, read on every request with Railway env var fallback
2. GET/POST `/api/admin/settings` with SETTINGS_SCHEMA validation, native-typed values, and `source` field (db/env/default) showing override hierarchy
3. Admin Intelligence tab rewritten as live steering panel — toggle switches for HyDE/feedback + 3 numeric threshold inputs + dirty tracking + 4s fade save feedback
4. Search Lab rewritten as full A/B comparison UI — side-by-side configs, amber/blue rank-change diff view, delta badges, ghost row alignment
5. Per-run flag overrides in Search Lab — force-enable HyDE/feedback for a single test without mutating global DB settings
6. ThreadPoolExecutor parallel execution of up to 4 intelligence configurations per `/api/admin/compare` request

**Archive:**
- Roadmap: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1.2-MILESTONE-AUDIT.md`

---


## v2.0 Extreme Semantic Explorer (Shipped: 2026-02-22)

**Phases completed:** 18 phases, 55 plans, 19 tasks

**Key accomplishments:**
- (none recorded)

---


## v2.2 Evolved Discovery Engine (Shipped: 2026-02-22)

**Phases completed:** 16 phases, 46 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


## v2.3 Sage Evolution & Marketplace Intelligence (Shipped: 2026-02-24)

**Phases completed:** 9 phases (28–35 + 34.1), 17 plans
**Timeline:** 3 days (2026-02-22 → 2026-02-24)
**Codebase:** ~8,315 LOC TypeScript/TSX · ~4,766 LOC Python (13,081 total)
**Commits:** 89 (29 feat, 5 fix, 52 docs)
**Git range:** a861df6 → 6b5591a

**Key accomplishments:**
1. Sage evolved from filter adjuster to active search engine — `search_experts` Gemini function discovers experts directly via FAISS hybrid search, results narrated + grid synced
2. User behavior tracking system — card clicks, Sage queries, and filter changes durably recorded in SQLite via fire-and-forget `trackEvent()` module function
3. Admin Marketplace Intelligence page — unmet demand signals (zero-result queries by frequency), expert exposure distribution, daily Sage usage trend BarChart, cold-start empty state
4. Sage direct grid injection — results appear in expert grid without polluting search bar; `sageMode` state machine with graceful filter-exit and zero-result handling
5. Command Center Header — glassmorphic frosted-glass panel with animated search placeholders, spring expert count, Sage-in-flight pulse, "tinrate" tilt + particle easter egg
6. Admin platform restructure — 3-section sidebar (Analytics/Tools/Admin), ToolsPage with hash-driven tabs, OverviewPage dashboard with zero-result queries card and Sage sparkline

**Archive:**
- Roadmap: `.planning/milestones/v2.3-ROADMAP.md`
- Requirements: `.planning/milestones/v2.3-REQUIREMENTS.md`
- Audit: `.planning/milestones/v2.3-MILESTONE-AUDIT.md`

---


## v3.0 Netflix Browse & Agentic Navigation (Shipped: 2026-02-26)

**Phases completed:** 9 phases (36–40.3.1), 19 plans
**Timeline:** 2 days (2026-02-24 → 2026-02-26)
**Codebase:** ~14,297 LOC TypeScript/TSX + Python
**Files modified:** 100 (+13,792 / -1,916)
**Git range:** 712f77c → 2d5fb3a

**Key accomplishments:**
1. Netflix-style Browse page with horizontal category rows, glassmorphic cards with photos/monograms, hero banner carousel, and skeleton loading
2. Expert photo system: bulk CSV import endpoint, photo proxy with HTTPS enforcement and 24h cache, monogram initials fallback
3. Sage cross-page navigation: FAB at root layout level, conversation history preserved across page transitions, discovery auto-navigation with 2s delay
4. Reverted to Explorer-only architecture: Browse page removed, Explorer as sole discovery surface at `/`, simplified Zustand store (navigationSlice deleted)
5. Search autocomplete with debounced suggestion dropdown (job title + company + tags), non-live grid updates (Enter to commit), keyboard navigation
6. Mobile optimization: tap-expand expert cards within fixed VirtuosoGrid height, Sage bottom sheet via Vaul, responsive layout with compact header

**Note:** Milestone evolved significantly — Browse page was built (Phases 36-40.2), then removed in favor of Explorer-only (Phase 40.3), with search and mobile improvements added (Phase 40.3.1).

**Archive:**
- Roadmap: `.planning/milestones/v3.0-ROADMAP.md`
- Requirements: `.planning/milestones/v3.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v3.0-MILESTONE-AUDIT.md`

---


## v3.1 Launch Prep (Shipped: 2026-02-26)

**Phases completed:** 4 phases (41–44), 5 plans
**Timeline:** 1 day (2026-02-26), 28 min total execution
**Codebase:** ~14,562 LOC TypeScript/TSX + Python
**Files modified:** 39 (+5,407 / -1,969)
**Git range:** 583e6cc → 312b8a2

**Key accomplishments:**
1. Expert email PII purged — idempotent startup migration blanks all Expert.email values; CSV Email column stripped; import/add/seed paths permanently closed
2. Backend Sentry errors eliminated — photo proxy 502→404, FTS5 MATCH safety nets with structlog, gemini-2.0-flash-lite→2.5-flash-lite
3. Search Lab aligned with live pipeline — run_explore() as default, legacy pipeline preserved for A/B validation, pipeline badges in UI
4. React redirect loop fixed — imperative useNavigate+useEffect pattern replaces declarative Navigate; GA4 SPA tracking wired (G-0T526W3E1Z)
5. Mobile filters redesigned as inline controls — MobileInlineFilters with TagPickerSheet, SortSheet, active chip row; Vaul drawer removed (kept for Sage)
6. Desktop tag cloud expanded from 12 to 18 visible tags; search bar full-width on mobile

**Archive:**
- Roadmap: `.planning/milestones/v3.1-ROADMAP.md`
- Requirements: `.planning/milestones/v3.1-REQUIREMENTS.md`

---


## v4.0 Public Launch (Shipped: 2026-02-27)

**Phases completed:** 6 phases (45–50), 12 plans
**Timeline:** 7 days (2026-02-20 → 2026-02-27)
**Codebase:** ~15,910 LOC TypeScript/TSX + Python
**Files modified:** 75 (+8,109 / -307)
**Git range:** a6bf93b → 96968b2

**Key accomplishments:**
1. Upgraded admin authentication from shared key to bcrypt+JWT credentials with rate limiting (3 attempts/min)
2. Halved public bundle size by lazy-loading all 11 admin routes and splitting vendor chunks (~711 kB vs ~1,261 kB)
3. Polished Explorer with white search bar, grid/list toggle, Sage de-duplication fix, and API error states with retry
4. Added industry-level tag taxonomy — Gemini batch-tagging, backend filter, tag cloud UI section, independent filtering
5. Streamlined admin dashboard — removed unused tools, added lead export CSV with search/click history, overview stat cards
6. All 19 requirements formally verified across 6 phases with VERIFICATION.md artifacts — production-ready

**Tech debt (from audit):**
- Suspense fallback replaces full admin frame during inter-page navigation (cosmetic)
- Phase 48 SUMMARY.md files not generated (requirements_completed frontmatter missing)
- `POST /api/admin/experts/assign-industry-tags` endpoint has no frontend button

**Archive:**
- Roadmap: `.planning/milestones/v4.0-ROADMAP.md`
- Requirements: `.planning/milestones/v4.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v4.0-MILESTONE-AUDIT.md`

---


## v5.0 Platform Polish & Admin Overhaul (Shipped: 2026-03-03)

**Phases completed:** 6 phases (55-59, including 58.1 insert), 15 plans
**Timeline:** 1 day (2026-03-03)
**Files modified:** 105 (+11,346 / -3,901)
**Commits:** 69
**Git range:** feat(55-01) → docs(phase-59)

**Key accomplishments:**
1. Explorer UX bugs fixed — tier-sorted search results (Top Match first), currency symbols on all surfaces, mobile card completeness (company + badge + 2-line name), OG meta tags for rich link previews
2. Backend performance optimized — embedding cache (60s TTL), settings cache (30s TTL), ExpertTag join table with 55x tag filtering speedup, admin monolith split into 10-module router package
3. Admin frontend overhauled — URL-based child routes, shared UI components (AdminCard, AdminInput, AdminPagination, AdminPageHeader), pagination with page jump, overview dashboard with period toggle
4. Audit gaps closed — CORS DELETE for admin expert deletion, currency symbol consistency via currencySymbol() utility, retroactive Phase 56 verification
5. Admin dashboard enhanced — unified Data page merging Searches and Marketplace with shared date picker, lead click count tracking, active tag chips on Overview, Click Activity table
6. Tech debt resolved — dead LeadsPage email handoff removed, orphaned AdminMarketplacePage.tsx deleted, GapsTable dead link removed, ADMUI-03 closed as N/A, full ADMUI traceability added

**Tech debt (from audit):**
- ADMUI-03 (search records on Data page) closed as N/A — underlying Sage data source retired

**Archive:**
- Roadmap: `.planning/milestones/v5.0-ROADMAP.md`
- Requirements: `.planning/milestones/v5.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v5.0-MILESTONE-AUDIT.md`

---


## v5.1 Lead Insights & Overview (Shipped: 2026-03-03)

**Phases completed:** 3 phases (60-62), 5 plans
**Timeline:** 1 day (2026-03-03)
**Files modified:** 8 (+429 / -140)
**Git range:** fix(60-01) → feat(62-02)

**Key accomplishments:**
1. Fixed clear-all button visibility — FilterChips returns null when no chips active, preventing phantom clear-all on page load
2. Removed dead `totalTagCount` variable breaking Vercel CI builds (TS6133 noUnusedLocals)
3. Lead journey timeline — admin expands any lead row to see chronological search/click history with time gap labels (30min+ dividers, 1-day+ amber emphasis)
4. Backend lead-timeline endpoint merging Conversation + LeadClick events with batch expert name resolution and offset pagination
5. Three ranked insight cards on Overview — Top Experts (by clicks), Top Searches (by frequency), Unmet Demand (zero-result queries) in responsive 3-column grid
6. All new overview cards wired to existing period toggle (Today / 7d / 30d / All) via `days` prop

**Archive:**
- Roadmap: `.planning/milestones/v5.1-ROADMAP.md`
- Requirements: `.planning/milestones/v5.1-REQUIREMENTS.md`
- Audit: `.planning/milestones/v5.1-MILESTONE-AUDIT.md`

---


## v5.2 Email-First Gate & Admin See-All (Shipped: 2026-03-04)

**Phases completed:** 4 phases (63-66), 5 plans
**Timeline:** 1 day (2026-03-04)
**Git range:** feat(63-01) → docs(phase-66)

**Key accomplishments:**
1. Email tracking infrastructure — nullable indexed `email` column on `user_events`, idempotent startup migration, `trackEvent()` enrichment from Zustand persist store with 8 unit tests
2. Mandatory email entry gate — full-screen glassmorphic gate blocks Explorer until email submitted, synchronous Zustand bypass for returning subscribers (no flash), Loops `source: "page_entry"` tagging
3. Email-attributed lead timeline — admin sees Explorer search and click events matched by email with distinct icons (green/compass for search, amber/eye for click), deduplication against session-linked events
4. Admin overview accordion expansion — Top Experts and Top Searches cards expand in-place to show full ranked lists (up to 50 items) with "Show less" collapse, accordion single-slot state
5. Vercel Speed Insights active on frontend deployment
6. Audit gap closure — fixed `explorer_click` payload key bug (`expert` → `expert_id`), Phase 64 formally verified with VERIFICATION.md, all 11 requirements satisfied

**Archive:**
- Roadmap: `.planning/milestones/v5.2-ROADMAP.md`
- Requirements: `.planning/milestones/v5.2-REQUIREMENTS.md`
- Audit: `.planning/milestones/v5.2-MILESTONE-AUDIT.md`

---


## v5.3 UX Polish & Admin Saved Insights (Shipped: 2026-03-05)

**Phases completed:** 6 phases (67-70, including 69.1 and 69.2 inserts), 11 plans
**Timeline:** 2 days (2026-03-04 → 2026-03-05)
**Files modified:** 30 (+1,706 / -174)
**Git range:** docs(67)..docs(phase-70)

**Key accomplishments:**
1. Email gate polished — dark charcoal overlay with dark-bg logo, minimal copy, auto-focus on email input, post-gate search bar focus via forwardRef imperative handle
2. Save/unsave event tracking — backend `save` event type with expert_id + action payload, frontend `trackEvent('save')` on every bookmark toggle, fire-and-forget instrumentation
3. Admin saved insights — Top Saved Experts ranked card (amber bookmark icon, period toggle) on overview, save/unsave events with distinct icons in lead timeline
4. CSV upload upgraded to full sync — soft-delete infrastructure (is_active flag), sync-preview with per-field diffs, sync-apply with cherry-pick exclusion, automatic FAISS rebuild
5. Admin tag manager — predefined tag catalog seeded from AI skill tags, bulk tag assignment, manual tags in FAISS search, Tag Manager page with expert search and inline assignment
6. All 11 requirements verified (10 complete + 1 superseded TAG-04) with formal VERIFICATION.md artifacts

**Archive:**
- Roadmap: `.planning/milestones/v5.3-ROADMAP.md`
- Requirements: `.planning/milestones/v5.3-REQUIREMENTS.md`
- Audit: `.planning/milestones/v5.3-MILESTONE-AUDIT.md`

---


## v5.4 Launch Hardening (Shipped: 2026-03-05)

**Phases completed:** 4 phases (71-74), 8 plans
**Timeline:** 1 day (2026-03-05)
**Requirements:** 25/25 satisfied
**Audit:** PASSED (25/25 requirements, 6/6 E2E flows, 25/25 integration paths)

**Key accomplishments:**
1. Backend performance hardened — asyncio event batch queue (flush 10/2s), SQLite PRAGMA tuning (WAL, 32MB cache, 128MB mmap), GZipMiddleware (500B min), explore endpoint TTL cache (5min) with mutation invalidation, connection pool (5+10)
2. Railway production config — europe-west4 region, healthcheck endpoint with DB diagnostics, ON_FAILURE restart policy, Uvicorn keep-alive tuning
3. Admin experts pagination — server-side page/limit/search params (default 50), Sentry large-payload alerts eliminated
4. Frontend performance — client-side event batch queue matching backend, Vite vendor chunk splitting (6 separate chunks), Vercel immutable cache headers for assets, preconnect hint to Railway API
5. Resilience — React error boundaries (app + page level) with Sentry reporting, global unhandled rejection handler, SEO meta description + robots.txt + sitemap.xml
6. Analytics hardened — GA4 beacon transport, navigator.onLine offline guard, sendBeacon fallback on page unload, Sentry filter for analytics noise, defensive send_page_view comment

**Archive:**
- Roadmap: `.planning/milestones/v5.4-ROADMAP.md`
- Requirements: `.planning/milestones/v5.4-REQUIREMENTS.md`
- Audit: `.planning/milestones/v5.4-MILESTONE-AUDIT.md`

---

