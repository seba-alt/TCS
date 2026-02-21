# Tinrate AI Concierge Chatbot

## What This Is

An AI-powered expert discovery experience for the Tinrate platform. Users describe their problem in natural language and the system semantically searches a database of 1,558 vetted experts, then responds with a personalized, conversational recommendation of exactly three best-fit experts — displayed as styled, clickable contact cards that link directly to their Tinrate profile pages. The platform includes an email gate for lead capture, thumbs up/down feedback on results, a full admin analytics dashboard, and a live intelligence steering panel where admins can toggle HyDE query expansion and feedback re-ranking flags and tune numeric thresholds without redeploying.

## Core Value

A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.

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

## Shipped Versions

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

## Current Milestone: v2.0 — Extreme Semantic Explorer

**Goal:** Rearchitect from AI chat into a professional Expert Marketplace with hybrid search, faceted sidebar, virtualized expert grid, and a floating AI co-pilot with function calling.

**Target features:**
- Hybrid search backend: `/api/explore` with SQLAlchemy pre-filter → FAISS IDSelectorBatch → FTS5 BM25 weighted fusion + findability/feedback boosts
- Zustand global state: `useExplorerStore` with filters/results/pilot slices + localStorage persist
- Marketplace UI: faceted sidebar (rate slider, tag filter, search), react-virtuoso expert grid, Framer Motion entry animations
- Floating AI co-pilot: FAB → 380px slide-in panel, Gemini function calling (`apply_filters`), full-screen on mobile
- Value-driven lead capture: gate "View Full Profile" + "Download Match Report" (in-app HTML AI report) behind email modal
- Robustness: URL filter state, FTS5 fuzzy suggestions, graceful empty states

## Current State

**Deployed version:** v1.2 (Railway + Vercel, auto-deploys on push to main)
**Expert pool:** 1,558 experts, all AI-tagged, FAISS index at 1,558 vectors
**Search intelligence:** HyDE + feedback re-ranking live; toggled via admin steering panel (DB-backed settings, no redeploy)
**Admin panel:** Intelligence tab = live steering panel; Search Lab = A/B comparison with diff view

### Out of Scope

- User authentication / accounts — users interact anonymously; admin uses session key
- Booking/payment flow — cards link to Tinrate profiles where booking happens
- Mobile native app — web-first
- Real-time availability or calendar integration — not in CSV data
- Multi-language support — English only for v1
- Offline mode — real-time retrieval is core value

## Context

- **Expert data:** SQLite table with 1,558 profiles; FAISS index at 1,558 tag-enriched vectors; all experts AI-tagged with 3–8 domain tags + findability scores
- **AI stack:** Google GenAI (gemini-embedding-001) for embeddings, Gemini 2.5 Flash for generation and expert tagging
- **Codebase:** ~8,000 LOC Python + TypeScript
- **Deployed:** Railway (FastAPI + SQLite + FAISS) + Vercel (React/Vite/Tailwind v3)
- **Live since:** 2026-02-20
- **Admin dashboard:** Available at /admin — search analytics, lead tracking, expert management, score explainer, intelligence steering panel, Search Lab A/B comparison

## Constraints

- **Tech stack:** React frontend, Python FastAPI backend — already decided
- **Hosting:** Vercel (frontend) + Railway (backend)
- **AI provider:** Google GenAI (embeddings) + Gemini (generation) — no switching to OpenAI
- **Output format:** Always exactly 3 expert recommendations per response (unless clarification needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RAG over fine-tuning | CSV data changes; retrieval is more maintainable than a fine-tuned model | ✓ Good — live in production, retrieval quality sufficient |
| FAISS in-memory | 1,558 profiles is small enough; no vector DB needed for v1 | ✓ Good — 530 vectors indexed, fast retrieval |
| Standalone site | Decoupled from main Tinrate app — faster to ship, easier to iterate | ✓ Good — shipped same day |
| Exactly 3 recommendations | Clear, decisive UX — avoids overwhelming users with choice | ✓ Good — user-verified in production |
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
| motion from 'motion/react' (not 'framer-motion') | New package name for Framer Motion v12+ — import path changed; entry-only animation on cards (no exit prop) to avoid VirtuosoGrid virtualization conflicts | ✓ Good — confirmed in Phase 17 implementation |
| Expert interface snake_case | API returns snake_case (first_name, job_title, hourly_rate) — camelCase aliases removed entirely; all components updated to match | ✓ Good — eliminated undefined field bug on cards |
| Individual Zustand selectors for isFetchingMore/appendResults | Same Phase 16 pattern — individual selectors in useExplore hook prevent stale closure and re-render loops for infinite scroll state | ✓ Good — consistent pattern across hooks |
| flex-1 min-h-0 container for VirtuosoGrid | VirtuosoGrid requires known-height container; flex-1 min-h-0 within flex column gives measurable height for virtualization | ✓ Good — VirtuosoGrid renders correctly |
| filterSlice.setTags (not toggleTag) for Sage | Sage needs to replace tags array entirely; toggleTag is designed for human one-at-a-time interaction only | ✓ Good — clean separation of programmatic vs human filter dispatch |
| useExplorerStore.getState() snapshot in useSage | Async handler captures store state at call time; reactive selectors cause stale closure in async context | ✓ Good — consistent with Phase 14 explore.py async pattern |
| Gemini role mapping: 'assistant' → 'model' | pilotSlice uses 'user'/'assistant' (React convention); Gemini API requires 'user'/'model' — toGeminiRole() handles mapping in useSage | ✓ Good — prevents Gemini API 400 errors on history |
| Two-turn Gemini pattern for Sage | Turn 1: extract apply_filters args; Turn 2: send function result back for confirmation text — keeps confirmation contextually accurate | ✓ Good — aligns with Gemini function calling spec |
| FAB hides when panel is open | AnimatePresence with {!isOpen && <SageFAB>} — cleaner than FAB+panel coexisting; avoids z-index conflicts on mobile | ✓ Good — locked in CONTEXT.md before Phase 18 |

---
*Last updated: 2026-02-21 after Phase 18 (Floating AI Co-Pilot)*
