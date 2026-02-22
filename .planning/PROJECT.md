# Tinrate AI Concierge Chatbot

## What This Is

A professional Expert Marketplace for the Tinrate platform. Users browse a pool of 530 vetted experts via an immersive aurora-aesthetic marketplace — animated aurora mesh background, glassmorphism surfaces, bento-style expert cards, animated claymorphic tag cloud with proximity-based scaling, and a floating Sage AI co-pilot. An newsletter gate captures leads when users click "View Full Profile". The platform includes URL-synced filter state, fuzzy search suggestions, and a full admin analytics dashboard with index management, intelligence metrics (OTR@K, Index Drift), and a t-SNE embedding scatter plot. Playful users can trigger a barrel roll easter egg.

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

### Active

<!-- v2.3 Sage Evolution & Marketplace Intelligence -->

- [ ] Sage calls `/api/explore` search function and returns expert results in chat + syncs main grid
- [ ] Sage panel and grid are kept in sync — Sage search updates the visible expert grid
- [ ] Sage system prompt rewritten for warmer, wittier personality
- [ ] Sage asks clarifying follow-up questions when query is ambiguous
- [ ] Sage proactively nudges when the grid shows zero results
- [ ] Sage FAB has animated reactions (pulse/glow) on user activity
- [ ] Expert card clicks are tracked as events in the DB (expert ID, timestamp, context)
- [ ] Sage query interactions are tracked (query text, function called, result count)
- [ ] Filter usage events are tracked (which filters applied, values)
- [ ] Admin Gaps tab shows unmet demand: searches/filter combos with poor results
- [ ] Admin Gaps tab shows expert exposure distribution (which experts appear/get clicked most vs least)

### Out of Scope

- User authentication / accounts — users interact anonymously; admin uses session key
- Booking/payment flow — cards link to Tinrate profiles where booking happens
- Mobile native app — web-first
- Real-time availability or calendar integration — not in CSV data
- Multi-language support — English only for v1
- Offline mode — real-time retrieval is core value
- In-app match report download (LEAD-03) — deferred to v2.1 backlog

## Shipped Versions

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

## Current Milestone: v2.3 Sage Evolution & Marketplace Intelligence

**Goal:** Evolve Sage from a filter adjuster into an active search engine with full personality, and add rich user behavior tracking with an admin Gaps dashboard for marketplace intelligence.

**Target features:**
- Sage active search — `search_experts` function calling `/api/explore`, results in panel + grid sync
- Sage personality upgrade — warmer/wittier system prompt, follow-up questions, proactive empty-state nudge, FAB animated reactions
- User behavior tracking — expert card clicks, Sage queries, filter events stored in DB
- Admin Gaps & Exposure tab — unmet demand signals + expert visibility distribution

## Current State

**Deployed version:** v2.2 (Railway + Vercel, auto-deploys on push to main)
**Expert pool:** 530 experts (data/metadata.json), all AI-tagged; FAISS index at 530 vectors
**Search intelligence:** Three-stage hybrid pipeline live; HyDE + feedback re-ranking toggled via admin steering panel
**Marketplace:** Immersive aurora-aesthetic marketplace with bento cards, animated tag cloud, Sage AI co-pilot; newsletter gate on profile clicks
**Admin panel:** Index rebuild trigger + status; Intelligence tab with OTR@K, Index Drift, t-SNE scatter plot; Leads with newsletter subscriber list
**Next milestone:** v2.3 — Sage Evolution & Marketplace Intelligence (in progress)

## Context

- **Expert data:** SQLite table with 530 profiles; FAISS index at 530 tag-enriched vectors; all experts AI-tagged with 3–8 domain tags + findability scores
- **AI stack:** Google GenAI (gemini-embedding-001) for embeddings, Gemini 2.5 Flash for generation, expert tagging, and Sage co-pilot function calling
- **Codebase:** ~6,356 LOC TypeScript/TSX · ~3,767 LOC Python
- **Deployed:** Railway (FastAPI + SQLite + FAISS) + Vercel (React/Vite/Tailwind v3)
- **Live since:** 2026-02-20
- **Admin dashboard:** Available at /admin — search analytics, lead tracking, expert management, score explainer, intelligence steering panel, Search Lab A/B comparison

## Constraints

- **Tech stack:** React frontend, Python FastAPI backend — already decided
- **Hosting:** Vercel (frontend) + Railway (backend)
- **AI provider:** Google GenAI (embeddings) + Gemini (generation) — no switching to OpenAI
- **Output format:** Always exactly 3 expert recommendations per chat response (unless clarification needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RAG over fine-tuning | CSV data changes; retrieval is more maintainable than a fine-tuned model | ✓ Good — live in production, retrieval quality sufficient |
| FAISS in-memory | 530 profiles is small enough; no vector DB needed | ✓ Good — fast retrieval, zero ops |
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
| VirtuosoGrid (not Virtuoso) for expert grid | Cards use fixed h-[180px] height → VirtuosoGrid's uniform-height assumption is correct; listClassName CSS grid handles 2/3-col responsive layout | ✓ Good — correct tool for fixed-height cards |
| CSS hover animation for ExpertCard (not Framer Motion mount) | Mount stagger removed during Phase 17 — CSS hover (lift + purple glow) is lighter and avoids VirtuosoGrid virtualization conflicts | ✓ Good — MARKET-05 accepted as shipped |
| motion from 'motion/react' for modals/FAB (not card mounts) | AnimatePresence used for Sage FAB show/hide, Sage panel slide-in, ProfileGateModal enter/exit only | ✓ Good — Framer Motion where it adds real value |
| Expert interface snake_case | API returns snake_case (first_name, job_title, hourly_rate) — camelCase aliases removed entirely; all components updated to match | ✓ Good — eliminated undefined field bug on cards |
| Individual Zustand selectors for isFetchingMore/appendResults | Same Phase 16 pattern — individual selectors in useExplore hook prevent stale closure and re-render loops for infinite scroll state | ✓ Good — consistent pattern across hooks |
| flex-1 min-h-0 container for VirtuosoGrid | VirtuosoGrid requires known-height container; flex-1 min-h-0 within flex column gives measurable height for virtualization | ✓ Good — VirtuosoGrid renders correctly |
| filterSlice.setTags (not toggleTag) for Sage | Sage needs to replace tags array entirely; toggleTag is designed for human one-at-a-time interaction only | ✓ Good — clean separation of programmatic vs human filter dispatch |
| useExplorerStore.getState() snapshot in useSage | Async handler captures store state at call time; reactive selectors cause stale closure in async context | ✓ Good — consistent with Phase 14 explore.py async pattern |
| Gemini role mapping: 'assistant' → 'model' | pilotSlice uses 'user'/'assistant' (React convention); Gemini API requires 'user'/'model' — toGeminiRole() handles mapping in useSage | ✓ Good — prevents Gemini API 400 errors on history |
| Two-turn Gemini pattern for Sage | Turn 1: extract apply_filters args; Turn 2: send function result back for confirmation text — keeps confirmation contextually accurate | ✓ Good — aligns with Gemini function calling spec |
| FAB hides when panel is open | AnimatePresence with {!isOpen && <SageFAB>} — cleaner than FAB+panel coexisting; avoids z-index conflicts on mobile | ✓ Good — locked in CONTEXT.md before Phase 18 |
| loadNextPage pagination: `query` param (not `q`) | useExplore.ts loadNextPage was sending `?q=` while backend expected `?query=`; fixed in Phase 20 gap closure | ✓ Good — pagination with active text query now correct |
| DEFAULT_RATE_MAX=5000 aligned across all components | FilterChips, RateSlider, and MobileFilterSheet all align to store default of 5000; fixed spurious chip on page load | ✓ Good — rate filter chip only appears when user has actively filtered |
| LEAD-03 deferred to v2.1 | In-app match report requires significant new backend + UI work; email gate alone is sufficient lead capture for v2.0 | — Deferred — capture as v2.1 requirement |
| asyncio.create_task post-yield for t-SNE | Background CPU-bound computation MUST fire after lifespan yield — pre-yield blocks Railway healthcheck causing infinite restart loop | ✓ Good — healthcheck passes, t-SNE computes in ~30s post-startup |
| Raw fetch for 202-aware polling | adminFetch throws on non-2xx; polling endpoint returns 202 (computing) which must be handled without throwing — raw fetch with status code inspection required | ✓ Good — useEmbeddingMap hook correctly handles 202→200 transition |
| recharts requires react-is explicit install | recharts@3.7.0 declares react-is as peer dep but Vite/Rollup fails if not in node_modules — must npm install react-is alongside recharts | ✓ Good — documented in SUMMARY; blocked CI otherwise |

---
| Standalone useNltrStore (not in useExplorerStore) | Newsletter state must not contaminate marketplace filter persistence — separate store with its own persist key avoids partialize conflicts | ✓ Good — no explorer state regression |
| Zustand write before fire-and-forget POST | User unlock must be immediate and not depend on API success — write to store first, then POST in background | ✓ Good — UX feels instant even on slow connections |
| Barrel roll intercepts before API in Sage | Sending "barrel roll" to Gemini would produce nonsensical results — short-circuit with canned message preserves quality UX | ✓ Good — playful without confusing AI |
| VirtuosoGrid container rotation (not card rotation) | Individual ExpertCard rotation causes scroll-triggered re-animations on virtualized unmount/remount — container rotation avoids VirtuosoGrid internals | ✓ Good — smooth 360° with no visual artifacts |
| rotate reset to 0 with duration:0 after spin | Framer Motion accumulates transform state — must explicitly reset after animate to prevent additive rotation on repeat triggers | ✓ Good — documented in SUMMARY; repeat triggers work cleanly |

---
*Last updated: 2026-02-22 — Milestone v2.3 Sage Evolution & Marketplace Intelligence started*
