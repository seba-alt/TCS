# Feature Research

**Domain:** Expert Marketplace — v3.1 Launch Hardening
**Milestone:** v3.1 (hardening existing v3.0 codebase for public launch)
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH overall — mobile filter UX MEDIUM (research confirms bottom-sheet is defensible but dropdown inline pattern is also legitimate; no authoritative A/B data for this exact context), GA4 SPA HIGH (official docs + multiple 2025 sources confirm pattern), email removal MEDIUM-HIGH (standard SQLite migration pattern + privacy practice), error hardening HIGH (Sentry + FastAPI patterns well-documented)

---

## Context: What Already Exists (do NOT re-implement)

This milestone hardens and polishes the existing v3.0 product. Nothing listed below is rebuilt — it is fixed, replaced, or removed.

| Existing Feature | Status | v3.1 Action |
|-----------------|--------|-------------|
| Vaul bottom-sheet mobile filter drawer | Live — works | Replace with inline dropdown controls |
| Mobile search input (compact in header) | Live — narrow | Expand to full-width on mobile |
| Expert email field in SQLite + metadata.json | Live — privacy risk | Remove entirely from all data stores |
| Photo proxy endpoint (returns 502 on broken URLs) | Live — Sentry errors | Add graceful fallback instead of 502 |
| React redirect loop in RedirectWithParams | Live — Sentry errors | Fix the redirect logic |
| FTS5 MATCH with empty string | Live — Sentry errors | Add empty-string guard before MATCH |
| `gemini-2.0-flash-lite` model string | Live — deprecated | Update to current model name |
| Sentry (frontend + backend already initialized) | Live — partially configured | Improve source maps, fingerprinting |
| Desktop tag cloud (12 tags visible) | Live | Expand to 18–20 tags |
| Google Analytics — not installed | Not present | Add gtag.js G-0T526W3E1Z with SPA route tracking |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features where launch readiness depends on getting them right. Missing or broken = public trust issue.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **No personal email data exposed** | Any marketplace that stores user/expert PII without necessity is a liability. GDPR's data minimization principle requires removing data that is not actively used. Expert emails are not displayed to users, not used in search, and not in any API response — they are pure dead weight that creates breach risk. | MEDIUM | Remove `email` column from SQLite `Expert` table via Alembic batch migration (SQLite requires batch ops for column drops). Remove from `metadata.json` and `experts.csv`. Add validation in bulk import endpoint to reject future uploads containing email fields. Three-step: migrate DB, sanitize flat files, guard import. |
| **Zero Sentry errors on normal user flows** | Production users encountering errors that surface in Sentry (502s, stack overflows, syntax errors) are experiencing a broken product. Pre-launch error budget should be zero for P0 flows (search, filter, card expand, Sage). | HIGH | Four distinct error sources, each needs its own fix: (1) photo proxy 502 → catch upstream failure and return 307 redirect to monogram SVG fallback; (2) React redirect loop → audit RedirectWithParams component, likely a `useEffect` dependency array missing `navigate`; (3) FTS5 empty string → validate `query.strip()` before building MATCH clause; (4) deprecated model → update string in `pilot_service.py` and `lang_detect.py`. |
| **Mobile filters that work without a drawer** | Mobile marketplace apps in 2025 increasingly use inline filter controls rather than bottom-sheet drawers for secondary filter sets. NN/G research found that bottom sheets create dismissal friction and the reachability advantage is overstated. For a small filter set (rate range + tags + text search), inline dropdowns above the grid eliminate the "open drawer → filter → close drawer → see results" round-trip. | MEDIUM | Replace Vaul `MobileFilterSheet` with inline horizontal filter bar: full-width search input + rate dropdown + tag multi-select dropdown. Dropdowns use native `<select>` or a lightweight headless component (no new library). The filter bar sits between the Command Center header and the VirtuosoGrid. On mobile, the sidebar (`FilterSidebar`) remains hidden (`md:hidden`); the inline bar replaces it. |
| **Google Analytics tracking on route changes** | Any product going to public launch needs baseline analytics: page views per route, user sessions, acquisition source. GA4 with the provided measurement ID (G-0T526W3E1Z) is the stated requirement. Without it, launch is analytically blind. | LOW | Inject `gtag.js` script in `index.html`. Initialize in `analytics.ts` module using the `arguments` object pattern (not spread — see PITFALLS.md). Add `useAnalytics` hook using `useLocation` from React Router that fires `page_view` events on route change. Set `send_page_view: false` in initial config to prevent double-counting. The existing `trackEvent()` fire-and-forget module can be extended to call `window.gtag('event', ...)` alongside the existing internal `/api/events` endpoint. |
| **Full-width search bar on mobile** | The current mobile header has a compact search input that is visually constrained. On mobile, search is the primary discovery tool. A full-width input with adequate touch target (min 44px height) is the baseline expectation for any search-first product. | LOW | CSS change in `CommandCenterHeader.tsx` or equivalent: `w-full` on mobile, remove any `max-w` constraint on small screens. Ensure the search input is the first interactive element in the mobile DOM flow. |
| **Desktop tag cloud shows 18–20 tags** | The current 12-tag limit was an arbitrary cap. With 530 experts across diverse domains, a 12-tag cloud hides coverage. Users scanning the tag cloud to understand the expert pool need sufficient breadth. 18–20 tags represents the maximum legible count before the cloud becomes a list. | LOW | Update the tag count constant in `TagCloud.tsx` (or equivalent). No backend change needed — the tag frequency data is already computed. |

---

### Differentiators (Competitive Advantage)

These features are above what a basic "fix the bugs" milestone would deliver. Each adds launch-day quality signal.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sentry source maps via `@sentry/vite-plugin`** | Production errors in Sentry currently show minified stack traces (line 1, column 87432). Source maps uploaded to Sentry via the Vite plugin show actual TypeScript file names and line numbers. This reduces mean-time-to-fix from "unclear" to "exact". Already have Sentry initialized — source maps are the next step. | LOW | Install `@sentry/vite-plugin` as dev dependency. Add to `vite.config.ts`: `sentryVitePlugin({ org, project, authToken })`. Set `build.sourcemap: 'hidden'` (generates maps, doesn't serve them to users). Maps upload on every production build automatically. Auth token stored as `SENTRY_AUTH_TOKEN` env var in Vercel. |
| **GA4 custom events that extend existing internal tracking** | The existing `trackEvent()` already captures card clicks, Sage queries, and filter changes to `/api/events`. Routing those same events to GA4 simultaneously gives the admin: (1) internal demand signal data for the Admin Marketplace Intelligence page, and (2) Google's acquisition/retention analytics without duplicating instrumentation. Two birds, one `trackEvent()` call. | LOW | In `trackEvent.ts`, add a GA4 call alongside the existing fetch: `window.gtag?.('event', eventName, eventParams)`. Map internal event names to GA4 event names (e.g., `card_click` → `select_content`, `sage_query` → `search`, `filter_change` → `view_item_list`). Use GA4's recommended e-commerce event taxonomy where applicable. |
| **Email removal with upload guard** | Removing existing email data is the minimum. Adding a server-side guard that rejects future expert CSV uploads containing an `email` column prevents the data from re-entering via the admin bulk import flow. This makes the removal durable, not just a one-time cleanup. | LOW | In the bulk import endpoint (`/api/admin/experts/import` or equivalent), add a check: if any row in the uploaded CSV contains an `email` or `Email` key, return 422 with message "Email field detected — remove before import for privacy compliance." This is a 5-line guard in the CSV parsing logic. |
| **Graceful photo proxy fallback (SVG monogram)** | The current photo proxy returns 502 when the upstream photo URL is unreachable. The frontend then shows a broken image. A graceful fallback returns a valid SVG monogram generated from the expert's initials. This means the proxy never returns an error — it always returns an image. Eliminates an entire class of Sentry errors. | MEDIUM | In the FastAPI photo proxy endpoint, wrap the upstream HTTP request in a try/except. On any failure (timeout, 4xx, 5xx, network error), generate a minimal SVG with the expert's initials and return it as `image/svg+xml`. Initials derived from `first_name` and `last_name` passed as query params. Cache the fallback SVG for the same 24h as the proxy cache. |

---

### Anti-Features (Explicitly Avoid)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Keeping the Vaul bottom sheet as-is** | "It already works, why replace it?" | The Vaul bottom sheet requires 3 interactions to change a filter (tap FAB → drawer opens → change filter → drawer closes → see results). NN/G research confirms bottom sheet dismissal is frequently confusing. More importantly: the existing implementation is generating Sentry errors on some mobile gesture interactions. The stated v3.1 requirement is to replace it. | Inline filter bar above the expert grid: search input (full-width) + rate dropdown + tag dropdown. Visible at all times, no drawer open/close cycle. Matches the desktop sidebar pattern in a mobile-appropriate layout. |
| **Installing react-ga4 or react-ga library** | "There's a library for GA4 in React" | `react-ga4` (the most popular) has not been meaningfully updated since 2022 and its last substantive release was 2023. The library wraps `gtag.js` but adds a dependency maintenance burden. The correct implementation for 2025 is a thin custom module (30 lines) around the native `gtag` function — no library needed, no maintenance risk, full control. | Custom `analytics.ts` module: initialize gtag, export `trackPageView()` and `trackEvent()` functions. `useAnalytics` hook using `useLocation`. This is the pattern recommended by multiple 2025 sources and is what the library would generate anyway. |
| **Pseudonymization instead of deletion for expert emails** | "We might need emails later" | Pseudonymization (hashing the email) retains the data in a non-identifiable form. For expert data, there is no stated use case for emails in TCS — they are not displayed, not used in search, not in any API response. Retaining hashed emails is data minimization theater: you still store personal data, it just looks different. GDPR's data minimization principle applies to the need to store, not just the format. If you don't need it, delete it. | Hard deletion: `ALTER TABLE` to drop the column (via Alembic batch), remove from flat files, add import guard. Zero stored email data. |
| **GTM (Google Tag Manager) instead of direct gtag.js** | "GTM is more powerful for future analytics" | GTM is appropriate when a non-developer (marketing team) needs to add tracking without code changes. TCS is a developer-maintained product with no separate marketing operations team. GTM adds a layer of complexity (GTM container, tag configuration, trigger rules) on top of gtag.js for zero benefit in this context. Direct gtag.js is simpler, faster to load, and directly controlled in code. | Direct `gtag.js` script injection in `index.html` + custom `analytics.ts` module. If GTM is needed in the future, it's a 30-minute migration. |
| **Fixing deprecated Gemini model by upgrading to Gemini 2.5 Flash** | "If we're touching the model string, why not upgrade to the latest?" | Upgrading the generation model (`gemini-2.0-flash` → `gemini-2.5-flash`) is a behavior change that requires re-testing Sage function calling accuracy, Dutch detection routing, and the "smart funny friend" persona. This is out of scope for a hardening milestone. The fix is narrow: update only the deprecated `gemini-2.0-flash-lite` model string (used for Dutch detection) to its non-deprecated successor. | Update `gemini-2.0-flash-lite` to `gemini-2.0-flash` (the non-lite variant, which is stable) or to the current equivalent. Do not change the main Sage generation model in this milestone. Validate Dutch detection still routes correctly with the updated model. |
| **Full mobile filter redesign (accordion, multi-panel)** | "If we're replacing the bottom sheet, let's do a full redesign" | A full mobile filter redesign (accordion sections, animated panels, saved filter presets) is a v4.0 feature. v3.1's mobile filter goal is narrow: eliminate the bottom-sheet drawer friction with a simpler inline bar. Adding complexity to a hardening milestone delays launch. | Inline filter bar: three controls (search, rate dropdown, tags dropdown) visible above the grid. No animation, no accordion. Functional, fast, and achievable in one phase. |

---

## Feature Dependencies

```
[Expert Email Removal]
    └──step 1──> [Alembic batch migration: drop email column from Expert table]
    └──step 2──> [Sanitize metadata.json and experts.csv (remove email fields)]
    └──step 3──> [Add import guard in bulk upload endpoint]
    └──no conflicts with──> [any other v3.1 feature]
    └──note: Must complete step 1 before step 3; steps 1 and 2 can be parallel]

[Sentry Error Fixes — four independent bugs]
    ├──[Photo proxy 502 → graceful SVG fallback]
    │       └──independent of other fixes]
    │       └──requires: first_name + last_name available as proxy query params]
    ├──[React redirect loop → fix RedirectWithParams]
    │       └──independent of other fixes]
    │       └──requires: reading the existing component to diagnose]
    ├──[FTS5 empty string → validate before MATCH]
    │       └──independent of other fixes]
    │       └──requires: finding every location that builds a MATCH clause]
    └──[Deprecated gemini-2.0-flash-lite → update model string]
            └──independent of other fixes]
            └──requires: test Dutch detection still works after update]

[Mobile Filter Redesign]
    └──removes: Vaul MobileFilterSheet component]
    └──adds: inline filter bar (search + rate dropdown + tags dropdown)]
    └──requires: full-width search bar (listed separately, must coordinate)]
    └──affects: CommandCenterHeader.tsx layout on mobile]
    └──note: Rate dropdown must align to filterSlice.rateMax default (5000) to avoid]
    └──      [spurious filter chip bug already fixed in v2.0 — preserve that fix]
    └──independent of: Sentry fixes, email removal, GA4]

[Full-width Search Bar]
    └──requires: mobile filter redesign (both touch the header layout)]
    └──should be: implemented in same phase as mobile filter bar]
    └──note: Coordinate so header doesn't get two separate layout passes]

[Google Analytics GA4]
    └──step 1──> [Inject gtag.js script in index.html]
    └──step 2──> [Create analytics.ts module with arguments-object gtag init]
    └──step 3──> [Add useAnalytics hook with useLocation for route tracking]
    └──step 4──> [Extend existing trackEvent() to dual-fire to GA4]
    └──requires: step 1 before steps 2–4]
    └──independent of: all other v3.1 features]
    └──note: Must set send_page_view: false to prevent double-counting on initial load]

[Sentry Source Maps]
    └──requires: @sentry/vite-plugin in vite.config.ts]
    └──requires: SENTRY_AUTH_TOKEN env var in Vercel]
    └──independent of: all other v3.1 features]
    └──note: Do not set sourcemap: true (serves maps publicly); use sourcemap: 'hidden']

[Desktop Tag Cloud 18–20 Tags]
    └──requires: updating count constant in TagCloud component]
    └──independent of: all other v3.1 features]
    └──note: Simplest change in the milestone; good first commit]
```

---

## MVP Definition

### Launch With (v3.1 milestone = public launch readiness)

All items below are P0 for launch. Missing any one creates a launch blocker (privacy, trust, or analytics blindness).

- [ ] **Expert email purge** — GDPR data minimization, privacy risk eliminated before any public marketing drives traffic to the platform
- [ ] **Photo proxy graceful fallback** — eliminates highest-frequency Sentry error category; broken images on public launch are an immediate trust signal failure
- [ ] **React redirect loop fix** — stack overflow errors cause blank pages for a subset of users; cannot launch with a known blank-page bug
- [ ] **FTS5 empty-string guard** — syntax errors in search on empty input; search is the primary discovery mechanism
- [ ] **Deprecated model string update** — running on a deprecated API endpoint means Google can drop it without notice; pre-empt outage
- [ ] **Google Analytics G-0T526W3E1Z** — need baseline acquisition and engagement data from day one of public launch

### Add in Same Milestone (P1 — high value, low risk)

- [ ] **Mobile filter inline bar** — replaces Vaul bottom-sheet with the simpler inline pattern; improves mobile conversion funnel
- [ ] **Full-width mobile search** — accompanies mobile filter bar (same layout area)
- [ ] **Desktop tag cloud 18–20 tags** — single constant change; ship with the first PR
- [ ] **Sentry source maps** — enables readable error traces for any errors that surface post-launch

### Future Consideration (v3.2+)

- [ ] **GA4 e-commerce event mapping** — map `card_click` to `select_content` etc. for Google's recommended taxonomy; useful for funnel analysis but not day-one critical
- [ ] **Admin analytics dashboard for GA4 data** — bringing GA4 data into the admin Marketplace Intelligence view; requires GA4 Data API integration (non-trivial)
- [ ] **Deeper Sentry performance monitoring (tracing)** — Sentry has performance tracing beyond error tracking; useful once error volume is zero and performance becomes the next investigation target

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Expert email purge | HIGH (privacy, compliance) | MEDIUM | P0 |
| Photo proxy graceful fallback | HIGH (eliminates broken images) | MEDIUM | P0 |
| React redirect loop fix | HIGH (blank page for some users) | MEDIUM | P0 |
| FTS5 empty-string guard | HIGH (broken search) | LOW | P0 |
| Deprecated model string | MEDIUM (latent outage risk) | LOW | P0 |
| Google Analytics | HIGH (launch analytics) | LOW | P0 |
| Mobile filter inline bar | HIGH (UX improvement) | MEDIUM | P1 |
| Full-width mobile search | MEDIUM (touch UX) | LOW | P1 |
| Desktop tag cloud expansion | MEDIUM (discovery coverage) | LOW | P1 |
| Sentry source maps | MEDIUM (dev productivity) | LOW | P1 |
| GA4 custom event dual-fire | LOW (nice-to-have data) | LOW | P2 |
| GTM integration | LOW (marketing tooling) | MEDIUM | P3 (defer) |

**Priority key:**
- P0: Must have before any public launch announcement
- P1: Should ship in v3.1, no strong reason to defer
- P2: Nice to have, ship if time allows
- P3: Defer to future milestone

---

## Detailed Pattern Notes by Feature Area

### 1. Expert Email Removal

**The migration pattern (HIGH confidence — Alembic official docs, SQLite batch mode):**

SQLite does not support `ALTER TABLE ... DROP COLUMN` in older SQLite versions. Alembic handles this via batch mode, which: reflects the current table, creates a new table without the column, copies data via `INSERT INTO ... SELECT`, drops the old table, and renames the new one.

```python
# alembic migration
def upgrade():
    with op.batch_alter_table('experts') as batch_op:
        batch_op.drop_column('email')

def downgrade():
    with op.batch_alter_table('experts') as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(), nullable=True))
```

**Flat file sanitization:**

Both `data/metadata.json` and `data/experts.csv` need email fields removed. Python one-liner approach for the JSON:

```python
import json
with open('data/metadata.json') as f:
    experts = json.load(f)
for expert in experts:
    expert.pop('Email', None)
    expert.pop('email', None)  # both casings, per the capital+spaced field naming convention
with open('data/metadata.json', 'w') as f:
    json.dump(experts, f, indent=2)
```

Note: the field in `metadata.json` uses capital+spaced naming (`"Email"` not `"email"`). Check both casings.

**Import guard (prevent re-introduction):**

In the CSV import endpoint, after parsing the CSV rows, add:
```python
if any('email' in key.lower() for key in first_row.keys()):
    raise HTTPException(status_code=422, detail="Email field detected. Remove before import.")
```

---

### 2. Photo Proxy Graceful Fallback

**The correct pattern (MEDIUM confidence — FastAPI error handling official docs + SVG generation pattern):**

The proxy endpoint currently does `httpx.get(photo_url)` and forwards the response. On failure, it propagates the upstream error as a 502. The fix:

```python
@router.get("/api/photos/{username}")
async def proxy_photo(username: str, first_name: str = "", last_name: str = ""):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"https://tinrate.com/storage/{username}/avatar")
            if resp.status_code == 200:
                return Response(content=resp.content, media_type="image/jpeg")
    except Exception:
        pass  # fall through to monogram

    # Generate SVG monogram
    initials = (first_name[:1] + last_name[:1]).upper() or "?"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="200" height="200" fill="#7C3AED"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
            font-family="sans-serif" font-size="80" fill="white">{initials}</text>
    </svg>'''
    return Response(content=svg.encode(), media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=86400"})
```

This returns a valid image in all cases. The frontend never needs to handle a broken image state.

**Frontend implication:** Remove any `onError` broken-image fallback handlers on `<img>` tags pointing to this proxy — the proxy now handles it server-side.

---

### 3. Mobile Filter Inline Bar

**When to use inline vs bottom-sheet (MEDIUM confidence — NN/G + Pencil & Paper research):**

Bottom sheets are appropriate for: complex filter sets (5+ controls), filter operations requiring dedicated focus, or when filters need to be hidden to show context. They are NOT appropriate for: small filter sets (2–3 controls), cases where seeing the results while filtering is important, or where users filter frequently.

The TCS mobile filter set has 3 controls (text search, rate range, tags). This maps directly to the "small filter set, inline" pattern.

**Recommended layout for the inline filter bar:**

```
┌────────────────────────────────────────────────┐
│  [Search input — full width                  ] │  ← row 1: search
│  [Rate ▼      ] [Tags ▼                      ] │  ← row 2: two dropdowns
└────────────────────────────────────────────────┘
```

- Row 1: Full-width text search input (existing `SearchInput` component, remove width constraint)
- Row 2: Two dropdowns side-by-side, each 50% width
  - Rate dropdown: options like "Any rate", "Under €100/hr", "€100–200/hr", "Over €200/hr" — maps to `rateMax` values. This replaces the continuous slider (which is fine on desktop but awkward with touch). Discrete rate brackets are easier to tap.
  - Tags dropdown: a `<select multiple>` or a simple popover with checkboxes for the top 10–15 tags

**Rate slider vs rate dropdown on mobile (MEDIUM confidence — UX research consensus):**

Continuous sliders on mobile have notoriously poor UX: small touch targets, imprecise dragging, and difficulty setting exact values. Discrete rate brackets ("Under €100", "€100–250", etc.) are unambiguous to tap and cover the practical use cases. The existing `RateSlider` component with its `min/max/step` is the right desktop component; a `<select>` or button group is the right mobile component for the same filter.

**Existing state compatibility:**

The `filterSlice` stores `rateMax` as a number. The mobile rate dropdown must map bracket selections to the same `rateMax` values that the desktop slider uses. This preserves URL sync, filter chip display, and store state without any slice changes.

---

### 4. Google Analytics 4 Integration

**The correct gtag.js initialization pattern (HIGH confidence — November 2025 article + multiple sources confirmed):**

The critical error: arrow functions and spread operators break `gtag.js` because it relies on JavaScript's native `arguments` object, which arrow functions do not have. The bug causes silent failures — no console error, but no data in GA4.

**index.html injection (in `<head>`):**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }  // NOT: const gtag = (...args) => dataLayer.push(args)
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z', { send_page_view: false });  // false = manual SPA tracking
</script>
```

**Route-change tracking hook:**
```typescript
// src/hooks/useAnalytics.ts
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location]);
}
```

Mount in `App.tsx` (inside `<BrowserRouter>`, outside `<Routes>`).

**Key pitfalls (from research):**
1. Arrow function in `gtag` definition → silent failure (most common mistake)
2. `send_page_view: true` (default) → double-counts first page view when SPA hook also fires
3. Placing the `useAnalytics` hook outside `<BrowserRouter>` → `useLocation` throws a context error
4. Using `react-ga4` library → dependency on a 2-year stale package for 30 lines of code

---

### 5. FTS5 Empty-String Guard

**The error (HIGH confidence — SQLite FTS5 official spec + GitHub issue confirmed):**

`MATCH ''` (empty string) throws `fts5: syntax error near ""`. This is not a caught exception in the current implementation — it propagates as a 500 error. Any user who submits a search with only spaces, or triggers a search before typing, can hit this.

**Fix pattern:**
```python
def build_fts5_query(raw_query: str) -> str | None:
    """Return None if query is empty/whitespace — caller skips MATCH clause."""
    cleaned = raw_query.strip()
    if not cleaned:
        return None
    # Escape special FTS5 operators
    cleaned = cleaned.replace('"', '""')
    return f'"{cleaned}"*'  # prefix match

# In the search function:
fts_query = build_fts5_query(query)
if fts_query:
    stmt = stmt.where(text("experts_fts MATCH :q").bindparam(q=fts_query))
# else: skip MATCH clause entirely, return all experts (or return empty)
```

This should be applied everywhere a MATCH clause is constructed — search the codebase for `MATCH` to find all locations.

---

### 6. Sentry Source Maps

**The setup (HIGH confidence — official `@sentry/vite-plugin` docs):**

```bash
npm install -D @sentry/vite-plugin
```

```typescript
// vite.config.ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'your-org',
      project: 'tcs-frontend',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: 'hidden',  // generates maps, does NOT serve them to users
  },
});
```

Add `SENTRY_AUTH_TOKEN` to Vercel environment variables (not in `.env` committed to git).

**Why `sourcemap: 'hidden'` not `true`:** Setting `sourcemap: true` serves the source maps publicly alongside the bundle. This means anyone can read your original TypeScript source code. `'hidden'` generates maps for Sentry upload only — they are not referenced in the bundle and not served to browsers.

---

## Sources

**Mobile filter UX patterns:**
- [Mobile Filter UX Design Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters) — MEDIUM confidence
- [Bottom Sheets: Definition and UX Guidelines — Nielsen Norman Group](https://www.nngroup.com/articles/bottom-sheet/) — HIGH confidence (authoritative)
- [Getting Filters Right: UX/UI Design Patterns — LogRocket](https://blog.logrocket.com/ux-design/filtering-ux-ui-design-patterns-best-practices/) — MEDIUM confidence
- [15 Filter UI Patterns That Actually Work in 2025 — Bricx Labs](https://bricxlabs.com/blogs/universal-search-and-filters-ui) — MEDIUM confidence

**Google Analytics 4 / React SPA:**
- [Implementing Google Analytics 4 in React: The Right Way — Mykola Aleksandrov (Nov 2025)](https://www.mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/) — HIGH confidence (recent, detailed, argues against spread operator correctly)
- [Tracking Page Views in a React SPA with GA4 — DEV Community](https://dev.to/highcenburg/tracking-page-views-in-a-react-spa-with-google-analytics-4-1bd7) — MEDIUM confidence
- [How to integrate GA4 into a ReactJS app in 2025 — Medium](https://medium.com/@nicolas.nunge/how-to-integrate-google-analytics-ga4-into-a-reactjs-app-in-2025-b62e121d4590) — MEDIUM confidence
- [Track Single Page Apps with GA4 and GTM — Analytics Mania](https://www.analyticsmania.com/post/single-page-web-app-with-google-tag-manager/) — MEDIUM confidence

**Expert email data removal / GDPR:**
- [GDPR: Data Compliance Best Practices For 2025 — Alation](https://www.alation.com/blog/gdpr-data-compliance-best-practices-2025/) — MEDIUM confidence
- [GDPR & Data Deletion: When Can You Remove Personal Info? — Sprintlaw UK](https://sprintlaw.co.uk/articles/gdpr-data-deletion-when-can-you-remove-personal-info/) — MEDIUM confidence
- [Running Batch Migrations for SQLite — Alembic official docs](https://alembic.sqlalchemy.org/en/latest/batch.html) — HIGH confidence (official)

**Sentry + FastAPI + Vite:**
- [Setting Up Sentry with Vite and Source Maps — Medium](https://medium.com/@rachelcantor/setting-up-sentry-with-vite-and-source-maps-634231732ef1) — MEDIUM confidence
- [Source Maps — Sentry for React (official docs)](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/) — HIGH confidence
- [FastAPI + Sentry: Tracking and Debugging Errors — Medium](https://medium.com/@bhagyarana80/fastapi-sentry-tracking-and-debugging-errors-in-production-apis-9a2506cc164a) — MEDIUM confidence

**FTS5 empty string:**
- [SQLite FTS5 Extension — official spec](https://sqlite.org/fts5.html) — HIGH confidence
- [FTS5 syntax error near "" — SQLdelight GitHub issue](https://github.com/sqldelight/sqldelight/issues/3566) — HIGH confidence (confirmed behavior)

---

*Feature research for: TCS v3.1 Launch Hardening*
*Researched: 2026-02-26*
