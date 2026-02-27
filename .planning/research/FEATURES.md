# Feature Research

**Domain:** Expert marketplace admin + public explorer (React + FastAPI)
**Milestone:** v4.0 Public Launch — polish, admin overhaul, production hardening
**Researched:** 2026-02-27
**Confidence:** HIGH overall — codebase fully inspected; patterns verified against 2025/2026 sources

---

## Context: What Already Exists (do NOT re-implement)

This is a polish/hardening milestone on top of a fully-shipped v3.1 product. All research
below is scoped to the six new feature areas only.

| Existing Baseline | Status |
|-------------------|--------|
| Single-key admin auth (`ADMIN_SECRET` env var, raw key in sessionStorage) | Live — replace with bcrypt |
| `VirtuosoGrid` with `grid-cols-2 md:grid-cols-3`, fixed `h-[180px]` cards | Live — extend with list toggle |
| Tag cloud with 18 domain tags from `TOP_TAGS` constant | Live — extend with industry row |
| `user_events` table: `card_click`, `sage_query`, `filter_change` events | Live — use for export |
| Newsletter leads on `LeadsPage`; email leads linked to `Conversation` search history | Live — extend with CSV export |
| `OverviewPage` with health speedometer + 4 KPI cards + zero-result top-5 + Sage sparkline | Live — extend with 2 cards |
| `SkeletonGrid` on initial load; `EmptyState` on zero results; `animate-pulse` loading text | Live — extend with error state |
| Logout button in `AdminSidebar` (sessionStorage.removeItem) | Live — no changes needed |

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable for a product going to public launch. Missing them signals incomplete or
unsafe software.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Admin login with username + hashed password | A single plaintext env var secret is not defensible for a public product. Any internal tool with a web-accessible login form needs bcrypt-hashed credentials. | LOW | Backend: bcrypt hash stored as `ADMIN_PASSWORD_HASH` env var; frontend adds username field. No JWT needed — sessionStorage expiry is sufficient for a single-admin tool. |
| Error state on public explorer grid | If `/api/explore` returns 5xx, users see a blank grid with no explanation — unacceptable for launch. | LOW | Inline error card in the grid area: "Something went wrong — try refreshing" with a retry button. Not a full-page crash. Handled in `useExplore` hook on non-200 response. |
| White search input for contrast | Current header input uses `bg-slate-900`, blending into the dark header. A public-facing product needs high-contrast, visible input fields. | LOW | CSS change in `Header.tsx`: `bg-white text-gray-900 placeholder-gray-400`. Keyword placeholders: "e.g. SaaS fundraising advisor" instead of animated role names. |
| Grid / list view toggle | Any marketplace that shows browsable cards is expected to offer a density toggle. Users want list view to compare rates and bios side-by-side. | MEDIUM | `viewMode: 'grid' \| 'list'` in Zustand `filterSlice`; localStorage persist; conditional render of `VirtuosoGrid` vs `Virtuoso` (list variant). |
| Lead export CSV | Admin needs to export email leads with search history for post-launch outreach. Currently there is no cross-referenced leads CSV (newsletter CSV exists separately). | MEDIUM | New endpoint `GET /api/admin/export/leads.csv`; JOIN `email_leads` + `conversations`; columns: email, first seen, last active, search count, gap searches. |

### Differentiators (Competitive Advantage)

These features directly support the v4.0 goal of a polished, intelligence-rich admin and a
production-hardened explorer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Industry tags alongside domain tags | Domain tags describe *what* an expert does (skills); industry tags describe *where* they work (verticals). These are orthogonal dimensions users expect to filter independently on a mature marketplace. | HIGH | Requires: `industry_tags` field on Expert model + metadata.json; Gemini batch-tagging with curated ~15-tag taxonomy; FilterSidebar industry section; `run_explore()` pipeline update; TagCloud second row. Touches 6+ files. |
| Streamlined admin "one-snap overview" | `OverviewPage` already exists but omits total leads count and expert pool count. An admin should answer "what is the state of this system?" without navigating elsewhere. | LOW | Add "Total Leads" and "Expert Pool" stat cards to the existing KPI grid. Requires two new fields in `GET /api/admin/stats` response. |
| Admin session with password + username | Two-field login (username + hashed password) is the expected pattern for any credential-based admin. The existing single-field key form is functional but feels like a temp hack. | LOW | Additive — same form, same sessionStorage pattern, same `RequireAuth` guard. Change is entirely in the `/auth` endpoint logic and the login form fields. |
| Production hardening: mobile polish and loading speed | Public launch traffic will include users on slow mobile connections. The current Sage double-rendering bug (desktop + mobile popout overlap) and double-click profile-open on mobile are known issues that affect first impressions. | MEDIUM | Sage: add `md:hidden` guard to mobile sheet, `hidden md:block` to desktop panel (they already coexist but conditionals are missing). Mobile double-click: change from double-tap expand to single-tap (desktop hover covers the expand need). Loading speed: audit lazy-loading of heavy dependencies. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| JWT session tokens with expiry | "Proper auth" implies JWTs | For a single-admin internal tool, JWT refresh flows add 3-4x implementation complexity with zero user-facing benefit. sessionStorage already expires on tab close — that is the right expiry model for a solo operator. | bcrypt password hashing on the existing single-key flow. Same security surface, 20% of the code. |
| Admin password reset via email | Security hygiene | There is one admin. Email-based reset requires SMTP integration, a reset token table, and a recovery UI — disproportionate for a solo operator tool. | Document: rotate `ADMIN_PASSWORD_HASH` in Railway env vars. Takes 30 seconds. |
| Real-time live admin events | "See what users are doing now" | WebSocket or rapid polling for live admin events adds backend complexity and Railway egress. The 30s health check interval already in `OverviewPage` is the right model. | Manual refresh button on Overview if needed. Keep 30s health polling as-is. |
| Inline expert editing in list view | "While in list view, edit expert from card" | Expert management belongs on `ExpertsPage`. Mixing browse and edit in the same view creates confusing IA and testing surface. | Link from list-view card to `/admin/experts?highlight=username`. |
| Free-form AI-invented industry tags | "Let Gemini choose industry labels" | Without a fixed taxonomy, Gemini produces "fin-tech", "FinTech", "financial technology" — inconsistent values that break filter matching. | Curated taxonomy of ~15 industry tags passed as an enum in the Gemini prompt. Force-fit to nearest match. |
| Card click export (email + click correlation) | "Show which experts each lead viewed" | `user_events.session_id` is an anonymous random string. `email_leads.email` is captured at the email gate. These are not currently linked in the DB — reliable correlation is not possible without a data model addition. | Export email + search queries from `Conversation` table (fully available now). Document the session linking gap for v4.1. |

---

## Feature Dependencies

```
[Admin bcrypt password login]
    └──replaces──> [ADMIN_SECRET plaintext comparison in /auth endpoint]
    └──requires──> [ADMIN_PASSWORD_HASH env var pre-generated with passlib]
    └──requires──> [ADMIN_USERNAME env var (defaults to "admin")]
    └──frontend: add username field to LoginPage.tsx]
    └──backend: 10-line change in admin.py /auth endpoint]

[Grid / list view toggle]
    └──requires──> [viewMode state in Zustand useFilterSlice]
    └──requires──> [Virtuoso (list variant) component as alternative to VirtuosoGrid]
    └──requires──> [ExpertCard list layout variant (wider, bio visible, no tap-expand)]
    └──enhances──> [localStorage persist via existing Zustand persist middleware]
    └──note: VirtuosoGrid assumes uniform height — list cards are variable height;
             must conditionally render Virtuoso, not pass a prop to VirtuosoGrid]

[Industry tags]
    └──requires──> [industry_tags column on Expert model (SQLite ADD COLUMN migration)]
    └──requires──> [industry_tags field in metadata.json]
    └──requires──> [Gemini batch-tagging script with curated 15-tag taxonomy]
    └──requires──> [run_explore() pipeline: industry_tags pre-filter]
    └──requires──> [FilterSidebar: industry multi-select section]
    └──requires──> [useExplorerStore: industryTags: string[] filter slice]
    └──enhances──> [TagCloud: second row labeled "Industry"]
    └──conflicts with timing of──> [Grid/list toggle]
       (both touch ExpertCard layout — ship in separate phases to avoid merge conflicts)

[Lead export CSV]
    └──requires──> [email_leads table] (ALREADY BUILT)
    └──requires──> [conversations table] (ALREADY BUILT)
    └──requires──> [new GET /api/admin/export/leads.csv endpoint on authenticated router]
    └──enhances──> [LeadsPage: "Export Leads CSV" button, matching newsletter export pattern]
    └──note: card click correlation NOT achievable without data model addition;
             scope to email + search queries for v4.0]

[One-snap overview additions]
    └──requires──> [total_leads and expert_count added to /api/admin/stats response]
    └──enhances──> [OverviewPage: two new stat cards in existing KPI grid]
    └──independent of all other v4.0 features]
    └──note: simplest change in the milestone — good first PR]

[White search input]
    └──modifies──> [Header.tsx: input className only]
    └──independent of all other v4.0 features]

[Error state on public explorer]
    └──modifies──> [useExplore hook: handle non-200 response from /api/explore]
    └──modifies──> [MarketplacePage.tsx or ExpertGrid.tsx: render error banner]
    └──independent of all other v4.0 features]
```

### Dependency Notes

- **Industry tags requires startup migration:** Adding `industry_tags` to `Expert` uses SQLite
  `ALTER TABLE ADD COLUMN NULL` — safe and idempotent. Match the existing startup migration
  pattern (`idempotent_startup_migration` for email purge).
- **Grid/list toggle requires component switch, not a prop:** `VirtuosoGrid` requires uniform
  item height. List mode cards contain variable-height bio text. Conditionally render
  `<VirtuosoGrid>` vs `<Virtuoso>` based on `viewMode`. This is 15 lines in `ExpertGrid.tsx`.
- **Lead export is read-only:** No new tables. The JOIN over `email_leads` + `conversations` is
  straightforward SQL.
- **Bcrypt admin auth is a surgical change:** The `/auth` endpoint body changes from `{key}`
  to `{username, password}`; the comparison changes from `body.key != secret` to
  `pwd_context.verify(body.password, stored_hash)`. Frontend adds one `<input>` field.

---

## MVP Definition

### Launch With (v4.0 — required for public launch)

- [ ] White search input with keyword placeholders — 30-minute change; immediate polish signal
- [ ] Error state on public explorer grid — prevents blank page on backend failure
- [ ] Admin bcrypt password + username login — plaintext key comparison is not defensible
- [ ] Grid / list view toggle — table stakes for a marketplace product
- [ ] Lead export CSV (email + search history) — enables post-launch outreach
- [ ] One-snap overview additions (total leads + expert pool count) — zero-cost win

### Add After Validation (v4.x)

- [ ] Industry tags — high complexity, high value; ship after launch traffic validates domain tag
  model first
- [ ] Card click correlation in lead export — requires `session_id → email` data model addition
- [ ] Admin session expiry (configurable timeout) — add if security audit requires it

### Future Consideration (v5+)

- [ ] Multi-admin user management with roles
- [ ] Export with date-range filtering
- [ ] Saved filter presets

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| White search input + keyword placeholders | MEDIUM | LOW | P1 |
| Error state on explorer grid | HIGH | LOW | P1 |
| Admin bcrypt password login | HIGH | LOW | P1 |
| Grid / list view toggle | HIGH | MEDIUM | P1 |
| Lead export CSV | HIGH | MEDIUM | P1 |
| One-snap overview (2 stat cards) | MEDIUM | LOW | P1 |
| Industry tags | HIGH | HIGH | P2 |
| Sage double-rendering fix | MEDIUM | LOW | P1 |
| Mobile double-click profile fix | LOW | LOW | P1 |
| Admin session expiry | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v4.0 launch
- P2: Ship in v4.1 after launch validates the data model
- P3: Defer

---

## Per-Feature Implementation Notes

### 1. Admin Login with Username + Hashed Password

**Current state:** `POST /api/admin/auth` accepts `{key: string}` and compares raw string
against `ADMIN_SECRET` env var. Plaintext comparison.

**Target state:** Accept `{username: string, password: string}`; compare username against
`ADMIN_USERNAME` env var; verify password against bcrypt hash in `ADMIN_PASSWORD_HASH` env var.

**Backend change (10 lines in admin.py):**
```python
from passlib.context import CryptContext
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthBody(BaseModel):
    username: str
    password: str

@auth_router.post("/auth")
def authenticate(body: AuthBody):
    stored_username = os.getenv("ADMIN_USERNAME", "admin")
    stored_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
    if not stored_hash or body.username != stored_username:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not _pwd_context.verify(body.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"ok": True}
```

**Library note:** FastAPI docs now reference `pwdlib` instead of `passlib` (passlib maintenance
lapsed per GitHub discussion #11773). For a single-endpoint auth with no legacy hashes, either
works. `pwdlib` is the forward-looking choice. `passlib` remains battle-tested and is the safer
choice if Railway's Python environment already has it. Use `passlib` for v4.0 — switching later is
a one-line change.

**Pre-generating the hash (operator one-time setup):**
```python
from passlib.context import CryptContext
ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(ctx.hash("your-secure-password"))
# Output: $2b$12$... (paste this into ADMIN_PASSWORD_HASH in Railway)
```

**Frontend change:** Add `username` text input above the existing password field in
`LoginPage.tsx`. Pass `{username, password}` in the POST body. Store the key in sessionStorage
as before — or store `username` separately and use it only for display.

**Session management:** sessionStorage provides implicit expiry (clears on tab close). No
server-side session table needed for v4.0. This is the correct tradeoff for a solo-operator
internal tool — confirmed by FastAPI auth best practices sources.

**No password reset UI:** Rotate `ADMIN_PASSWORD_HASH` and `ADMIN_USERNAME` in the Railway
dashboard. Document this in `ADMIN.md`. Takes 30 seconds.

**Confidence:** HIGH — bcrypt/passlib is thoroughly documented; the codebase change is surgical.

---

### 2. Grid / List View Toggle

**Current state:** `VirtuosoGrid` renders `grid-cols-2 md:grid-cols-3` with fixed `h-[180px]`
cards. No view mode state exists.

**Target state:** Toggle in the `FilterChips` toolbar area; `viewMode: 'grid' | 'list'` in
`useFilterSlice` Zustand slice; `localStorage` persist; conditional rendering in `ExpertGrid.tsx`.

**Key technical constraint:** `VirtuosoGrid` requires uniform row height. List mode cards expose
bio text and variable content — must render `<Virtuoso>` (standard list variant) instead of
`VirtuosoGrid`. This is a conditional render, not a prop.

**List card layout:** Full-width single column; shows `photo + name + title + company + rate +
2-3 tags + bio preview (2 lines) + View Full Profile`. Match reason visible by default (no
tap-expand needed). Card height: auto (variable). Remove the `h-[180px]` constraint in list mode.

**Grid card layout:** Unchanged from current — `h-[180px]`, four bento zones, tap-expand on
mobile.

**Toggle persistence:** `localStorage` via Zustand `persist` middleware is already configured on
`filterSlice`. Adding `viewMode` to the persisted slice is a two-line addition.

**Mobile behavior:** List view is the better default on mobile (single column, easier to scan
titles and rates). On mobile, grid = 2 columns (existing); list = 1 column. Toggle visible on
both breakpoints.

**Toggle UI:** Two icon buttons in the toolbar (grid icon and list icon), active state uses
`text-brand-purple`, inactive uses `text-gray-400`. No labels needed — icons are universally
recognized. Place in `FilterChips.tsx` rightmost area or above the grid as a standalone control.

**Confidence:** HIGH — VirtuosoGrid/Virtuoso conditional rendering is well-documented in
react-virtuoso docs; Zustand persist pattern is already in the codebase.

---

### 3. Industry Tags Alongside Domain Tags

**Current state:** `tags` field on Expert contains 3–8 AI-assigned domain tags (skills/topics).
`category` field exists in DB and `metadata.json` but is `None` for all 536 experts — populated
only by keyword-matching in `_auto_categorize()` based on job titles (9 broad categories: Tech,
Marketing, Finance, etc.). Category is not exposed in the public Explorer UI.

**Target state:** A separate `industry_tags` field (list of 1–3 industry verticals) shown as a
second row in the `TagCloud` and as a second multi-select section in `FilterSidebar`. Industry
tags filter the FAISS/BM25 pipeline as a pre-filter.

**Recommended industry taxonomy (curated, ~15 tags):**
`fintech`, `healthcare`, `e-commerce`, `saas / software`, `real estate`, `construction`,
`energy`, `media & entertainment`, `professional services`, `manufacturing`, `education`,
`nonprofit`, `hospitality & food`, `logistics`, `legal`

Using a fixed enum in the Gemini prompt prevents free-form inconsistencies ("fin-tech" vs
"FinTech" vs "financial technology"). This is the critical implementation decision — confirmed by
filter UX research showing that filter values must be predictable for users to trust them.

**Implementation path (6 touch points):**
1. Startup migration: `ALTER TABLE experts ADD COLUMN industry_tags TEXT NULL` — idempotent
2. Update `_serialize_expert()` in `admin.py` to include `industry_tags`
3. Batch-tagging script: `scripts/tag_industry.py` using Gemini flash-lite with enum-constrained
   prompt; updates both SQLite and `metadata.json`
4. `run_explore()` in `explore.py`: add `industry_tags` SQLite JSON contains pre-filter
5. `useExplorerStore`: add `industryTags: string[]` to filter slice and URL sync
6. UI: `IndustryTagCloud` row in `FilterSidebar` + second row in `TagCloud.tsx`

**Complexity:** HIGH — touches 6+ files across model, scripts, pipeline, store, and UI.
Batch tagging for 536 experts takes ~5 minutes with Gemini flash-lite. Data quality depends
on bio content — experts with thin bios may get imprecise industry assignments.

**Confidence for UX pattern:** HIGH (separate filter dimensions for skills vs industry is
standard marketplace pattern per NN/G research). **Confidence for implementation timeline:**
MEDIUM — Gemini enum-constrained tagging works but needs a test pass to verify accuracy.

---

### 4. Lead Export with Search/Click History

**Current state:** `LeadsPage` shows email-grouped leads with expandable recent queries from
`Conversation` table. Newsletter CSV export exists (`GET /api/admin/export/newsletter.csv`).
No cross-referenced export of email + full search history.

**Target state:** "Export Leads CSV" button on `LeadsPage` → `GET /api/admin/export/leads.csv`.
One row per email lead.

**Available columns (all from existing tables):**
```
email           — email_leads.email
first_seen      — email_leads.created_at
last_active_at  — MAX(conversations.created_at) grouped by email
search_count    — COUNT(conversations.id) grouped by email
gap_searches    — COUNT WHERE response_type='clarification'
newsletter_sub  — boolean: email in newsletter_subscribers table
recent_queries  — pipe-separated last 5 queries from conversations
```

**Card click data gap:** `user_events.session_id` is an anonymous string generated client-side.
`email_leads.email` is captured separately at the email gate. There is no `session_id → email`
join in the current data model. Card clicks cannot be reliably attributed to emails. Do not
fabricate this column in v4.0. Label it "not available" or omit it. Document the gap for v4.1
(fix: include `session_id` in the email gate submission).

**Backend implementation:**
```python
@router.get("/export/leads.csv")
def export_leads_csv(db: Session = Depends(get_db)):
    # JOIN email_leads + conversations
    rows = db.execute(text("""
        SELECT
            el.email,
            el.created_at AS first_seen,
            MAX(c.created_at) AS last_active_at,
            COUNT(c.id) AS search_count,
            SUM(CASE WHEN c.response_type = 'clarification' THEN 1 ELSE 0 END) AS gap_searches,
            GROUP_CONCAT(c.query, ' | ') AS recent_queries
        FROM email_leads el
        LEFT JOIN conversations c ON c.email = el.email
        GROUP BY el.email
        ORDER BY last_active_at DESC
    """)).fetchall()
    # Stream CSV response (matching newsletter export pattern)
```

**Frontend:** Identical to newsletter export button in `LeadsPage.tsx` — `fetch blob → URL.createObjectURL → a.click()` pattern already exists. Add a second button labeled "Export Leads CSV".

**Confidence:** HIGH for email + search data (fully available now). LOW for card click
correlation (requires data model addition, not in v4.0 scope).

---

### 5. Admin One-Snap Overview

**Current state:** `OverviewPage` has: health speedometer + 4 KPI cards (total searches,
matches, match rate, gaps) + zero-result top-5 + Sage sparkline + top queries + top feedback.

**Gap:** No total leads count, no expert pool count. The duplicate "Match Rate" standalone card
(already shown as sub-label on "Matches" card) wastes a slot that should show business metrics.

**Target state:** Replace the two least-informative KPI cards with actionable business metrics:
- Replace standalone "Match Rate" card with "Total Leads" (email_leads count, sub: newsletter
  subscribers count)
- Replace "Gaps" card with "Expert Pool" (expert count, sub: "X with photos")

The "gaps" data already appears prominently in the zero-result table immediately below — it does
not need a redundant KPI card.

**API change:** `GET /api/admin/stats` must return two new fields:
```python
"total_leads": db.query(func.count(EmailLead.id)).scalar(),
"expert_count": db.query(func.count(Expert.id)).scalar(),
```

**Frontend change:** Replace two `<StatCard>` entries in `OverviewPage.tsx` with the new data.
The `StatCard` component already supports `label`, `value`, `sub`, and `accent` props — no
component changes needed.

**F-pattern layout alignment:** Eye-tracking research confirms users scan top-left to
bottom-right. "Total Searches" (top-left) and "Total Leads" (second card) are the two most
executive-relevant metrics — correct placement per 2025 SaaS dashboard design guidance.

**Confidence:** HIGH — additive change to existing endpoint and component.

---

### 6. Production Error States and Loading Patterns

**Current state:**
- Admin: `animate-pulse` loading text + inline `text-red-400` error strings per page
- Explorer: `SkeletonGrid` on initial load; `EmptyState` on zero results
- Missing: no explicit error UI if `/api/explore` returns 500 — grid stays blank indefinitely

**Target state for public explorer:**

If `/api/explore` fails (network error or 5xx), show an error banner inside the grid area:
```
[!] Having trouble loading experts. Try refreshing.   [Retry]
```
This is an inline error card, not a full-page error. The banner replaces the skeleton/grid area
on failure. Retry button re-triggers the `useExplore` fetch.

Implementation in `useExplore` hook: catch non-200 responses; set `error` state; pass to
`ExpertGrid`. In `ExpertGrid.tsx`, add an error branch before the skeleton/empty checks.

**Target state for Sage panel:**
Sage already handles errors partially. Ensure the Sage panel shows an error message (not a blank
panel) if the Gemini call fails. Check `SagePanel.tsx` — if there is no error branch, add one.

**Target state for admin:**
Admin API errors already render `text-red-400` inline — acceptable for internal tooling. No
changes needed to admin error states.

**React error state best practice (MEDIUM confidence — LogRocket 2025):**
- Content-level API errors: inline error card within the content area (not full-page)
- Network errors: banner with retry button; auto-retry optional
- Use `ErrorBoundary` only for catastrophic JS exceptions, not for API fetch failures
- Never show raw error messages to public users (show friendly copy; log details to Sentry)

**Loading patterns already in codebase (no changes needed):**
- `SkeletonGrid` for initial grid load — correct, keep
- `animate-pulse` for sub-section loads — correct for admin, keep
- `SkeletonFooter` in `ExpertGrid.tsx` for infinite scroll — correct, keep
- Sage in-flight pulse in header — correct, keep

**Confidence:** HIGH for patterns. LOW for which specific failure modes currently produce blank
screens (requires integration testing to confirm).

---

## Competitor Feature Analysis

| Feature | Standard Marketplace Pattern | Our v4.0 Approach |
|---------|------------------------------|-------------------|
| Grid/list toggle | List primary (LinkedIn, Upwork); grid primary (photo-heavy products) | Grid default (photos are the primary differentiator), list toggle in toolbar |
| Tag filtering | Single tag dimension (most platforms) | Two dimensions (domain + industry) — launches as domain-only; industry in v4.1 |
| Admin auth | Single admin key OR full auth service | Single admin with bcrypt hash — pragmatic for solo operator |
| Lead export | CRM integration or CSV with email + activity | CSV with email + search history — actionable without a CRM |
| Error states | Full error page with support links (large products); inline retry (small products) | Inline error card with retry — appropriate for marketplace scale |
| Admin overview | Health + KPIs above the fold, details below | Existing OverviewPage is already close to one-snap ideal; two card additions complete it |

---

## Sources

- **Codebase inspection (HIGH confidence):** `frontend/src/admin/LoginPage.tsx`,
  `frontend/src/admin/pages/OverviewPage.tsx`, `frontend/src/admin/pages/LeadsPage.tsx`,
  `frontend/src/components/marketplace/ExpertGrid.tsx`,
  `frontend/src/components/sidebar/TagCloud.tsx`, `app/routers/admin.py`, `app/models.py`,
  `data/metadata.json`
- [FastAPI Security — official docs](https://fastapi.tiangolo.com/tutorial/security/) — HIGH confidence
- [Authentication and Authorization with FastAPI — Better Stack](https://betterstack.com/community/guides/scaling-python/authentication-fastapi/) — MEDIUM confidence
- [passlib vs pwdlib discussion — fastapi/fastapi GitHub #11773](https://github.com/fastapi/fastapi/discussions/11773) — HIGH confidence (official repo)
- [UI best practices for loading, error, empty states — LogRocket](https://blog.logrocket.com/ui-design-best-practices-loading-error-empty-state-react/) — MEDIUM confidence
- [Helpful Filter Categories and Values — Nielsen Norman Group](https://www.nngroup.com/articles/filter-categories-values/) — HIGH confidence (authoritative UX research)
- [15 Filter UI Patterns That Actually Work in 2025 — Bricxlabs](https://bricxlabs.com/blogs/universal-search-and-filters-ui) — MEDIUM confidence
- [Smart SaaS Dashboard Design Guide 2026 — F1Studioz](https://f1studioz.com/blog/smart-saas-dashboard-design/) — MEDIUM confidence
- [React Loading Skeleton: Smooth Loading States — Medium](https://medium.com/@joodi/react-loading-skeleton-smooth-loading-states-in-your-app-1061c92e2f73) — MEDIUM confidence

---

*Feature research for: Tinrate Expert Marketplace v4.0 Public Launch*
*Researched: 2026-02-27*
