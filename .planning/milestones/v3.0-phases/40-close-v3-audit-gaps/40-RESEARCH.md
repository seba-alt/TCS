# Phase 40: Close v3.0 Audit Gaps — Research

**Researched:** 2026-02-24
**Domain:** Documentation, dead code removal, Zustand state lifecycle
**Confidence:** HIGH

---

## Summary

Phase 40 closes three procedural and technical gaps identified by the v3.0 milestone audit. The work breaks cleanly into three self-contained tasks: (1) create the missing Phase 39 VERIFICATION.md with pass/fail evidence for SAGE-01, SAGE-02, and SAGE-03; (2) delete the `useNavigationSlice` convenience hook from `store/index.ts` which the audit confirmed is exported but never imported anywhere; and (3) reset `navigationSource` back to `'direct'` after Explorer consumes it, so subsequent Explorer mounts in the same SPA session start clean.

None of these tasks introduce new libraries or architectural patterns. The VERIFICATION.md follows the established format seen in phases 36, 37, and 38 — prose evidence under each success criterion, a requirement coverage table, and a must-haves checklist. The dead code removal is a targeted three-line deletion. The sticky-state fix is a one-liner `setNavigationSource('direct')` call added to the existing `useEffect` in `MarketplacePage.tsx`.

The entire phase can be completed in a single plan wave with three sequential tasks. Total code change is under 10 lines net (plus the new VERIFICATION.md). Risk is minimal — all changes are either additive (docs) or subtractive (dead code, and a reset call that restores intended default behavior).

**Primary recommendation:** Execute all three tasks in one plan. Write VERIFICATION.md first (no code changes, fast to verify), then remove dead hook, then add the navigationSource reset. Commit once at the end.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAGE-01 | Sage FAB visible on Browse (mounted at root layout level above route outlet) | VERIFICATION.md evidence: RootLayout.tsx wraps / and /explore, mounts SageFAB above Outlet — confirmed by 39-01-SUMMARY.md commit fd0c8a6 |
| SAGE-02 | Sage conversation history preserved navigating Browse → Explorer | VERIFICATION.md evidence: pilotSlice messages live in Zustand (not component state), survive route navigation — confirmed by pilotSlice.ts design and 39-01-SUMMARY.md; navigationSource sticky-state fix also supports this criteria |
| SAGE-03 | Sage discovery on Browse auto-navigates to Explorer with search results in grid | VERIFICATION.md evidence: useSage.ts lines 134-166 implement full flow: search_performed → setPendingSageResults → setSageMode → setTimeout 2s → navigate('/explore'); useExplore.ts lines 34-40 consume pending on mount — confirmed by 39-02-SUMMARY.md commit 11f5a0d |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | (already installed) | State management — `setNavigationSource` action | Already the project store; no new dependency |
| React Router v7 | (already installed) | `useNavigate` / `useLocation` in hooks | Already used by useSage.ts and MarketplacePage.tsx |

### Supporting
None — no new libraries needed.

### Alternatives Considered
None — all three tasks use existing project infrastructure.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Pattern 1: Phase VERIFICATION.md Format

**What:** A markdown file in `.planning/phases/39-sage-cross-page-navigation/` following the exact structure used in phases 36, 37, and 38.

**When to use:** After a phase is complete but lacks formal verification documentation.

**Structure (from 36-VERIFICATION.md):**
```markdown
---
phase: 39-sage-cross-page-navigation
status: passed
verified: 2026-02-24
---

# Phase 39: Sage Cross-Page Navigation — Verification

## Phase Goal
[one-line description]

## Success Criteria Verification

### 1. [Success criterion text]
**Status: PASSED**
- [File path + line ref]: [evidence]

## Requirement Coverage

| Requirement | Plan | Status |
|-------------|------|--------|
| SAGE-01 | 39-01 | PASSED — ... |

## Must-Haves Verification

### Plan 39-01 Must-Haves
- [x] ...

## Result
**Score: 3/3 success criteria passed**
**Status: PASSED**
```

**Evidence to cite for each SAGE requirement:**

| Requirement | File + Lines | Evidence |
|-------------|-------------|---------|
| SAGE-01 | `frontend/src/layouts/RootLayout.tsx` | SageFAB mounted above `<Outlet />` at layout level wrapping both / and /explore |
| SAGE-01 | `frontend/src/main.tsx` | Layout route parent element = RootLayout |
| SAGE-02 | `frontend/src/store/pilotSlice.ts` | `messages: PilotMessage[]` lives in Zustand store — persists across route navigation |
| SAGE-02 | `frontend/src/pages/MarketplacePage.tsx` lines 30-32 | `resetPilot()` only called when `navigationSource === 'direct'` — Browse→Explorer preserves messages |
| SAGE-03 | `frontend/src/hooks/useSage.ts` lines 134-166 | Browse discovery path: `search_performed === true && !isExplorer` → `setPendingSageResults` → `setSageMode(true)` → `setTimeout 2s` → `navigate('/explore')` |
| SAGE-03 | `frontend/src/hooks/useExplore.ts` lines 34-40 | Explorer mount: reads `pendingSageResults` via `getState()`, calls `setResults(pending)`, calls `clearPendingSageResults()` |

### Pattern 2: Dead Code Removal — `useNavigationSlice` hook

**What:** Delete lines 106-116 from `frontend/src/store/index.ts`.

**Verification:** `grep -r "useNavigationSlice" frontend/src/` — the audit confirmed zero consumers. All consumers use `useExplorerStore` selectors directly.

**Lines to delete (current content):**
```typescript
// Lines 106-116 of frontend/src/store/index.ts
export const useNavigationSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      navigationSource:        state.navigationSource,
      pendingSageResults:      state.pendingSageResults,
      pendingSearchQuery:      state.pendingSearchQuery,
      setNavigationSource:     state.setNavigationSource,
      setPendingSageResults:   state.setPendingSageResults,
      clearPendingSageResults: state.clearPendingSageResults,
    }))
  )
```

**Note:** The `NavigationSlice` type export (line 16) and `createNavigationSlice` import (line 8) MUST stay — only the `useNavigationSlice` hook function is dead. The slice itself is fully used by multiple consumers via `useExplorerStore` directly.

### Pattern 3: navigationSource Sticky-State Fix

**What:** After Explorer mounts and reads `navigationSource`, reset it to `'direct'` so the next Explorer mount starts clean regardless of what triggered the current one.

**Root cause:** `MarketplacePage.tsx` useEffect checks `navigationSource` to gate `resetPilot()` but never resets `navigationSource` back to `'direct'`. After a Browse→Explorer navigation, `navigationSource` remains `'browse'` or `'sage'` for the remainder of the SPA session. If the user later navigates away and returns to `/explore` directly (without reload), `navigationSource` is still `'browse'`/`'sage'` — `resetPilot()` is skipped incorrectly.

**Current code (`frontend/src/pages/MarketplacePage.tsx` lines 29-33):**
```typescript
useEffect(() => {
  if (navigationSource === 'direct') {
    resetPilot()
  }
}, [resetPilot, navigationSource])
```

**Fix — add reset-after-consume:**
```typescript
const setNavigationSource = useExplorerStore((s) => s.setNavigationSource)

useEffect(() => {
  if (navigationSource === 'direct') {
    resetPilot()
  }
  // Reset to 'direct' after consuming — ensures next Explorer mount starts clean
  // regardless of how the user arrived this time
  if (navigationSource !== 'direct') {
    setNavigationSource('direct')
  }
}, [resetPilot, navigationSource, setNavigationSource])
```

**Alternative — simpler unconditional reset:**
```typescript
const setNavigationSource = useExplorerStore((s) => s.setNavigationSource)

useEffect(() => {
  if (navigationSource === 'direct') {
    resetPilot()
  }
  setNavigationSource('direct')
}, [resetPilot, navigationSource, setNavigationSource])
```

The unconditional form is preferred — it is idempotent (setting 'direct' when already 'direct' is a no-op in Zustand) and avoids a conditional path that obscures intent. Calling `setNavigationSource('direct')` when `navigationSource` is already `'direct'` causes no re-render because Zustand performs reference equality checks on primitive values.

**Key constraint:** The reset must happen inside the same `useEffect` that consumes `navigationSource` — not in a separate effect or cleanup. A cleanup function would fire on unmount (when leaving Explorer), which is the wrong timing. The reset should fire on mount (when arriving at Explorer) after the gate check.

### Anti-Patterns to Avoid

- **Resetting in cleanup:** `return () => setNavigationSource('direct')` would fire when the component unmounts (on navigation away), not on the next mount — this does not fix the bug.
- **Resetting in a separate useEffect:** A second effect with `[navigationSource]` dep would create two effects competing for the same state — keep it in one effect.
- **Removing the entire `useNavigationSlice` export line but keeping the function body:** The whole function block (11 lines) must be deleted, not just the export keyword.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting zero consumers of a hook | Custom import scanner | `grep -r "useNavigationSlice" frontend/src/` | Already verified by audit — no scanner needed |
| State reset timing | Complex middleware | One-liner in existing useEffect | The Zustand action already exists (`setNavigationSource`) |

---

## Common Pitfalls

### Pitfall 1: Deleting the Wrong navigationSlice Symbol

**What goes wrong:** Deleting `createNavigationSlice` import or `NavigationSlice` type export instead of (or in addition to) only `useNavigationSlice`.

**Why it happens:** All three are navigationSlice-related names. The audit specifically flags `useNavigationSlice` (the convenience hook), not the slice itself.

**How to avoid:** Grep for each name before and after deletion. `createNavigationSlice` must remain (used in the `create()` call). `NavigationSlice` type must remain (used in `ExplorerStore` type union).

**Warning signs:** TypeScript errors on `ExplorerStore` type or the `persist()` call if wrong symbols removed.

### Pitfall 2: VERIFICATION.md Missing Must-Have Checklists

**What goes wrong:** Writing only the success criteria section but omitting the per-plan must-haves checklist that other phase verifications include.

**Why it happens:** VERIFICATION.md template has two sections that cover the same ground differently — the narrative success criteria (with line refs) and the flat checklist. Both are required to match the project format.

**How to avoid:** Copy the must-haves directly from the plan files (`39-01-PLAN.md`, `39-02-PLAN.md`) — these list what "must be true" at task completion.

### Pitfall 3: navigationSource Reset Creating Infinite Loop

**What goes wrong:** Adding `setNavigationSource('direct')` unconditionally with `navigationSource` in the dependency array causes the effect to run once per navigation event, call the setter, which triggers a re-render, which triggers the effect again — but only if Zustand re-renders on same-value sets.

**Why it's NOT a real risk here:** Zustand's `set()` uses Object.is equality — setting `navigationSource` to `'direct'` when it's already `'direct'` does not trigger a subscriber notification. No infinite loop.

**How to verify:** Check Zustand source — confirmed behavior for primitive state values.

### Pitfall 4: Forgetting to Read Plan Files Before Writing VERIFICATION.md

**What goes wrong:** VERIFICATION.md success criteria don't match the actual success criteria stated in the PLAN files.

**Why it happens:** Writing from memory rather than reading `39-01-PLAN.md` and `39-02-PLAN.md` first.

**How to avoid:** Read both plan files to extract the exact success criteria text before drafting VERIFICATION.md.

---

## Code Examples

### Remove `useNavigationSlice` from store/index.ts

```typescript
// DELETE these 11 lines from frontend/src/store/index.ts:

export const useNavigationSlice = () =>
  useExplorerStore(
    useShallow((state) => ({
      navigationSource:        state.navigationSource,
      pendingSageResults:      state.pendingSageResults,
      pendingSearchQuery:      state.pendingSearchQuery,
      setNavigationSource:     state.setNavigationSource,
      setPendingSageResults:   state.setPendingSageResults,
      clearPendingSageResults: state.clearPendingSageResults,
    }))
  )

// KEEP: createNavigationSlice import (line 8)
// KEEP: NavigationSlice type import/export (lines 13, 16)
// KEEP: ExplorerStore type union (line 21)
```

### Add navigationSource reset in MarketplacePage.tsx

```typescript
// ADD selector (near line 27, after resetPilot selector):
const setNavigationSource = useExplorerStore((s) => s.setNavigationSource)

// MODIFY useEffect (lines 29-33):
useEffect(() => {
  if (navigationSource === 'direct') {
    resetPilot()
  }
  // Reset after consume — next Explorer mount starts clean
  setNavigationSource('direct')
}, [resetPilot, navigationSource, setNavigationSource])
```

### Verify no remaining useNavigationSlice consumers

```bash
grep -r "useNavigationSlice" /Users/sebastianhamers/Documents/TCS/frontend/src/
# Expected: no output (zero matches after deletion)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase verification implied by SUMMARY | Explicit VERIFICATION.md with line refs | Phases 36-38 pattern | Audit cross-reference requires 3-source evidence |

**Deprecated/outdated:**
- `useNavigationSlice`: Dead convenience hook from Phase 36 scaffolding — no consumer ever adopted it; all consumers use `useExplorerStore` selectors directly.

---

## Open Questions

1. **Should `useNavigationSlice` be promoted rather than deleted?**
   - What we know: Zero current consumers. All existing code uses `useExplorerStore` selectors directly.
   - What's unclear: Was this a forward-looking hook that was never adopted, or intentional dead code?
   - Recommendation: Delete it. The audit explicitly flags it as orphaned dead code. If a future phase needs it, it can be re-added. The project convention is direct `useExplorerStore` selectors.

2. **Should the VERIFICATION.md date reflect original completion (2026-02-24) or Phase 40 write date?**
   - What we know: Phase 39 was completed 2026-02-24. The verification is being written retroactively.
   - Recommendation: Use 2026-02-24 (original completion date) for consistency with SUMMARY files. The VERIFICATION.md is formalizing what was already true.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not present in `.planning/config.json` (defaults to false).

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `frontend/src/store/index.ts` — confirmed `useNavigationSlice` function at lines 106-116, zero grep matches for its import
- Direct code inspection: `frontend/src/pages/MarketplacePage.tsx` lines 25-33 — confirmed `navigationSource` consumption without reset
- Direct code inspection: `frontend/src/hooks/useSage.ts` lines 134-166 — confirmed full Browse discovery flow
- Direct code inspection: `frontend/src/hooks/useExplore.ts` lines 31-40 — confirmed pending results consumption on mount
- `.planning/v3.0-MILESTONE-AUDIT.md` — primary source of truth for all three gaps
- `.planning/phases/36-foundation/36-VERIFICATION.md` — canonical VERIFICATION.md format template

### Secondary (MEDIUM confidence)
- Phase 39 SUMMARY files (39-01-SUMMARY.md, 39-02-SUMMARY.md) — implementation evidence for VERIFICATION.md content

---

## Metadata

**Confidence breakdown:**
- VERIFICATION.md content: HIGH — all evidence verifiable from existing code files at confirmed line numbers
- Dead code removal scope: HIGH — grep confirms zero consumers of `useNavigationSlice`
- Sticky-state fix: HIGH — root cause and fix verified against Zustand equality behavior; no new behavior introduced
- Pitfalls: HIGH — derived from direct code analysis, not speculation

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable — no external dependencies)
