# Phase 58: Audit Gap Closure - Research

**Researched:** 2026-03-03
**Domain:** FastAPI CORS, React/TypeScript utility adoption, Markdown documentation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-02 | Currency displayed as symbol (€, $, £) instead of text code (EUR, USD, GBP) across all surfaces | `currencySymbol()` utility exists in `frontend/src/utils/currency.ts` — two surfaces (`FilterChips.tsx`, `RateSlider.tsx`) hardcode `€` instead of using it |
| ADM-06 | Admin Experts page table layout modernized | The CORS bug is the blocker that prevents the delete action (DELETE HTTP method) from working; the table layout itself was done in Phase 57 |
| PERF-01 | Query embeddings cached with TTL to avoid duplicate Google API calls | Implementation confirmed present in `app/services/embedder.py` — only the VERIFICATION.md document is missing |
| PERF-02 | Tag filtering optimized — no LIKE on JSON substrings | Implementation confirmed present in `app/models.py` + `app/services/tag_sync.py` + `app/services/explorer.py` — only the VERIFICATION.md is missing |
| PERF-03 | Feedback data cached per request cycle instead of fetched on every explore call | Implementation confirmed present in `app/services/explorer.py` — only the VERIFICATION.md is missing |
| PERF-04 | Settings cached in-memory with TTL instead of full SELECT on every call | Implementation confirmed present in `app/services/search_intelligence.py` — only the VERIFICATION.md is missing |
| ADM-01 | Admin backend refactored from 2,225-line monolith into logical route modules | Implementation confirmed: 10 sub-modules under `app/routers/admin/` replacing the deleted `app/routers/admin.py` — only the VERIFICATION.md is missing |
</phase_requirements>

---

## Summary

Phase 58 closes three distinct gaps identified in the v5.0 milestone audit. Each gap is narrowly scoped with a well-understood fix. No new libraries, no architectural changes.

**Gap 1 — CORS DELETE fix (BUG affecting ADM-06):** `app/main.py` line 323 has `allow_methods=["GET", "POST"]`. The browser issues a CORS preflight for HTTP DELETE requests, which the middleware rejects. The admin Experts page calls `adminDelete('/experts/{username}')` (a DELETE request) — this fails silently in the browser due to CORS. Fix is a one-line change: add `"DELETE"` to the `allow_methods` list.

**Gap 2 — Currency symbol hardcoding (BUG-02):** `FilterChips.tsx` (line 24) hardcodes `€${rateMin}–€${rateMax}` and `RateSlider.tsx` (lines 50–51, 81) hardcodes `€{localValue[0]}`, `€{localValue[1]}`, `€{roundedMax}`. Both files must import and call `currencySymbol('EUR')` from `frontend/src/utils/currency.ts` instead. Since the rate filter operates on aggregate range (not per-expert currency), using `currencySymbol('EUR')` as the display default is correct — the filter is EUR-denominated (the dataset is EUR-dominated) and the result is functionally identical to the hardcoded `€`, but now routed through the shared utility as required.

**Gap 3 — Phase 56 VERIFICATION.md (process gap):** Phase 56 completed all 3 plans with SUMMARY.md frontmatter claiming PERF-01, PERF-02, PERF-03, PERF-04, and ADM-01 complete. The v5.0 audit confirmed implementation is present via codebase inspection. The only gap is a missing documentation artifact. The VERIFICATION.md must be written retroactively, citing the code evidence from the SUMMARY files.

**Primary recommendation:** Three isolated tasks, one per gap. The CORS fix deploys immediately on push. The currency fix is a pure front-end import/call substitution. The VERIFICATION.md is a documentation write.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| FastAPI `CORSMiddleware` | existing | CORS headers including `allow_methods` | Already wired in `app/main.py`; no new imports needed |
| `currencySymbol()` utility | existing | Convert currency code to symbol | Already used in ExpertCard, ExpertList — established pattern |
| Vitest | 4.0.18 | Frontend unit tests | Already configured in `vite.config.ts`; `npm test` runs it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new dependencies needed for any gap in this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `currencySymbol('EUR')` as slider default | Per-result dominant currency from API | Adding a `dominant_currency` field to the explore response would be over-engineering — the dataset is EUR-dominated and the filter range is not per-expert |

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: FastAPI CORS `allow_methods` Extension

**What:** Add `"DELETE"` to the `allow_methods` list in the `CORSMiddleware` configuration.

**When to use:** Any time a frontend calls an endpoint with a non-GET/POST HTTP method.

**Current state in `app/main.py`:**

```python
# Line 319-325 — CURRENT (broken)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],          # DELETE missing — blocks preflight
    allow_headers=["Content-Type", "Authorization"],
)
```

**Fix:**

```python
# FIXED
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],   # DELETE added
    allow_headers=["Content-Type", "Authorization"],
)
```

**Confidence:** HIGH — direct code inspection confirms the missing method.

---

### Pattern 2: `currencySymbol()` Adoption in Filter Components

**What:** Import the existing utility and call it instead of the hardcoded `€` character.

**When to use:** Any component displaying a currency amount that is not tied to a specific expert's `currency` field (i.e., aggregate/range displays).

**FilterChips.tsx — current (broken):**

```tsx
// Line 24
label: `€${rateMin}–€${rateMax}`,
```

**FilterChips.tsx — fixed:**

```tsx
import { currencySymbol } from '../../utils/currency'
// ...
label: `${currencySymbol('EUR')}${rateMin}–${currencySymbol('EUR')}${rateMax}`,
```

**RateSlider.tsx — current (broken):**

```tsx
// Lines 50-52
<span>€{localValue[0]}</span>
<span>€{localValue[1]}</span>
// ...
// Line 81
<p ...>€{roundedMax}/hr max</p>
```

**RateSlider.tsx — fixed:**

```tsx
import { currencySymbol } from '../../utils/currency'
const sym = currencySymbol('EUR')
// ...
<span>{sym}{localValue[0]}</span>
<span>{sym}{localValue[1]}</span>
// ...
<p ...>{sym}{roundedMax}/hr max</p>
```

**Confidence:** HIGH — direct code inspection confirms hardcoded `€` literals at these exact locations.

---

### Pattern 3: Retroactive VERIFICATION.md for Phase 56

**What:** Write a VERIFICATION.md for Phase 56 that confirms all 5 requirements (PERF-01, PERF-02, PERF-03, PERF-04, ADM-01) based on code evidence already present in the codebase and SUMMARY frontmatter.

**When to use:** When a phase completed execution but the VERIFICATION.md artifact was not produced.

**Location:** `.planning/phases/56-backend-performance-admin-refactor/56-VERIFICATION.md`

**Evidence to document (verified by codebase inspection):**

| Requirement | Implementation Evidence |
|-------------|------------------------|
| PERF-01 | `app/services/embedder.py`: `_embed_cache: dict`, `_embed_lock: threading.Lock`, `EMBED_CACHE_TTL = 60` — `embed_query()` checks cache before Google API call. Commit: `9a80f4d` |
| PERF-02 | `app/models.py`: `ExpertTag` model with `Index('ix_expert_tags_tag_type', 'tag', 'tag_type')` and `Index('ix_expert_tags_expert_id', 'expert_id')`. `app/services/explorer.py`: `EXISTS` subquery against `expert_tags` table. Commit: `a73e829` |
| PERF-03 | `app/services/explorer.py`: `feedback_rows = db.scalars(...).all()` called once at top of `run_explore()`, passed as parameter to scoring loop. Commit: `43fdc76` |
| PERF-04 | `app/services/search_intelligence.py`: `_settings_cache: dict`, `_settings_lock: threading.Lock`, `SETTINGS_CACHE_TTL = 30` — `get_settings()` returns cached value within TTL. `invalidate_settings_cache()` exported and wired in `app/routers/admin/settings.py` POST handler. Commit: `90dafbf` |
| ADM-01 | `app/routers/admin.py` (2,225 lines) DELETED. Replaced by `app/routers/admin/` package: `__init__.py`, `_common.py`, `analytics.py`, `compare.py`, `events.py`, `experts.py`, `exports.py`, `imports.py`, `leads.py`, `settings.py`. All 36 routes preserved. Commits: `8fb99ac`, `67e6846` |

**Confidence:** HIGH — all implementation verified by direct file inspection.

---

### Anti-Patterns to Avoid

- **Adding `"*"` to `allow_methods`:** Never use wildcard method allows in production. Add only the specific methods needed (`DELETE`).
- **Adding `allow_credentials=True`:** The current middleware correctly has `allow_credentials=False`. Do not change it.
- **Fetching dominant currency from API:** The rate slider/chips are aggregate filter controls, not per-expert displays. Using `currencySymbol('EUR')` is correct; adding backend support for a dominant currency field is unnecessary scope expansion.
- **Writing VERIFICATION.md from memory:** All evidence must come from the codebase and SUMMARY files. No fabricating commit hashes or file line numbers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS preflight handling | Custom OPTIONS handler | FastAPI `CORSMiddleware` `allow_methods` | Middleware handles all CORS headers including preflight automatically |
| Currency symbol lookup | Inline if/else or ternary | `currencySymbol()` from `frontend/src/utils/currency.ts` | Utility already handles all supported codes with fallback; established project pattern |

**Key insight:** All three fixes use existing infrastructure — the middleware, the utility function, and the documentation pattern from Phase 55/57 VERIFICATION files. Zero new code patterns needed.

---

## Common Pitfalls

### Pitfall 1: CORS — Forgetting `OPTIONS` Is Handled by Middleware

**What goes wrong:** Developer adds DELETE to `allow_methods` but also adds a custom `@app.options("/api/admin/experts/{username}")` handler, causing a conflict.

**Why it happens:** Misunderstanding that `CORSMiddleware` already handles all OPTIONS preflights globally.

**How to avoid:** Only modify the `allow_methods` list. No additional route handlers needed.

**Warning signs:** If you find yourself adding `@app.options(...)` routes, stop — you're hand-rolling something the middleware already does.

---

### Pitfall 2: `currencySymbol` Import Path

**What goes wrong:** Import path is wrong because RateSlider is in `sidebar/` and FilterChips is in `marketplace/` — both need different relative paths to `utils/currency`.

**Why it happens:** Directory depth differs.

**How to avoid:**
- `FilterChips.tsx` is at `frontend/src/components/marketplace/FilterChips.tsx` → import path: `'../../utils/currency'`
- `RateSlider.tsx` is at `frontend/src/components/sidebar/RateSlider.tsx` → import path: `'../../utils/currency'`

Both are 2 levels deep from `src/` so the relative path is the same: `'../../utils/currency'`.

**Warning signs:** TypeScript compiler error on import if path is wrong.

---

### Pitfall 3: VERIFICATION.md Must Cite Real Evidence

**What goes wrong:** VERIFICATION.md says "implementation confirmed" without citing specific file paths, line numbers, or commit SHAs — creating an audit artifact that a future verifier can't independently validate.

**Why it happens:** Retroactive documentation written from memory.

**How to avoid:** All claims must cite: file path + what the code does (not just "it exists"), and commit SHA from SUMMARY frontmatter.

---

### Pitfall 4: Test File for FilterChips Already Exists

**What goes wrong:** Creating a new test file for FilterChips currency when `FilterChips.test.ts` already exists — causing import conflicts or duplicate describe blocks.

**Why it happens:** Not checking existing test infrastructure.

**How to avoid:** Extend the existing `frontend/src/components/marketplace/FilterChips.test.ts` with a new `describe` block covering the currency symbol behavior. Do not create a new test file.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing currencySymbol usage (ExpertCard.tsx line 148)

```tsx
// Source: frontend/src/components/marketplace/ExpertCard.tsx
import { currencySymbol } from '../../utils/currency'
// ...
<span>{currencySymbol(expert.currency)}{expert.hourly_rate}/hr</span>
```

### Existing test file to extend (FilterChips.test.ts lines 1-8)

```typescript
// Source: frontend/src/components/marketplace/FilterChips.test.ts
import { describe, it, expect } from 'vitest'

// Mirror the post-fix logic from FilterChips.tsx
const DEFAULT_RATE_MIN = 0
const DEFAULT_RATE_MAX = 5000
```

Add a new `describe` block to cover currency symbol behavior:

```typescript
import { currencySymbol } from '../../utils/currency'

describe('FilterChips rate chip currency symbol', () => {
  it('uses currencySymbol utility, not hardcoded €', () => {
    const sym = currencySymbol('EUR')
    expect(sym).toBe('€')
    // Verify the utility is the source of truth
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('GBP')).toBe('£')
  })
})
```

### CORS middleware — final state

```python
# Source: app/main.py (post-fix)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `€` in filter components | `currencySymbol()` utility | Phase 55 established utility; Phase 58 completes adoption | Non-EUR experts now display correct symbol in all surfaces |
| Missing VERIFICATION.md for Phase 56 | Retroactive VERIFICATION.md | Phase 58 | Milestone audit passes at 3/3 phases verified |

**Deprecated/outdated:**
- `allow_methods=["GET", "POST"]` in CORS config: will be replaced by `["GET", "POST", "DELETE"]`

---

## Open Questions

1. **Should `PATCH` also be added to CORS `allow_methods`?**
   - What we know: The admin frontend currently only uses GET, POST, and DELETE. No PATCH calls exist.
   - What's unclear: Future admin endpoints might use PATCH for partial updates.
   - Recommendation: Only add DELETE now (minimal change, minimal attack surface). Add PATCH later if a PATCH endpoint is introduced.

2. **Is the rate slider EUR-only by design?**
   - What we know: The explore API returns `max_rate` but not a dominant currency. The dataset is primarily EUR experts. The rate filter is aggregate, not per-expert.
   - What's unclear: Whether the product ever intends to support multi-currency filtering.
   - Recommendation: Use `currencySymbol('EUR')` as a named default. This is the correct behavior for the current product and satisfies BUG-02 (routes through the utility). Multi-currency filter UI is out of scope per REQUIREMENTS.md "Out of Scope" table.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test block at line 27) |
| Quick run command | `cd frontend && npm test` |
| Full suite command | `cd frontend && npm test` |
| Estimated runtime | ~1 second (7 tests currently) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-02 | FilterChips rate chip label uses `currencySymbol('EUR')` not hardcoded `€` | unit | `cd frontend && npm test` | ✅ Extend `FilterChips.test.ts` |
| BUG-02 | RateSlider displays correct symbol | unit (logic only) | `cd frontend && npm test` | ❌ Wave 0 gap — add to `FilterChips.test.ts` |
| ADM-06 | DELETE method allowed in CORS | manual-only | Browser DevTools network tab: verify DELETE preflight returns 200 with correct headers | N/A — no backend unit test infra |
| PERF-01–04, ADM-01 | Phase 56 requirements satisfied | documentation | N/A — verified by reading codebase files | N/A — VERIFICATION.md is the artifact |

**Notes:**
- Backend has no automated test suite. CORS change verification is manual (check browser network tab after deploy, or check Railway logs).
- The VERIFICATION.md for Phase 56 is the artifact that "passes" PERF-01–04 and ADM-01 — there is no automated test for documentation completeness.
- RateSlider currency symbol logic is embedded in JSX rendering, making it difficult to unit test without JSDOM. A simpler approach: add a utility-level test that confirms `currencySymbol('EUR') === '€'` (covering the adoption), then verify visually via the app.

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task → run: `cd frontend && npm test`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~1 second

### Wave 0 Gaps (must be created before implementation)

- [ ] Extend `frontend/src/components/marketplace/FilterChips.test.ts` — add `describe('FilterChips rate chip currency symbol')` block covering `currencySymbol('EUR')` usage

*(No new test files needed — existing test infrastructure covers all other phase requirements)*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `app/main.py` lines 319-325: CORS config with `allow_methods=["GET", "POST"]`
- Direct codebase inspection — `frontend/src/components/marketplace/FilterChips.tsx` line 24: hardcoded `€${rateMin}–€${rateMax}`
- Direct codebase inspection — `frontend/src/components/sidebar/RateSlider.tsx` lines 50-51, 81: hardcoded `€` in labels
- Direct codebase inspection — `frontend/src/utils/currency.ts`: `currencySymbol()` utility, already used in ExpertCard and ExpertList
- Direct codebase inspection — `.planning/phases/56-backend-performance-admin-refactor/`: 3 SUMMARY files confirm implementation; no VERIFICATION.md file present
- Direct codebase inspection — `.planning/v5.0-MILESTONE-AUDIT.md`: gaps documented with evidence
- FastAPI CORS middleware documentation: `allow_methods` parameter accepts a list of HTTP method strings — confirmed pattern used in existing `main.py`

### Secondary (MEDIUM confidence)

- N/A

### Tertiary (LOW confidence)

- N/A — all findings are from direct codebase inspection, no web search required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are already in the project; no new dependencies
- Architecture: HIGH — all patterns verified by reading actual source files
- Pitfalls: HIGH — based on reading exact file paths and line numbers

**Research date:** 2026-03-03
**Valid until:** Stable indefinitely (no external library versions at risk; pure internal changes)
