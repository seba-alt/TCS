# Milestones

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

