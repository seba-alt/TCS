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

## Current Milestone: v1.1 Expert Intelligence & Search Quality

**Goal:** Transform the expert layer — auto-tag all 1,558 experts, score findability, enhance the admin Expert tab — then systematically improve retrieval using feedback signals, domain mapping, and query expansion.

**Target features:**
- Multi-tag system: AI auto-generates domain tags for all 1,558 experts (covering all domains); tags feed into FAISS search
- Enhanced admin Expert tab: first + last name, bio, profile URL, tags, findability score (color-coded, sorted worst-first)
- Findability score (0–100): based on bio presence/quality, profile link, tags, topic description
- FAISS re-ingest: all 1,558 experts with enhanced data (tags included in embedding text)
- Search intelligence: feedback learning from thumbs up/down, expert pool domain mapping, query expansion, test lab

### Active

- [ ] CORS fully wired: set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway env vars
- [ ] Auto-generate domain tags for all 1,558 experts using AI
- [ ] Compute findability scores for all experts; surface worst profiles in admin Expert tab
- [ ] Enhance admin Expert tab: first+last name, bio, profile URL, tags, findability score
- [ ] Re-ingest FAISS with all 1,558 experts + tags in embedding text
- [ ] Search intelligence: feedback learning, domain mapping, query expansion, test lab evaluation

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
