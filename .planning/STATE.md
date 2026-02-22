# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.
**Current focus:** v2.2 Evolved Discovery Engine — Phase 22 ready to plan

## Current Position

Phase: 26 of 27 (Embedding Heatmap)
Plan: 26-01 complete
Status: Plan complete
Last activity: 2026-02-22 — Phase 26-01 executed: t-SNE background task + GET /embedding-map endpoint

Progress: [██████████          ] 1/? plans

## Live URLs

| Service | URL |
|---------|-----|
| Railway (backend) | https://web-production-fdbf9.up.railway.app |
| Vercel (frontend) | https://tcs-three-sigma.vercel.app |

## Performance Metrics

**Velocity:**
- Total plans completed: 55 (phases 1-21)
- Average duration: ~15 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**v2.2 critical constraints (encode in every phase plan):**
- Phase 22: Glassmorphism uses `before:` pseudo-element hack — do NOT apply backdrop-filter to overflow:hidden containers. Start with ancestor audit. OKLCH tokens as CSS custom properties only (not Tailwind JS config).
- Phase 23: Tag cloud limit to top 30 tags. Proximity scale via `useMotionValue`+`useTransform`+`useSpring` (never useState). ExpertCard has NO Framer Motion import — CSS hover only (Phase 17 decision). Bento card preserves `h-[180px]`.
- Phase 24: Frontend-only. Backend swap already in admin.py `_run_ingest_job`. Extend `_ingest` dict with `last_rebuild_at` + `expert_count_at_rebuild`. Add `asyncio.Lock` for double-rebuild OOM prevention.
- Phase 25: OTR@K computed post `scored.sort()` in `run_explore()`. `ALTER TABLE conversations ADD COLUMN otr_at_k REAL` via inline migration. Admin-only metric — not in public ExploreResponse.
- Phase 26: t-SNE MUST run post-yield via `asyncio.create_task` — NEVER above yield (Railway healthcheck failure). PCA(50) then TSNE(perplexity=30, max_iter=1000, init='pca', random_state=42, metric='cosine'). Cache in `app.state.embedding_map`.
- Phase 27: `useNltrStore` with persist key `'tinrate-newsletter-v1'`. Do NOT modify `useExplorerStore` or its `partialize`. `localStorage['tcs_email_unlocked']` bypass is unchanged. Barrel roll on VirtuosoGrid container (not ExpertCards).

### Pending Todos

- Set `ALLOWED_ORIGINS=https://tcs-three-sigma.vercel.app` in Railway environment variables (carried over from v1.1)
- Verify FTS5 availability on Railway SQLite at startup
- Before Phase 23: confirm framer-motion import path (`cat frontend/package.json | grep -i motion`)
- Before Phase 27: confirm exact localStorage key name from `frontend/src/hooks/useEmailGate.ts`

### Blockers/Concerns

- Phase 26 deployment risk resolved: create_task fires post-yield, healthcheck is unblocked.
- Phase 23 medium confidence: proximity scale pattern confirmed but no v12-specific tag cloud example exists. Phase spec must include exact `useMotionValue`/`useTransform` code to prevent useState temptation.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 26-01-PLAN.md (embedding heatmap backend)
Resume file: None
