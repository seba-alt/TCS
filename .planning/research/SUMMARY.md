# Project Research Summary

**Project:** TCS Expert Marketplace — v3.1 Launch Hardening
**Domain:** Expert Marketplace SPA — React + FastAPI, launch preparation milestone
**Researched:** 2026-02-26
**Confidence:** HIGH

## Executive Summary

v3.1 is a hardening milestone, not a feature milestone. The existing v3.0 product is live and functional; this milestone exists to fix known production errors, eliminate a privacy liability, replace one UX pattern, and add baseline analytics before a public launch announcement. All four research files confirm the same underlying reality: the work is narrowly scoped, the patterns are well-established, and the risks are execution risks (wrong scope, wrong pattern, wrong order) rather than technology risks. Zero new npm packages or pip packages are required across all four capability areas.

The recommended approach is to execute changes in dependency-driven order: purge expert email data first (the privacy liability is the highest-stakes item and is pure backend with no UI risk), then fix backend Sentry errors, then fix the frontend redirect loop, then add Google Analytics and expand the tag cloud, and finally replace the mobile filter drawer with inline controls (the most complex UI change, saved for last to isolate any layout regressions). Each phase is independently deployable. The codebase already contains all necessary abstractions — `trackEvent()`, Zustand filterSlice, idempotent lifespan migrations, and Sentry initialization — so each change is an extension of an existing pattern, not a new pattern.

The primary risks are: (1) accidental scope creep on the email purge — `Conversation.email` and `Feedback.email` must not be touched, only `Expert.email` and the data files; (2) live-sync instead of draft-apply on mobile filter dropdowns, which would hammer the API on every interaction; (3) the SQLite `ALTER TABLE ... DROP COLUMN` path, which is confirmed safe on SQLite 3.35+ but should also remove the field from the ORM model to make the change effective at the application layer. All three risks have clear prevention strategies documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The existing production stack requires no changes for v3.1. All four new capabilities are implemented with what is already installed: a single string constant change for the Gemini model, a raw SQL migration for the email column removal, native HTML `<select>` elements with Tailwind for the mobile filter bar, and a two-line `<script>` injection in `index.html` for GA4. The decision to reject every proposed new package (Alembic, react-ga4, @radix-ui/react-select, vite-plugin-radar) is well-supported — each adds maintenance burden for a task the existing stack handles directly.

**Core technology notes for v3.1:**
- **`gemini-2.5-flash-lite`**: Direct string replacement for deprecated `gemini-2.0-flash-lite` in `app/services/pilot_service.py` line 116 only. The main Sage model in `llm.py` is not touched. The lite variant is correct — Dutch language detection is a structured JSON extraction task where the full model would be wasteful.
- **Native `<select>` + Tailwind**: Correct choice for mobile rate filter. Native select triggers the OS-native picker on iOS/Android. Radix UI Select has a documented mobile touch event bug (#2083) and adds ~15 kB for plain text dropdowns.
- **Direct gtag.js (no library)**: `react-ga4` is unmaintained (last release 2023). Direct `gtag.js` in `index.html` plus a 30-line `useAnalytics` hook is the 2025 recommended approach. The `arguments` object pattern in `function gtag(){}` is critical — arrow functions break it silently with no console error.
- **Inline SQLite migration**: `ALTER TABLE experts DROP COLUMN email` in `main.py` lifespan block wrapped in `try/except`, combined with removing the field from the `Expert` ORM model. SQLite 3.35+ (confirmed on Railway) supports `DROP COLUMN` natively. Application-level model removal ensures SQLAlchemy never reads or writes the field regardless of migration status.

### Expected Features

This milestone has a clear P0/P1 split with no ambiguity.

**Must have before public launch (P0):**
- Expert email purge — GDPR data minimization; expert emails are stored but never displayed, used in search, or returned in any API response
- Photo proxy graceful fallback — highest-frequency Sentry error class; 502 responses from broken photo URLs pollute Sentry and show broken images on launch day
- React redirect loop fix — stack overflow for users arriving at `/explore`, `/marketplace`, `/browse`, `/chat`; causes Sentry noise on every such visit
- FTS5 empty-string guard — search is the primary discovery mechanism; `MATCH ''` is a SQLite syntax error that propagates as a 500
- Deprecated Gemini model string update — `gemini-2.0-flash-lite` shuts down June 1 2026; pre-empt outage
- Google Analytics G-0T526W3E1Z — need acquisition and engagement data from day one of public launch

**Should ship in v3.1 (P1 — high value, low risk):**
- Mobile filter inline bar — replaces Vaul bottom-sheet; eliminates the open/configure/close/see-results round-trip on mobile
- Full-width mobile search — accompanies mobile filter bar; same layout area, must be done in the same phase
- Desktop tag cloud expansion (12 → 18-20 tags) — single constant change; ships in the first PR of its phase
- Sentry source maps via `@sentry/vite-plugin` — enables readable stack traces for any post-launch errors (only new devDependency in the milestone)

**Defer to v3.2+:**
- GA4 e-commerce event taxonomy mapping (card_click → select_content, etc.)
- Admin dashboard integration of GA4 Data API
- Sentry performance tracing (useful once error volume is zero)
- Full mobile filter redesign with accordion sections or saved presets

### Architecture Approach

The v3.0 architecture is unchanged by v3.1 — every change is either a subtraction (removing the email column, deleting `MobileFilterSheet.tsx`) or a minimal targeted addition (gtag script tag, new `MobileFilterBar.tsx`, one-line migration in lifespan). The Zustand store, FastAPI router structure, FTS5/FAISS search pipeline, and Sentry instrumentation all continue as-is. The architecture document provides an exact file-by-file touch list confirmed by direct codebase inspection — every file name, line number, and integration point is verified.

**Component boundaries for v3.1:**
1. `MobileFilterBar.tsx` (NEW) — inline dropdown filter controls; writes directly to `useExplorerStore` via the same direct-store pattern as the desktop `FilterSidebar`; renders between Header and ExpertGrid on mobile
2. `MobileFilterSheet.tsx` (DELETE) — Vaul bottom-sheet replaced; `vaul` package must stay in `package.json` because `SageMobileSheet` in `RootLayout.tsx` also uses it
3. `tracking.ts` (MODIFY) — `window.gtag()` call added inside existing `trackEvent()` function body; augments, does not replace, internal `/api/events` tracking
4. `app/main.py` lifespan (MODIFY) — idempotent `ALTER TABLE experts DROP COLUMN email` migration block, matching the established pattern for other column migrations in this file
5. `app/routers/browse.py` (MODIFY) — photo proxy 502 → 404; semantically correct ("photo not found") and not treated as a server error by Sentry's default configuration
6. `app/services/pilot_service.py` (MODIFY) — one string constant change for Gemini model ID

**Architecture-driven build order:** Email purge → Backend error hardening → React redirect fix → Google Analytics + tag cloud → Mobile filter redesign

### Critical Pitfalls

1. **Wrong email purge scope** — `admin.py` has 20+ references to "email" across three distinct columns: `Expert.email` (purge), `Conversation.email` (keep — powers Leads page and search-by-email filter), `Feedback.email` (keep). A naive grep-and-delete breaks the admin Leads page. Prevention: define exact scope before touching any file — only `Expert.email`, `data/experts.csv`, and `data/metadata.json` (which uses capital+spaced field names: `"Email"`, not `"email"`).

2. **SQLite DROP COLUMN startup crash** — If `ALTER TABLE experts DROP COLUMN email` runs in the lifespan block and fails (any exception), the server enters a Railway restart loop. Prevention: use the established try/except idempotent pattern already in `main.py` for other migrations — catch all exceptions and pass. Additionally remove the field from the `Expert` ORM model, so the application-layer change is independent of the migration's success.

3. **Live-sync mobile dropdowns hammering API** — Binding new dropdown `onChange` handlers directly to Zustand setters triggers `useUrlSync` → `setSearchParams` → `useExplore` refetch on every interaction (30-60 requests/second during rate input). The existing `MobileFilterSheet` used a draft-apply pattern for this exact reason. Prevention: new `MobileFilterBar` must maintain local draft state and commit on blur or Apply — or use `setTags` (full array replace) instead of `toggleTag` (per-tag dispatch) to batch the commit.

4. **GA4 not tracking SPA route changes** — gtag.js fires one `page_view` on `DOMContentLoaded` (hard page load). React Router client-side navigation never fires it again. Prevention: set `send_page_view: false` in gtag config; add `useAnalytics` hook in `RootLayout.tsx` (inside RouterProvider context — not in `main.tsx`) that fires `page_view` on `useLocation` changes, depending only on `location.pathname` not `location.search` (to avoid treating filter changes as page views).

5. **Gemini model behavior change on swap** — The string change looks like a no-op but `gemini-2.5-flash-lite` may require `response_mime_type="application/json"` to guarantee structured output. If the new model returns unstructured text, Dutch detection fails silently (degrades to English — acceptable). If JSON parsing throws uncaught, Sage fails entirely (unacceptable). Prevention: add `response_mime_type="application/json"` to the `GenerateContentConfig` for the language detection call proactively; test with a Dutch query against the real API before deploying.

---

## Implications for Roadmap

Based on combined research, the milestone maps cleanly to 4 phases. Each phase is independently deployable and testable. The ordering is dependency-driven: highest-stakes/lowest-risk changes first, most complex UI change last. No phase requires new research — all patterns are documented to implementation level.

### Phase 1: Expert Email Purge

**Rationale:** The privacy liability must be eliminated before any public marketing drives traffic. This is pure backend — no UI risk, no user-facing change. If something breaks, it is caught before any other changes are layered on top. Defining the exact scope (Expert.email only) before touching files prevents the most dangerous pitfall in the milestone.
**Delivers:** `Expert.email` column removed from SQLite (via idempotent lifespan migration), from the `Expert` ORM model, from `data/experts.csv`, and from `data/metadata.json`. Admin CSV import endpoint ignores any uploaded `Email` column going forward. `Conversation.email` and `Feedback.email` explicitly preserved.
**Addresses:** "No personal email data exposed" (P0 table stakes), GDPR data minimization
**Avoids:** Wrong-scope purge pitfall (Pitfall 2 in PITFALLS.md), SQLite startup crash pitfall (Pitfall 1)
**Files:** `app/models.py`, `app/main.py`, `app/routers/admin.py`, `data/experts.csv`, `data/metadata.json`
**Research flag:** None needed — patterns are fully documented in ARCHITECTURE.md and STACK.md

### Phase 2: Backend Error Hardening + Gemini Model Update

**Rationale:** All remaining Sentry error sources are in Python files — no frontend changes. Grouping them together means one Railway deploy covers all backend fixes. The Gemini model update is included here because it is also a backend file and its verification (Dutch query returns translated FAISS results) should happen in the same deploy window.
**Delivers:** Photo proxy returns 404 instead of 502 on upstream failures — Sentry-silent. FTS5 `_safe_prefix_query` in `suggest.py` strips `*` characters to prevent invalid MATCH expressions. `gemini-2.5-flash-lite` model string with explicit `response_mime_type="application/json"` in language detection config. Zero backend Sentry errors on normal user flows after deploy.
**Addresses:** "Zero Sentry errors on normal user flows" (P0 table stakes), photo proxy graceful fallback (differentiator)
**Avoids:** FTS5 `*` input crash (Pitfall 6 in PITFALLS.md), Gemini behavior change on swap (Pitfall 7)
**Files:** `app/routers/browse.py`, `app/routers/suggest.py`, `app/services/pilot_service.py`
**Research flag:** None needed — all fix sites confirmed by direct codebase inspection

### Phase 3: Frontend Fixes + Google Analytics + Tag Cloud

**Rationale:** Three frontend changes that are independent of each other, all low-risk, all deploy together in one Vercel push. The redirect loop fix goes here (not with backend) because it is a `main.tsx` routing concern. Tag cloud expansion is the simplest change in the milestone and ships here as a zero-cost improvement. GA4 integration is additive-only.
**Delivers:** `RedirectWithParams` stack overflow resolved — zero `Maximum update depth exceeded` Sentry errors. GA4 tracking live: page views fire on initial load and on every React Router client-side route change. Desktop tag cloud shows 18-20 tags.
**Addresses:** React redirect loop fix (P0), Google Analytics (P0), Desktop tag cloud expansion (P1)
**Avoids:** GA not tracking SPA route changes (Pitfall 4), GA double-fire in StrictMode (use `import.meta.env.PROD` guard), GA tracking `location.search` polluting user query data in analytics
**Files:** `frontend/src/main.tsx`, `frontend/index.html`, `frontend/src/tracking.ts`, `frontend/src/vite-env.d.ts`, `frontend/src/components/sidebar/TagCloud.tsx`
**Research flag:** None needed for redirect fix and tag cloud. GA4 SPA integration has one known implementation nuance (`send_page_view: false` + `useLocation` hook in RootLayout, not main.tsx) — fully documented in FEATURES.md and PITFALLS.md.

### Phase 4: Mobile Filter Redesign

**Rationale:** The most complex UI change — creates a new component, deletes an existing component, modifies `MarketplacePage.tsx` layout, and may require adjusting `Header.tsx` flex behavior for full-width search. Saving it for last means all other v3.1 changes are already deployed and verified. Any layout regressions introduced here are unambiguously attributable to this phase.
**Delivers:** `MobileFilterSheet.tsx` (Vaul bottom-sheet) replaced by `MobileFilterBar.tsx` (inline dropdowns with direct-store writes, matching desktop sidebar pattern). Full-width search bar on mobile. Active filter count badge preserved and reading from `useFilterSlice`. Desktop `FilterSidebar` and `SageMobileSheet` (Vaul) unchanged.
**Addresses:** Mobile filters without drawer (P0 table stakes), Full-width mobile search (P1)
**Avoids:** Live-sync dropdowns hammering API (Pitfall 3), removing `vaul` package that Sage still uses (anti-pattern documented in ARCHITECTURE.md), draft state in live dropdowns (anti-pattern)
**Files:** `frontend/src/components/sidebar/MobileFilterSheet.tsx` (DELETE), `frontend/src/components/sidebar/MobileFilterBar.tsx` (NEW), `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/Header.tsx`
**Research flag:** Mobile filter UX pattern (inline vs bottom-sheet) is MEDIUM confidence per FEATURES.md — no authoritative A/B data for this exact context, but the explicit product requirement to replace the drawer and the NN/G bottom-sheet dismissal friction research make the direction clear.

### Phase Ordering Rationale

- Privacy-first ordering: email purge before any public traffic so there is never a window where PII is accessible after launch
- Backend before frontend: Railway deploy failures are isolated from Vercel deploy failures; easier to debug and roll back independently
- Low-risk frontend changes before high-risk layout work: analytics and tag cloud before mobile layout rework
- Mobile filter redesign last: most likely to surface layout regressions; isolated placement makes root-cause analysis straightforward
- Each phase is independently deployable: the milestone does not require all phases to ship simultaneously

### Research Flags

All phases have well-documented patterns — no phase requires `/gsd:research-phase` during planning:

- **Phase 1 (Email Purge):** Established SQLite migration + ORM pattern; all touch sites confirmed by direct code inspection. Known scope boundary (Expert.email only) is explicit.
- **Phase 2 (Backend Errors):** All fix sites are known with exact file and line references. Standard FastAPI error handling and SQLite FTS5 validation patterns.
- **Phase 3 (Frontend + GA4):** GA4 SPA integration pattern fully documented with correct nuances captured in FEATURES.md and PITFALLS.md. Redirect fix root cause identified in ARCHITECTURE.md. Tag cloud is a constant change.
- **Phase 4 (Mobile Filter):** Component boundaries and data flow fully mapped. Draft-apply vs live-sync requirement is explicit. Vaul retention requirement is explicit.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against current `package.json`, `requirements.txt`, and official docs. Zero new packages confirmed across all four capability areas. Every rejected package has documented rationale. |
| Features | HIGH (P0/P1) / MEDIUM (mobile UX pattern) | P0 and P1 prioritization is unambiguous. Mobile filter inline-vs-drawer has no authoritative A/B data for this exact professional marketplace context, but product requirement and NN/G research support the decision. |
| Architecture | HIGH | Based on direct codebase inspection of all relevant files — not inference. Every file, line number, and integration point is confirmed. Data flow diagrams in ARCHITECTURE.md are derived from actual component analysis. |
| Pitfalls | HIGH | All 7 pitfalls derived from direct code analysis plus targeted external research. Each pitfall has a confirmed prevention strategy, warning signs, recovery path, and a phase assignment. |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemini model behavior validation:** `gemini-2.5-flash-lite` structured JSON output compatibility with the existing `GenerateContentConfig` cannot be confirmed without a live API test. Plan: test with the actual Dutch detection prompt against the real API before merging Phase 2. Add `response_mime_type="application/json"` proactively as documented in PITFALLS.md.

- **`data/metadata.json` email field casing:** FEATURES.md and PITFALLS.md both note that `metadata.json` uses capital+spaced field names (`"Email"` not `"email"`). The purge script must pop both casings to be safe. Verify with `grep -i email data/metadata.json` after Phase 1 and before deploying.

- **Mobile filter active filter count badge:** PITFALLS.md flags that the badge must read from `useFilterSlice`, not from `MobileFilterSheet` local state. Confirm badge increment still works after replacing the component — this is a Phase 4 acceptance criterion.

- **Railway SQLite version confirmation:** STACK.md states SQLite 3.35+ is confirmed on Railway (local env is 3.50.4). If there is any uncertainty, the application-level ORM model removal makes the `ALTER TABLE` migration optional — SQLAlchemy will never reference the column even if it remains in the file.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `app/models.py`, `app/main.py`, `app/routers/admin.py`, `app/routers/browse.py`, `app/routers/suggest.py`, `app/services/pilot_service.py`, `app/services/explorer.py`
- Direct codebase inspection — `frontend/src/main.tsx`, `frontend/src/pages/MarketplacePage.tsx`, `frontend/src/components/sidebar/MobileFilterSheet.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/tracking.ts`, `frontend/src/instrument.ts`, `frontend/src/hooks/useUrlSync.ts`, `frontend/src/store/filterSlice.ts`, `frontend/src/layouts/RootLayout.tsx`, `frontend/index.html`
- [Gemini API deprecations](https://ai.google.dev/gemini-api/docs/deprecations) — `gemini-2.0-flash-lite` shutdown June 1, 2026; `gemini-2.5-flash-lite` confirmed as direct replacement
- [Gemini models page](https://ai.google.dev/gemini-api/docs/models) — `gemini-2.5-flash-lite` listed as current stable
- [SQLite ALTER TABLE DROP COLUMN — requires 3.35+](https://sqlite.org/lang_altertable.html)
- [Google gtag.js developer guide](https://developers.google.com/analytics/devguides/collection/gtagjs)
- [SQLite FTS5 Extension — MATCH syntax rules and special characters](https://sqlite.org/fts5.html)
- [Source Maps — Sentry for React (official docs)](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/)

### Secondary (MEDIUM confidence)
- [Implementing GA4 in React: The Right Way — Mykola Aleksandrov (Nov 2025)](https://www.mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/) — `arguments` object pattern, `send_page_view: false`, StrictMode double-fire prevention
- [Bottom Sheets: Definition and UX Guidelines — Nielsen Norman Group](https://www.nngroup.com/articles/bottom-sheet/) — bottom-sheet dismissal friction research
- [Mobile Filter UX Design Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters) — inline vs drawer filter pattern guidance
- [Radix UI Select mobile touch event bug #2083](https://github.com/radix-ui/primitives/issues/2083) — confirms native select over Radix for mobile dropdowns
- [React Router Navigate infinite loop issue #8733](https://github.com/remix-run/react-router/issues/8733) — root cause analysis for `RedirectWithParams` stack overflow
- [FTS5 syntax error near "" — SQLdelight issue #3566](https://github.com/sqldelight/sqldelight/issues/3566) — confirms FTS5 behavior on empty string input
- [Running Batch Migrations for SQLite — Alembic official docs](https://alembic.sqlalchemy.org/en/latest/batch.html) — context for why Alembic was evaluated and rejected

### Tertiary (supporting context)
- [react-ga4 npm](https://www.npmjs.com/package/react-ga4) — confirmed last published 3 years ago; reason for rejection
- [GDPR: Data Compliance Best Practices For 2025 — Alation](https://www.alation.com/blog/gdpr-data-compliance-best-practices-2025/) — data minimization principle context

---
*Research completed: 2026-02-26*
*Ready for roadmap: yes*
