# Phase 4: Deployment - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the FastAPI backend to Railway and the React frontend to Vercel, configure environment variables and secrets, set up error tracking, and verify the full app works end-to-end at a public URL. Custom domains and uptime monitoring are deferred.

</domain>

<decisions>
## Implementation Decisions

### Keep-alive / Railway reliability
- Railway **Hobby plan** ($5/mo) — no container sleeping, no keep-alive ping needed
- Configure `/api/health` as the Railway **health check endpoint** — Railway must wait for 200 before routing traffic to a new deploy (zero-downtime redeploys)

### Custom domains
- **Vercel**: Use auto-generated URL for now (e.g. `tinrate-ai.vercel.app`) — custom domain planned but not yet acquired
- **Railway**: Use auto-generated Railway URL — `api.tinrate.com` subdomain is a future task, not in this phase

### CI/CD pipeline
- **Both Vercel and Railway**: auto-deploy on every push to `main`
- No branch preview deployments in scope

### Monitoring & observability
- **Sentry**: Install on **both frontend (React) and backend (FastAPI)**
- Sentry alert destination: **email** (Sentry default)
- No uptime monitoring — Sentry error tracking is sufficient for now

### Claude's Discretion
- Whether `/api/health` returns `503` during FAISS index load or `200` immediately — Claude picks based on Railway health check timeout behavior
- Whether the FAISS index is committed to the repo or generated at deploy time via `ingest.py` — Claude picks based on index size and Railway build step complexity
- CORS configuration approach — use `CORS_ORIGINS` env var on Railway so domain updates require no code changes
- Automated CI checks before deploy — Claude picks appropriate lightweight config (e.g. ruff + tsc on push to main)

</decisions>

<specifics>
## Specific Ideas

- FAISS index must be available at Railway deploy time — either committed or generated as a build step
- Production CORS must be locked to the exact Vercel domain (no wildcard) — should be configurable via env var for when custom domain is added later

</specifics>

<deferred>
## Deferred Ideas — Required Before Deployment

These features were identified as **must-haves before Phase 4 runs**. Insert as decimal phases (3.1–3.4):

- **Email gate UX** (Phase 3.1) — Show expert results immediately, but require email to click through to a profile. Current backend email validation exists but the frontend UX needs to implement this gate pattern.
- **Thumbs up/down feedback** (Phase 3.2) — Small thumbs up/down shown beneath results. Downvote opens a sheet with easy-select suggestions + open comment field. Feedback stored in DB.
- **Analytics dashboard** (Phase 3.3) — Admin-facing dashboard: who searches for what, which experts are matched, gap tracking for platform improvements and outreach. All data exportable as CSV.
- **Test lab** (Phase 3.4) — Behind-the-scenes tool to run test queries against the search engine, evaluate results, and iteratively improve retrieval quality.

## Deferred Ideas — Post-Deployment

- **Custom domain for Vercel frontend** — e.g. `tinrate.com` or `app.tinrate.com`. Add when domain is acquired.
- **Railway custom subdomain** — `api.tinrate.com` pointing to Railway backend. Add alongside frontend domain.
- **Uptime monitoring** — BetterUptime or UptimeRobot pinging `/api/health`. Add if Sentry coverage proves insufficient.

</deferred>

---

*Phase: 04-deployment*
*Context gathered: 2026-02-20*
