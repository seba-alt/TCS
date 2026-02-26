# Stack Research

**Domain:** Expert Marketplace — v3.1 Launch Hardening additions only
**Researched:** 2026-02-26
**Research Mode:** Ecosystem (Subsequent Milestone — stack additions only)
**Confidence:** HIGH for all items — verified against current package.json, requirements.txt, and official documentation

---

## Scope of This Document

Covers ONLY what is new or changed for v3.1 Launch Prep. The existing production stack is validated and must not change:

- **Backend:** FastAPI 0.129.* + SQLAlchemy 2.0.* + SQLite + faiss-cpu 1.13.* + google-genai 1.64.* + tenacity 8.4.* + httpx 0.28.*
- **Frontend:** React 19.2 + Vite 7.3 + Tailwind v3.4 + React Router v7 + motion/react v12.34 + Zustand v5.0.11 + react-virtuoso 4.18 + vaul 1.1.2 + lucide-react 0.575

The four new capability areas for v3.1:

1. Gemini model update (deprecated `gemini-2.0-flash-lite` → `gemini-2.5-flash-lite`)
2. Expert email column removal from DB, CSV, and ORM model
3. Mobile filter UX redesign (Vaul bottom-sheet → inline dropdown controls)
4. Google Analytics GA4 integration (gtag.js, measurement ID `G-0T526W3E1Z`)

---

## 1. Gemini Model Update — String Constant Change Only

### What Is Deprecated

`gemini-2.0-flash-lite` is used in one location: `app/services/pilot_service.py` line 116, in the `_detect_and_translate()` function for Dutch language detection.

`gemini-2.5-flash` (the main generation model in `llm.py`) is already current and does not need updating.

### Replacement

**`gemini-2.5-flash-lite`** — the direct successor, confirmed on the official Gemini deprecations page and models page.

| Attribute | Old | New |
|-----------|-----|-----|
| Model ID string | `"gemini-2.0-flash-lite"` | `"gemini-2.5-flash-lite"` |
| SDK | google-genai (unchanged) | google-genai (unchanged) |
| API | Gemini API (unchanged) | Gemini API (unchanged) |
| Shutdown date of old model | June 1, 2026 | — |

### Why gemini-2.5-flash-lite (Not gemini-2.5-flash)

The Dutch detection call is a structured JSON extraction — a tiny `{"lang": ..., "english": ...}` response. `gemini-2.5-flash-lite` is the fastest, cheapest model in the 2.5 family and is explicitly recommended for "low latency and high volume tasks." Using the heavier `gemini-2.5-flash` here would be wasteful and inconsistent with the existing design intent.

### No Package Change Required

`google-genai==1.64.*` supports `gemini-2.5-flash-lite`. The model ID is a string constant — no requirements.txt update needed.

### Change Required

```python
# app/services/pilot_service.py — one line change
# Before:
model="gemini-2.0-flash-lite",
# After:
model="gemini-2.5-flash-lite",
```

### Confidence: HIGH

Source: [Gemini API deprecations](https://ai.google.dev/gemini-api/docs/deprecations) — shutdown June 1, 2026, replacement `gemini-2.5-flash-lite` confirmed. [Gemini models page](https://ai.google.dev/gemini-api/docs/models) — `gemini-2.5-flash-lite` listed as current stable.

---

## 2. Expert Email Column Removal — Raw SQL Migration, No Alembic

### Context

The `Expert` SQLAlchemy model has an `email` field (`String(320)`, non-nullable with default `""`). The project has no Alembic setup — all migrations are inline raw SQL executed at startup in `app/main.py` using `engine.connect()` + `text()`. This is the established project pattern.

### Approach: SQLite DROP COLUMN (native, no batch mode needed)

SQLite has supported `ALTER TABLE ... DROP COLUMN` natively since version **3.35.0** (released March 2021). The local environment runs SQLite 3.50.4. Railway uses Python's built-in `sqlite3` module, which ships with modern Python 3.11/3.12/3.13 — all well above 3.35. No compatibility concern.

**Pattern used by this project (raw SQL in startup lifespan):**

```python
# app/main.py — add to startup lifespan block (same pattern as existing migrations)
with engine.connect() as _conn:
    try:
        _conn.execute(_text("ALTER TABLE experts DROP COLUMN email"))
        _conn.commit()
    except Exception:
        pass  # Column already dropped — idempotent
log.info("startup: expert email column dropped")
```

### What Else Must Change

Beyond the DB column, the email purge touches three places:

| Location | Change |
|----------|--------|
| `app/models.py` — `Expert` class | Remove `email: Mapped[str]` field |
| `app/routers/admin.py` — CSV import (line 1035, 1053) | Remove `email` from CSV ingestion |
| `data/experts.csv` | Delete the `Email` column from the file |
| `app/routers/admin.py` — `POST /api/admin/experts` (line 928) | Remove `email=""` from Expert object creation |
| Future CSV upload validation | Reject uploads that include an `email` column |

### No New Packages

This is pure SQLAlchemy + raw SQL. No Alembic, no migration framework — consistent with the rest of the project.

### Why Not Alembic

Alembic adds a versions directory, migration scripts, and a separate alembic.ini. For a SQLite-backed project that already uses inline migrations and has no existing Alembic setup, adding it for a single column drop introduces significant complexity with zero benefit. The inline pattern used throughout `main.py` is battle-tested in this codebase.

### Confidence: HIGH

SQLite 3.35+ DROP COLUMN confirmed at [sqlite.org/lang_altertable.html](https://sqlite.org/lang_altertable.html). Project migration pattern verified in `app/main.py`.

---

## 3. Mobile Filter UX — Native HTML Select, No New Package

### Current State

The Vaul bottom-sheet (`MobileFilterSheet.tsx`) is a full-screen drawer triggered by a filter button in the mobile header. It contains a text search input, two number inputs for rate range, and a scrollable tag multi-select. The requirement is to replace this with inline dropdown controls — filters visible in the mobile layout without a drawer.

### Recommendation: Native `<select>` + Tailwind, Zero New Dependencies

For the mobile filter controls (rate range presets, tag category select), native `<select>` elements styled with Tailwind are the right tool.

**Rationale:**

- Native `<select>` triggers the OS-native picker on iOS/Android — the correct mobile UX, with accessible scrolling and no touch event conflicts.
- The existing tag filter uses a multi-select chip interface (not a single-select dropdown). This is retained as chips but moved inline below the search bar, not inside a drawer.
- Rate filter can become a `<select>` with preset brackets (€0-500, €500-1500, etc.) or remain as number inputs but rendered inline. Either avoids the drawer.
- No Radix UI `Select` or Headless UI needed — the added JS bundle cost (Radix Select alone is ~15 kB) is unjustified when native `<select>` handles simple option lists.

**When a custom select IS needed:** Only if the dropdown must show custom option styling (avatars, colors, multi-line). Not the case here — filter options are plain text labels.

**Tailwind styling pattern for native select:**

```tsx
// Styled native select — works cross-browser, mobile-optimal
<select
  value={ratePreset}
  onChange={(e) => setRatePreset(e.target.value)}
  className="w-full appearance-none bg-white border border-gray-300 rounded-lg
             px-3 py-2 text-sm text-gray-700 focus:outline-none
             focus:ring-2 focus:ring-brand-purple"
>
  <option value="">Any rate</option>
  <option value="0-500">Under €500/hr</option>
  <option value="500-1500">€500–1500/hr</option>
  <option value="1500+">Over €1500/hr</option>
</select>
```

**Tag filter stays as chip multi-select** — there is no native HTML control for multi-select that is usable on mobile. The chip-based approach remains but is relocated to render inline (collapsed/expandable row) rather than inside the Vaul drawer.

### What Happens to Vaul

`vaul` (v1.1.2) is already installed and used for the **Sage bottom sheet** (`SagePanel.tsx` mobile mode). Do NOT remove vaul from package.json — it is still needed. Only `MobileFilterSheet.tsx` is removed/replaced.

### No New Packages

```
# Nothing to install — native HTML + Tailwind only
```

### Alternatives Considered

| Option | Verdict |
|--------|---------|
| Radix UI Select (`@radix-ui/react-select`) | Rejected — ~15 kB for plain text dropdowns; touch events on mobile have documented bug (#2083 in radix-ui/primitives); overkill |
| Headless UI Select | Rejected — adds a dependency for a thin native select wrapper; Tailwind forms plugin already handles this |
| `react-select` | Rejected — 26 kB bundle, designed for searchable multi-selects; too heavy |
| Keep Vaul for filters | Rejected — the explicit requirement is to replace the bottom-sheet UX |

### Confidence: HIGH

Verified against existing `MobileFilterSheet.tsx` and `vaul` usage in the codebase. Native select mobile behavior confirmed via MDN + Tailwind CSS docs. Radix UI touch bug confirmed at [radix-ui/primitives#2083](https://github.com/radix-ui/primitives/issues/2083).

---

## 4. Google Analytics GA4 — Manual gtag.js Script, No Library

### Recommendation

**No new npm package.** Add the standard GA4 `gtag.js` script snippet directly to `frontend/index.html`. Track route changes manually with a `useEffect` in `App.tsx` or a dedicated hook.

### Why Not react-ga4

`react-ga4` (latest: v2.1.0) was last published **3 years ago** and is unmaintained. The `react-ga` ecosystem generally wraps an API that Google has superseded. For a Vite SPA with React Router v7, the direct gtag.js integration is simpler, has no runtime dependency, and is what Google officially recommends.

### Why Not vite-plugin-radar

`vite-plugin-radar` works but is a build-time plugin that adds complexity for what is a two-line `index.html` change. The plugin is also not well-maintained for Vite 7.

### Implementation Pattern

**Step 1: Add script to `frontend/index.html`**

```html
<!-- Google Analytics — add before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0T526W3E1Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0T526W3E1Z', { send_page_view: false });
</script>
```

`send_page_view: false` disables the automatic page view (which only fires once on load for SPAs). Route change page views are sent manually.

**Step 2: TypeScript declaration (no @types package needed)**

```typescript
// frontend/src/vite-env.d.ts — add to existing file
declare function gtag(...args: unknown[]): void;
declare const dataLayer: unknown[];
```

**Step 3: Route-change tracking hook**

```typescript
// frontend/src/hooks/useAnalytics.ts
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      })
    }
  }, [location])
}
```

Mount in `App.tsx` (top-level) so every route change is tracked.

**Critical implementation note:** The `gtag` function MUST use `arguments` (not spread operators). The script tag above uses the correct `function gtag(){dataLayer.push(arguments);}` pattern — do not refactor with arrow functions or spread.

### Custom Event Tracking

The existing `trackEvent()` module in `frontend/src/tracking.ts` is a fire-and-forget internal analytics call to the FastAPI backend. GA4 tracking is a separate parallel concern — they coexist. For GA4 events:

```typescript
// Fire GA4 custom events alongside existing internal tracking
gtag('event', 'expert_card_click', { expert_id: id, rank })
gtag('event', 'sage_query', { result_count: n })
```

This is optional for v3.1 — page views alone satisfy the analytics requirement.

### No npm Install Required

```bash
# Nothing to install — script tag in index.html only
```

### Alternatives Considered

| Option | Verdict |
|--------|---------|
| `react-ga4` (v2.1.0) | Rejected — 3 years unmaintained, unnecessary abstraction layer |
| `vite-plugin-radar` | Rejected — build complexity overhead for a two-line HTML change |
| Google Tag Manager (GTM) | Over-engineered for a direct GA4 measurement ID; GTM adds a second script tag and a container layer. Use direct gtag.js. |
| `@connectaryal/google-analytics` | Rejected — new/small package, not battle-tested; direct gtag.js is simpler |

### Confidence: HIGH

Direct gtag.js integration is the approach documented at [developers.google.com/analytics/devguides/collection/gtagjs](https://developers.google.com/analytics/devguides/collection/gtagjs). SPA page view pattern verified across multiple 2025 implementation guides.

---

## Summary: Net-New Packages for v3.1

**None.** All four v3.1 features require zero new npm packages and zero requirements.txt changes.

| Feature | What Changes | Package Delta |
|---------|-------------|---------------|
| Gemini model update | 1 string constant in `pilot_service.py` | None |
| Expert email purge | ORM model + raw SQL migration + CSV + admin routes | None |
| Mobile filter UX | Replace `MobileFilterSheet.tsx` with inline Tailwind selects | None (vaul stays for Sage) |
| Google Analytics | 2-line script in `index.html` + hook | None |

---

## What NOT to Add

| Rejected Package | Reason | Use Instead |
|-----------------|--------|-------------|
| `alembic` | No existing setup; inline raw SQL is the project pattern; single column drop doesn't justify migration framework | Raw `ALTER TABLE experts DROP COLUMN email` via `engine.connect()` |
| `react-ga4` | Unmaintained (last release 3 years ago); adds a layer over an API Google itself documents directly | Manual gtag.js script tag in index.html |
| `@radix-ui/react-select` | ~15 kB for plain text dropdowns; documented mobile touch event bug; already have `@radix-ui/react-slider` | Native `<select>` with Tailwind |
| `react-select` | 26 kB, designed for searchable multi-selects; vastly over-engineered for rate preset dropdowns | Native `<select>` with Tailwind |
| `vite-plugin-radar` | Build-time plugin for what is a two-line index.html change; not well-maintained for Vite 7 | gtag.js script tag |
| `headlessui` | Full component library for a single select element; already have Radix Slider in stack | Native `<select>` |

---

## Sources

- [Gemini API deprecations — gemini-2.0-flash-lite shutdown June 1, 2026](https://ai.google.dev/gemini-api/docs/deprecations)
- [Gemini models page — gemini-2.5-flash-lite current stable](https://ai.google.dev/gemini-api/docs/models)
- [SQLite ALTER TABLE DROP COLUMN — requires 3.35+](https://sqlite.org/lang_altertable.html)
- [Google gtag.js developer guide](https://developers.google.com/analytics/devguides/collection/gtagjs)
- [react-ga4 npm — last published 3 years ago, v2.1.0](https://www.npmjs.com/package/react-ga4)
- [Radix UI Select mobile touch bug #2083](https://github.com/radix-ui/primitives/issues/2083)
- [Implementing GA4 in React: The Right Way (Nov 2025)](https://www.mykolaaleksandrov.dev/posts/2025/11/react-google-analytics-implementation/)
- Current `frontend/package.json` and `requirements.txt` verified directly
- `app/models.py`, `app/services/pilot_service.py`, `app/main.py`, `frontend/src/components/sidebar/MobileFilterSheet.tsx` verified directly

---
*Stack research for: Expert Marketplace v3.1 Launch Prep*
*Researched: 2026-02-26*
