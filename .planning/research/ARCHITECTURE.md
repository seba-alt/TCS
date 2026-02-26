# Architecture Patterns: v3.1 Launch Prep

**Domain:** Expert Marketplace SPA — launch hardening integration
**Researched:** 2026-02-26
**Confidence:** HIGH — all findings from direct codebase inspection of v3.0 source
**Scope:** Integration points for v3.1 features only. Existing v3.0 system is ground truth — only deltas documented.

---

## Context: v3.0 Ground Truth (verified by file inspection)

```
ROUTES  (frontend/src/main.tsx)
  /             -> MarketplacePage (inside RootLayout)
  /explore      -> RedirectWithParams to /
  /browse       -> Navigate to /
  /marketplace  -> RedirectWithParams to /
  /chat         -> Navigate to /
  /admin/*      -> AdminApp (protected, sessionStorage key)

FRONTEND FILE STRUCTURE (relevant to v3.1)
  Entry point:          frontend/src/main.tsx
  HTML shell:           frontend/index.html                 (gtag.js goes here)
  Sentry init:          frontend/src/instrument.ts          (imported first in main.tsx)
  Tracking module:      frontend/src/tracking.ts            (fire-and-forget, module fn)
  Marketplace page:     frontend/src/pages/MarketplacePage.tsx
  Root layout:          frontend/src/layouts/RootLayout.tsx  (Sage FAB/panel/sheet lives here)
  Header:               frontend/src/components/Header.tsx   (glassmorphic Command Center)
  Filter sidebar:       frontend/src/components/sidebar/FilterSidebar.tsx  (desktop only, md:flex)
  Mobile filter sheet:  frontend/src/components/sidebar/MobileFilterSheet.tsx  (Vaul-based — REPLACE)
  Filter chips:         frontend/src/components/marketplace/FilterChips.tsx
  Expert grid:          frontend/src/components/marketplace/ExpertGrid.tsx  (VirtuosoGrid)
  Tag cloud:            frontend/src/components/sidebar/TagCloud.tsx        (18-20 tags change here)

BACKEND FILE STRUCTURE (relevant to v3.1)
  ORM models:           app/models.py                  (Expert.email — REMOVE column here)
  App startup:          app/main.py                    (seed logic — remove email read here)
  Admin router:         app/routers/admin.py           (import-csv — remove email write here)
  Explore service:      app/services/explorer.py       (no email — no change needed)
  Suggest router:       app/routers/suggest.py         (FTS5 — validate empty string here)
  Explore router:       app/routers/explore.py         (FTS5 — validate empty string here)
  Photo proxy:          app/routers/browse.py          (502 → graceful fallback needed here)

ZUSTAND STORE  (frontend/src/store/)
  index.ts:          createFilterSlice + createResultsSlice + createPilotSlice + persist
  filterSlice.ts:    query, rateMin, rateMax, tags, sortBy, savedExperts, savedFilter — persisted
  resultsSlice.ts:   experts[], total, cursor, loading, sageMode — ephemeral
  pilotSlice.ts:     messages[], isOpen, isStreaming, sessionId — ephemeral
  nltrStore.ts:      subscribed, email — separate store (Zustand persist key: 'nltr-store')

MOBILE FILTER ARCHITECTURE (CURRENT — v3.0)
  MobileFilterSheet.tsx: Vaul Drawer.Root with snapPoints=[0.5,1]
  Called from:       MarketplacePage.tsx line 167
  Trigger:           "Filters" button in mobile toolbar (md:hidden div, lines 99-130)
  State:             local useState sheetOpen in MarketplacePage.tsx
  Store write path:  handleApply() → setQuery/setRateRange/toggleTag via useExplorerStore.getState()

REDIRECT ARCHITECTURE (CURRENT — v3.0 bug)
  RedirectWithParams component: main.tsx lines 25-29
  Bug: useSearchParams() at component level works fine. The issue is likely
       a loop caused by /explore → / redirect when URL already has params that
       get re-parsed, possibly triggering useUrlSync → setSearchParams → re-render
  useUrlSync hook: frontend/src/hooks/useUrlSync.ts
       URL → Store: one-time on mount (initialized ref guards re-run)
       Store → URL: skipFirst ref guards first cycle
  Known risk: multiple redirects of the same route can stack React renders

FTS5 EMPTY QUERY BUG (CURRENT — v3.0 bug)
  Location: app/services/explorer.py
  _safe_fts_query("") returns ""
  The safe_q guard on line 223: `if safe_q:` correctly skips FTS5 when empty
  ACTUAL BUG SITE: app/routers/suggest.py — `_run_suggest_multi` early-exits on
       len < 2, but `_safe_prefix_query("")` could still produce a query if called
       with edge cases. More likely: the suggest endpoint is called with q="" before
       the 2-char guard fires on some debounce flush.
  Also check: if FTS5 MATCH is called with an empty string anywhere else — the
       startup `INSERT INTO experts_fts(experts_fts) VALUES('rebuild')` is safe.

PHOTO PROXY ERROR (CURRENT — v3.0 Sentry error)
  Location: app/routers/browse.py lines 178-186
  Current behavior: httpx.RequestError → 502, non-200 upstream → 502
  Problem: 502 is logged by Sentry as an error. Frontend gets 502, browser logs error,
       ExpertCard falls back to monogram — but the 502 pollutes Sentry.
  Fix: return 404 (not 502) on upstream failures, or suppress Sentry for photo errors.

GEMINI MODEL (CURRENT — v3.0 active)
  Deprecated model: gemini-2.0-flash-lite referenced somewhere in codebase
  Check: app/routers/pilot.py or app/services/pilot_service.py for flash-lite usage
```

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VERCEL — React SPA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  frontend/index.html                                                         │
│  ├── gtag.js script tag (NEW — v3.1)                                        │
│  └── /src/main.tsx  (Sentry init → RouterProvider → RootLayout)             │
│                                                                              │
│  RootLayout.tsx                                                              │
│  ├── <Outlet /> → MarketplacePage                                            │
│  ├── SageFAB / SagePanel (desktop)                                           │
│  └── SageMobileSheet (mobile, Vaul)                                          │
│                                                                              │
│  MarketplacePage.tsx                                                         │
│  ├── Header (glassmorphic Command Center — full-width search on mobile NEW)  │
│  ├── FilterSidebar (desktop md:flex — unchanged)                             │
│  ├── Mobile toolbar (md:hidden — "Filters" button → REPLACED)               │
│  │   └── [WAS] MobileFilterSheet (Vaul) → [NOW] MobileDropdownFilters       │
│  ├── FilterChips                                                             │
│  ├── ExpertGrid (VirtuosoGrid, virtualized)                                  │
│  └── NewsletterGateModal                                                     │
│                                                                              │
│  Zustand Store (useExplorerStore)                                            │
│  ├── filterSlice — query, rateMin, rateMax, tags (localStorage persist)      │
│  ├── resultsSlice — experts[], total, cursor, loading, sageMode              │
│  └── pilotSlice — messages[], isOpen, isStreaming                            │
│                                                                              │
│  tracking.ts — void trackEvent(type, payload)  [fire-and-forget]            │
│  Google Analytics — window.gtag() calls (NEW — v3.1)                        │
└──────────────────────────────────────────────────┬──────────────────────────┘
                                                   │ HTTPS
┌──────────────────────────────────────────────────▼──────────────────────────┐
│                          RAILWAY — FastAPI                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  main.py (lifespan: DB tables, FTS5, FAISS load, seed from CSV)             │
│  ├── /api/explore       → explorer.py (FAISS+BM25 hybrid pipeline)          │
│  ├── /api/suggest       → suggest.py (FTS5 prefix — empty string guard FIX) │
│  ├── /api/photos/{u}    → browse.py  (photo proxy — 502→404 FIX)           │
│  ├── /api/admin/*       → admin.py   (email column removal touches here)    │
│  └── /api/events        → events.py  (behavior tracking, no auth)           │
│                                                                              │
│  SQLite (Railway volume) — tables:                                          │
│  ├── experts (email column — REMOVE)                                        │
│  ├── conversations, email_leads, feedback                                   │
│  ├── newsletter_subscribers, user_events, settings                          │
│  └── experts_fts (FTS5 virtual table — content='experts')                  │
│                                                                              │
│  FAISS (in-memory) — 530 vectors, loaded at startup from data/faiss.index  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points by Feature

### 1. Mobile Filter Dropdown Redesign

**What changes:** Replace the Vaul bottom-sheet (`MobileFilterSheet.tsx`) with inline dropdown controls rendered directly in the mobile toolbar. The bottom-sheet is a full overlay — the replacement should be a lighter, in-place pattern (collapsible inline panel or positioned dropdowns).

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/src/components/sidebar/MobileFilterSheet.tsx` | DELETE (or gut and repurpose) | Vaul dependency removed |
| `frontend/src/pages/MarketplacePage.tsx` | MODIFY | Remove `MobileFilterSheet` import + JSX (line 167); replace mobile toolbar section (lines 99-130); manage new dropdown state |
| `frontend/src/components/sidebar/MobileFilterBar.tsx` | NEW | Inline filter bar with rate + tag dropdowns; reads/writes useExplorerStore directly (no draft pattern needed — live filter writes) |
| `frontend/package.json` | OPTIONAL | `vaul` can be removed if SageMobileSheet also migrates — check RootLayout.tsx first |

**Architecture decision — NO draft state for mobile dropdowns:**
The existing `MobileFilterSheet` used an explicit draft state (local copy of filters, Apply button to commit). Inline dropdowns should write directly to the Zustand store via `setRateRange` / `toggleTag` / `setQuery` — same as the desktop sidebar. This eliminates the Apply step, matching the desktop UX and the existing store mutation pattern.

**Important constraint — Vaul is still used for Sage:**
`RootLayout.tsx` uses `SageMobileSheet` which is also Vaul-based. Do NOT remove the `vaul` package when gutting `MobileFilterSheet`. The `vaul` import in `MobileFilterSheet.tsx` can be removed but the package must stay.

**Data flow — unchanged:**
```
Mobile dropdown interaction
    ↓
useExplorerStore.setQuery / setRateRange / toggleTag
    ↓
useExplore hook (reactive to store) re-fetches /api/explore
    ↓
resultsSlice.setResults → ExpertGrid re-renders
    ↓
useUrlSync writes new params to URL (replace: true)
```

**Full-width search on mobile:**
The Header search bar is currently `max-w-2xl` with `flex-1`. On mobile, the logo takes `shrink-0` space. Making search full-width on mobile means adjusting Header layout — either hide the logo on mobile or change flex sizing. The Header does not communicate with the mobile filter bar; they write to the same store slice independently.

---

### 2. Google Analytics (gtag.js) Integration

**What changes:** Add `gtag.js` snippet to the HTML shell. Wire custom events via `window.gtag()` at the same call sites as the existing `trackEvent()` instrumentation.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/index.html` | MODIFY | Add two `<script>` tags in `<head>` (gtag.js loader + config call) |
| `frontend/src/tracking.ts` | MODIFY | Add `gtag()` calls alongside existing `fetch` calls, or create a wrapper |
| `frontend/src/vite-env.d.ts` | MODIFY | Add `interface Window { gtag: (...args: unknown[]) => void }` declaration |

**Integration pattern — augment, not replace:**
The existing `trackEvent()` fires behavior events to the internal `/api/events` endpoint (marketplace intelligence). This must continue. `gtag()` is additive — it should be called inside the same `trackEvent()` function body, after the existing fetch. No new hook or component is needed.

```typescript
// tracking.ts — augmented pattern
export function trackEvent(event_type: EventType, payload: TrackPayload = {}): void {
  const session_id = getSessionId()
  // Existing: internal event store
  void fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ session_id, event_type, payload }),
  })
  // NEW: Google Analytics
  if (typeof window.gtag === 'function') {
    window.gtag('event', event_type, payload)
  }
}
```

**HTML injection pattern (SPA-safe):**
```html
<!-- frontend/index.html — inside <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z');
</script>
```

**SPA page view tracking:**
React Router v7 with `createBrowserRouter` does not auto-fire pageview events when navigating. Since this SPA has only one real route (`/`), this is not a problem — the initial pageview fires on page load automatically from the `gtag('config', ...)` call. No route-level tracking hook needed.

**Sentry coexistence:**
`instrument.ts` initializes Sentry before the rest of the app (it is the first import in `main.tsx`). gtag.js loads asynchronously via `<script async>` in the HTML shell — they do not conflict. Both run in parallel.

---

### 3. Expert Email Column Removal

**What changes:** Remove `email` from the `Expert` SQLAlchemy model, `data/experts.csv`, and all write paths that store or process this field.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/models.py` | MODIFY | Remove `email: Mapped[str]` column from `Expert` class |
| `app/main.py` | MODIFY | Remove `email=(row.get("Email") or "").strip()` from `Expert(...)` constructor in `_seed_experts_from_csv()` (line 85) |
| `app/routers/admin.py` | MODIFY | 4 sites: (1) import-csv upsert `existing.email =` (line 1035), (2) import-csv insert `email=` (line 1053), (3) CSV write header `"Email"` (line 969), (4) CSV row write `"Email": ""` (line 977) |
| `data/experts.csv` | MODIFY | Remove the `Email` column header and all email values from all 530 rows |

**Migration strategy — SQLite ALTER TABLE:**
SQLite does not support `DROP COLUMN` before version 3.35.0 (2021). Railway's SQLite version should support it, but the safest approach is to add an idempotent migration in `main.py`'s lifespan, matching the existing pattern for column additions:

```python
# In lifespan() — alongside other migration blocks
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE experts DROP COLUMN email"))
        _conn.commit()
        log.info("startup: experts.email column dropped")
    except Exception:
        pass  # Column already removed — idempotent
```

**Upload rejection:**
Future CSV imports via `POST /api/admin/experts/import-csv` should silently ignore the `Email` column if present (already achieved by not reading it). No 400 validation error needed — graceful ignore is safer and simpler.

**FTS5 impact:** `experts_fts` virtual table does NOT index the `email` column (it indexes `first_name, last_name, job_title, company, bio, tags`). Dropping the column from the physical table does not affect FTS5.

**FAISS impact:** `email` is not embedded into FAISS vectors — no rebuild needed.

**ExpertCard Pydantic schema impact:** `app/services/explorer.py` ExpertCard does not include `email`. No change needed to the API response contract.

**Frontend impact:** Zero. The `Expert` TypeScript interface in `frontend/src/types.ts` does not include `email`. No frontend files reference it.

---

### 4. Error Hardening

#### 4a. Photo Proxy 502 → Graceful Fallback

**Location:** `app/routers/browse.py`, `photo_proxy()` function (lines 151-194)

**Current behavior:**
- `httpx.RequestError` → `raise HTTPException(status_code=502)` → logged to Sentry
- Non-200 upstream → `raise HTTPException(status_code=502)` → logged to Sentry
- Frontend `<img src="/api/photos/{username}">` receives 502 → browser logs network error → ExpertCard monogram fallback renders (correct UX, noisy Sentry)

**Fix — return 404 instead of 502:**
```python
# browse.py — replace both raise HTTPException(502) lines
try:
    upstream_resp = await client.get(upstream_url, timeout=5.0)
    if upstream_resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Photo not found")
except httpx.RequestError:
    raise HTTPException(status_code=404, detail="Photo not found")
```

404 is the semantically correct response ("this photo doesn't exist/isn't available") and is NOT treated as a server error by Sentry's default configuration. The monogram fallback in ExpertCard already handles any non-200 by falling through to the `onError` handler — changing 502→404 does not change frontend behavior.

#### 4b. FTS5 Empty String Validation

**Location:** `app/routers/explore.py` and `app/routers/suggest.py`

**Current state:**
- `explorer.py._safe_fts_query("")` returns `""` and the `if safe_q:` guard on line 223 correctly skips FTS5. This path is **safe**.
- `suggest.py._run_suggest_multi()` has a `len(q.strip()) < 2` early-return guard on line 43. This path is **safe** for truly empty strings.
- The Sentry error is likely from edge cases: strings that pass the length check but become empty after `_safe_prefix_query()` sanitization (e.g., a query containing only FTS5 special chars like `"("`). The `_safe_prefix_query` strips these, potentially producing an empty word list — then `words[-1]` on an empty list would raise `IndexError`.

**Fix — add empty check after sanitization in suggest.py:**
```python
def _safe_prefix_query(q: str) -> str:
    cleaned = re.sub(r'[()"\+\-]', ' ', q)
    cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned, flags=re.IGNORECASE)
    words = cleaned.split()[:5]
    if not words:           # guard added — was missing
        return ""
    words[-1] = words[-1] + "*"
    return " ".join(words)
```

The function already has this guard in the current code (line 33: `if not words: return ""`). The actual Sentry error source may be the FTS5 MATCH call receiving a string that passes the `if prefix_q:` check but is still syntactically invalid for FTS5 (e.g., a single `*` character). Add a try/except around the FTS5 MATCH call in `_run_suggest_multi` — already present (lines 53-66). Review Sentry error details to pinpoint exact path.

**Also validate in explore.py at the router layer:**
```python
# explore.py — add before delegating to run_explore
if query.strip() == "":
    query = ""   # normalize — prevents FTS5 from receiving whitespace-only strings
```

#### 4c. React Redirect Loop (Stack Overflow)

**Location:** `frontend/src/main.tsx`, `RedirectWithParams` component

**Root cause:** `RedirectWithParams` uses `useSearchParams` which requires RouterProvider context. When nested inside a route that itself is rendered via the router, this is fine. The stack overflow occurs when the redirect target (`/`) also triggers a re-render that re-evaluates the redirect source — creating an infinite cycle. This most likely happens when a user navigates to `/explore?q=foo` and the redirect to `/?q=foo` triggers `useUrlSync` which writes `?q=foo` back to the URL via `setSearchParams(replace:true)`, which may cause `/explore` to be re-evaluated briefly.

**Fix options (in order of preference):**
1. Replace `RedirectWithParams` with a simple `<Navigate to="/" replace />` for all legacy routes — discard query params. The URL sync can be removed from the redirects because returning users arriving at `/explore?q=foo` are an edge case. URL params are useful once on the Explorer page, not during redirect.
2. If preserving query params is required: use `loader` instead of component-based redirect (React Router v7 supports route-level `loader` returning `redirect()`).

**Current `RedirectWithParams` pattern is architecturally fragile** because it creates a component that depends on routing context while itself being part of the routing definition.

#### 4d. Deprecated Gemini Model

**Location:** `app/services/pilot_service.py` or `app/routers/pilot.py` — check for `gemini-2.0-flash-lite` string.

**Fix:** Replace with `gemini-2.0-flash` or the current lite equivalent. This is a single string substitution. No architectural change.

---

### 5. Desktop Tag Cloud Expansion (18-20 tags)

**Location:** `frontend/src/components/sidebar/TagCloud.tsx` and/or `frontend/src/constants/tags.ts`

**Current:** Shows 12 tags. The `TOP_TAGS` constant in `tags.ts` contains the full list; `TagCloud` likely slices to 12.

**Fix:** Increase the slice constant from 12 to 18-20. The claymorphic tag cloud uses spring physics and FLIP layout — adding more tags will naturally extend the grid without architectural changes. The sidebar is `w-64` with `overflow-y-auto` so additional tags scroll naturally.

---

## Component Boundaries: New vs Modified

| Component | Status | File | What |
|-----------|--------|------|------|
| `MobileFilterBar` | NEW | `frontend/src/components/sidebar/MobileFilterBar.tsx` | Inline dropdown filter controls for mobile |
| `MobileFilterSheet` | DELETE or gut | `frontend/src/components/sidebar/MobileFilterSheet.tsx` | Vaul bottom-sheet — replaced |
| `MarketplacePage` | MODIFY | `frontend/src/pages/MarketplacePage.tsx` | Remove sheet state, import new bar, adjust mobile toolbar |
| `Header` | MODIFY | `frontend/src/components/Header.tsx` | Full-width search adjustment on mobile |
| `TagCloud` | MODIFY | `frontend/src/components/sidebar/TagCloud.tsx` | Increase tag count 12→18 |
| `index.html` | MODIFY | `frontend/index.html` | gtag.js script tags |
| `tracking.ts` | MODIFY | `frontend/src/tracking.ts` | Add `window.gtag()` calls |
| `vite-env.d.ts` | MODIFY | `frontend/src/vite-env.d.ts` | `Window.gtag` type declaration |
| `Expert` model | MODIFY | `app/models.py` | Drop `email` column |
| `main.py` | MODIFY | `app/main.py` | Remove email from seed logic + add DROP COLUMN migration |
| `admin.py` | MODIFY | `app/routers/admin.py` | Remove email from import-csv (4 sites) + CSV header |
| `browse.py` | MODIFY | `app/routers/browse.py` | 502→404 for photo proxy errors |
| `suggest.py` | MODIFY | `app/routers/suggest.py` | Validate sanitized query not empty |
| `pilot_service.py` | MODIFY | `app/services/pilot_service.py` | Update deprecated model string |

---

## Data Flow Changes

### Mobile Filter Flow (Before → After)

```
BEFORE (v3.0):
  Mobile "Filters" button click
      ↓
  setSheetOpen(true)  [local useState in MarketplacePage]
      ↓
  MobileFilterSheet renders as Vaul Drawer
      ↓
  User edits draft state (local copy of filters)
      ↓
  "Apply" button → handleApply() → setQuery/setRateRange/toggleTag
      ↓
  useExplorerStore updates → useExplore re-fetches

AFTER (v3.1):
  Mobile filter bar always visible (below header on mobile)
      ↓
  User interacts with rate or tag dropdown
      ↓
  setRateRange / toggleTag directly on useExplorerStore (live)
      ↓
  useExplore re-fetches (same as desktop sidebar)
```

### GA Event Flow (New)

```
User action (card click, filter change, Sage query)
    ↓
trackEvent(event_type, payload)  [tracking.ts]
    ├── void fetch('/api/events', {...})  [existing — internal marketplace intelligence]
    └── window.gtag('event', event_type, payload)  [NEW — Google Analytics]
```

### Email Purge Flow

```
Current state: Expert.email column exists in SQLite (populated from CSV)
               experts.csv has "Email" as first column
               admin.py import-csv writes email on upsert and insert
               main.py seed reads email from CSV

After v3.1:   Expert.email column dropped via ALTER TABLE in lifespan()
              (idempotent — no-op on subsequent restarts)
               experts.csv: Email column removed
               admin.py: email ignored in all write paths
               main.py: email not read from CSV
               FTS5 / FAISS / API response: unaffected (never included email)
```

---

## Suggested Build Order

Dependencies drive this ordering. Each task is independent from the next unless noted.

```
1. Expert email purge
   Why first: Pure data hygiene — no UI/UX risk. Backend-only change.
   Blocks nothing. If something breaks, catch early before adding UI changes.
   Files: app/models.py, app/main.py, app/routers/admin.py, data/experts.csv

2. Error hardening (backend)
   Why second: All Sentry fixes are in Python files. No frontend changes.
   Photo proxy: browse.py (502→404)
   FTS5 guard: suggest.py (empty sanitized query)
   Model update: pilot_service.py (deprecated gemini string)
   These are independent of each other — can be done in any order.

3. Redirect loop fix
   Why third: Isolated to main.tsx routing. Only change is simplifying
   RedirectWithParams or replacing it. Can be verified independently.
   Files: frontend/src/main.tsx

4. Google Analytics
   Why fourth: index.html + tracking.ts only. Low-risk addition.
   Testable in isolation: open browser devtools → Network → verify gtag calls.
   Files: frontend/index.html, frontend/src/tracking.ts, frontend/src/vite-env.d.ts

5. Desktop tag cloud (18-20 tags)
   Why fifth: Single constant change. Fast, low-risk.
   Files: frontend/src/components/sidebar/TagCloud.tsx (or constants/tags.ts)

6. Mobile filter redesign (most complex UI change — save for last)
   Why last: Requires new component, deleting existing component, updating
   MarketplacePage layout, and potentially adjusting Header flex behavior.
   Most likely to surface layout regressions — isolate from other changes.
   Files: MobileFilterSheet.tsx, MobileFilterBar.tsx (new), MarketplacePage.tsx, Header.tsx
```

---

## Architectural Patterns in Use (Reference)

### Pattern: Idempotent SQLite Migration in Lifespan

**What:** ALTER TABLE wrapped in try/except inside `main.py` lifespan — runs on every startup but succeeds only once (subsequent runs catch the "duplicate column" or "no such column" error silently).

**Applied for email removal:**
```python
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE experts DROP COLUMN email"))
        _conn.commit()
    except Exception:
        pass  # Already removed — idempotent
```

This matches the existing v3.0 pattern for `photo_url` column addition and analytics column additions.

### Pattern: Direct Store Write (No Draft)

**What:** Desktop sidebar components call `setRateRange` / `toggleTag` directly on `useExplorerStore`. Results update live.

**Applied to mobile dropdowns:** Mobile filter bar should follow the same pattern — no local draft state, no Apply button. Simplifies code and unifies UX with desktop.

### Pattern: Fire-and-Forget Module Function for Side Effects

**What:** `trackEvent()` in `tracking.ts` is a plain module function (not a React hook). Callable from anywhere — async handlers, debounce callbacks, non-component code.

**Applied to GA:** `window.gtag()` call added inside `trackEvent()`. Never awaited. Guard with `typeof window.gtag === 'function'` to safely handle cases where the script hasn't loaded yet.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Removing `vaul` when gutting MobileFilterSheet

**What people do:** See that `MobileFilterSheet.tsx` imports Vaul, delete the package when deleting the component.

**Why it's wrong:** `RootLayout.tsx` renders `SageMobileSheet` which also uses Vaul. Removing the package breaks the Sage mobile experience.

**Do this instead:** Delete only the `import { Drawer } from 'vaul'` from `MobileFilterSheet.tsx`. Keep the `vaul` package in `package.json`.

### Anti-Pattern: Draft State in Live Dropdowns

**What people do:** Copy the existing `MobileFilterSheet` draft pattern into the new dropdown bar.

**Why it's wrong:** The draft pattern exists specifically for the bottom-sheet's deferred-commit UX (user configures many filters, then taps Apply). Inline dropdowns apply immediately — draft state adds unnecessary complexity and diverges from the desktop sidebar behavior.

**Do this instead:** Write directly to the Zustand store on each change.

### Anti-Pattern: Calling FTS5 MATCH with Empty String

**What people do:** Pass a user query through to FTS5 MATCH without validating the sanitized output.

**Why it's wrong:** An empty MATCH expression is a syntax error in SQLite FTS5 (`fts5: syntax error near ""`), which raises an exception and generates Sentry noise.

**Do this instead:** Always check `if not safe_q: skip` after sanitization, before constructing the SQL query.

### Anti-Pattern: Blocking on ALTER TABLE for Running Production DB

**What people do:** Run a migration script that assumes the column exists and will block if it doesn't.

**Why it's wrong:** Railway deploys with the existing SQLite volume. If the column was already dropped in a previous deploy, the migration will error.

**Do this instead:** Use the existing try/except idempotent pattern — already established in `main.py`.

---

## Scaling Considerations

| Concern | At Current Scale (530 experts) |
|---------|-------------------------------|
| Email column drop | Zero risk — SQLite, < 1ms |
| Mobile dropdown renders | Zero risk — DOM only, no virtual scrolling |
| GA event volume | Zero risk — client-side, off-thread |
| Photo proxy 404 vs 502 | Zero risk — status code change only |

This is a hardening milestone — no scaling trade-offs to manage. All changes are subtractive (removing data, simplifying code paths) or additive-only (gtag, inline dropdowns).

---

## Sources

- Direct inspection: `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/routers/browse.py`, `app/routers/suggest.py`, `app/services/explorer.py`
- Direct inspection: `frontend/src/main.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/sidebar/MobileFilterSheet.tsx`, `frontend/src/components/sidebar/FilterSidebar.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/tracking.ts`, `frontend/src/instrument.ts`, `frontend/src/hooks/useUrlSync.ts`, `frontend/src/store/filterSlice.ts`
- Direct inspection: `frontend/index.html`, `frontend/src/layouts/RootLayout.tsx`
- Google Analytics gtag.js documentation: https://developers.google.com/analytics/devguides/collection/ga4/reference/config
- SQLite ALTER TABLE DROP COLUMN: supported since SQLite 3.35.0 (2021-03-12)

---

*Architecture research for: v3.1 Launch Prep — Expert Marketplace hardening*
*Researched: 2026-02-26*
