# Phase 4: Deployment - Research

**Researched:** 2026-02-20
**Domain:** Vercel (React/Vite frontend) + Railway (FastAPI backend) deployment with Sentry monitoring
**Confidence:** HIGH (all critical paths verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Railway Hobby plan** ($5/mo) — no container sleeping, no keep-alive ping needed
- **Health check**: configure `/api/health` as Railway health check endpoint — Railway waits for 200 before routing traffic (zero-downtime redeploys)
- **Vercel**: use auto-generated URL (e.g. `tinrate-ai.vercel.app`) — no custom domain in this phase
- **Railway**: use auto-generated Railway URL — no custom subdomain in this phase
- **CI/CD**: both Vercel and Railway auto-deploy on every push to `main`; no branch preview deployments
- **Sentry**: install on **both** frontend (React) and backend (FastAPI); alert destination is email (Sentry default)
- No uptime monitoring — Sentry error tracking is sufficient for now

### Claude's Discretion

- Whether `/api/health` returns `503` during FAISS index load or `200` immediately — pick based on Railway health check timeout behavior
- Whether the FAISS index is committed to the repo or generated at deploy time via `ingest.py` — pick based on index size and Railway build step complexity
- CORS configuration approach — use `CORS_ORIGINS` env var on Railway so domain updates require no code changes
- Automated CI checks before deploy — pick appropriate lightweight config (e.g. ruff + tsc on push to main)

### Deferred Ideas (OUT OF SCOPE)

- Custom domain for Vercel frontend (e.g. `tinrate.com` or `app.tinrate.com`)
- Railway custom subdomain (`api.tinrate.com`)
- Uptime monitoring (BetterUptime or UptimeRobot)
- Email gate UX, thumbs feedback, analytics dashboard, test lab (these are pre-Phase 4 phases 3.1–3.4 that precede deployment but are out of scope for this research)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPL-01 | Application is publicly hosted and accessible via URL — React frontend on Vercel, FastAPI backend on Railway or Render | Vercel Vite deployment (Root Directory: `frontend`, auto-detected build `npm run build`, output `dist`); Railway FastAPI deployment via Procfile + railway.json health check; CORS locked to exact Vercel domain via ALLOWED_ORIGINS env var |
</phase_requirements>

---

## Summary

This phase deploys two separate services: the FastAPI backend to Railway (Hobby plan, $5/mo) and the React/Vite frontend to Vercel (free Hobby tier). Both services already exist in the repository — Railway reads `Procfile` for the start command and the CORS/env-var architecture is already implemented. The primary implementation work is: connecting GitHub repos to each platform, setting env vars, configuring the Railway health check, and installing Sentry on both services.

The most critical decision resolved by this research is the **FAISS index strategy**: Railway's standard builder (Railpack/Nixpacks) does not inject user-defined environment variables (like `GOOGLE_API_KEY`) during the build phase. This makes running `ingest.py` as a build step impossible without a Dockerfile. The FAISS index (1.6 MB) and metadata.json (452 KB) and experts.csv (532 KB) are currently gitignored — they must be **committed to git** (removing them from `.gitignore`) so they are present in the repo Railway clones. Total ~2.6 MB is well below GitHub's file size warning threshold. The `ingest.py` docstring explicitly warns against running it at startup (60+ seconds, hits embedding API), confirming build-time generation is not viable.

The second critical finding is **SQLite data loss on redeploy**: Railway's container filesystem is ephemeral. Every redeploy wipes `data/conversations.db`. For v1 lead capture (which is the primary SQLite use case), a Railway Volume must be mounted at `data/` so conversation logs survive deployments. Without it, every redeploy loses all conversation history.

**Primary recommendation:** Commit data files (FAISS index, metadata.json, experts.csv) to git; mount a Railway Volume at `/app/data` for SQLite persistence; configure `railway.json` for health check and start command; set `VITE_API_URL` on Vercel and `GOOGLE_API_KEY` + `ALLOWED_ORIGINS` on Railway.

---

## Standard Stack

### Core

| Service | Version / Tier | Purpose | Why Standard |
|---------|---------------|---------|--------------|
| Railway | Hobby ($5/mo) | FastAPI backend hosting | Locked decision; no sleeping on Hobby plan; Procfile-based start already in repo |
| Vercel | Hobby (free) | React/Vite frontend hosting | Industry standard for Vite/React SPAs; zero-config Vite detection |
| Sentry | Free tier | Error tracking on both services | Locked decision; email alerts; `sentry-sdk` (Python) + `@sentry/react` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sentry-sdk` | latest (`pip install sentry-sdk`) | FastAPI error tracking | Added to `requirements.txt`; auto-activates with fastapi package present |
| `@sentry/react` | latest (`npm install @sentry/react`) | React error boundary + tracing | Added to `frontend/package.json`; initialized in `frontend/src/instrument.ts` before any import |
| `@sentry/vite-plugin` | latest | Source map upload to Sentry | Required for readable production stack traces in Sentry |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Commit data files to git | Run `ingest.py` as Railway build step | Build-step approach impossible: Railway does not expose `GOOGLE_API_KEY` to the build phase without a Dockerfile; committing is simpler and ~2.6 MB is small |
| Railway Volume for SQLite | Railway Postgres add-on | Volume is simpler for v1 with no schema migrations; Postgres is recommended when scale or multi-instance deploys arrive |
| `railway.json` for health check | Dashboard-only config | `railway.json` is code-as-config, survives re-deploys and makes health check path explicit |

---

## Architecture Patterns

### Recommended Project Structure Changes

No new directories needed. The following files are added or modified:

```
/                               # repo root
├── railway.json                # NEW: health check + start command config
├── .github/
│   └── workflows/
│       └── ci.yml              # NEW: ruff + tsc check, gates Railway deploy via "Wait for CI"
├── data/
│   ├── faiss.index             # UNIGNORE: remove from .gitignore (1.6 MB)
│   ├── metadata.json           # UNIGNORE: remove from .gitignore (452 KB)
│   └── experts.csv             # UNIGNORE: remove from .gitignore (532 KB)
│   └── conversations.db        # KEEP ignored (ephemeral, replaced by Volume)
├── app/
│   └── main.py                 # ADD: sentry_sdk.init() near top, before app = FastAPI()
├── frontend/
│   └── src/
│       ├── instrument.ts       # NEW: Sentry.init() for React
│       └── main.tsx            # MODIFY: import './instrument' as first import
└── requirements.txt            # ADD: sentry-sdk
```

### Pattern 1: Railway Configuration as Code (`railway.json`)

**What:** Declares health check path and start command in the repo instead of the dashboard.
**When to use:** Always — ensures config is version-controlled and reproducible.

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

Source: [Railway Config as Code docs](https://docs.railway.com/reference/config-as-code)

The Procfile already has the correct uvicorn command. `railway.json` overrides it explicitly and adds the health check. 300-second timeout is the Railway default and gives the FAISS index (which loads at startup) time to load before traffic is routed.

### Pattern 2: Health Check — Return 200 Immediately (Not 503 During Load)

**What:** The `/api/health` endpoint returns `{"status": "ok", "index_size": N}` only after `lifespan()` completes, because FastAPI's lifespan runs before the server starts accepting connections.
**Resolution of Claude's Discretion item:** The endpoint will naturally return 200 only after FAISS loads, because Railway queries the health endpoint only after the process is listening. FastAPI's `lifespan` context manager blocks startup until `yield`, so the FAISS index is guaranteed to be loaded before any request is accepted. No 503 logic needed.

### Pattern 3: CORS — Exact Vercel Domain via Env Var

**What:** `ALLOWED_ORIGINS` env var on Railway, comma-separated. Already implemented in `app/main.py`. After Vercel deploy, set the exact URL.
**Example Railway env var:**
```
ALLOWED_ORIGINS=https://tinrate-ai.vercel.app
```
When a custom domain is acquired later, append it: `https://tinrate-ai.vercel.app,https://tinrate.com` — no code change required.

Source: Confirmed by reading `app/main.py` line 80–81 (`_raw_origins` split on comma).

### Pattern 4: Vercel Root Directory for Subdirectory Frontend

**What:** Vercel project settings → Build & Deployment → Root Directory = `frontend`. Vercel then reads `frontend/package.json` and auto-detects Vite framework.
**When to use:** Required when the frontend is not at the repo root (this project has `frontend/` subdirectory).

Vercel auto-configures:
- Build Command: `npm run build` (from `frontend/package.json` scripts)
- Output Directory: `dist` (Vite default)
- Framework Preset: Vite (auto-detected)

No `vercel.json` needed because this app has no client-side routing (single-page app with no React Router deep links). If client-side routing is added later, add:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Source: [Vercel Configuring a Build docs](https://vercel.com/docs/builds/configure-a-build), [Vite on Vercel docs](https://vercel.com/docs/frameworks/frontend/vite)

### Pattern 5: Railway Volume for SQLite Persistence

**What:** Mount a Railway Volume at `/app/data` so that `data/conversations.db` survives redeployments.
**Why critical:** Railway container filesystem is ephemeral — every redeploy wipes the container. Without a Volume, all conversation logs are lost on every deploy.
**Configuration:** Railway dashboard → Service → Volumes → Add Volume → Mount path: `/app/data`

Important constraint from Railway docs: **Volumes are NOT mounted during the build phase** — only at runtime. Since the FAISS index and metadata are committed to git (and copied into the image at build time), they appear at their absolute path (`DATA_DIR = Path(__file__).resolve().parent.parent / "data"`). The Volume mount at `/app/data` will overlay the build-time `data/` directory. This means the committed `faiss.index` and `metadata.json` will be hidden by the empty Volume on first deploy.

**Resolution:** Two options:
1. **Separate data paths**: Mount Volume at `/app/var` for SQLite only, update `DATABASE_URL` in `config.py` to point to `/app/var/conversations.db`. FAISS files stay at `/app/data/` (not overlaid).
2. **Copy on startup**: Use a start command wrapper that copies FAISS/metadata from a build-time path into the Volume on first boot.

**Recommended (Option 1):** Separate the Volume mount from the FAISS data directory. Change `DATABASE_URL` in `config.py` to use `/app/var/conversations.db` and mount the Volume at `/app/var`. FAISS index remains at build-time path `/app/data/`.

Source: [Railway Volumes docs](https://docs.railway.com/reference/volumes) — "If you write data to a directory at build time, it will not persist on the volume, even if it writes to the directory to which you have mounted the volume."

### Pattern 6: Sentry FastAPI Integration

**What:** Call `sentry_sdk.init()` at module level in `app/main.py`, before `app = FastAPI()`.
**Source:** [Sentry FastAPI docs](https://docs.sentry.io/platforms/python/integrations/fastapi/)

```python
# app/main.py — add near top, after imports
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),  # set as Railway env var
    traces_sample_rate=0.1,       # 10% in production — 100% is expensive
    environment="production",
)
```

The FastAPI Sentry integration activates automatically when `fastapi` is in installed packages — no explicit `FastApiIntegration()` call needed.

### Pattern 7: Sentry React Integration

**What:** Create `frontend/src/instrument.ts`, import it as the very first import in `frontend/src/main.tsx`.
**Source:** [Sentry React docs](https://docs.sentry.io/platforms/javascript/guides/react/)

```typescript
// frontend/src/instrument.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,  // set as Vercel env var
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: "production",
});
```

```typescript
// frontend/src/main.tsx — FIRST import, before React
import "./instrument";
import React from "react";
// ...
```

`VITE_SENTRY_DSN` must be prefixed with `VITE_` to be exposed to client-side code (Vite requirement). Also add to `ImportMetaEnv` interface in `vite-env.d.ts` for TypeScript safety.

### Pattern 8: GitHub Actions CI Gate

**What:** `.github/workflows/ci.yml` runs ruff (Python linting) and tsc (TypeScript type check) on push to main. Railway's "Wait for CI" feature holds deployment until the workflow passes.
**Source:** [Railway GitHub Autodeploys docs](https://docs.railway.com/guides/github-autodeploys), [Ruff GitHub Action](https://github.com/astral-sh/ruff-action)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install ruff
        run: pip install ruff

      - name: Ruff lint
        run: ruff check .

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install frontend deps
        run: npm ci
        working-directory: frontend

      - name: TypeScript type check
        run: npx tsc --noEmit
        working-directory: frontend
```

Enable "Wait for CI" toggle in Railway service settings after linking GitHub repo.

### Anti-Patterns to Avoid

- **Running `ingest.py` as Railway build command**: Railway does not inject user-defined env vars during build. `GOOGLE_API_KEY` will not be available → ingest will fail silently or with auth errors.
- **Wildcard CORS (`["*"]`)**: Already avoided in codebase. Never add it. Success criterion explicitly requires CORS locked to exact Vercel domain.
- **Committing `.env` or secrets**: Already gitignored. `GOOGLE_API_KEY` goes into Railway env vars; `VITE_API_URL` goes into Vercel env vars.
- **Mounting Railway Volume at `/app/data`**: Would overlay the committed FAISS index/metadata files, making the app fail on first deploy. Use `/app/var` for SQLite only.
- **`VITE_API_URL` without trailing slash mismatch**: If the frontend hardcodes `/api/chat` and `VITE_API_URL` ends with `/`, URLs will double-slash. Verify the URL construction pattern in `useChat.ts` before setting the env var.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error tracking | Custom error logging service | Sentry SDK | Locked decision; handles grouping, alerts, stack traces, source maps automatically |
| Health check logic | Custom readiness probe | FastAPI lifespan + existing `/api/health` | Already implemented correctly; just wire to Railway health check config |
| Railway sleep prevention | Keep-alive ping cron | Railway Hobby plan (no sleep) | Locked decision; Hobby plan containers never sleep unless serverless mode is explicitly enabled |
| CI linting | Custom lint scripts | `astral-sh/ruff-action` + `tsc --noEmit` | Existing maintained actions; zero setup cost |

**Key insight:** The infrastructure is mostly already in place. This phase is primarily configuration and wiring, not building new code.

---

## Common Pitfalls

### Pitfall 1: Railway Volume Overlaying Build-Time Files

**What goes wrong:** Developer mounts Railway Volume at `/app/data` (matching `DATA_DIR`). On first deploy, the Volume is empty and overlays the committed FAISS index and metadata.json — server fails with `RuntimeError: FAISS index not found`.
**Why it happens:** Railway Volumes shadow the build-time container directory they're mounted to. Data written to that path at build time is not visible through the mount.
**How to avoid:** Mount Volume at `/app/var`, update `DATABASE_URL` in `config.py` to `sqlite:////app/var/conversations.db`. FAISS files remain at `/app/data/` untouched.
**Warning signs:** Server startup error "FAISS index not found at /app/data/faiss.index" on first deploy after volume configuration.

### Pitfall 2: GOOGLE_API_KEY Not Available at Railway Build Time

**What goes wrong:** Developer puts `python scripts/ingest.py` in the Railway build command. Ingest silently fails or throws auth error because Railway does not inject user secrets into the build phase.
**Why it happens:** Railway's standard builder (Railpack/Nixpacks) only injects env vars at runtime, not build time. Confirmed by official Railway support station answer.
**How to avoid:** Commit FAISS index + metadata.json + experts.csv to git (remove from `.gitignore`). They become part of the Docker image at build time.
**Warning signs:** Empty FAISS index, `KeyError` or `google.auth.exceptions` in build logs.

### Pitfall 3: SQLite Data Loss on Every Redeploy

**What goes wrong:** `data/conversations.db` is on the ephemeral container filesystem. Every redeploy creates a fresh container → all conversation history deleted.
**Why it happens:** Docker containers on Railway are replaced on each deployment; no persistent storage without explicit Volume configuration.
**How to avoid:** Mount Railway Volume at `/app/var`, update `DATABASE_URL` to point there before first deploy.
**Warning signs:** Conversation count resets to 0 after every deploy.

### Pitfall 4: VITE_ Prefix Required for Frontend Env Vars

**What goes wrong:** Developer sets `API_URL` on Vercel. The variable is undefined at runtime (`import.meta.env.API_URL` is `undefined`). Fetch calls go to wrong URL or fail.
**Why it happens:** Vite only exposes environment variables prefixed with `VITE_` to client-side code at build time. Others are stripped.
**How to avoid:** Always use `VITE_API_URL` (and `VITE_SENTRY_DSN`). The `ImportMetaEnv` interface in `src/vite-env.d.ts` already enforces this via TypeScript.
**Warning signs:** `import.meta.env.VITE_API_URL` logs as `undefined` in browser console.

### Pitfall 5: Railway Serverless Mode (App Sleeping) May Be On

**What goes wrong:** Service sleeps after 10 minutes of inactivity (Railway's optional "Serverless" mode). First request cold-starts and may time out.
**Why it happens:** Railway has an opt-in "Serverless" (formerly App Sleeping) mode. Locked decision is Hobby plan with no sleeping — but it must be explicitly verified as disabled.
**How to avoid:** In Railway service settings, verify "Serverless" toggle is **OFF**. The Hobby plan supports always-on containers by default.
**Warning signs:** First request after idle period takes 10+ seconds or drops.

### Pitfall 6: Vercel Deploys Frontend From Repo Root

**What goes wrong:** Vercel imports the GitHub repo and tries to build from root. No `package.json` at root → build fails or deploys backend files as static assets.
**Why it happens:** Vercel defaults to repo root as project root.
**How to avoid:** In Vercel project settings → Build & Deployment → Root Directory → set to `frontend`.
**Warning signs:** Vercel build log shows "No framework detected" or lists Python files.

### Pitfall 7: CORS Mismatch After Vercel URL Is Known

**What goes wrong:** Backend is deployed first. ALLOWED_ORIGINS is set to `http://localhost:5173` (dev default). Frontend gets its Vercel URL. Browser blocks all requests with CORS error.
**Why it happens:** Deployment order — backend must know frontend URL to set CORS. The URL is only known after the frontend is first deployed on Vercel.
**How to avoid:** Deploy Vercel first (or deploy both and update ALLOWED_ORIGINS immediately after Vercel URL is known). Redeploying Railway with the correct `ALLOWED_ORIGINS` is a ~2 minute operation.
**Warning signs:** Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header".

---

## Code Examples

### Railway `railway.json` (repo root)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

Source: [Railway Config as Code](https://docs.railway.com/reference/config-as-code)

### Updated `app/config.py` — SQLite on Volume Path

```python
import os

# SQLite on persistent Railway Volume (mounted at /app/var in production)
# Falls back to data/ for local development
_VAR_DIR = Path(os.getenv("VAR_DIR", str(Path(__file__).resolve().parent.parent / "data")))
DATABASE_URL = f"sqlite:///{_VAR_DIR / 'conversations.db'}"
```

Set `VAR_DIR=/app/var` as a Railway environment variable. Local dev needs no change (defaults to `data/`).

### `.gitignore` — Remove Data File Entries

Remove these three lines from `.gitignore`:
```
data/faiss.index
data/metadata.json
data/*.csv
```
Keep `data/conversations.db` ignored (it lives on the Volume in production, and is gitignored locally).

### Railway Environment Variables (set in Railway dashboard)

| Variable | Value | Notes |
|----------|-------|-------|
| `GOOGLE_API_KEY` | `<your-key>` | Required for embed_query at runtime |
| `ALLOWED_ORIGINS` | `https://tinrate-ai.vercel.app` | Exact Vercel URL; append custom domain later |
| `SENTRY_DSN` | `https://...@sentry.io/...` | From Sentry project settings |
| `VAR_DIR` | `/app/var` | Points SQLite to Volume mount path |

### Vercel Environment Variables (set in Vercel dashboard)

| Variable | Value | Environment | Notes |
|----------|-------|-------------|-------|
| `VITE_API_URL` | `https://<railway-url>.railway.app` | Production | Exact Railway public URL; no trailing slash |
| `VITE_SENTRY_DSN` | `https://...@sentry.io/...` | Production | Separate Sentry project or same project different environment |

### Sentry `instrument.ts` — Frontend

```typescript
// frontend/src/instrument.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: "production",
  enabled: import.meta.env.PROD,  // only in production builds
});
```

### Sentry in `app/main.py` — Backend

```python
# Add near top of app/main.py, after os import, before app = FastAPI()
import sentry_sdk

if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=dsn,
        traces_sample_rate=0.1,
        environment="production",
    )
```

The `if dsn :=` guard means Sentry is silently skipped in local dev when `SENTRY_DSN` is not set.
Source: [Sentry FastAPI docs](https://docs.sentry.io/platforms/python/integrations/fastapi/)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nixpacks (Railway builder) | Railpack (Railway builder) | Late 2024/early 2025 | Nixpacks deprecated, no new features; Railpack is default for new services. Both support Procfile and `railway.json` identically. |
| `@app.on_event("startup")` | `asynccontextmanager lifespan` | FastAPI 0.90+ | Already using correct pattern in `app/main.py` |
| `google-generativeai` SDK | `google-genai` SDK | Jan 2026 | Already using correct SDK (`google-genai==1.64.*`) |

**Deprecated/outdated:**
- Nixpacks: No longer receiving new features; Railway docs say new services use Railpack. Existing services on Nixpacks continue to work. The `railway.json` schema is identical for both.

---

## Open Questions

1. **Sentry project: one project with environments or two separate projects?**
   - What we know: Sentry supports both patterns; `environment="production"` tag filters in Sentry UI
   - What's unclear: Team preference; single project simpler to manage, two projects cleaner error separation
   - Recommendation: One Sentry project, two DSN values (backend and frontend are separate SDK clients regardless). Use `environment` tag to filter.

2. **`VITE_API_URL` trailing slash convention**
   - What we know: `useChat.ts` constructs request URLs. The exact URL concatenation pattern must be checked.
   - What's unclear: Whether the hook uses `${VITE_API_URL}/api/chat` or `${VITE_API_URL}api/chat`
   - Recommendation: Planner should include a verification step: read `frontend/src/hooks/useChat.ts` and confirm URL construction before setting the Railway URL env var.

3. **Git file size for committed data files**
   - What we know: faiss.index=1.6MB, metadata.json=452KB, experts.csv=532KB → total ~2.6MB
   - What's unclear: GitHub warns at 50MB per file and blocks at 100MB; 2.6MB is well under threshold
   - Recommendation: Commit directly — no Git LFS needed. Total repo size increase is acceptable.

---

## Sources

### Primary (HIGH confidence)

- [Railway Config as Code](https://docs.railway.com/reference/config-as-code) — `railway.json` schema for `healthcheckPath`, `healthcheckTimeout`, `startCommand`
- [Railway Health Checks](https://docs.railway.com/guides/healthchecks-and-restarts) — 300s default timeout; 200 response required before new deploy goes live; `healthcheck.railway.app` hostname
- [Railway Volumes](https://docs.railway.com/reference/volumes) — "Each service can only have a single volume"; volumes not mounted during build phase
- [Railway GitHub Autodeploys](https://docs.railway.com/guides/github-autodeploys) — "Wait for CI" feature: WAITING → SKIPPED if CI fails → deploys if CI passes
- [Railway App Sleeping](https://docs.railway.com/reference/app-sleeping) — opt-in serverless mode; Hobby plan can run always-on
- [Vercel Configuring a Build](https://vercel.com/docs/builds/configure-a-build) — Root Directory setting for subdirectory projects; auto-detected Vite build settings
- [Vercel Vite docs](https://vercel.com/docs/frameworks/frontend/vite) — VITE_ prefix requirement for environment variables; SPA rewrite pattern
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) — Production/Preview/Development scopes; 64KB limit; encrypted at rest
- [Sentry FastAPI docs](https://docs.sentry.io/platforms/python/integrations/fastapi/) — `sentry_sdk.init()` before `FastAPI()`; auto-activates; `traces_sample_rate`
- [Sentry React docs](https://docs.sentry.io/platforms/javascript/guides/react/) — `instrument.ts` pattern; first import in `main.tsx`; `@sentry/react` package
- Railway Help Station — env vars NOT available during Railway build phase (confirmed by official Railway support response)
- `app/main.py`, `app/config.py`, `Procfile`, `data/` file sizes, `.gitignore` — read directly from project

### Secondary (MEDIUM confidence)

- [Ruff GitHub Action](https://github.com/astral-sh/ruff-action) — `astral-sh/ruff-action@v3` for CI linting
- [Railway build-and-start-commands](https://docs.railway.com/reference/build-and-start-commands) — build command runs during image building; start command runs at deployment

### Tertiary (LOW confidence)

- WebSearch results re: Railpack vs Nixpacks transition timeline (late 2024/early 2025) — not officially dated in docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official Railway and Vercel docs confirm both platforms, versions are current
- Architecture: HIGH — patterns derived from official docs + direct reading of existing project code
- Pitfalls: HIGH — SQLite ephemerality and Volume overlay confirmed by Railway docs; VITE_ prefix confirmed by Vercel docs; env var build-time unavailability confirmed by Railway support thread
- FAISS index strategy: HIGH — confirmed by Railway support answer that env vars not available at build time + ingest.py docstring explicitly forbids startup execution

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (Railway/Vercel config APIs are stable; Sentry SDK is stable)
