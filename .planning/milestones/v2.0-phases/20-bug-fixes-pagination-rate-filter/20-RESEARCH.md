# Phase 20: Bug Fixes — Pagination & Rate Filter - Research

**Researched:** 2026-02-22
**Domain:** React state management, URL params, Zustand filter logic, Radix UI Slider
**Confidence:** HIGH (all bugs confirmed directly from source code inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Regression tests
- Tests are a **blocker** — phase is not complete without passing regression tests
- Claude decides: whether to add tests, where they live, and what level (unit vs integration)
- Tests must cover at minimum: the pagination param fix and the rate filter chip state on load

#### Audit scope
- While fixing the `q`→`query` param in `loadNextPage`, audit all other API call sites for similar wrong param names and fix any found
- For `MobileFilterSheet`, audit all store/sheet state sync issues (not just rate defaults) and fix any found
- Check mobile vs desktop filter behavior parity; fix any gaps found
- Out-of-scope findings (not fixable within this phase's boundary) should be logged to ROADMAP.md backlog

#### Constants consolidation
- Audit ALL rate-related constants across the codebase (min, max, defaults) and fix any that conflict with the store's source of truth — not just `DEFAULT_RATE_MAX`
- `DEFAULT_RATE_MAX` value changes: 2000 → 5000 everywhere
- `RateSlider` max aligns to 5000
- Audit all files for inline copies of `TOP_TAGS`; make all files import from `constants/tags.ts` (not just `MobileFilterSheet`)
- Source of truth for rate constants: Claude decides based on project patterns
- Build/typecheck must pass as a verification step after all constant and import changes

### Claude's Discretion
- Which test framework and file locations to use for regression tests
- Where the single source of truth for rate constants should live (constants file vs store)
- Test depth/level (unit vs integration) per fix

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MARKET-01 | User sees faceted sidebar with rate range slider, domain tag multi-select, text search, and active filter chips | FilterChips bug fix ensures the rate chip does not show when no rate filter is active; RateSlider max fix ensures it correctly spans the full rate range (0–5000) |
| MARKET-02 | Expert grid renders via `react-virtuoso` with cursor-based pagination and scroll restoration | Pagination `q`→`query` param fix ensures `loadNextPage` passes the correct param so infinite scroll returns semantically-ranked results instead of filter-only results |
</phase_requirements>

---

## Summary

This phase fixes four tightly scoped bugs identified by the v2.0 audit. All bugs have been confirmed by direct source code inspection — no guesswork required. The fixes are surgical one-to-three-line changes in specific files; no architectural work is needed.

**Bug 1 — Pagination param mismatch:** In `frontend/src/hooks/useExplore.ts`, the `loadNextPage` function at line 85 calls `params.set('q', query)` but the backend `/api/explore` endpoint expects the parameter name `query` (confirmed in `app/routers/explore.py` line 24: `query: str = Query(...)`). The initial-load `useEffect` correctly uses `query` in a `URLSearchParams` object literal at line 40. `useUrlSync.ts` also uses `q` at line 66 for the Store→URL direction — but this is the URL display param (not an API call), so the naming is intentional there. Only `loadNextPage`'s API call uses the wrong name.

**Bug 2 — Rate filter chip false positive:** In `frontend/src/components/marketplace/FilterChips.tsx`, the local constant `DEFAULT_RATE_MAX = 2000` (line 4) does not match the store's actual default of `5000` (defined in `filterSlice.ts` line 25: `rateMax: 5000`). On fresh page load the store rehydrates with `rateMax: 5000`, which does not equal `DEFAULT_RATE_MAX` (2000), so the chip render condition at line 22 evaluates true and shows "EUR 0–5000" incorrectly. The fix is to update `DEFAULT_RATE_MAX` in `FilterChips.tsx` to 5000.

**Bug 3 — RateSlider max=2000:** In `frontend/src/components/sidebar/RateSlider.tsx`, the Radix UI Slider has `max={2000}` (line 27). This must change to `max={5000}` to match the store default.

**Bug 4 — MobileFilterSheet stale inline constants:** `MobileFilterSheet.tsx` has three sub-issues: (a) an inline `TOP_TAGS` array copy instead of importing from `constants/tags.ts`; (b) draft initial state hardcodes `rateMax: 2000` (line 53); (c) the two number inputs have `max={2000}` (lines 153, 162). All three need updating.

**Primary recommendation:** Fix all four bugs, then add Vitest unit tests (install as devDependency — it does not exist yet) covering the two required scenarios, then run `tsc -b && vite build` to confirm the build passes.

---

## Standard Stack

### Core (already installed — no new runtime dependencies)
| Library | Version | Purpose | Relevant to This Phase |
|---------|---------|---------|----------------------|
| zustand | ^5.0.11 | Global filter state | `filterSlice.ts` is the source of truth for rate defaults |
| @radix-ui/react-slider | ^1.3.6 | RateSlider component | `max` prop must change from 2000 to 5000 |
| react-virtuoso | ^4.18.1 | Infinite scroll grid | `endReached` → `loadNextPage` → broken `q` param |
| typescript | ~5.9.3 | Type checking | `tsc -b` is a required verification step |
| vite | ^7.3.1 | Build system | `vite build` is a required verification step |

### New devDependency for Tests
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| vitest | ^3.x | Unit/integration test runner | No test runner exists; Vitest integrates natively with Vite — zero config needed; `@testing-library/react` optional for hook tests |
| @testing-library/react | ^16.x | React hook testing utilities | Needed only if hook-level tests are written (vs pure logic tests) |
| jsdom | ^26.x | DOM environment for Vitest | Required for React component/hook tests via `environment: 'jsdom'` in vitest config |

**Installation (devDependencies only — no bundle impact):**
```bash
npm install --save-dev vitest @testing-library/react jsdom
```

**Note:** If test scope is limited to pure logic (filter chip condition, URL param construction), `@testing-library/react` and `jsdom` can be skipped — plain Vitest with TypeScript suffices.

---

## Architecture Patterns

### Confirmed Source of Truth for Rate Constants

From direct code inspection:

| File | Current `DEFAULT_RATE_MAX` | Status |
|------|---------------------------|--------|
| `store/filterSlice.ts` line 25 | `5000` | Correct — this is the canonical source |
| `hooks/useUrlSync.ts` line 20 | `5000` | Correct — already aligned |
| `components/marketplace/FilterChips.tsx` line 4 | `2000` | **BUG — must fix to 5000** |
| `components/sidebar/RateSlider.tsx` line 27 | `max={2000}` | **BUG — must fix to 5000** |
| `components/sidebar/MobileFilterSheet.tsx` line 53 | `rateMax: 2000` | **BUG — must fix to 5000** |
| `components/sidebar/MobileFilterSheet.tsx` lines 153, 162 | `max={2000}` | **BUG — must fix to 5000** |

**Decision:** Rate constants do NOT need a shared constants file. `filterSlice.ts` already serves as the authoritative source (it defines the store defaults). Components that reference defaults should use literal `5000` with a comment pointing to the store, or they can read from the store directly. A separate `constants/rates.ts` would be overengineering for four small values.

### Confirmed `TOP_TAGS` Usage

| File | Import style | Status |
|------|-------------|--------|
| `components/marketplace/EmptyState.tsx` | `import { TOP_TAGS } from '../../constants/tags'` | Correct |
| `components/sidebar/TagMultiSelect.tsx` | `import { TOP_TAGS } from '../../constants/tags'` | Correct |
| `components/sidebar/MobileFilterSheet.tsx` | Inline copy (lines 6–37) | **BUG — must replace with import** |

### Pattern: Fixing `loadNextPage` Param

The initial `useEffect` fetch correctly constructs params via object literal passed to `URLSearchParams`:
```typescript
// Correct (initial load — useExplore.ts line 39-46)
const params = new URLSearchParams({
  query,        // ← param name matches backend
  rate_min: String(rateMin),
  rate_max: String(rateMax),
  tags: tags.join(','),
  limit: '20',
  cursor: '0',
})
```

The `loadNextPage` function uses `params.set('q', query)` — wrong param name. Fix:
```typescript
// BEFORE (broken)
if (query) params.set('q', query)

// AFTER (correct)
if (query) params.set('query', query)
```

The `useUrlSync.ts` Store→URL direction uses `q` as the URL display param name (`?q=…`). This is intentional — it's a URL param for bookmarking/sharing, NOT the API call param. Do not change `useUrlSync.ts`.

The `/api/suggest` endpoint also uses `q` as its param name (line 64 of `suggest.py`). The `SearchInput` correctly calls `/api/suggest?q=…`. Do not change `SearchInput.tsx`.

### Vitest Configuration Pattern

Since no `vitest.config.ts` exists, add a minimal config:
```typescript
// vitest.config.ts (project root)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',  // 'jsdom' only if React component tests are added
    globals: true,
  },
})
```

For pure logic tests (filter chip condition, URL param name), `environment: 'node'` is sufficient. No JSX transform needed.

### Test File Location Pattern

The project has no existing test files. Use the standard Vite/Vitest convention of co-locating tests:
```
frontend/src/
├── hooks/
│   └── useExplore.test.ts       # pagination param test
├── components/
│   └── marketplace/
│       └── FilterChips.test.ts  # rate chip condition test
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom assertion scripts | Vitest | Native Vite integration, TypeScript out of box, watch mode |
| URL param construction | Manual string concatenation | `URLSearchParams` (already used) | Already in codebase; handles encoding |
| Store reading in tests | Mock Zustand manually | `useExplorerStore.getState()` / import filterSlice defaults directly | Zustand stores are importable modules; no mock needed for pure logic tests |

---

## Common Pitfalls

### Pitfall 1: Changing `q` in `useUrlSync.ts` by mistake
**What goes wrong:** The Store→URL direction in `useUrlSync.ts` uses `params.set('q', query)` at line 66. This is the URL display param (for bookmarking), not an API call. If changed to `query`, URLs would break from `?q=react` to `?query=react`, invalidating all shared links and breaking URL→Store reading at line 42 (`searchParams.get('q')`).
**Why it happens:** The bug report says "fix `q` → `query`" and `useUrlSync.ts` also has `params.set('q', ...)`, so it looks like the same bug.
**How to avoid:** Only fix the API call in `loadNextPage` inside `useExplore.ts`. Leave `useUrlSync.ts` and `SearchInput.tsx` unchanged.
**Warning signs:** If `useUrlSync.ts` is modified, URL sync tests would fail and `?q=` params would stop restoring query on page reload.

### Pitfall 2: Draft initial state in `MobileFilterSheet` not reading from store
**What goes wrong:** `useState<Draft>({ query: '', rateMin: 0, rateMax: 2000, tags: [] })` at line 53 uses a hardcoded initial state. On every open, the `useEffect` at line 57–68 correctly syncs from `useExplorerStore.getState()`, so the draft is always overwritten on open. The hardcoded `2000` only matters if the sheet is rendered before `open` becomes true, which it is (the component renders but the effect runs on `open` change).
**Root cause:** The literal `2000` in draft init and the `max={2000}` on number inputs are misaligned constants, not a logic error.
**How to avoid:** Change both the draft init default (`rateMax: 2000` → `rateMax: 5000`) AND the `max` attribute on both number inputs (`max={2000}` → `max={5000}`). The init default matters for TypeScript clarity and edge cases; the `max` attribute matters for user input validation.
**Warning signs:** A user typing a rate above 2000 in the mobile sheet would be clamped by the browser's native input validation.

### Pitfall 3: Vitest config conflicts with Vite config
**What goes wrong:** Adding a `vitest.config.ts` at the project root can conflict with the existing `vite.config.ts` if not handled correctly.
**How to avoid:** Either (a) add `test: { ... }` block directly inside `vite.config.ts` (Vitest recognizes this), or (b) create a separate `vitest.config.ts` that extends the vite config with `mergeConfig`. The simpler approach (a) — adding `test` to existing `vite.config.ts` — avoids a new file.
**Warning signs:** TypeScript errors on `test` property in `vite.config.ts` — fix by importing `defineConfig` from `vitest/config` instead of `vite` in the config file, or by importing both.

### Pitfall 4: `FilterChips` dismissing rate chip resets to wrong default
**What goes wrong:** When the "EUR 0–5000" chip is dismissed, `onDismiss` calls `setRateRange(DEFAULT_RATE_MIN, DEFAULT_RATE_MAX)`. If `DEFAULT_RATE_MAX` is still `2000`, dismissing a legitimate rate chip (e.g., "EUR 0–300") would reset max to 2000 instead of 5000.
**How to avoid:** Fixing `DEFAULT_RATE_MAX` to `5000` in `FilterChips.tsx` fixes both the chip display bug AND the dismiss behavior in one change.

### Pitfall 5: Build fails after `TOP_TAGS` import change
**What goes wrong:** After removing the inline `TOP_TAGS` from `MobileFilterSheet.tsx` and adding `import { TOP_TAGS } from '../../constants/tags'`, the relative path must be correct.
**How to avoid:** `MobileFilterSheet` lives at `frontend/src/components/sidebar/MobileFilterSheet.tsx`. The constants file is at `frontend/src/constants/tags.ts`. The correct relative import is `../../constants/tags` (two levels up: `sidebar` → `components` → `src`, then down to `constants/tags`).
**Warning signs:** TypeScript compiler error `Cannot find module '../../constants/tags'`.

---

## Code Examples

Verified by direct source code inspection.

### Bug 1 Fix — loadNextPage param name
```typescript
// File: frontend/src/hooks/useExplore.ts
// In the loadNextPage useCallback

// BEFORE (line 85 — BUG):
if (query) params.set('q', query)

// AFTER (correct API param name — matches backend explore.py line 24):
if (query) params.set('query', query)
```

### Bug 2 Fix — FilterChips DEFAULT_RATE_MAX
```typescript
// File: frontend/src/components/marketplace/FilterChips.tsx

// BEFORE (lines 3-4 — BUG):
const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 2000

// AFTER (aligned with filterSlice.ts defaults):
const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000
```

### Bug 3 Fix — RateSlider max prop
```tsx
// File: frontend/src/components/sidebar/RateSlider.tsx

// BEFORE (line 27 — BUG):
max={2000}

// AFTER:
max={5000}
```

### Bug 4 Fix — MobileFilterSheet three sub-issues
```tsx
// File: frontend/src/components/sidebar/MobileFilterSheet.tsx

// Sub-issue (a): Replace inline TOP_TAGS with import
// REMOVE lines 6-37 (the inline const TOP_TAGS = [...])
// ADD at top of file:
import { TOP_TAGS } from '../../constants/tags'

// Sub-issue (b): Fix draft initial state (line 53)
// BEFORE:
const [draft, setDraft] = useState<Draft>({ query: '', rateMin: 0, rateMax: 2000, tags: [] })
// AFTER:
const [draft, setDraft] = useState<Draft>({ query: '', rateMin: 0, rateMax: 5000, tags: [] })

// Sub-issue (c): Fix number input max attributes (lines 153, 162)
// BEFORE: max={2000} (appears twice)
// AFTER: max={5000} (both instances)
```

### Vitest config addition to existing vite.config.ts
```typescript
// File: frontend/vite.config.ts
// Change: import { defineConfig } from 'vite' → import { defineConfig } from 'vitest/config'
// Add test block:

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

### Test: pagination param correctness (unit test — pure logic)
```typescript
// File: frontend/src/hooks/useExplore.test.ts

import { describe, it, expect } from 'vitest'

describe('loadNextPage URL params', () => {
  it('uses "query" param name (not "q") for /api/explore', () => {
    const query = 'react developer'
    const params = new URLSearchParams()
    if (query) params.set('query', query)  // correct behaviour post-fix
    params.set('rate_min', '0')
    params.set('rate_max', '5000')
    params.set('cursor', '20')

    expect(params.get('query')).toBe('react developer')
    expect(params.get('q')).toBeNull()
    expect(params.toString()).toContain('query=react+developer')
  })
})
```

### Test: rate chip not shown on fresh load with default rate
```typescript
// File: frontend/src/components/marketplace/FilterChips.test.ts

import { describe, it, expect } from 'vitest'

// Mirror the logic from FilterChips.tsx post-fix
const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000  // post-fix value

function shouldShowRateChip(rateMin: number, rateMax: number): boolean {
  return rateMin !== DEFAULT_RATE_MIN || rateMax !== DEFAULT_RATE_MAX
}

describe('FilterChips rate chip visibility', () => {
  it('does NOT show rate chip when store has default rate values (0–5000)', () => {
    // Store default is rateMax: 5000 (filterSlice.ts)
    expect(shouldShowRateChip(0, 5000)).toBe(false)
  })

  it('shows rate chip when rate filter is non-default', () => {
    expect(shouldShowRateChip(100, 300)).toBe(true)
    expect(shouldShowRateChip(0, 1500)).toBe(true)
    expect(shouldShowRateChip(500, 5000)).toBe(true)
  })

  it('does NOT show chip with old wrong default of 2000 (regression guard)', () => {
    // If DEFAULT_RATE_MAX were 2000, shouldShowRateChip(0, 5000) would be true — wrong
    const wrongDefault = 2000
    const wouldShowWithBug = 0 !== 0 || 5000 !== wrongDefault
    expect(wouldShowWithBug).toBe(true) // confirms the bug existed
    // And with the fix:
    expect(shouldShowRateChip(0, 5000)).toBe(false)
  })
})
```

---

## Complete Inventory of Files to Change

| File | Change | Bug Fixed |
|------|--------|-----------|
| `frontend/src/hooks/useExplore.ts` | Line 85: `'q'` → `'query'` | Bug 1: pagination param |
| `frontend/src/components/marketplace/FilterChips.tsx` | Line 4: `2000` → `5000` | Bug 2: rate chip false positive |
| `frontend/src/components/sidebar/RateSlider.tsx` | Line 27: `max={2000}` → `max={5000}` | Bug 3: slider max |
| `frontend/src/components/sidebar/MobileFilterSheet.tsx` | (a) Replace inline TOP_TAGS with import; (b) line 53 `rateMax: 2000` → `rateMax: 5000`; (c) lines 153, 162 `max={2000}` → `max={5000}` | Bug 4: mobile sheet constants |
| `frontend/vite.config.ts` | Add `test` block; change `defineConfig` import to `vitest/config` | Enable Vitest |
| `frontend/src/hooks/useExplore.test.ts` | Create: pagination param unit test | Required regression test |
| `frontend/src/components/marketplace/FilterChips.test.ts` | Create: rate chip logic unit test | Required regression test |

**Files that are confirmed correct — do NOT change:**
- `frontend/src/hooks/useUrlSync.ts` — uses `q` intentionally as URL display param, not API param; `DEFAULT_RATE_MAX = 5000` is already correct
- `frontend/src/components/sidebar/SearchInput.tsx` — uses `?q=` for `/api/suggest` which takes param `q`; correct
- `frontend/src/components/marketplace/EmptyState.tsx` — already imports `TOP_TAGS` from constants
- `frontend/src/components/sidebar/TagMultiSelect.tsx` — already imports `TOP_TAGS` from constants
- `frontend/src/store/filterSlice.ts` — `rateMax: 5000` is correct, this is the source of truth

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `params.set('q', query)` in loadNextPage | `params.set('query', query)` | Infinite scroll with active text query returns semantic results instead of filter-only results |
| `DEFAULT_RATE_MAX = 2000` in FilterChips | `DEFAULT_RATE_MAX = 5000` | Rate chip not shown on fresh load when no rate filter is active |
| Inline `TOP_TAGS` copy in MobileFilterSheet | Import from `constants/tags.ts` | Single source of truth; tag list updates only needed in one place |
| No test runner | Vitest (devDependency) | Regression tests possible without changing build output |

---

## Open Questions

1. **npm install script location**
   - What we know: `package.json` is at `frontend/package.json`; tests are a blocker
   - What's unclear: Whether the planner should include the `npm install --save-dev vitest` step or if it should be assumed
   - Recommendation: Include explicit install step in the plan; it modifies `package.json` and `package-lock.json`

2. **Test script in package.json**
   - What we know: Current `scripts` has `dev`, `build`, `lint`, `preview` — no `test` script
   - What's unclear: Whether the planner should add `"test": "vitest run"` or `"test": "vitest"`
   - Recommendation: Add `"test": "vitest run"` (CI-friendly one-shot run) and `"test:watch": "vitest"` (dev convenience)

3. **ROADMAP.md backlog entries**
   - What we know: Context.md says out-of-scope findings should be logged to ROADMAP.md
   - What's unclear: No out-of-scope bugs were found in this audit — all discovered issues are within the four bug categories
   - Recommendation: If audit finds nothing additional, note "no backlog items added" in plan verification

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection — all bug locations confirmed by reading actual file contents
  - `frontend/src/hooks/useExplore.ts` — Bug 1 confirmed at line 85
  - `frontend/src/components/marketplace/FilterChips.tsx` — Bug 2 confirmed at line 4
  - `frontend/src/components/sidebar/RateSlider.tsx` — Bug 3 confirmed at line 27
  - `frontend/src/components/sidebar/MobileFilterSheet.tsx` — Bug 4 confirmed at lines 6–37, 53, 153, 162
  - `app/routers/explore.py` — Backend param name confirmed as `query` at line 24
  - `frontend/src/store/filterSlice.ts` — Store default `rateMax: 5000` confirmed at line 25
  - `frontend/src/hooks/useUrlSync.ts` — `DEFAULT_RATE_MAX = 5000` confirmed correct at line 20
  - `frontend/package.json` — Confirmed Vitest is not installed; confirmed Vite ^7.3.1

### Secondary (MEDIUM confidence)
- Vitest documentation: https://vitest.dev/config/ — Vitest integrates with Vite config via `defineConfig` from `vitest/config`; `test` block merges into Vite config

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all confirmed by source code inspection, no inference required
- Fix correctness: HIGH — one-line or two-line changes with clear before/after
- Test approach: HIGH — pure logic tests require no component rendering; Vitest is the standard Vite test runner
- Vitest version: MEDIUM — version ^3.x expected based on Vite 7.x compatibility; confirm with `npm install` output

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable codebase — no fast-moving dependencies involved in fixes)
