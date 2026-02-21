# Tinrate AI Concierge Chatbot

## What This Is

An AI-powered expert discovery experience for the Tinrate platform. Users describe their problem in natural language and the system semantically searches a database of 1,558 vetted experts, then responds with a personalized, conversational recommendation of exactly three best-fit experts — displayed as styled, clickable contact cards that link directly to their Tinrate profile pages. The platform includes an email gate for lead capture, thumbs up/down feedback on results, and a full admin analytics dashboard for monitoring search quality and managing experts.

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

## Current Milestone: v1.2 Intelligence Activation & Steering Panel

**Goal:** Activate the search intelligence layer in production and transform the admin Intelligence tab into a real-time steering panel — live flag toggles, threshold tuning, A/B comparison, and per-run overrides in Search Lab.

**Target features:**
- SQLite settings table for runtime flag storage (no Railway redeploy needed to toggle HyDE/feedback)
- Admin Intelligence tab redesigned as steering panel: live flag toggles, similarity threshold slider, HyDE sensitivity tuning, feedback boost cap adjustment
- Search Lab A/B comparison mode: side-by-side expert ranking with diff view (moved/new/dropped experts)
- Per-run flag overrides in Search Lab (force-enable a mode for a single test regardless of global setting)

### Active

- [ ] SQLite settings table: `settings` table with key/value pairs, read at runtime by backend
- [ ] Flag toggle API: `POST /api/admin/settings` to write flag values, `GET /api/admin/settings` to read
- [ ] Backend reads flags from DB (with env var as fallback default)
- [ ] Admin Intelligence steering panel: live toggles for QUERY_EXPANSION_ENABLED and FEEDBACK_LEARNING_ENABLED
- [ ] Admin Intelligence steering panel: threshold inputs (similarity threshold, HyDE min-results trigger, feedback boost cap)
- [ ] Search Lab A/B mode: run query in multiple configurations, show side-by-side diff
- [ ] Search Lab per-run overrides: checkbox to force-enable HyDE/feedback for a single test run

## Future Milestone: v2.0 — Extreme Semantic Explorer

**Goal:** Rearchitect from AI chat into a professional Expert Marketplace with hybrid search, faceted sidebar, virtualized expert grid, and a floating AI co-pilot with function calling.

**Target features:**
- Hybrid search: pre-filter via SQLAlchemy (rate, tags) → FAISS IDSelectorBatch → HyDE embedding search → feedback re-ranking
- Zustand global state: searchParams, results, isPilotOpen slices with persist middleware
- Marketplace grid: react-virtuoso virtualized expert list, high-density expert cards (tags, bio, findability score)
- Floating AI co-pilot: collapsible panel, Gemini function calling (`apply_filters(criteria)`), context-aware (summarizes visible experts)
- Performance: <200ms filter-to-grid latency for metadata changes
- Mobile: sidebar → bottom-sheet, grid → single column

## Current State

**Deployed version:** v1.1 (Railway + Vercel, auto-deploys on push to main)
**Expert pool:** 1,558 experts, all tagged, FAISS index at 1,558 vectors
**Search intelligence:** HyDE + feedback re-ranking built; flags default off — v1.2 activates them with DB-level control

### Out of Scope

- User authentication / accounts — users interact anonymously; admin uses session key
- Booking/payment flow — cards link to Tinrate profiles where booking happens
- Mobile native app — web-first
- Real-time availability or calendar integration — not in CSV data
- Multi-language support — English only for v1
- Offline mode — real-time retrieval is core value

## Context

- **Expert data:** SQLite table with 1,558 profiles seeded from experts.csv; FAISS index has 530 vectors (re-ingest needed for full coverage)
- **AI stack:** Google GenAI (text-embedding-004) for embeddings, Gemini LLM (gemini-2.5-flash) for generation
- **Codebase:** ~5,000 LOC Python + TypeScript
- **Deployed:** Railway (FastAPI + SQLite + FAISS) + Vercel (React/Vite/Tailwind v3)
- **Live since:** 2026-02-20
- **Admin dashboard:** Available at /admin — login with ADMIN_SECRET key; includes search analytics, lead tracking, expert management, score explainer

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

---
*Last updated: 2026-02-21 after v1.1 milestone started*
