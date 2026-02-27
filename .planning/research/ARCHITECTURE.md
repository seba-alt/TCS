# Architecture Research: v4.0 Public Launch

**Domain:** Expert Marketplace SPA — feature integration for public launch
**Researched:** 2026-02-27
**Confidence:** HIGH — all findings from direct codebase inspection of v3.1 source
**Scope:** v4.0 feature integration only. Existing v3.1 system is ground truth. Only deltas documented.

---

## Context: v3.1 Ground Truth (verified by file inspection)

```
ROUTING  (frontend/src/main.tsx)
  /             -> MarketplacePage (inside RootLayout)
  /admin/*      -> AdminApp (protected via RequireAuth — sessionStorage 'admin_key')
  /admin/login  -> LoginPage (unauthenticated)
  /admin        -> OverviewPage (index)
  /admin/gaps, /admin/leads, /admin/experts, /admin/settings  -> standalone pages
  /admin/tools  -> ToolsPage (hash-driven: #search-lab, #score-explainer, #index)
  /admin/data   -> DataPage (tab: marketplace|intelligence)
  /admin/intelligence -> IntelligenceDashboardPage

AUTH MECHANISM  (current — v3.1)
  LoginPage:    POST /api/admin/auth { key } → 200 → sessionStorage.setItem('admin_key', key)
  RequireAuth:  sessionStorage.getItem('admin_key') → null → redirect /admin/login
  adminFetch:   headers: { 'X-Admin-Key': sessionStorage.getItem('admin_key') }
  Backend dep:  _require_admin() reads ADMIN_SECRET env var — single secret, no users table

ZUSTAND STORE  (frontend/src/store/)
  index.ts:       createFilterSlice + createResultsSlice + createPilotSlice + persist middleware
  filterSlice.ts: query, rateMin, rateMax, tags[], sortBy, savedExperts[], savedFilter
                  — persisted to localStorage under 'explorer-filters'
  resultsSlice.ts: experts[], total, cursor, loading, sageMode — NOT persisted
  pilotSlice.ts:   messages[], isOpen, isStreaming, sessionId — NOT persisted
  nltrStore.ts:    subscribed, email — separate Zustand persist key 'nltr-store'

EXPERT DATA SHAPE  (app/services/explorer.py ExpertCard, frontend/src/store/resultsSlice.ts Expert)
  Backend Pydantic ExpertCard fields: username, first_name, last_name, job_title, company,
    hourly_rate, currency, profile_url, photo_url, tags[], findability_score, category,
    faiss_score, bm25_score, final_score, match_reason
  Frontend Expert interface: subset — username, first_name, last_name, job_title, company,
    hourly_rate, currency, profile_url, photo_url, tags[], findability_score, match_reason
  Note: tags[] is a JSON array of AI-assigned domain tags (strings). category is a separate
    keyword-matched field (Finance, Marketing, Tech, etc.). Industry tags are NEW in v4.0.

EXPLORE PIPELINE  (app/services/explorer.py run_explore)
  Stage 1: SQLAlchemy pre-filter by hourly_rate range + AND-logic tag containment (LIKE "%tag%")
  Stage 2: FAISS IDSelectorBatch semantic search (skipped in pure-filter mode)
  Stage 3: FTS5 BM25 keyword scoring (skipped in pure-filter mode)
  Fusion: FAISS*0.7 + BM25*0.3, then findability boost ±20%, then feedback boost

EXPERT GRID  (frontend/src/components/marketplace/ExpertGrid.tsx)
  Uses VirtuosoGrid — requires uniform item heights (current cards: h-[180px] fixed)
  Data source: useExplorerStore (s) => s.experts
  List view would share SAME data source — only rendering differs

ADMIN AUTH FLOW  (current)
  LoginPage: single password field, no username
  Frontend: sessionStorage key expires on tab close
  Backend: ADMIN_SECRET env var — plain string comparison in _require_admin()
  No session tokens, no refresh tokens, no expiry TTL

SQLite TABLES  (app/models.py)
  experts:              id, username, email, first_name, last_name, job_title, company, bio,
                        hourly_rate, currency, profile_url, profile_url_utm, category, tags,
                        findability_score, photo_url, created_at
                        ← no industry_tags column yet
  conversations:        id, email, query, history, response_type, response_narrative,
                        response_experts, created_at, top_match_score, gap_resolved,
                        hyde_triggered, feedback_applied, hyde_bio, otr_at_k, source
  user_events:          id, session_id, event_type, payload (JSON), created_at
  newsletter_subscribers: id, email, source, created_at
  email_leads:          id, email, created_at
  feedback:             id, conversation_id, vote, email, expert_ids, reasons, comment, created_at
  settings:             key (PK), value, updated_at
  experts_fts:          FTS5 virtual table (content='experts') — indexes bio, job_title, etc.
```

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          VERCEL — React SPA (v4.0 state)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  main.tsx (RouterProvider — lazy-loaded admin routes NEW)                    │
│  ├── /  → RootLayout → MarketplacePage                                       │
│  │   ├── Header (search bar: white input bg NEW, keyword placeholders NEW)   │
│  │   ├── FilterSidebar (desktop) — tag cloud: industry tags NEW              │
│  │   ├── MobileInlineFilters — industry tags in TagPickerSheet NEW           │
│  │   ├── FilterChips                                                         │
│  │   ├── ExpertGrid (VirtuosoGrid) ←─┐ same data, toggle between views      │
│  │   └── ExpertList (NEW)  ←─────────┘ viewMode: 'grid'|'list' in filterSlice│
│  │                                                                           │
│  └── /admin/* → RequireAuth → AdminApp (sidebar simplified NEW)             │
│      ├── /admin/login → LoginPage (username+password fields NEW)            │
│      ├── /admin → OverviewPage (one-snap simplified NEW)                    │
│      ├── /admin/leads → LeadsPage + leads export (user_events JOIN NEW)     │
│      ├── /admin/experts → ExpertsPage + CSV import (improved)               │
│      └── /admin/tools → ToolsPage (Search Lab, Index — Score Explainer kept │
│                                    or removed per simplification scope)      │
│                                                                              │
│  Zustand Store                                                               │
│  ├── filterSlice — query, rateMin, rateMax, tags[], industryTags[] NEW,     │
│  │                 sortBy, savedExperts[], savedFilter, viewMode NEW          │
│  ├── resultsSlice — experts[], total, cursor, loading, sageMode             │
│  └── pilotSlice — messages[], isOpen, isStreaming, sessionId                │
│                                                                              │
│  Code splitting (NEW): admin routes lazy-loaded via React.lazy + Suspense  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
┌───────────────────────────────────▼──────────────────────────────────────────┐
│                          RAILWAY — FastAPI (v4.0 state)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  main.py (lifespan: DB migration adds industry_tags column NEW)              │
│  ├── /api/explore   → explorer.py (industry_tags filter stage NEW)          │
│  ├── /api/admin/auth → POST { username, password } hashed verification NEW  │
│  ├── /api/admin/*   → all protected by X-Admin-Key (token-based NEW)        │
│  │   ├── /export/leads.csv     — joins user_events + newsletter NEW         │
│  │   └── /experts              — industry_tags field NEW                    │
│  ├── /api/events    → events.py (no auth, unchanged)                        │
│  └── /api/photos/{u} → browse.py (unchanged)                               │
│                                                                              │
│  SQLite (Railway volume) — v4.0 adds:                                       │
│  ├── experts.industry_tags (TEXT nullable — JSON array, idempotent migration)│
│  └── admin_users (id, username, hashed_password) OR env var approach        │
│                                                                              │
│  FAISS (in-memory) — 530 vectors, unchanged for v4.0 (tags are domain-only)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points by Feature

### 1. Admin Auth: Username + Password with Hashed Credentials

**Current state:** Single-field login (`key` = raw string), stored in `sessionStorage` on success. Backend compares against `ADMIN_SECRET` env var. No username, no hashing, no expiry.

**What v4.0 needs:** Username + password login form, bcrypt-hashed credentials stored securely, session expiry (auto-logout after inactivity or fixed TTL).

**Architecture decision — env var approach (not DB table):**

Introducing a `admin_users` DB table would require a bootstrap problem (how do you create the first user?). The cleaner approach for a single-admin system: store `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` as Railway env vars. This keeps credentials out of the DB, avoids schema migration complexity, and requires zero seeding logic.

```python
# app/routers/admin.py — new AuthBody
class AuthBody(BaseModel):
    username: str
    password: str

@auth_router.post("/auth")
def authenticate(body: AuthBody):
    expected_username = os.getenv("ADMIN_USERNAME", "")
    password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")  # bcrypt hash
    if not expected_username or not password_hash:
        raise HTTPException(status_code=503, detail="Auth not configured")
    if body.username != expected_username:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(body.password.encode(), password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Return a session token (short-lived signed value or just OK + client-side TTL)
    return {"ok": True}
```

**Session state — where it lives:**

Option A (recommended): Keep sessionStorage but add a client-side expiry timestamp. On login success, write `sessionStorage.setItem('admin_key', key)` AND `sessionStorage.setItem('admin_expires', Date.now() + TTL_MS)`. `RequireAuth` checks both — if expired, clears and redirects to login.

Option B: Server-issued JWT token. More complex, requires token storage and refresh logic. Overkill for single-admin panel.

**Recommended: Option A** — minimal change surface. sessionStorage already provides tab-close logout (secure). Adding a TTL check in `RequireAuth` and `adminFetch` gives session expiry without new infrastructure.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/src/admin/LoginPage.tsx` | MODIFY | Add `username` field; send `{ username, password }`; store expiry timestamp |
| `frontend/src/admin/RequireAuth.tsx` | MODIFY | Check `admin_expires` timestamp in addition to key presence |
| `frontend/src/admin/hooks/useAdminData.ts` | MODIFY | `adminFetch` checks expiry before sending; auto-logout on 401 response |
| `app/routers/admin.py` | MODIFY | `AuthBody` adds `username`; compare against `ADMIN_USERNAME` env var; add bcrypt check |
| `app/main.py` requirements | MODIFY | Add `bcrypt` to `requirements.txt` |
| Railway env vars | NEW | Add `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (bcrypt hash of chosen password) |

**What does NOT change:**
- The `X-Admin-Key` header mechanism on all protected endpoints — keep exactly as-is. The "key" value stored in sessionStorage becomes the actual ADMIN_SECRET value (unchanged). The improvement is only in the login form (username + hashed password verification) and session expiry.
- All `_require_admin` dependency logic — unchanged.
- `auth_router` / `router` split in admin.py — unchanged.

**Important constraint:** The existing `ADMIN_SECRET` env var controls what value gets checked by `_require_admin`. This stays. The new `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` env vars are only used by the `/api/admin/auth` endpoint to verify the login form submission. On success, the frontend still stores the `ADMIN_SECRET` value (which it already knows from successful auth — or the backend returns it, or the admin enters it in the password field and the backend verifies it's the hash of ADMIN_SECRET). The cleanest model: the password IS the ADMIN_SECRET, and the backend verifies `bcrypt.checkpw(body.password, ADMIN_PASSWORD_HASH)` + `body.username == ADMIN_USERNAME`. The stored session key is still the raw password (ADMIN_SECRET) — `_require_admin` still works unchanged.

---

### 2. List View Toggle Alongside VirtuosoGrid

**Current state:** `ExpertGrid.tsx` renders a `VirtuosoGrid` (CSS grid, 2-col mobile / 3-col desktop). All 530 experts are paginated via cursor-based infinite scroll. `experts[]` lives in `resultsSlice`.

**What v4.0 needs:** A toggle button (grid icon / list icon) that switches between the existing grid card layout and a compact list layout (one expert per row, denser information).

**Architecture decision — shared data, view-mode flag in filterSlice:**

Both views consume `experts[]` from `resultsSlice` — no separate fetch, no data duplication. A `viewMode: 'grid' | 'list'` field in `filterSlice` (persisted to localStorage so user preference is remembered) controls which renderer mounts.

```typescript
// filterSlice.ts — add to FilterSlice interface
viewMode: 'grid' | 'list'
setViewMode: (mode: 'grid' | 'list') => void
```

**Rendering architecture — conditional mount:**

```tsx
// ExpertGrid.tsx or MarketplacePage.tsx
{viewMode === 'grid' ? (
  <ExpertGrid experts={experts} ... />
) : (
  <ExpertList experts={experts} loading={loading} onEndReached={loadNextPage} onViewProfile={onViewProfile} />
)}
```

**ExpertList component:** A new `frontend/src/components/marketplace/ExpertList.tsx`. For virtual scrolling in list view, use `Virtuoso` (not `VirtuosoGrid`) — list items are variable height, and `Virtuoso` handles that correctly. The `VirtuosoGrid` assumption of uniform heights does not apply to list rows.

**Critical constraint — VirtuosoGrid uniform height:** Do NOT try to make VirtuosoGrid display list-style rows. `VirtuosoGrid` is specifically designed for uniform-height grid items. List rows would have variable heights (different bio lengths, tag counts), which breaks VirtuosoGrid's internal measurement. Use `Virtuoso` for the list view.

**Toggle button placement:** In the `FilterChips` strip (desktop) and the `MobileInlineFilters` bar (mobile), or in the Header. A dedicated toolbar above the grid is the simplest placement — does not require touching the sidebar or filter logic.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/src/store/filterSlice.ts` | MODIFY | Add `viewMode` field + `setViewMode` action; add to `partialize` persist list |
| `frontend/src/store/index.ts` | MODIFY | Export `viewMode` + `setViewMode` from `useFilterSlice` hook |
| `frontend/src/components/marketplace/ExpertList.tsx` | NEW | Virtuoso-based list renderer; `ExpertListRow` sub-component |
| `frontend/src/components/marketplace/ExpertGrid.tsx` | NONE | Unchanged — purely consumed by parent |
| `frontend/src/pages/MarketplacePage.tsx` | MODIFY | Read `viewMode`; render `ExpertGrid` OR `ExpertList`; render toggle button |

**Data flow — identical for both views:**

```
useExplore hook (reads filterSlice, calls /api/explore)
    ↓
resultsSlice.setResults(experts, total, cursor)
    ↓
MarketplacePage reads experts from store
    ↓
viewMode === 'grid' → ExpertGrid (VirtuosoGrid)
viewMode === 'list' → ExpertList (Virtuoso)
Both call onEndReached → loadNextPage (same infinite scroll)
```

---

### 3. Industry Tags as a New Data Dimension

**Current state:** `Expert` model has `tags` (TEXT, JSON array of domain tags — AI-assigned, e.g. "fundraising", "digital marketing"). `category` is a separate keyword-matched bucket (Finance, Marketing, etc.). The frontend `filterSlice.tags[]` filters by domain tags.

**What v4.0 needs:** A second tag dimension — "industry tags" representing the vertical/sector (e.g. "FinTech", "HealthTech", "Retail", "B2B SaaS"). These are displayed separately from domain tags in the tag cloud and filterable independently.

**Architecture decision — new column, not reuse existing tags:**

Industry tags are semantically distinct from domain tags (domain = skill/expertise, industry = sector/vertical). Storing them separately makes filtering unambiguous and avoids polluting the existing domain tag search logic.

**Schema change — new column in experts table:**

```python
# app/models.py — add to Expert class
industry_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
# JSON array of industry strings: ["FinTech", "HealthTech"]
```

Migration in `main.py` lifespan (idempotent):

```python
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE experts ADD COLUMN industry_tags TEXT"))
        _conn.commit()
        log.info("startup: experts.industry_tags column added")
    except Exception:
        pass  # Column already exists — idempotent
```

**How they relate to existing domain tags:**

| Dimension | Column | Example Values | Filter Logic | Used in FAISS? |
|-----------|--------|----------------|--------------|----------------|
| Domain tags | `tags` (existing) | "fundraising", "saas" | AND-logic containment filter in explore pipeline | YES — embedded in vectors |
| Industry tags | `industry_tags` (NEW) | "FinTech", "B2B SaaS" | AND-logic containment filter, additive to domain tag filter | NO — FAISS not rebuilt |
| Category | `category` (existing) | "Finance", "Tech" | Used by admin classification only, not exposed as filter | NO |

**Industry tags are NOT embedded in FAISS vectors** — adding the column does not require rebuilding the FAISS index. The tagging pipeline (`scripts/tag_experts.py`) would need a new prompt to assign industry tags, but that is a separate data pipeline task from the architecture integration.

**Frontend changes:**

The `filterSlice` needs a second tag array:

```typescript
// filterSlice.ts
industryTags: string[]      // selected industry tag filters
toggleIndustryTag: (tag: string) => void
setIndustryTags: (tags: string[]) => void
```

The `TagCloud` component in the desktop sidebar needs to show BOTH tag types. Options:
- Two separate sections in the sidebar: "Skills" + "Industries"
- A single tag cloud with visual differentiation (color/shape)

The simpler approach: two separate tag cloud sections in the sidebar, each with their own `TOP_INDUSTRY_TAGS` constant (similar to the existing `TOP_TAGS` constant in `constants/tags.ts`).

**Backend filter integration in explorer.py:**

The `run_explore` function adds industry tag filtering in Stage 1 alongside existing tag filtering:

```python
# Stage 1 addition in run_explore()
for industry_tag in industry_tags:
    stmt = stmt.where(Expert.industry_tags.like(f'%"{industry_tag}"%'))
```

The `/api/explore` endpoint signature gains a new `industry_tags` parameter.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/models.py` | MODIFY | Add `industry_tags: Mapped[str | None]` column |
| `app/main.py` | MODIFY | Add idempotent `ALTER TABLE experts ADD COLUMN industry_tags` migration |
| `app/services/explorer.py` | MODIFY | Add `industry_tags: list[str]` parameter to `run_explore()`; add Stage 1 filter loop |
| `app/routers/explore.py` | MODIFY | Accept `industry_tags` query param; pass to `run_explore()` |
| `app/routers/admin.py` | MODIFY | Include `industry_tags` in `_serialize_expert()`; accept in `AddExpertBody`; handle in `import-csv` |
| `frontend/src/store/filterSlice.ts` | MODIFY | Add `industryTags`, `toggleIndustryTag`, `setIndustryTags` |
| `frontend/src/store/index.ts` | MODIFY | Export new fields from `useFilterSlice` hook |
| `frontend/src/hooks/useExplore.ts` | MODIFY | Read `industryTags` from store; pass as `industry_tags` param to `/api/explore` |
| `frontend/src/constants/tags.ts` | MODIFY | Add `TOP_INDUSTRY_TAGS` export (curated list) |
| `frontend/src/components/sidebar/TagCloud.tsx` | MODIFY | Render industry tag section separately |
| `frontend/src/components/marketplace/MobileInlineFilters.tsx` | MODIFY | Add industry tags to TagPickerSheet |
| `frontend/src/store/resultsSlice.ts` | MODIFY | Add `industry_tags: string[] | null` to `Expert` interface |

---

### 4. Lead Export Joining user_events + newsletter_subscribers

**Current state:**

- `/api/admin/leads` returns email-grouped data from `conversations` table (chat search history, gap counts). No click history, no newsletter join.
- `/api/admin/newsletter-subscribers` returns newsletter subscriber list separately.
- `/api/admin/export/searches.csv` exports raw `conversations` rows.
- No single export unifies profile view clicks + newsletter sign-ups + search history.

**What v4.0 needs:** A unified lead export that combines:
1. Newsletter subscribers (from `newsletter_subscribers` table)
2. Profile click activity (from `user_events` where `event_type = 'card_click'`)
3. Search history (from `conversations` table, email-keyed)

**Architecture decision — new endpoint, not modifying existing /leads:**

Existing `/api/admin/leads` is used by `LeadsPage.tsx` and should not be broken. Add a new endpoint `/api/admin/export/leads.csv` that performs the join.

**SQL join pattern:**

```python
# New endpoint: GET /api/admin/export/leads.csv
# The three tables are linked only by email (conversations.email, newsletter_subscribers.email)
# user_events uses session_id — no direct email link unless we correlate via newsletter subscription timing

# Practical approach: export as separate enriched sections
# Section 1: newsletter subscribers with click count (by session proximity — approximate)
# Section 2: all unique chat emails with search count, gap count, last search date
# Join: newsletter_subscribers LEFT JOIN conversations ON email
```

The key architectural challenge: `user_events` stores `session_id` (not email). There is no direct FK between `user_events` and `newsletter_subscribers`. The export can:

1. Export newsletter subscribers enriched with their conversation history (email join on `conversations`)
2. Export card click aggregates by expert_id (from `user_events`) as a separate sheet/section

This is the pragmatic approach — no fake join between session-keyed events and email-keyed leads.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/routers/admin.py` | ADD | New `GET /export/leads.csv` endpoint; joins `newsletter_subscribers` LEFT JOIN `conversations` on email |
| `frontend/src/admin/pages/LeadsPage.tsx` | MODIFY | Add "Export Leads CSV" button that calls new endpoint |
| `frontend/src/admin/hooks/useAdminExport.ts` | MODIFY | Add `exportLeadsCsv()` function |

---

### 5. Admin Dashboard Simplification

**Current state:** 8 nav items across 3 sections:
- Analytics: Overview, Gaps, Intelligence, Data
- Tools: Tools (Search Lab, Score Explainer, Index)
- Admin: Experts, Leads, Settings

**What v4.0 needs:** Fewer nav items, one-snap overview. The "Score Explainer" and/or other low-use tools pages may be removed or merged.

**Architecture decision — audit before delete:**

The Score Explainer page (`ScoreExplainerPage.tsx`) is a sub-tab of `ToolsPage` (hash-driven navigation). Removing it requires:
1. Deleting the component file
2. Removing its hash case from `ToolsPage.tsx`
3. Removing its `<Navigate>` redirect entry from `main.tsx`

The `GapsPage` and `SearchesPage` (sub-tab of DataPage) are used in the lead tracking flow (LeadsPage has a "Searches →" link navigating to `/admin/data#searches`). Removing these would break that cross-page link.

**Recommended simplification:**
- Keep: Overview, Leads, Experts, Tools (Search Lab + Index), Settings
- Merge/remove: Gaps (fold into OverviewPage as a card), Intelligence (fold key OTR@K metric into OverviewPage), Data page (demote searches to Leads page)
- Remove: Score Explainer standalone tool

**OverviewPage one-snap approach:** The current OverviewPage already has health status, top queries, Sage volume. For "one-snap" — add a "Unmet Demand" section (currently in a separate Gaps page) and a "Quick Stats" for expert count and leads.

**Touch points (minimal — this is largely cosmetic/structural):**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/src/admin/components/AdminSidebar.tsx` | MODIFY | Remove nav items per simplification decision |
| `frontend/src/admin/pages/OverviewPage.tsx` | MODIFY | Add unmet demand card, simplify or expand layout |
| `frontend/src/main.tsx` | MODIFY | Remove route entries for deleted pages; adjust redirects |
| Pages to delete | DELETE | `ScoreExplainerPage.tsx` and/or others per final decision |

---

### 6. Performance Optimization: Code Splitting and Lazy Loading

**Current state:** `main.tsx` imports ALL admin page components at the top level:

```typescript
import OverviewPage from './admin/pages/OverviewPage.tsx'
import GapsPage from './admin/pages/GapsPage.tsx'
import LeadsPage from './admin/pages/LeadsPage.tsx'
// ... 8 more static imports
```

This means the initial bundle includes all admin page code — Recharts, admin-specific logic, etc. — even for users who never visit `/admin`.

**What v4.0 needs:** Admin routes lazy-loaded so the main bundle for public users does not include admin code.

**Architecture decision — React.lazy + Suspense on admin routes:**

React Router v7 with `createBrowserRouter` supports lazy loading via `React.lazy()` and route-level `lazy` property. The simplest approach compatible with the existing router structure is `React.lazy` on the component imports.

```typescript
// main.tsx — lazy-loaded admin imports
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))
const OverviewPage = lazy(() => import('./admin/pages/OverviewPage.tsx'))
const LeadsPage = lazy(() => import('./admin/pages/LeadsPage.tsx'))
// ... all admin pages

// Wrap RequireAuth's children in Suspense
{
  path: '/admin',
  element: <RequireAuth />,
  children: [
    {
      element: (
        <Suspense fallback={<AdminLoadingFallback />}>
          <AdminApp />
        </Suspense>
      ),
      children: [
        { index: true, element: <Suspense fallback={null}><OverviewPage /></Suspense> },
        // ...
      ]
    }
  ]
}
```

**Vite automatic chunking:** Vite's default Rollup config already splits dynamic imports into separate chunks. Using `React.lazy` with dynamic `import()` syntax is sufficient — no manual `rollupOptions.output.manualChunks` needed.

**What this achieves:** The main bundle (for public users on `/`) no longer includes Recharts, admin page logic, or any admin-specific dependencies. Estimated bundle reduction: 30-50% for public users based on the admin page complexity seen in the codebase.

**Touch points:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `frontend/src/main.tsx` | MODIFY | Convert all admin page imports to `React.lazy()` dynamic imports; wrap routes in `Suspense` |
| `frontend/vite.config.ts` | NO CHANGE | Vite handles chunking automatically |

---

## Component Boundaries: New vs Modified

| Component | Status | File | What |
|-----------|--------|------|------|
| `LoginPage` | MODIFY | `frontend/src/admin/LoginPage.tsx` | Add username field; expiry timestamp on login |
| `RequireAuth` | MODIFY | `frontend/src/admin/RequireAuth.tsx` | Check expiry timestamp; auto-logout on expiry |
| `useAdminData` | MODIFY | `frontend/src/admin/hooks/useAdminData.ts` | 401 handler → auto-logout; expiry check in `adminFetch` |
| `ExpertList` | NEW | `frontend/src/components/marketplace/ExpertList.tsx` | Virtuoso-based dense list view for experts |
| `filterSlice` | MODIFY | `frontend/src/store/filterSlice.ts` | Add `viewMode`, `industryTags`, `toggleIndustryTag`, `setIndustryTags` |
| `useExplore` | MODIFY | `frontend/src/hooks/useExplore.ts` | Pass `industryTags` to `/api/explore` |
| `TagCloud` | MODIFY | `frontend/src/components/sidebar/TagCloud.tsx` | Second industry tag section |
| `MobileInlineFilters` | MODIFY | `frontend/src/components/marketplace/MobileInlineFilters.tsx` | Add industry tags to TagPickerSheet |
| `MarketplacePage` | MODIFY | `frontend/src/pages/MarketplacePage.tsx` | Grid/list toggle button; conditional ExpertGrid vs ExpertList |
| `constants/tags.ts` | MODIFY | `frontend/src/constants/tags.ts` | Add `TOP_INDUSTRY_TAGS` export |
| `Expert` interface | MODIFY | `frontend/src/store/resultsSlice.ts` | Add `industry_tags` field |
| `LeadsPage` | MODIFY | `frontend/src/admin/pages/LeadsPage.tsx` | Add "Export Leads CSV" button |
| `AdminSidebar` | MODIFY | `frontend/src/admin/components/AdminSidebar.tsx` | Remove items per simplification |
| `OverviewPage` | MODIFY | `frontend/src/admin/pages/OverviewPage.tsx` | Add unmet demand card; simplify |
| `main.tsx` | MODIFY | `frontend/src/main.tsx` | Lazy-load admin routes; adjust routing after simplification |
| `Expert` model | MODIFY | `app/models.py` | Add `industry_tags` column |
| `main.py` | MODIFY | `app/main.py` | Idempotent `industry_tags` column migration |
| `admin.py` | MODIFY | `app/routers/admin.py` | Auth: username+password; new export/leads.csv endpoint; industry_tags in expert serialization |
| `explorer.py` | MODIFY | `app/services/explorer.py` | Add `industry_tags` filter parameter and Stage 1 loop |
| `explore.py` router | MODIFY | `app/routers/explore.py` | Accept `industry_tags` query param |

---

## Data Flow Changes

### Auth Flow (Before → After)

```
BEFORE (v3.1):
  LoginPage: single "Admin Key" field
      ↓
  POST /api/admin/auth { key }
      ↓
  Backend: key === ADMIN_SECRET  (plain string compare)
      ↓
  sessionStorage.setItem('admin_key', key)
      ↓
  RequireAuth: key !== null → allow
  adminFetch: X-Admin-Key header = sessionStorage value

AFTER (v4.0):
  LoginPage: "Username" + "Password" fields
      ↓
  POST /api/admin/auth { username, password }
      ↓
  Backend: username === ADMIN_USERNAME AND bcrypt.checkpw(password, ADMIN_PASSWORD_HASH)
      ↓
  sessionStorage.setItem('admin_key', password)  ← value is still ADMIN_SECRET (the password)
  sessionStorage.setItem('admin_expires', Date.now() + 8*3600*1000)  ← 8h TTL
      ↓
  RequireAuth: key !== null AND expires > Date.now() → allow
  adminFetch: X-Admin-Key = key (unchanged); if 401 → clear session, redirect login
```

### Industry Tag Filter Flow (New)

```
User selects industry tag in sidebar or TagPickerSheet
    ↓
store.toggleIndustryTag(tag)  [filterSlice]
    ↓
useExplore re-fires (industry_tags in dep array)
    ↓
GET /api/explore?...&industry_tags=FinTech,HealthTech
    ↓
explorer.py Stage 1: Expert.industry_tags LIKE '%"FinTech"%' AND LIKE '%"HealthTech"%'
    ↓
setResults(filtered_experts, ...)  → grid/list re-renders
```

### List View Toggle Flow (New)

```
User clicks grid/list toggle button
    ↓
store.setViewMode('list' | 'grid')  [filterSlice — persisted]
    ↓
MarketplacePage conditional render:
  viewMode === 'grid' → <ExpertGrid /> (VirtuosoGrid)
  viewMode === 'list' → <ExpertList /> (Virtuoso)
Both components read same experts[] from resultsSlice
Both call loadNextPage on endReached (same infinite scroll)
No API call triggered — only renderer switches
```

---

## Suggested Build Order

Dependencies drive this ordering. Numbers represent suggested phase groupings.

```
1. Admin auth upgrade (username + password + expiry)
   Why first: Security-critical; backend + frontend touch. Complete before any
   other admin work so all subsequent testing uses the new auth flow.
   Blocks: nothing else. Can be developed in isolation.
   Files: admin.py (auth endpoint), LoginPage.tsx, RequireAuth.tsx, useAdminData.ts

2. Industry tags — schema + backend filter
   Why second: Schema migration must land before frontend can send industry_tags param.
   Backend work: models.py (column), main.py (migration), explorer.py (filter), explore.py (param)
   This does NOT require admin UI yet — deploy schema first, then add UI.
   Blocks: frontend industry tag filter UI

3. Industry tags — frontend UI (after schema is deployed)
   filterSlice (add industryTags), useExplore (param), TagCloud (2nd section),
   MobileInlineFilters (TagPickerSheet), constants/tags.ts (TOP_INDUSTRY_TAGS)
   Blocks: nothing else

4. Grid/list view toggle
   Why after schema: Does not depend on industry tags, but benefits from having
   industry_tags in Expert interface first (avoids double-touching resultsSlice).
   New component: ExpertList.tsx
   Modify: filterSlice (viewMode), MarketplacePage (conditional render)

5. Lead export (joins user_events + newsletter)
   Why fifth: Pure backend endpoint addition + frontend button. No dependencies on above.
   Could be earlier but admin auth should be complete first (it uses protected endpoint).
   Files: admin.py (new endpoint), LeadsPage.tsx

6. Admin dashboard simplification
   Why sixth: Destructive (removes pages) — do after new features are confirmed working.
   Avoids removing a page that's still being tested.
   Files: AdminSidebar.tsx, main.tsx, OverviewPage.tsx, delete target pages

7. Code splitting (lazy loading)
   Why last: Pure optimization. Safe to do last — no functional change.
   Easy to verify: Vite build output will show separate admin chunks.
   Files: main.tsx (lazy imports + Suspense wrappers)
```

---

## Architectural Patterns in Use (Reference)

### Pattern: Idempotent SQLite Column Migration in Lifespan

**What:** `ALTER TABLE experts ADD COLUMN X` wrapped in `try/except` inside `main.py` lifespan. Runs on every restart but errors silently if column already exists.

**Applied for industry_tags:**
```python
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE experts ADD COLUMN industry_tags TEXT"))
        _conn.commit()
    except Exception:
        pass  # Already exists — idempotent
```

Established pattern — already used for `otr_at_k`, `source`, `photo_url` column additions.

### Pattern: Dual-Renderer with Shared Store Data

**What:** Two separate components (ExpertGrid, ExpertList) render the same `experts[]` array from `resultsSlice`. A `viewMode` flag in `filterSlice` determines which renders. No data duplication, no separate fetch.

**Trade-off:** Both components must handle `onEndReached → loadNextPage`. The infinite scroll `cursor` is global in `resultsSlice` — switching views mid-scroll preserves pagination state (correct behavior).

### Pattern: Additive Filter Parameters

**What:** New filter dimensions (industry_tags) are added to the explore pipeline as additive AND conditions. An empty array means "no filter applied" — not "filter to experts with empty industry_tags".

**Implementation contract:**
```python
# Only apply filter if tags list is non-empty
for industry_tag in industry_tags:  # if industry_tags is [], loop doesn't execute
    stmt = stmt.where(...)
```

This is the same pattern used by domain tags today — safe to replicate.

### Pattern: Session Expiry via Client-Side Timestamp

**What:** After login, write a Unix timestamp expiry to sessionStorage alongside the session key. `RequireAuth` and `adminFetch` check it before proceeding.

**Why not JWT:** For a single-admin panel with a Railway backend, JWT adds token verification complexity (signing keys, refresh tokens) with no additional security benefit over a timestamped sessionStorage value. Both expire at tab close. The timestamp approach is 5 lines vs 50+ lines.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Using VirtuosoGrid for List View

**What people do:** Try to use the existing `VirtuosoGrid` in "1 column" mode for list view, or add list-row styles to ExpertCard.

**Why it's wrong:** `VirtuosoGrid` assumes uniform item heights (hardcoded to `h-[180px]` for cards). List rows have variable heights. VirtuosoGrid will miscalculate scroll positions, causing visual glitches.

**Do this instead:** Use `Virtuoso` (not `VirtuosoGrid`) for list view. `Virtuoso` handles variable-height items correctly via dynamic measurement.

### Anti-Pattern: Embedding industry_tags in FAISS Vectors Immediately

**What people do:** Add `industry_tags` column and immediately modify the embedding pipeline to include them in FAISS vectors, triggering a full index rebuild.

**Why it's wrong:** FAISS rebuild for 530 experts takes significant Gemini API calls + time. Industry tags are sector labels ("FinTech") — they add limited semantic value to the embedding that is not already captured by the expert's bio + domain tags. The Stage 1 SQLAlchemy pre-filter handles industry tag filtering correctly without FAISS involvement.

**Do this instead:** Filter industry tags in Stage 1 only. Defer FAISS embedding enhancement to a future version if semantic search across industry tags becomes needed.

### Anti-Pattern: DB Table for Admin Credentials

**What people do:** Create an `admin_users` table with `username` and `hashed_password` columns to store admin credentials.

**Why it's wrong:** Creates a bootstrap problem (how to create the first user?), adds a migration, and requires either a seed script or a "create admin" endpoint (security risk). For a single-admin system with one set of credentials, env vars are simpler, more secure (not in the DB/backup), and already the pattern used by `ADMIN_SECRET`.

**Do this instead:** Store `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` as Railway env vars. The `admin.py` `/auth` endpoint reads them for verification only.

### Anti-Pattern: Lazy Loading MarketplacePage or Core Components

**What people do:** Apply `React.lazy` to `MarketplacePage` or other components on the public route.

**Why it's wrong:** `MarketplacePage` is the primary user-facing page — lazy loading it would add a loading flash on initial navigation for every public user, degrading the first-impression experience.

**Do this instead:** Lazy load ONLY the admin routes (`/admin/*`). Everything under `/` remains statically imported.

---

## Scaling Considerations

| Concern | At Current Scale (530 experts, single admin) |
|---------|----------------------------------------------|
| Industry tag filter | Zero risk — Stage 1 SQL LIKE, same complexity as existing domain tag filter |
| List view with Virtuoso | Zero risk — 530 items, Virtuoso handles 100k+ items |
| bcrypt verification | ~100ms per login — acceptable for admin login; not user-facing |
| Session expiry check | Zero cost — single timestamp comparison |
| Lead export JOIN | Low risk — conversations table is small; LEFT JOIN is efficient |
| Code splitting | Positive impact — reduces initial bundle for public users |

---

## Sources

- Direct inspection: `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/services/explorer.py`, `app/routers/explore.py`
- Direct inspection: `frontend/src/main.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/admin/LoginPage.tsx`, `frontend/src/admin/RequireAuth.tsx`, `frontend/src/admin/hooks/useAdminData.ts`, `frontend/src/admin/components/AdminSidebar.tsx`
- Direct inspection: `frontend/src/store/filterSlice.ts`, `frontend/src/store/resultsSlice.ts`, `frontend/src/store/index.ts`, `frontend/src/hooks/useExplore.ts`
- Direct inspection: `frontend/src/components/marketplace/ExpertGrid.tsx`, `frontend/vite.config.ts`
- react-virtuoso docs: `VirtuosoGrid` for uniform-height grids; `Virtuoso` for variable-height lists
- Vite code splitting: dynamic `import()` + `React.lazy` automatically creates separate chunks

---

*Architecture research for: v4.0 Public Launch — Expert Marketplace feature integration*
*Researched: 2026-02-27*
