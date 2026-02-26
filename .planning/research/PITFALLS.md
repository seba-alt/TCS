# Pitfalls Research

**Domain:** Adding launch-prep features to an existing live React + FastAPI expert marketplace (v3.1)
**Researched:** 2026-02-26
**Confidence:** HIGH — based on direct codebase analysis of `models.py`, `main.py`, `admin.py`, `explorer.py`, `suggest.py`, `pilot_service.py`, `MobileFilterSheet.tsx`, `useUrlSync.ts`, `filterSlice.ts`, `main.tsx`, `instrument.ts` plus targeted web research on each specific change class.

The five changes in v3.1 are each narrow but each carries a distinct failure mode:
1. Email column purge — SQLite schema + SQLAlchemy ORM + CSV + admin endpoints
2. Mobile filter UX — replace Vaul bottom-sheet with dropdowns while keeping Zustand + URL sync intact
3. Google Analytics — add gtag.js to a React SPA with client-side routing and StrictMode
4. React stack overflow fix — `RedirectWithParams` in `main.tsx`, `useUrlSync.ts` infinite loop
5. FTS5 empty-string crash + deprecated Gemini model — server-side validation gaps

---

## Critical Pitfalls

Mistakes that cause rewrites, broken state, or production crashes.

---

### Pitfall 1: Removing the `email` Column Crashes SQLite on Railway

**What goes wrong:**
SQLite does not support `ALTER TABLE ... DROP COLUMN` on versions below 3.35.0. Even on 3.35+, dropping a column that has an index (`index=True` on `Expert.email`) requires dropping the index first, then the column. If the `ALTER TABLE experts DROP COLUMN email` statement runs in the lifespan startup block and the Railway SQLite build does not support it, the server crashes at startup and never passes the healthcheck — Railway restarts the container in an infinite loop.

**Why it happens:**
The team assumes "SQLite supports DROP COLUMN now" after seeing it in documentation, but Railway's prebuilt SQLite version or the `sqlalchemy` dialect behavior may silently fall back to the old rebuild-based path. The `Expert.email` field also has `nullable=False, default=""` and an implicit column-level index that must be removed or recreated.

**Consequences:**
- Railway restart loop (startup crash before `yield`)
- Zero downtime impossible if the `DROP COLUMN` is in the lifespan block
- Sentry reports a `500` on every request because the server never comes up

**Prevention:**
- Do NOT use `ALTER TABLE ... DROP COLUMN`. SQLite support is unreliable in production environments.
- Use the application-level ignore approach instead:
  1. Remove `email` from the `Expert` SQLAlchemy model class definition
  2. Do NOT add any `ALTER TABLE` statement to `main.py` lifespan
  3. The column remains in the SQLite file but SQLAlchemy does not read or write it
  4. Purge email values by running a one-off `UPDATE experts SET email = ''` via the admin console or a script before the deploy
  5. Update the CSV seeding code (`_seed_experts_from_csv`) to not read the `Email` column
  6. Update `admin.py` bulk upload to not write the `email` field (already has `email=""` on new expert creation — verify the CSV upload path at line 1053)
- Verify: after deploy, check `db.scalars(select(Expert)).first()` does not expose `.email` — attribute access on the ORM object should raise `AttributeError`

**Warning signs:**
- Railway logs show `OperationalError: table experts has no column named email` (good — means model already cleaned)
- Railway logs show startup crash before `lifespan yield` (bad — means a DROP COLUMN was attempted)
- Sentry shows 0 requests after deploy (server never came up)

**Phase to address:** Email purge phase — must be implemented before any other v3.1 change is deployed, so that subsequent deploys do not re-seed email data.

---

### Pitfall 2: `Conversation.email` Column Is Still Referenced in Multiple Admin Endpoints

**What goes wrong:**
The `Expert.email` field is the primary target of the purge, but `Conversation.email` (line 19, `models.py`) is a separate column that stores user emails from the chat email-gate flow. The admin endpoints at lines 463–490 and 1198–1225 both filter by `Conversation.email`, and the `get_leads()` function at line 622 groups analytics by `Conversation.email`. The `Feedback.email` column also exists (line 73, nullable).

If the task is interpreted as "remove all email from the system", removing `Conversation.email` would break the Leads page and the `/admin/searches` filter-by-email feature. If interpreted as "remove expert emails only", the task is scoped correctly, but a developer rushing through may accidentally remove both.

**Why it happens:**
The word "email" appears in 20+ locations across `admin.py` alone. A naive grep-and-delete approach during the purge affects analytics columns that are not part of the expert privacy concern.

**Consequences:**
- Leads page returns 500 if `Conversation.email` is removed from model
- Admin `/api/admin/searches?email=...` filter silently stops working
- Confusion between the three distinct `email` columns: `Expert.email`, `Conversation.email`, `Feedback.email`

**Prevention:**
- Scope the purge precisely: only `Expert.email` and `data/experts.csv` `Email` column, and `data/metadata.json` (if it contains email fields)
- Add a comment to `models.py` after the change explaining which email columns remain and why
- Verify `metadata.json` — the file may contain an `"Email"` key per expert that must be nulled or removed separately from the SQLite operation

**Warning signs:**
- Admin Leads page returns 500 after the purge deploy
- `/api/admin/searches?email=foo@bar.com` returns 422 instead of filtered results

**Phase to address:** Email purge phase — define exact scope in the phase spec before touching any file.

---

### Pitfall 3: Removing Vaul Bottom-Sheet Breaks Zustand Filter State Synchronization

**What goes wrong:**
`MobileFilterSheet.tsx` uses a draft-apply pattern: it copies the Zustand store state into local `useState` on open, lets users edit the draft, then applies on "Apply" using `setQuery`, `setRateRange`, and `toggleTag` diffs. The new dropdown-based design must replicate this exact pattern or risk one of two failure modes:

- **Live sync model (wrong):** dropdowns write directly to Zustand on every change. Each change triggers `useUrlSync` to write to `window.history.replaceState`, which triggers `useExplore` to fetch — every single dropdown interaction causes a network request. On a mobile connection this causes stutter and wastes quota.
- **Draft model (correct but easy to get wrong):** dropdowns maintain local state and commit on blur/close. The commit must use `setQuery`/`setRateRange`/`setTags` (not `toggleTag` one by one) to avoid partial-state dispatches that fire `useExplore` multiple times.

**Why it happens:**
The bottom-sheet's draft-apply pattern is non-obvious from the component API surface. A developer adding inline dropdowns to the mobile toolbar area may default to binding dropdown `onChange` directly to store setters, not realizing each setter triggers `useUrlSync` → `setSearchParams` → `useExplore` refetch.

**Consequences:**
- Every rate slider drag sends a `/api/explore` request on mobile (30–60 requests per second during drag)
- Tag checkboxes each trigger a navigation history update and a full grid refetch
- URL flickers with every intermediate state, breaking browser back-button behavior

**Prevention:**
- Keep the draft-apply pattern from `MobileFilterSheet.tsx` regardless of UI component choice
- If using `<select>` dropdowns, maintain local state in the parent component and commit on `onBlur` or a "Apply" button click
- The `setTags` action (not `toggleTag`) should be used for committing tag arrays from the mobile panel — `setTags` replaces the full array in one dispatch
- Do not bind mobile filter controls to `useExplorerStore` selectors as controlled inputs — this creates the live-sync problem

**Warning signs:**
- Network tab shows `/api/explore` firing on every dropdown scroll or rate input keypress
- `useExplore`'s `loading` state flickers rapidly during filter interaction on mobile
- URL bar changes on every keystroke in rate inputs

**Phase to address:** Mobile filter redesign phase — the spec must explicitly say "draft-apply pattern required, no live sync".

---

### Pitfall 4: Google Analytics gtag.js Does Not Track Client-Side Route Changes Automatically

**What goes wrong:**
Adding the gtag.js snippet to `index.html` causes GA4 to fire exactly one `page_view` event on initial load — the hard browser load of the SPA. React Router's client-side navigation (`<Navigate>`, `useNavigate`, `<Link>`) does not trigger full page reloads, so GA4 never sees subsequent "page views." The GA4 dashboard will show all users stuck on `/` with 0 navigation events beyond landing.

**Why it happens:**
gtag.js is designed for multi-page applications. Its automatic `page_view` event fires on `DOMContentLoaded`, which happens once per browser session in an SPA. This app has only one real route (`/`) but the admin at `/admin/*` has many sub-routes, and the redirect routes (`/explore`, `/marketplace`, `/browse`, `/chat`) all need to fire a page_view when resolved.

**Consequences:**
- GA4 shows 100% of sessions as single-page views
- No data on admin section usage
- Legacy redirects appear invisible in analytics even though they fire and resolve

**Prevention:**
- Set `send_page_view: false` in the gtag config to disable automatic tracking
- Add a `useEffect` inside the `RouterProvider` tree (e.g., in `RootLayout.tsx`) that listens to `useLocation` and calls `window.gtag('event', 'page_view', { page_path: location.pathname })` on every location change
- Place this effect in `RootLayout.tsx`, not in `main.tsx`, because `useLocation` requires a Router context and `main.tsx` is above `RouterProvider`
- Guard against React 18 StrictMode double-fire in development by checking `import.meta.env.PROD` before firing, or use a `useRef` initialization guard (same pattern as `instrument.ts` uses `enabled: import.meta.env.PROD`)

**Warning signs:**
- GA4 Real-Time shows all active users on `/` even when navigating to `/admin`
- GA4 shows `session_duration` of 0 for most sessions (only one page_view per session)
- Console in dev shows `gtag is not a function` — means the `<script>` tag was placed below the gtag call

**Phase to address:** Google Analytics phase — add both the script tag and the `useLocation` effect in the same phase. Never add just the script tag without the SPA tracking hook.

---

### Pitfall 5: `RedirectWithParams` Causes Stack Overflow via `useSearchParams` Reference Instability

**What goes wrong:**
`RedirectWithParams` in `main.tsx` uses `useSearchParams()` to read the current search params, then renders `<Navigate to={...} replace />`. In React Router v7, `useSearchParams` returns a new `searchParams` object reference on every render. If `RedirectWithParams` is mounted inside a route that re-renders frequently (e.g., because `<RouterProvider>` re-renders on location change), the component re-renders → `Navigate` fires → location changes → `RouterProvider` re-renders → component re-renders again. This is the reported "React stack overflow" in PROJECT.md.

**Why it happens:**
`Navigate` with `replace` updates `window.history` but does not necessarily unmount the component immediately in React's concurrent rendering model. If the route condition that renders `<Navigate>` is never resolved (the path still matches after the navigation), `Navigate` fires again on the next render cycle.

**Consequences:**
- "Maximum update depth exceeded" React error in production
- Sentry captures a stack overflow on every visit to `/explore`, `/marketplace`, `/browse`, or `/chat`
- The redirect does work (user ends up at `/`) but the error floods Sentry

**Prevention:**
- The existing `RedirectWithParams` implementation is correct — the issue is likely that it is being rendered more than once due to a route matching ambiguity or because the legacy routes are not defined outside the `RootLayout` context
- Verify that the legacy redirect routes (`/explore`, `/marketplace`, `/browse`, `/chat`) are defined at the top level of the `createBrowserRouter` array, not inside the `element: <RootLayout>` children array — if they are inside `RootLayout`, RootLayout re-renders trigger re-renders of the redirect components
- Looking at `main.tsx` lines 42–57, the legacy redirects ARE at the top level (outside `RootLayout`). The fix is to ensure these routes do not match any path that is also matched by the `RootLayout` parent — confirm no wildcard `*` route is accidentally matching redirect paths
- Alternative: replace `RedirectWithParams` with a `loader`-based redirect (React Router v7 supports `redirect()` from loaders), which fires once server-side before any component renders

**Warning signs:**
- Sentry shows `Error: Maximum update depth exceeded` with a stack trace containing `Navigate` → `RouterProvider` → `Navigate` loop
- React DevTools Profiler shows the redirect component rendering 50+ times per second
- Browser console shows "Warning: Cannot update a component while rendering a different component"

**Phase to address:** Error fix phase — address before launch since Sentry is already capturing this in production.

---

### Pitfall 6: FTS5 Empty String Crash Is Not Fully Fixed by the Existing `_safe_fts_query` Sanitizer

**What goes wrong:**
`explorer.py` has `_safe_fts_query()` which strips special characters and returns an empty string for empty input. The check `if safe_q:` at line 223 correctly skips the FTS5 MATCH call when the query sanitizes to nothing. However, `suggest.py` has a separate sanitizer `_safe_prefix_query()` that appends `*` to the last word for prefix matching. If a user types a string composed entirely of FTS5 special characters (e.g., `"()"` or `"AND"`), `_safe_prefix_query` returns an empty string, and the function returns `[]` correctly — but there is a window where a single special character like `"*"` passes through the `len(q.strip()) >= 2` guard and reaches the MATCH clause as `"**"`, which is invalid FTS5 syntax.

**Why it happens:**
The `_safe_prefix_query` regex strips `[()"\+\-]` but does not strip `*`. An input of `"**"` passes the 2-char guard, the regex does not remove the asterisks, and `words = cleaned.split()` produces `["**"]`, then `words[-1] + "*"` becomes `"***"` — an invalid FTS5 expression.

**Consequences:**
- `suggest` endpoint returns 500 instead of `[]` for inputs containing `*`
- Sentry captures the error as an unhandled exception from the `db.execute(text(...))` call
- The `try/except Exception: continue` in `_run_suggest_multi` catches the error per column, so the endpoint actually returns `[]` gracefully — but Sentry still logs it as an error every time

**Prevention:**
- Add `*` to the stripped characters in `_safe_prefix_query`: change `r'[()"\+\-]'` to `r'[()"\+\-\*]'`
- Similarly verify `explorer.py`'s `_safe_fts_query` strips `*` — it does: `re.sub(r'[()"\*\+]', ' ', query)` already handles `*`
- After stripping in `_safe_prefix_query`, validate that `words` is non-empty before returning — the existing `if not words: return ""` guard handles this
- Add a test: call `_safe_prefix_query("***")` and assert it returns `""`

**Warning signs:**
- Sentry shows `sqlite3.OperationalError: fts5: syntax error` from `suggest.py`
- The error appears exactly when users type `*` in the search bar

**Phase to address:** FTS5 fix phase — one-line regex change plus a test.

---

### Pitfall 7: Deprecated `gemini-2.0-flash-lite` — Behavior Change on Model Swap

**What goes wrong:**
The Dutch language detection in `pilot_service.py` (line 116) uses `gemini-2.0-flash-lite`. This model is deprecated and scheduled for retirement June 1, 2026. The replacement is `gemini-2.5-flash-lite` (or `gemini-2.5-flash` if the lite variant is not yet available). The risk is not just the name change — model behavior can differ:

- `gemini-2.0-flash-lite` returns structured JSON for the language detection prompt; the newer model may require `response_mime_type="application/json"` to be set explicitly to guarantee structured output
- The `config=types.GenerateContentConfig(...)` block at line 118 may need `response_mime_type` added if the new model's default output format is text

**Why it happens:**
The model swap looks like a one-line change (`"gemini-2.0-flash-lite"` → `"gemini-2.5-flash-lite"`), and developers assume behavior is identical. In practice, "lite" model generations often have different default response formats, token limits, and JSON mode support.

**Consequences:**
- Language detection returns unparseable JSON, causing the Dutch detection to fail silently (falls back to English — acceptable)
- OR: language detection raises a `json.JSONDecodeError`, causing the entire Sage response to fail (unacceptable)
- The try/except at line 114 wraps the entire call, so failures degrade gracefully to English — but only if the exception propagates correctly

**Prevention:**
- Add `response_mime_type="application/json"` to the `GenerateContentConfig` for the language detection call if not already present — this forces structured JSON output regardless of model
- Test the new model with the exact existing prompt ("Is this Dutch? Return {lang: 'en'|'nl', english_message: str}") before deploying
- Keep the `try/except` fallback pattern — it already handles model failures gracefully

**Warning signs:**
- Sentry shows `json.JSONDecodeError` from the language detection try/except block
- Dutch queries suddenly stop being translated (Sage responds in Dutch context instead of searching in English)
- Railway logs show `google.genai.errors.ClientError: model not found` — the model name was wrong

**Phase to address:** Gemini model update phase — one-line change with a manual test against the real API before deploy.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Application-level email ignore (no DROP COLUMN) | No Railway downtime, no schema migration risk | `email` column stays in SQLite file forever (wasted storage, potential future confusion) | Always acceptable for SQLite — the cost is negligible at 530-row scale |
| Hardcoded `window.gtag` in RootLayout | No npm dependency needed | TypeScript will complain about unknown window property; must extend `Window` type or cast | Acceptable for MVP analytics; add type extension to silence TS errors |
| Single `useEffect` for GA page view tracking | Simple implementation | Fires on every location change including hash changes and filter changes encoded in URL | Acceptable if `page_path` is set to `location.pathname` only (not `location.search`), so filter changes don't create GA "page views" |
| Removing Vaul entirely rather than conditionally rendering | Simpler component tree | Vaul is also used for `SageMobileSheet.tsx` — removing it from `package.json` would break Sage on mobile | Never — check all Vaul usages before removing the package |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Analytics gtag.js | Placing `<script>` at bottom of `<body>` | Place in `<head>` before any other scripts; use `async` attribute |
| Google Analytics gtag.js | Calling `window.gtag()` before the script loads | Guard with `typeof window.gtag === 'function'` check or use the `dataLayer.push` fallback |
| Google Analytics gtag.js | Firing `page_view` on every `useEffect` re-render (not just route changes) | Depend only on `location.pathname` in the effect; do NOT depend on `location.search` |
| Gemini API model names | Assuming `gemini-2.5-flash-lite` is available — it may not be GA yet | Check `https://ai.google.dev/gemini-api/docs/models` for current model IDs before coding |
| Railway SQLite | Running DDL (ALTER TABLE) in the lifespan block | Use `try/except OperationalError: pass` for additive migrations; never use DROP COLUMN |
| Sentry (existing) | Adding `gtag.js` interferes with Sentry's `browserTracingIntegration` | Both can coexist; do not set `traces_sample_rate` to 1.0 in either tool in production |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Live-sync mobile dropdowns writing to Zustand on every change | `/api/explore` called 30+ times per second during rate input | Draft-apply pattern: write to local state, commit on blur/close | Immediately at first user interaction |
| GA page_view on every `location` change including `location.search` | GA shows 50+ page views per session when users filter experts | Track only `location.pathname`, not `location.search` | At first filter interaction |
| Keeping `vaul` in dev deps but removing all Vaul usages | Build succeeds but bundle is larger than needed | Remove `vaul` from `package.json` only after verifying `SageMobileSheet.tsx` is also refactored | At next bundle analysis |
| FTS5 suggest endpoint called on every keystroke without debounce | 300ms debounce already in place in `useHeaderSearch.ts` — this trap is already avoided | No action needed — existing debounce is correct | Not currently a risk |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Purging `Expert.email` from the model but not from `data/metadata.json` | Email data remains in the deployed JSON file, accessible if the file is served statically | Audit `metadata.json` for email fields before deploy; null or delete the `Email` key per record |
| Purging `Expert.email` from the model but not from `data/experts.csv` | Future admin bulk-upload reads the CSV and re-seeds email data into the DB | Remove or blank the `Email` column in `experts.csv` as part of the same PR |
| Adding `window.gtag` tracking of `location.search` | Filter parameter values (query text) appear in GA session data | Track only `location.pathname`; do not pass `page_location` with the full URL including search params |
| GA Measurement ID hardcoded in frontend source | ID is public (frontend JS is readable) — this is acceptable for GA but the ID should match the domain | Confirm `G-0T526W3E1Z` is registered for the correct Vercel domain in the GA4 property settings |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mobile dropdowns without a visible "active filter" indicator | Users cannot tell which filters are active after collapsing dropdowns | Preserve the existing `activeFilterCount` badge on the Filters button — count must still update as filters are applied |
| Full-width search bar on mobile pushes filter button off-screen | Users cannot access filters | Use a row layout: `search bar (flex-1)` + `filter button (shrink-0)`; search takes remaining space, filter button is always visible |
| Replacing Vaul bottom-sheet for filters but keeping Vaul for Sage mobile sheet | Inconsistent interaction model — swipe-up for Sage, tap-dropdown for filters | This inconsistency is intentional and acceptable: Sage is a conversation assistant (sheet is correct), filters are transactional controls (dropdowns are correct) |
| Tag cloud expanding from 12 to 18-20 tags breaking layout | Long tag cloud overlaps sidebar content or pushes the grid below the fold | Verify `TagCloud.tsx` uses a wrapping flex container (not an absolute height constraint); test at 768px viewport width |
| Removing bottom-sheet without removing the "Filters" button trigger | Button opens nothing; users confused | Remove or repurpose the filters button to open an inline panel or expand a header row of dropdowns |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Email purge:** `Expert.email` removed from model — verify `data/metadata.json` email fields are also nulled/removed
- [ ] **Email purge:** `experts.csv` `Email` column is blank or removed — verify the column header still exists (to avoid CSV parse errors in the bulk upload path if the header count changes)
- [ ] **Email purge:** `admin.py` new-expert creation already uses `email=""` (line 928) — verify the CSV bulk upload path at line 1053 does not still write `email=` from CSV data
- [ ] **GA integration:** `window.gtag` declared with correct TypeScript type extension — verify no TS build errors in CI
- [ ] **GA integration:** `send_page_view: false` is set in the gtag config — verify in GA4 DebugView that only one `page_view` fires on initial load, not a second one from the `useLocation` effect
- [ ] **Mobile filters:** `activeFilterCount` badge on the mobile Filters button still increments when inline dropdowns are used — verify the badge reads from `useFilterSlice` not from MobileFilterSheet local state
- [ ] **Gemini model update:** `gemini-2.0-flash-lite` is replaced in `pilot_service.py` line 116 — verify the language detection still returns correct `{lang, english_message}` JSON shape with the new model
- [ ] **FTS5 fix:** `_safe_prefix_query` in `suggest.py` strips `*` — verify by manually calling `GET /api/suggest?q=***` and confirming 200 `[]` response, not 500

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Railway startup crash from attempted DROP COLUMN | HIGH | Revert the migration code, redeploy; DB file is unchanged since Railway volume persists across restarts |
| GA tracking fires on every search param change | LOW | Update the `useEffect` dependency to `[location.pathname]` only; redeploy Vercel (auto on push) |
| Live-sync mobile dropdowns hammering API | MEDIUM | Revert to draft-apply pattern in the new dropdown component; test before redeploy |
| Gemini model name typo causing 404 from Google API | LOW | Fix model string, redeploy; all Gemini calls have try/except fallback so no user-facing crash |
| FTS5 `suggest` endpoint returning 500 on `*` input | LOW | One-line regex fix in `suggest.py`; Railway auto-deploys on push |
| `Conversation.email` accidentally removed breaking Leads page | HIGH | Restore column via `ALTER TABLE conversations ADD COLUMN email TEXT`; this is an additive migration (always safe); redeploy |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SQLite DROP COLUMN crash | Email purge phase | Railway startup logs show no `OperationalError`; Sentry shows 0 errors post-deploy |
| `Conversation.email` / wrong scope purge | Email purge phase — scope definition step | Admin Leads page returns 200 with data after deploy |
| `metadata.json` / `experts.csv` email not purged | Email purge phase — data file update step | `grep -i email data/metadata.json` returns no email values |
| Mobile live-sync instead of draft-apply | Mobile filter redesign phase — architecture decision | Network tab shows 0 `/api/explore` calls during dropdown interaction before Apply |
| GA not tracking client-side routes | Google Analytics phase — SPA hook implementation | GA4 DebugView shows distinct `page_view` events when navigating to `/admin` |
| GA double-fire in StrictMode | Google Analytics phase — env guard | GA4 DebugView shows exactly 1 `page_view` on initial load in production |
| `RedirectWithParams` stack overflow | React error fix phase | Sentry shows 0 `Maximum update depth exceeded` errors after deploy |
| FTS5 `*` input crash | FTS5 fix phase — one-line regex | `GET /api/suggest?q=***` returns `200 []`; no Sentry errors for that input |
| Gemini model deprecation behavior change | Gemini model update phase | Dutch query test: "Ik zoek een consultant voor marketing" returns English-translated FAISS results |

---

## Sources

- Direct codebase analysis: `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/routers/suggest.py`, `app/services/explorer.py`, `app/services/pilot_service.py`, `frontend/src/main.tsx`, `frontend/src/hooks/useUrlSync.ts`, `frontend/src/components/sidebar/MobileFilterSheet.tsx`, `frontend/src/store/filterSlice.ts`, `frontend/src/instrument.ts`
- [SQLite ALTER TABLE & How To Overcome Its Limitations](https://www.sqlitetutorial.net/sqlite-alter-table/) — confirms DROP COLUMN limitations and workarounds
- [Fixing ALTER TABLE errors with Flask-Migrate and SQLite](https://blog.miguelgrinberg.com/post/fixing-alter-table-errors-with-flask-migrate-and-sqlite) — Alembic batch mode and application-level ignore patterns
- [Implementing Google Analytics 4 in React: The Right Way](https://www.mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/) — StrictMode double-fire prevention, `send_page_view: false` pattern
- [Tracking Page Views in a React SPA with Google Analytics 4](https://dev.to/highcenburg/tracking-page-views-in-a-react-spa-with-google-analytics-4-1bd7) — `useLocation` + `useEffect` pattern for client-side route tracking
- [React Router Navigate infinite loop issue #8733](https://github.com/remix-run/react-router/issues/8733) — root cause of `<Navigate>` mounted-after-navigation infinite loop
- [Gemini API deprecations](https://ai.google.dev/gemini-api/docs/deprecations) — official deprecation dates and replacement model names
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) — current model IDs and capabilities
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html) — FTS5 MATCH syntax rules and special character handling

---
*Pitfalls research for: v3.1 Launch Prep — email purge, mobile UX redesign, Google Analytics, React error fixes, Gemini model update*
*Researched: 2026-02-26*
