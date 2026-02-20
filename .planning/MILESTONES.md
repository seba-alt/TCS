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
