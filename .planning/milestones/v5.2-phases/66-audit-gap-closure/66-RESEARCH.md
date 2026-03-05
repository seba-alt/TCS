# Phase 66: Audit Gap Closure — Research

**Researched:** 2026-03-04
**Domain:** Bug fix (payload key mismatch) + documentation verification (Phase 64 VERIFICATION.md)
**Confidence:** HIGH

---

## Summary

Phase 66 has exactly two deliverables, both identified precisely by the v5.2 milestone audit. The first is a one-line backend bug fix: `leads.py` reads `payload_data.get("expert", "")` for `explorer_click` events, but `ExpertCard.tsx` sends the payload key as `expert_id`. This causes the expert name to always appear blank in the admin lead timeline. The fix is surgical — change the key name in two places on lines 162–163 of `app/routers/admin/leads.py`.

The second deliverable is creating the Phase 64 `VERIFICATION.md` file, which was never generated despite both Phase 64 plans completing successfully. The summaries and code are all present and correct (minus the bug above); the gap is purely documentary. A `VERIFICATION.md` following the established Phase 63/65 pattern must be authored that formally confirms GATE-01 through GATE-04 and TRACK-03 against code evidence.

No new libraries, architecture changes, or schema migrations are required. This phase is entirely a fix-and-verify operation on already-shipped code.

**Primary recommendation:** Fix the `expert_id` key in `leads.py` first (closes the TRACK-03 bug), then author the Phase 64 `VERIFICATION.md` (satisfies the five partial requirements). Both tasks are independent and can be planned in a single plan wave.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | User sees mandatory email gate modal on first page load before browsing the Explorer | Code exists in `EmailEntryGate.tsx` + `MarketplacePage.tsx`. Needs formal verification evidence in VERIFICATION.md. |
| GATE-02 | User cannot dismiss or skip the email gate — email submission is required to access the platform | Implemented with no dismiss path in `EmailEntryGate.tsx`. Needs formal verification evidence in VERIFICATION.md. |
| GATE-03 | Returning subscriber bypasses gate instantly with no flash (synchronous localStorage check) | Implemented via synchronous Zustand persist initializer (`useState` lazy init, not `useEffect`). Needs formal verification evidence in VERIFICATION.md. |
| GATE-04 | Email gate submission sends distinct `source: "page_entry"` to Loops for lead segmentation | Implemented in `MarketplacePage.tsx` with 3s delayed subscribe call. Needs formal verification evidence in VERIFICATION.md. |
| TRACK-03 | Admin lead journey timeline includes Explorer search queries attributed to the lead's email | Backend query exists (`step 3.5` in `leads.py`). `explorer_search` path works. `explorer_click` path broken — payload key bug (`expert` vs `expert_id`). Fix required + verification evidence. |
</phase_requirements>

---

## Standard Stack

### Core
| Component | Version/Location | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| Python / FastAPI | `app/routers/admin/leads.py` | Backend endpoint serving the lead timeline | Existing stack — no new dependency |
| React / TypeScript | `frontend/src/admin/pages/LeadsPage.tsx` | Frontend admin timeline UI | Existing stack — no new dependency |
| Vitest | 4.0.18 (implicit Vite config) | Frontend test runner | Already used — 17 tests passing |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `app/routers/admin/leads.py` (existing) | Contains the bug at lines 162–163 | Direct edit only — no new file |
| `.planning/phases/64-email-first-gate/64-VERIFICATION.md` | Target file to create | Mirrors Phase 63 and 65 patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One-line fix to `payload_data.get("expert_id", "")` | Refactor backend to lookup expert name from DB (like `lead_clicks` path) | DB lookup is safer long-term but out of scope — payload key fix is correct and sufficient per audit |

**Installation:** None — no new packages required.

---

## Architecture Patterns

### Pattern 1: Payload Key Fix in leads.py
**What:** Change `payload_data.get("expert", "")` to `payload_data.get("expert_id", "")` on both lines 162 and 163 of `app/routers/admin/leads.py`.
**When to use:** Whenever frontend and backend disagree on payload field names.
**Evidence:** `ExpertCard.tsx` line 66 — `trackEvent('card_click', { expert_id: expert.username, ... })`. Backend lines 162–163 read `"expert"` — this key never exists in the payload.

```python
# CURRENT (broken) — app/routers/admin/leads.py lines 162-163
"expert_username": payload_data.get("expert", ""),
"expert_name": payload_data.get("expert", ""),

# FIXED
"expert_username": payload_data.get("expert_id", ""),
"expert_name": payload_data.get("expert_id", ""),
```

Note: `expert_username` and `expert_name` will both resolve to the username string (e.g., `"john-doe"`). The `expert_name` field ideally would be a display name, but looking at the `lead_clicks` path (lines 100–113), the display name is resolved from a DB lookup via `experts_map`. For Phase 66, correcting the key to `expert_id` is the minimum fix and is sufficient to make the field non-blank. A follow-up could add the DB lookup, but that is out of scope per the audit fix specification.

### Pattern 2: VERIFICATION.md Format
**What:** Create `.planning/phases/64-email-first-gate/64-VERIFICATION.md` following the exact format of Phase 65's `65-VERIFICATION.md`.
**When to use:** After every phase execution — currently missing for Phase 64.

```markdown
---
phase: 64
name: Email-First Gate
status: passed
verified_at: 2026-03-04T00:00:00Z
verifier: orchestrator-inline
---

# Phase 64: Email-First Gate — Verification

## Goal
...

## Requirements Verification
| Requirement | Status | Evidence |
|-------------|--------|----------|
| GATE-01 | PASSED | ... |
...
```

The evidence for each requirement comes from scanning the actual files created in Phase 64 (listed in summaries).

### Anti-Patterns to Avoid
- **Changing both `expert_username` and `expert_name` to different keys:** Both map to the same payload field (`expert_id` = the username string). Do not split them.
- **Adding a DB lookup in this phase for display name resolution:** Out of scope. The audit fix is payload key only.
- **Backdating verification timestamps:** Use today's date (2026-03-04) for `verified_at`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VERIFICATION.md structure | Custom format | Copy Phase 65 pattern exactly | Consistency — verifier agent expects the established format |
| Backend test for the payload fix | pytest infrastructure from scratch | Manual verification (no backend test infra exists) | The project has no pytest — confirmed in Phase 64 VALIDATION.md |

---

## Common Pitfalls

### Pitfall 1: Fixing Only One of the Two Lines
**What goes wrong:** `expert_username` or `expert_name` still reads `"expert"` and returns blank.
**Why it happens:** Lines 162 and 163 are identical — easy to fix only one.
**How to avoid:** Fix both `expert_username` and `expert_name` in the same edit.
**Warning signs:** If only one field is fixed, the timeline still shows blank in fields consuming the other key.

### Pitfall 2: VERIFICATION.md Missing Required Frontmatter
**What goes wrong:** The GSD verifier agent or audit tooling cannot parse the phase status.
**Why it happens:** Forgetting the YAML frontmatter block that Phase 63 and 65 both have.
**How to avoid:** Use the Phase 65 VERIFICATION.md as the exact structural template.

### Pitfall 3: Claiming TRACK-03 "Fully Satisfied" Without Noting the Scope
**What goes wrong:** VERIFICATION.md claims TRACK-03 PASSED but the `explorer_click` path was broken at time of Phase 64 execution.
**How to avoid:** In the Phase 64 VERIFICATION.md, note that the `explorer_click` payload key bug was discovered post-hoc and fixed in Phase 66. Mark TRACK-03 as PASSED with a note referencing Phase 66 closure.

### Pitfall 4: REQUIREMENTS.md Still Shows Requirements as Pending
**What goes wrong:** After Phase 66, REQUIREMENTS.md still shows `[ ]` for GATE-01–04 and TRACK-03.
**Why it happens:** REQUIREMENTS.md is updated manually — easy to forget.
**How to avoid:** Include a REQUIREMENTS.md update as a task step — flip `[ ]` to `[x]` for all 5 requirements.

---

## Code Examples

### Where the Bug Lives

```python
# File: app/routers/admin/leads.py (lines 159–166)
elif row.event_type == "card_click":
    click_events.append({
        "type": "explorer_click",
        "expert_username": payload_data.get("expert", ""),   # BUG: key is "expert_id"
        "expert_name": payload_data.get("expert", ""),       # BUG: key is "expert_id"
        "search_query": None,
        "created_at": row.created_at.isoformat(),
    })
```

### What the Frontend Actually Sends

```typescript
// File: frontend/src/components/marketplace/ExpertCard.tsx (lines 65–67)
void trackEvent('card_click', {
  expert_id: expert.username,   // <-- This is the actual key
  context,
  rank,
  ...
})
```

### Files to Verify for Phase 64 VERIFICATION.md Evidence

| File | What to Check |
|------|--------------|
| `frontend/src/components/marketplace/EmailEntryGate.tsx` | Exists, has no dismiss path, renders with gate content |
| `frontend/src/pages/MarketplacePage.tsx` | Imports `EmailEntryGate`, renders conditionally on `!subscribed`, `source: 'page_entry'` present |
| `frontend/src/store/nltrStore.ts` | `setSubscribed` method exists, synchronous bypass check possible |
| `app/routers/admin/leads.py` | Step 3.5 exists — queries `user_events WHERE email = :email` |
| `frontend/src/admin/types.ts` | `TimelineExplorerSearchEvent`, `TimelineExplorerClickEvent` interfaces exist |
| `frontend/src/admin/pages/LeadsPage.tsx` | Renders `explorer_search` (green/Compass) and `explorer_click` (amber/Eye) events |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 64 unverified (no VERIFICATION.md) | Phase 64 formally verified (VERIFICATION.md created) | Phase 66 | Audit gap closed, 5 requirements flip from partial → satisfied |
| `explorer_click` shows blank expert name | `explorer_click` shows correct `expert_id` (username) | Phase 66 bug fix | TRACK-03 fully satisfied |

---

## Open Questions

1. **Should `expert_name` resolve to a display name or username string?**
   - What we know: `lead_clicks` path (lines 100–113) does a DB lookup via `experts_map` to resolve display names. `explorer_click` currently just stores raw payload value.
   - What's unclear: Whether the audit fix intent was username-only (simpler) or display-name-resolved (consistent with `lead_clicks`).
   - Recommendation: Use username string for now (consistent with the audit fix spec: "Change `payload_data.get('expert', '')` to `payload_data.get('expert_id', '')`"). Leave DB lookup as future improvement. The field will be non-blank, which is the observable success criterion.

2. **Should Phase 64 VERIFICATION.md mark TRACK-03 PASSED or PARTIAL?**
   - What we know: At time of Phase 64 execution, the `explorer_click` path was broken. The fix happens in Phase 66.
   - Recommendation: Mark TRACK-03 as PASSED in the Phase 64 VERIFICATION.md with a note that the payload key bug was corrected in Phase 66. The Phase 64 implementation was otherwise correct and complete. The verification is authored retroactively so the final state (post Phase 66) should be reflected.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | Implicit Vite config (no vitest.config.ts — uses vite.config.ts) |
| Quick run command | `cd /Users/sebastianhamers/Documents/TCS/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd /Users/sebastianhamers/Documents/TCS/frontend && npx vitest run` |
| Estimated runtime | ~5 seconds (17 tests currently passing) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | Gate renders before Explorer | manual-only | N/A — visual DOM verification | N/A |
| GATE-02 | No dismiss path on gate | manual-only | N/A — requires DOM interaction testing | N/A |
| GATE-03 | Returning subscriber bypass (no flash) | manual-only | N/A — requires Zustand hydration in real browser | N/A |
| GATE-04 | `source: "page_entry"` sent to Loops | manual-only | N/A — third-party API call | N/A |
| TRACK-03 (bug fix) | `explorer_click` shows non-blank expert name | manual-only | N/A — no pytest infrastructure | N/A |

All Phase 66 verifications are manual-only (consistent with Phase 64 validation strategy). The existing 17 Vitest tests should still pass after the `leads.py` fix (Python-only change). Run Vitest as a regression guard after any frontend changes.

### Nyquist Sampling Rate
- **Minimum sample interval:** After the leads.py edit — run `cd /Users/sebastianhamers/Documents/TCS/frontend && npx vitest run --reporter=verbose` as regression guard (Python change, no frontend impact, but confirms nothing was accidentally touched)
- **Full suite trigger:** Before `/gsd:verify-work`
- **Phase-complete gate:** All 17 tests green + manual verification checklist complete
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps
None — no new test files required. Phase 66 is documentation + one-line bug fix. All verification is manual (consistent with established pattern for this codebase).

*(Existing infrastructure covers regression guard. No new test scaffolding needed.)*

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `app/routers/admin/leads.py` lines 148–166 — bug confirmed (reads `"expert"`, should read `"expert_id"`)
- Direct code read: `frontend/src/components/marketplace/ExpertCard.tsx` lines 65–67 — frontend sends `expert_id`
- `.planning/v5.2-MILESTONE-AUDIT.md` — authoritative gap specification
- `.planning/phases/65-admin-enhancements/65-VERIFICATION.md` — VERIFICATION.md structural template
- `.planning/phases/64-email-first-gate/64-01-SUMMARY.md` — evidence for GATE-01/02/03/04
- `.planning/phases/64-email-first-gate/64-02-SUMMARY.md` — evidence for TRACK-03

### Secondary (MEDIUM confidence)
- Phase 64 VALIDATION.md — confirms no backend pytest infrastructure, all TRACK-03 verification is manual-only

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Bug fix location: HIGH — directly read from source, confirmed by audit and both frontend/backend code
- VERIFICATION.md pattern: HIGH — Phase 63 and 65 templates exist and are readable
- Requirements coverage: HIGH — all 5 partial requirements map directly to code evidence in Phase 64 summaries
- Test architecture: HIGH — consistent with existing validation strategy (manual-only for this domain)

**Research date:** 2026-03-04
**Valid until:** Indefinite — stable code, not fast-moving domain
