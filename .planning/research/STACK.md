# Stack Research

**Domain:** Expert Marketplace — v4.0 Public Launch additions only
**Researched:** 2026-02-27
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH for all items — verified against current package.json, requirements.txt, official docs, and PyPI

---

## Scope of This Document

Covers ONLY what is new or changed for v4.0 Public Launch. The existing production stack is
validated and must not change unless explicitly noted:

- **Backend:** FastAPI 0.129.* + SQLAlchemy 2.0.* + SQLite + faiss-cpu 1.13.* + google-genai 1.64.*
  + scikit-learn 1.8.0 + numpy 2.2.* + pandas 2.2.* + tenacity 8.4.* + httpx 0.28.* + structlog 24.2.*
- **Frontend:** React 19.2 + Vite 7.3 + Tailwind v3.4 + React Router v7.13 + motion/react v12.34
  + Zustand v5.0.11 + react-virtuoso 4.18 + vaul 1.1.2 + lucide-react 0.575 + recharts 3.7
  + @radix-ui/react-slider 1.3.6 + @tanstack/react-table 8.21

The seven new capability areas for v4.0:

1. Proper admin auth — username + hashed password + JWT session expiry
2. Grid/list view toggle on the expert grid
3. Industry-level tags separate from domain tags in the tag cloud
4. Lead and click-event CSV export
5. Expert CSV import improvements (upsert with industry tag support)
6. Frontend performance optimization for public launch
7. Fixing the t-SNE embedding heatmap (always shows "loading")

---

## 1. Admin Auth — bcrypt + PyJWT, No Passlib

### Current State

The current login sends a raw API key to `POST /api/admin/auth`, which compares it against
`ADMIN_SECRET` env var (plain string equality). The key is stored in `sessionStorage` on the
frontend and sent as `X-Admin-Key` header on every admin request. This works but has two problems:
no password hashing (secret stored in plain env var) and no session expiry (key stays valid until
manually rotated).

### What to Add

**Backend — two new Python packages:**

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `bcrypt` | 5.0.0 | Hash + verify the admin password | Actively maintained (pyca org), no passlib dependency, simple API: `bcrypt.hashpw()` + `bcrypt.checkpw()`. passlib is abandoned and throws deprecation warnings on Python 3.13+. |
| `PyJWT` | 2.11.0 | Generate + verify short-lived JWT tokens | Lightweight, actively maintained (last release Jan 2026), does not require cryptography package for HS256. python-jose is nearly abandoned (last commit 2023, open security issues). |

**Frontend — zero new packages.** The login page already exists. It needs to be updated to
submit `{username, password}` instead of `{key}` and store the returned JWT token (not the
raw key) in `sessionStorage`. The `X-Admin-Key` header name is fine to keep as-is; the value
becomes the JWT token.

### Why Not Passlib

passlib has not had a release since 2020. It throws `DeprecationWarning: 'crypt' is deprecated
and slated for removal in Python 3.13` on modern Python. The FastAPI official template
(`fastapi/full-stack-fastapi-template`) migrated away from passlib in 2024 — PR #1539 shows
direct bcrypt usage as the replacement.

### Why Not python-jose

python-jose has known unresolved security issues and the project is effectively unmaintained
(last commit 2023). PyJWT is the active standard: 2.11.0 released January 2026, used by the
official FastAPI JWT tutorial examples in 2025.

### Auth Pattern to Implement

```
1. Startup: read ADMIN_USERNAME + ADMIN_PASSWORD_HASH from env vars
   (ADMIN_PASSWORD_HASH = bcrypt.hashpw(password, bcrypt.gensalt()).decode())
2. POST /api/admin/auth: accept {username, password}
   → bcrypt.checkpw(password, hash) → if OK, return JWT token (1 day expiry)
3. All admin endpoints: verify JWT in X-Admin-Key header
   → PyJWT.decode(token, SECRET_KEY, algorithms=["HS256"])
4. Frontend: store JWT in sessionStorage['admin_token']
   → send as X-Admin-Key header (same header name, different value format)
```

Expiry: 24 hours (`exp` claim in JWT). Simple, no refresh token needed — admin sessions are
explicit log-ins, not user sessions.

### Hashed Password Bootstrap

The admin needs a way to generate the initial hash. Two approaches are valid:
- A one-off CLI script: `python -c "import bcrypt; print(bcrypt.hashpw(b'mypassword', bcrypt.gensalt(12)).decode())"`
- Store the hash as `ADMIN_PASSWORD_HASH` env var on Railway

### Session Storage Consideration

`sessionStorage` is fine for admin use (single-tab, cleared on browser close). The JWT approach
adds expiry enforcement that `sessionStorage` alone cannot provide. No change to storage mechanism
needed — only the stored value changes from raw key to JWT token.

### Installation

```bash
# Backend only
pip install "bcrypt==5.0.0" "PyJWT==2.11.0"
```

`requirements.txt` additions:
```
bcrypt==5.0.*
PyJWT==2.11.*
```

### Confidence: HIGH

- bcrypt 5.0.0: verified at [pypi.org/project/bcrypt](https://pypi.org/project/bcrypt/) — Python >=3.8, Apache-2.0
- PyJWT 2.11.0: verified at [pypi.org/project/PyJWT](https://pypi.org/project/PyJWT/) — released 2026-01-30, Python >=3.9
- passlib abandonment confirmed: [fastapi/fastapi Discussion #11773](https://github.com/fastapi/fastapi/discussions/11773)
- python-jose abandonment confirmed: [fastapi/fastapi Discussion #9587](https://github.com/fastapi/fastapi/discussions/9587)
- FastAPI official template bcrypt migration: [full-stack-fastapi-template PR #1539](https://github.com/fastapi/full-stack-fastapi-template/pull/1539)

---

## 2. Grid/List View Toggle — Virtuoso Component Swap, No New Package

### Current State

The expert grid uses `VirtuosoGrid` (uniform-height cards, `h-[180px]` fixed). This is already
installed via `react-virtuoso 4.18.1`.

### Approach

Toggle between `VirtuosoGrid` (current grid) and `Virtuoso` (list) using React state.
`Virtuoso` is already exported from `react-virtuoso` — no new dependency.

```
Grid mode: VirtuosoGrid — same as today, multi-column, h-[180px] cards
List mode: Virtuoso — single column, variable-height list rows
```

**State:** Add `viewMode: 'grid' | 'list'` to the Zustand `filterSlice` (or as local state in
`ExpertGrid.tsx`). Persist to `localStorage` if desired (not required for v4.0).

**List row design:** A compact horizontal card — photo/monogram + name + title + company + rate
on one line, tags below. Height is auto (no fixed `h-[180px]` constraint).

**Toggle button:** Two icon buttons (grid icon + list icon) in the toolbar area. `lucide-react`
already includes `LayoutGrid` and `List` icons — no new icons needed.

### Why Not a New Library

`react-virtuoso` already exports both `Virtuoso` and `VirtuosoGrid`. Swapping between them is
a conditional render. No new package needed. The `itemContent` render function is different
(grid card vs list row), but the data source `totalCount` / `data` props are identical.

### The `stateChanged` Consideration

`VirtuosoGrid` and `Virtuoso` do not share scroll state. When toggling views, the scroll position
resets to the top. This is the correct UX — no attempt to preserve scroll position across
view mode switches.

### Installation

```bash
# Nothing to install — react-virtuoso already in package.json
```

### Confidence: HIGH

Verified against `react-virtuoso` API docs at [virtuoso.dev](https://virtuoso.dev/) — both
`Virtuoso` (variable height list) and `VirtuosoGrid` (uniform grid) are first-class exports.
Current `package.json` confirms `react-virtuoso@4.18.1` is installed.

---

## 3. Industry Tags — Data Modeling Change, No New Package

### Current State

Tags are stored as a JSON array in `Expert.tags` (SQLite TEXT column). These are domain-level
tags (e.g., "AI Strategy", "Revenue Growth"). The tag cloud uses all tags from `Expert.tags`.

### What Changes

Add a second tag field: **industry tags** (e.g., "SaaS", "FinTech", "Healthcare", "Retail").
Industry tags differ from domain tags — they describe the sector the expert works IN, not the
skills they have.

### Approach: New DB Column + No New Package

Add `industry_tags TEXT` column to the `experts` table via the startup migration pattern:

```python
# app/main.py — startup lifespan (same pattern as existing)
try:
    _conn.execute(_text("ALTER TABLE experts ADD COLUMN industry_tags TEXT"))
    _conn.commit()
except Exception:
    pass  # Already exists — idempotent
```

Store as JSON array (same pattern as `tags`). Serialize/deserialize with `json.loads()`/`json.dumps()`.

No new package needed. The existing JSON pattern used for `tags` is sufficient.

**Admin UI:** The expert import CSV should accept an `Industry Tags` column. The tag cloud
component accepts a separate `industryTags` array prop. Filtering supports industry tags as
a separate multi-select chip row or a second section in the existing tag cloud.

**Auto-classification:** Industry tags can be keyword-matched from `job_title` / `company` / `bio`
(same approach as `CATEGORY_KEYWORDS` in admin.py). Initial population can happen via the
existing tagging script or a startup migration loop.

### Why Not a Separate Table

For 530 experts, a separate `expert_industries` table would be premature normalization. The
existing `tags` column uses JSON arrays and it works well. Industry tags follow the same
pattern for consistency.

### Confidence: HIGH

Verified against existing `app/models.py` and `app/main.py` patterns. SQLite JSON text column
pattern is already used for `tags`.

---

## 4. Lead + Click Export — Pure Python/CSV, No New Package

### Current State

Existing exports: `GET /api/admin/export/searches.csv`, `GET /api/admin/export/gaps.csv`,
`GET /api/admin/export/newsletter.csv`, `GET /api/admin/export/demand.csv`,
`GET /api/admin/export/exposure.csv`. All use `io.StringIO` + `csv.writer` + `StreamingResponse`.
This pattern is already in the codebase and working.

### What to Add

Two new export endpoints following the exact same pattern:

**`GET /api/admin/export/leads.csv`** — lead data enriched with click history from `user_events`

```
Columns: email, first_seen, last_seen, total_searches, gap_count, recent_queries,
         card_clicks (count), top_clicked_experts (top 3 expert usernames from card_click events)
```

The join: `Conversation` table has `email`; `user_events` has `session_id` but NOT `email` directly.
Leads export enrichment uses the `email` from `Conversation` rows matched by date range or
session proximity. This is a best-effort join — exact session-to-email linking is not possible
without a session table.

**`GET /api/admin/export/events.csv`** — raw `user_events` table dump with JSON payload expanded

```
Columns: id, session_id, event_type, created_at, + payload fields expanded inline
```

The `payload` is a JSON blob — expand key fields per event type:
- `card_click`: expert_id, context, rank
- `sage_query`: query_text, result_count, zero_results
- `filter_change`: filter_type, value

### Pattern (already established)

```python
@router.get("/export/leads.csv")
def export_leads_csv(db: Session = Depends(get_db)):
    rows = db.scalars(select(Conversation).order_by(Conversation.created_at.desc())).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["# Export date", date.today().isoformat()])
    writer.writerow([])
    writer.writerow(["email", "total_searches", "last_search_at", ...])
    # ... aggregate by email
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads-{date.today().isoformat()}.csv"},
    )
```

### Frontend

Add "Export CSV" buttons to the Leads admin page and a new Events admin page.
No new library needed — plain `<a href="/api/admin/export/leads.csv">` with the `X-Admin-Key`
header requires a `fetch()` + `Blob` + `URL.createObjectURL()` pattern (already used in
`ExportDialog.tsx`).

### Confidence: HIGH

Pattern verified against existing `export_newsletter_csv`, `export_demand_csv`,
`export_exposure_csv` implementations in `app/routers/admin.py`. No new packages.

---

## 5. Expert CSV Import Improvements — No New Package

### Current State

`POST /api/admin/experts/import-csv` reads CSV via Python stdlib `csv.DictReader`, upserts
into SQLite via SQLAlchemy row-by-row, returns `{inserted, updated, skipped}`. Tags are
preserved on update (not overwritten). Email column is deliberately ignored.

### What to Add

**Industry tags import:** The CSV importer should read an `Industry Tags` column (semicolon or
comma separated) and write to the new `industry_tags` JSON field.

**Auto-tag on import:** New experts inserted via CSV currently get `tags=NULL` and no
`findability_score`. The import should optionally trigger background Gemini tagging for new rows
(same pattern as `POST /api/admin/experts` — the `_retry_tag_expert_background` background task).

**Dry-run mode:** Add a `?dry_run=true` query param that returns `{would_insert, would_update,
would_skip}` without writing. Useful for previewing large CSV files before committing.

**Better error reporting:** Currently, a single bad row silently increments `skipped`. Return
a `warnings` list with `{row, reason}` for skipped rows so the admin knows what was rejected.

### Why Not pandas for Import

`pandas` is already in the stack (`requirements.txt`) and is tempting here, but:
- The existing `csv.DictReader` pattern is simpler for row-by-row upsert logic
- pandas `to_sql` doesn't support SQLAlchemy ORM upsert semantics
- For 530 rows, performance is irrelevant — clarity beats speed
- Keep the pattern consistent with the existing importer

### Confidence: HIGH

Verified against existing `import_experts_csv` in `app/routers/admin.py` (lines 999–1066).
No new packages. Dry-run pattern is a standard query param addition.

---

## 6. Frontend Performance — React.lazy + Vite manualChunks, No New Package

### Current State

The admin panel (`/admin`) loads in the same Vite bundle as the public-facing Explorer (`/`).
This means every public user downloads admin-specific code (recharts, @tanstack/react-table,
complex admin components) they will never use.

### What to Do

**Route-level code splitting with `React.lazy` + `Suspense`:**

```typescript
// frontend/src/App.tsx (or router config)
const AdminApp = React.lazy(() => import('./admin/AdminApp'))

// Wrap with Suspense
<Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
  <Route path="/admin/*" element={<AdminApp />} />
</Suspense>
```

**Vite `manualChunks` for stable vendor libraries:**

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-motion': ['motion'],
        'vendor-recharts': ['recharts'],
        'vendor-table': ['@tanstack/react-table'],
      }
    }
  }
}
```

**Expected result:** Admin chunks download only when `/admin` is visited. Public Explorer
gets a smaller initial bundle. `recharts` (chart library, ~100 kB) and `@tanstack/react-table`
stay in separate chunks that cache independently between deploys.

**Image optimization:** The logo images in `frontend/` (PNG files) should be served from Vercel's
CDN — they already are, since Vercel serves the `public/` directory with proper cache headers.
No change needed here. However, if the aurora gradient and glassmorphism are causing paint delays,
the correct fix is CSS `will-change: transform` on animated elements, not a new library.

**No new packages required.** `React.lazy` and `Suspense` are built into React 19.
Vite `manualChunks` is a built-in Rollup option.

### What NOT to Do for Performance

| Rejected Approach | Why |
|-------------------|-----|
| `react-window` or `react-virtual` | react-virtuoso is already installed and covers all virtualization needs |
| `@loadable/component` | Adds a dependency for what React.lazy handles natively |
| `vite-plugin-compression` | Vercel already serves gzip/brotli on all assets by default |
| Server-side rendering (SSR/Next.js) | The project is a client-side SPA deployed on Vercel; SSR migration is a separate architectural decision, not a v4.0 task |

### Confidence: HIGH

Vite `manualChunks` pattern verified at [vite.dev/guide/build](https://vite.dev/guide/build).
React.lazy verified in React 19 docs. Bundle size reduction expectation (admin/public split)
confirmed in multiple 2025 case studies — typical drop of 30-40% in public bundle size when
admin routes are split out.

---

## 7. t-SNE Embedding Heatmap Fix — Code Bug, No New Package

### Root Cause Identified

The t-SNE background task is launched at the WRONG place in the lifespan context manager.

```python
# app/main.py — CURRENT (broken)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... startup code ...
    yield
    asyncio.create_task(_compute_tsne_background(app))  # WRONG: runs at SHUTDOWN, not startup
```

In FastAPI's `@asynccontextmanager` lifespan pattern:
- Code **before** `yield` = startup (runs when server starts)
- Code **after** `yield` = shutdown (runs when server stops)

The `asyncio.create_task()` call is placed after `yield`, so it only executes when Railway
shuts down the container — never on startup. This is why the heatmap always shows "Loading..."
with HTTP 202 `{status: computing}` — `app.state.tsne_ready` is never set to `True` during
normal operation.

### Fix

Move the task launch to **before** `yield` using `asyncio.ensure_future()` or
`asyncio.get_event_loop().create_task()` — but these must be called after the event loop
is running. The correct pattern for FastAPI lifespan is:

```python
# app/main.py — FIXED
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... all startup code (DB, FAISS, FTS5, etc.) ...

    # Launch t-SNE computation as background task DURING startup
    # create_task() requires a running event loop — safe here because we're inside async lifespan
    asyncio.create_task(_compute_tsne_background(app))
    log.info("tsne.background_task_scheduled")

    yield
    # Shutdown: nothing to do
```

This places the task launch in the startup phase. The task runs asynchronously (does not block
startup) because `_compute_tsne_background` uses `asyncio.to_thread()` for the CPU-intensive
sklearn TSNE computation. The 5-second polling in `useEmbeddingMap()` hook will correctly
receive HTTP 202 while computing and HTTP 200 when done.

### Additional Hardening

The frontend hook already handles the polling pattern correctly. The only concern is Railway
deployments where the t-SNE computation (30s for 530 experts) might race with health checks.
Since the computation runs in a thread (not blocking the event loop), health checks continue
to respond normally during t-SNE computation.

**No new packages.** The fix is a 2-line code move: delete `asyncio.create_task(...)` from
after `yield` and add it before `yield`.

### Confidence: HIGH

Root cause confirmed by code inspection of `app/main.py` lines 334-335 and the FastAPI lifespan
pattern at [fastapi.tiangolo.com/advanced/events](https://fastapi.tiangolo.com/advanced/events/).
asyncio.create_task() semantics confirmed in Python docs — must be called from a coroutine or a
running event loop.

---

## Net-New Packages for v4.0

Two new Python packages. Zero new frontend packages.

| Package | Version Pinned | Language | Purpose |
|---------|---------------|----------|---------|
| `bcrypt` | 5.0.* | Python | Admin password hashing |
| `PyJWT` | 2.11.* | Python | Admin JWT session tokens |

### requirements.txt Changes

```
# Add these two lines:
bcrypt==5.0.*
PyJWT==2.11.*
```

### package.json Changes

None.

---

## What NOT to Add

| Rejected Package | Reason | Use Instead |
|-----------------|--------|-------------|
| `passlib` | Abandoned since 2020, DeprecationWarning on Python 3.13, FastAPI official template migrated away | `bcrypt` directly |
| `python-jose` | Near-abandoned (last commit 2023), open security issues | `PyJWT` |
| `fastapi-jwt-auth` | Third-party wrapper with its own opinions; adds dependency for a 20-line implementation | PyJWT directly |
| `alembic` | No existing setup; startup raw SQL is the project pattern; would require migration file management | Raw `ALTER TABLE` in `main.py` |
| `@loadable/component` | Adds dependency for what React.lazy handles natively in React 19 | `React.lazy` + `Suspense` |
| `react-window` | Redundant — react-virtuoso already handles all virtualization | react-virtuoso `Virtuoso` (list) / `VirtuosoGrid` (grid) |
| `vite-plugin-compression` | Vercel auto-serves gzip/brotli — no manual compression plugin needed | Vercel default behavior |
| `react-select` | 26 kB for dropdowns, over-engineered for simple filter selects | Native `<select>` with Tailwind |
| `pandas` (for import) | Already in stack but wrong tool for row-by-row ORM upsert | `csv.DictReader` (existing pattern) |

---

## Version Compatibility Notes

| Package | Constraint | Notes |
|---------|-----------|-------|
| `bcrypt==5.0.*` | Python >=3.8 | Compatible with all Python 3.11-3.13 on Railway |
| `PyJWT==2.11.*` | Python >=3.9 | HS256 algorithm requires no cryptography extras |
| `react-virtuoso==4.18.*` | React 19.x | Confirmed compatible — no peer dep warnings in current install |

---

## Sources

- [bcrypt 5.0.0 on PyPI](https://pypi.org/project/bcrypt/) — verified 2026-02-27, Python >=3.8
- [PyJWT 2.11.0 on PyPI](https://pypi.org/project/PyJWT/) — verified 2026-02-27, released 2026-01-30
- [passlib abandonment discussion — fastapi/fastapi #11773](https://github.com/fastapi/fastapi/discussions/11773)
- [python-jose abandonment discussion — fastapi/fastapi #9587](https://github.com/fastapi/fastapi/discussions/9587)
- [FastAPI official template passlib → bcrypt migration PR #1539](https://github.com/fastapi/full-stack-fastapi-template/pull/1539)
- [FastAPI lifespan events docs](https://fastapi.tiangolo.com/advanced/events/) — startup vs shutdown
- [Vite build manualChunks docs](https://vite.dev/guide/build) — Rollup output options
- [react-virtuoso API reference](https://virtuoso.dev/react-virtuoso/api-reference/virtuoso-grid/) — Virtuoso + VirtuosoGrid exports
- [Vite code splitting 2025 case study](https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/) — 40% bundle size reduction with route splitting
- Current `frontend/package.json` verified (react-virtuoso@4.18.1, no PyJWT/bcrypt present)
- Current `requirements.txt` verified (no bcrypt, no PyJWT)
- `app/main.py` lines 315-335: t-SNE task placement bug confirmed by direct code inspection
- `app/routers/admin.py`: existing CSV export pattern + import-csv endpoint verified

---
*Stack research for: Expert Marketplace v4.0 Public Launch*
*Researched: 2026-02-27*
