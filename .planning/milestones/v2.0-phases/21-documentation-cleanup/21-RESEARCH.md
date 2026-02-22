# Phase 21: Documentation & Cleanup - Research

**Researched:** 2026-02-22
**Domain:** Planning artefact synchronisation, retroactive documentation, dead code cleanup
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**VERIFICATION.md format & depth**
- Agent picks the most sensible format/structure based on existing phase VERIFICATION.md files (no fixed template required)
- Depth should match existing phases (e.g. Phase 17 or 18 level of detail)
- Status should be `passed` — these are retroactive docs for already-shipped, production code
- Source: primary from existing plan SUMMARY.md files, confirmed against actual code files for key facts (both — SUMMARYs + code spot-check)
- Applies to: Phase 16 (Marketplace Page & Sidebar) and Phase 19 (Extended Features)

**Requirement language updates (MARKET-05 & Phase 17 VERIFICATION.md)**
- Agent judges how much to rewrite MARKET-05 based on how wrong the current text is — minimal surgical fix if close, fuller rewrite if substantially wrong
- Phase 17 VERIFICATION.md animation description: agent picks level of detail (label-only vs behaviour description) based on surrounding context
- tags.slice count (0,3 → 0,2): agent investigates the actual code to confirm the real value before updating the doc
- Phase 17 VERIFICATION.md full accuracy: agent flags anything obviously wrong it spots while editing, but primary task is the two known issues

**LEAD-03 deferral**
- Treat as minor — just mark it deferred with a brief v2.1 backlog note
- Tone and placement: agent follows whatever pattern other deferred requirements use in REQUIREMENTS.md
- Agent checks if a v2.1 milestone exists in the roadmap and references it formally if so; otherwise uses 'v2.1 backlog' as a placeholder label

**Dead code scan breadth**
- Scan all Phase 14–20 frontend/backend files for dead comments and stale code
- If dead code is found during reads, fix it inline (don't just note it)
- Code changes committed separately from documentation changes
- The known `_state?.triggerSearch()` comment in the Phase 15 store is confirmed dead — delete it without further investigation

**Commit conventions**
- Documentation changes (VERIFICATION.md, REQUIREMENTS.md) → one commit
- Code changes (dead comment removal) → separate commit

### Claude's Discretion
- Exact format and section headings for Phase 16 and 19 VERIFICATION.md files
- Whether to expand or just label-correct the MARKET-05 requirement
- Depth of Phase 17 VERIFICATION.md animation description
- Placement of LEAD-03 deferral (in-place flag vs separate section)
- What else is obviously dead in the codebase during the scan

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MARKET-05 | Cards animate on mount via Framer Motion; AnimatePresence used only on sidebar and modal transitions | Research confirms actual code uses CSS hover transition only (no mount animation); requirement text must be updated to match reality — ExpertCard uses `.expert-card` CSS class with `transform: translateY(-4px)` + box-shadow glow on `:hover` defined in `index.css` |
| LEAD-03 | "Download Match Report" gates behind email + project type; AI generates in-app styled HTML report | Research confirms no implementation exists; REQUIREMENTS.md already has an inline deferral note on the checkbox line and an entry in "Deferred to v2.1+" section — the checkbox needs to remain `[ ]` with existing deferral note confirmed accurate |
</phase_requirements>

## Summary

Phase 21 is a documentation-only and surgical code cleanup phase — it changes no product behaviour. The v2.0 milestone audit (`v2.0-MILESTONE-AUDIT.md`) identified five specific gaps that prevent the audit from passing: two missing `VERIFICATION.md` files (phases 16 and 19), a stale animation description in Phase 17's `VERIFICATION.md` and its parent requirement MARKET-05, a dead code comment in the Phase 15 store, and a `tags.slice` count discrepancy in Phase 17's `VERIFICATION.md`. Phase 20 already closed the four code-level bugs; Phase 21 closes only the documentation and dead-comment gaps.

All evidence for the retroactive VERIFICATION.md files exists in the phase SUMMARY.md files and can be cross-checked directly against the live codebase. No library research or architecture decisions are needed. The primary risk is writing VERIFICATION.md content that drifts from the actual codebase — every factual claim must be spot-checked against real source files before being written.

**Primary recommendation:** Work through the five audit gap items in a single, well-ordered pass — write Phase 16 VERIFICATION.md, write Phase 19 VERIFICATION.md, fix Phase 17 VERIFICATION.md (animation text + tags.slice count), update MARKET-05 in REQUIREMENTS.md, mark LEAD-03 deferred, then remove the dead comment — committing docs and code separately.

## Standard Stack

This phase involves no new libraries. The "stack" is the planning artefact format and the existing project conventions.

### Core
| Item | Version/Pattern | Purpose | Why Standard |
|------|----------------|---------|--------------|
| VERIFICATION.md format | Match phases 17 & 18 | Structured verification record | Audit tooling expects consistent format |
| YAML frontmatter | `phase`, `status`, `verified`, `plans_verified` | Machine-readable metadata | Used by gsd audit tool |
| REQUIREMENTS.md checkbox syntax | `[ ]` / `[x]` with inline italics note | Requirement status | Existing project convention |

### Existing VERIFICATION.md Anatomy (from phases 17 and 18)

Phase 17 uses:
```yaml
---
phase: 17
status: passed
verified: 2026-02-21
verifier: automated
---
```
Sections: Phase Goal, Requirement Coverage table, Must-Haves Verification (per success criterion), Artifact Spot-Checks table, Build Status, Commits, Summary.

Phase 18 uses:
```yaml
---
phase: "18"
status: passed
verified: "2026-02-21"
plans_verified: 4/4
---
```
Sections: Status, Requirements Traceability table, Must-Have Verification table, Phase Goal Achievement, Build Verification, Files Created/Modified.

Either format is acceptable. Phase 16 and 19 VERIFICATION.md files should match one of these styles for consistency.

## Architecture Patterns

### Pattern 1: Retroactive VERIFICATION.md from SUMMARY evidence

**What:** Write VERIFICATION.md after the fact using SUMMARY frontmatter + code spot-checks as the evidence source.
**When to use:** Phase was human-verified or auto-approved without a VERIFICATION.md being written at the time.

Evidence sources per phase:

**Phase 16 (Marketplace Page & Sidebar):**
- `16-01-SUMMARY.md` — useExplore hook, SearchInput, RateSlider, TagMultiSelect; installed @radix-ui/react-slider, vaul, lucide-react
- `16-02-SUMMARY.md` — FilterSidebar (sticky collapsible), FilterChips, SkeletonGrid, MobileFilterSheet (vaul Drawer), full MarketplacePage layout
- `16-03-SUMMARY.md` — Human verification passed; vaul `Drawer.Content h-full max-h-[97%]` fix applied; MARKET-01 and MARKET-06 satisfied
- Requirements covered: MARKET-01 (faceted sidebar with rate slider, domain tag multi-select, text search, active filter chips), MARKET-06 (sidebar collapses to bottom-sheet on mobile)
- Key code files to spot-check: `FilterSidebar.tsx`, `MobileFilterSheet.tsx`, `FilterChips.tsx`, `RateSlider.tsx`, `SearchInput.tsx`, `TagMultiSelect.tsx`, `useExplore.ts`

**Phase 19 (Extended Features):**
- `19-01-SUMMARY.md` — `GET /api/suggest` with FTS5 prefix matching, registered in `main.py`
- `19-02-SUMMARY.md` — `constants/tags.ts` (shared TOP_TAGS), `useUrlSync.ts` (bidirectional URL ↔ Zustand sync), Copy link button in FilterSidebar
- `19-03-SUMMARY.md` — `ProfileGateModal.tsx`, `onViewProfile` prop on ExpertCard/ExpertGrid, `pendingProfileUrl` gate state at MarketplacePage level
- `19-04-SUMMARY.md` — Enhanced EmptyState with 6 tag suggestions, Sage CTA, Clear all
- `19-05-SUMMARY.md` — SearchInput suggestions dropdown (8 suggestions, AbortController, blur/click race fix)
- `19-06-SUMMARY.md` — Auto-approved; FTS5 rebuild fix in `main.py`; build and API verified
- Requirements covered: LEAD-01, LEAD-02, LEAD-04, ROBUST-01, ROBUST-02, ROBUST-03
- LEAD-03 NOT covered — explicitly deferred
- Key code files to spot-check: `suggest.py`, `useUrlSync.ts`, `ProfileGateModal.tsx`, `EmptyState.tsx`, `SearchInput.tsx`, `constants/tags.ts`

### Pattern 2: Surgical requirement text fix (MARKET-05)

**What:** Update REQUIREMENTS.md requirement text to match what was actually shipped.
**Current MARKET-05 text (line 29):**
```
- [ ] **MARKET-05**: Cards animate on mount via Framer Motion; `AnimatePresence` used only on sidebar and modal transitions *(gap closure Phase 21: accepting CSS hover animation — requirement will be updated)*
```
**Actual implementation:** ExpertCard uses a CSS class `.expert-card` with `transition: transform 0.2s ease-out, box-shadow 0.2s ease-out` on hover (defined in `frontend/src/index.css`). No mount animation. No `motion/react` import in ExpertCard. `AnimatePresence` is used in MarketplacePage for the Sage FAB, Sage panel, and ProfileGateModal — but NOT for expert cards.

The inline parenthetical already signals this update is coming. The CONTEXT.md says to judge how much to rewrite — the current text is substantially wrong (Framer Motion vs CSS hover, mount vs hover), so a fuller rewrite of the requirement description is warranted. The checkbox stays `[ ]` and the phase reference should be updated to reflect what was actually accepted.

**Phase 17 VERIFICATION.md fixes needed (two issues):**
1. `tags.slice(0,3)` on line 33 → confirmed actual code uses `tags.slice(0, 2)` (ExpertCard.tsx line 55)
2. Animation description in Success Criteria 4 (lines 41–45): describes `motion/react` with `initial/animate` and stagger delay — this code no longer exists. ExpertCard has NO `motion` import. The animation is CSS-only hover. The VERIFICATION.md must reflect what the code actually does now.

Note: the `index` prop in ExpertCard (`interface ExpertCardProps { index: number }`) is declared but never used in the component body — this was a leftover from the removed stagger animation. This is dead code that should be flagged and removed during the scan.

### Pattern 3: LEAD-03 deferral mark-up

**What:** Ensure REQUIREMENTS.md consistently documents LEAD-03 as deferred to v2.1.
**Current state:** REQUIREMENTS.md already has:
- Line 42: `- [ ] **LEAD-03**: ... *(deferred to v2.1 — not implemented in v2.0)*`
- Lines 53–55: Deferred to v2.1+ section with a LEAD-03 entry: "explicitly removed from v2.0 scope in `19-CONTEXT.md`; no MatchReport component or `/api/match_report` endpoint built; requires full implementation in v2.1"
- Line 95 traceability table: `LEAD-03 | Phase 21 (deferred → v2.1) | Deferred`
- Line 105 coverage: `Deferred: 1 (LEAD-03)`

**Assessment:** LEAD-03 is already well-documented as deferred throughout REQUIREMENTS.md. The CONTEXT.md says "treat as minor — just mark it deferred with a brief v2.1 backlog note." The existing inline note on the checkbox line is exactly that. No v2.1 milestone entry was found in MILESTONES.md (it ends at v1.2; v2.0 is current). The traceability is consistent. The primary task here is confirming the existing state is correct and potentially adding a more explicit backlog note if the existing ones are insufficient for the audit.

**MILESTONES.md v2.1 check:** No v2.1 milestone section exists in MILESTONES.md. The CONTEXT.md says "if a v2.1 milestone exists in the roadmap, reference it formally; otherwise use 'v2.1 backlog' as a placeholder." Result: use 'v2.1 backlog' as the label — which is what the existing REQUIREMENTS.md already does.

### Pattern 4: Dead code identification and removal

**Confirmed dead code (Phase 15 store):**

File: `frontend/src/store/index.ts`, lines 44–46:
```typescript
onRehydrateStorage: () => (_state) => {
  // Phase 16+ wires: _state?.triggerSearch()
},
```
The comment references `_state?.triggerSearch()` — `triggerSearch` was never added to the store. `useExplore` manages search via a `useEffect` that runs when filter state changes. The `onRehydrateStorage` callback is functionally empty. The entire block can be reduced to an empty callback or the comment line removed. The CONTEXT.md says to delete the comment without further investigation.

**Additional dead code found during research:**

File: `frontend/src/components/marketplace/ExpertCard.tsx`, line 6:
```typescript
interface ExpertCardProps {
  expert: Expert
  index: number     // ← dead prop: was used for stagger delay in motion/react, now removed
  onViewProfile: (url: string) => void
}
```
The `index` parameter is declared in the interface and in the function signature (`ExpertCard({ expert, onViewProfile }` — actually it IS destructured as `{ expert, index, onViewProfile }` but `index` is never referenced in the JSX). Wait — re-checking: line 18 of ExpertCard.tsx: `export function ExpertCard({ expert, onViewProfile }: ExpertCardProps)` — `index` is NOT destructured in the function signature (it's in the interface but omitted from the destructuring). However, ExpertGrid.tsx passes `index={index}` on line 49. The prop is in the interface, passed by ExpertGrid, but never used in ExpertCard. This is a dead prop that should be removed from both the interface and ExpertGrid's render call.

**Backend scan result:** Only informational/documentation comments found in backend files — nothing dead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VERIFICATION.md content | Don't invent from memory | Read all SUMMARY.md files + spot-check code files | SUMMARYs are the authoritative record of what was built |
| MARKET-05 requirement text | Don't speculate on intent | Read actual `index.css` and `ExpertCard.tsx` | The code IS the ground truth |
| Dead code detection | Don't rely on memory | Actually grep/read the files | Comments drift from reality; only code reading confirms |

## Common Pitfalls

### Pitfall 1: Writing VERIFICATION.md from memory without code spot-checks
**What goes wrong:** VERIFICATION.md claims facts that have drifted from the actual codebase (this is exactly what happened to Phase 17's VERIFICATION.md — it described stagger animation code that was subsequently removed).
**Why it happens:** It's easy to write from SUMMARY.md and assume the code matches. Code changes after SUMMARY was written.
**How to avoid:** For every specific claim in VERIFICATION.md (file exists, function exists, key line present), actually read the file and confirm before writing.
**Warning signs:** Any claim about animation/motion/hooks that can't be verified by a grep.

### Pitfall 2: Over-writing LEAD-03 deferral
**What goes wrong:** Adding duplicate or conflicting deferral notes to REQUIREMENTS.md when the existing notes are already correct.
**Why it happens:** Not reading the existing file carefully before editing.
**How to avoid:** Read REQUIREMENTS.md in full — it already has three consistent LEAD-03 deferral references. The task is to confirm they are accurate, not to add more.

### Pitfall 3: Leaving the `index` prop dangling in ExpertCard
**What goes wrong:** Removing the motion stagger comment from the VERIFICATION.md without also cleaning up the dead `index` prop in ExpertCard.tsx.
**Why it happens:** The audit only called out the comment; the prop is a secondary dead artifact from the same removed feature.
**How to avoid:** When reading ExpertCard.tsx to verify the animation fix, also check the prop interface for leftovers.

### Pitfall 4: Incorrect tags.slice count in VERIFICATION.md
**What goes wrong:** Writing `slice(0,3)` if relying on the old VERIFICATION.md instead of the actual code.
**Why it happens:** The old VERIFICATION.md says 0,3; the code says 0,2.
**How to avoid:** Already confirmed by research: `ExpertCard.tsx` line 55 reads `expert.tags.slice(0, 2)`. Write `slice(0, 2)` in the corrected VERIFICATION.md.

### Pitfall 5: Committing docs and code in the same commit
**What goes wrong:** Mixing documentation changes with code changes makes the history harder to audit.
**Why it happens:** It's faster to do one commit.
**How to avoid:** Follow the CONTEXT.md mandate: two separate commits — one for docs, one for code.

## Code Examples

Verified patterns from actual codebase inspection:

### Actual MARKET-05 animation (CSS hover in index.css)
```css
/* frontend/src/index.css — confirmed by direct read */
.expert-card {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.06);
}

.expert-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 0 0 1.5px #5128F2,
    0 0 24px rgba(81, 40, 242, 0.25),
    0 8px 20px rgba(0, 0, 0, 0.08);
}
```

### Dead onRehydrateStorage comment to remove (index.ts lines 44-46)
```typescript
// BEFORE — frontend/src/store/index.ts lines 43-48
onRehydrateStorage: () => (_state) => {
  // Phase 16+ wires: _state?.triggerSearch()
},

// AFTER — keep callback but remove dead comment
onRehydrateStorage: () => (_state) => {
  // intentionally empty — useExplore manages initial fetch via useEffect
},

// OR remove entirely if the hook itself is not needed
```
The CONTEXT.md says to delete the dead comment. The callback can remain with an empty body (or be removed if unused).

### Phase 17 VERIFICATION.md — lines needing correction

Line 33 (current):
```
- `ExpertCard.tsx` renders: `first_name last_name`, `job_title`, `company`, `currency hourly_rate/hr`, `tags.slice(0,3)` pills...
```
Corrected (actual code is `slice(0, 2)`):
```
- `ExpertCard.tsx` renders: `first_name last_name`, `job_title`, `company`, `currency hourly_rate/hr`, `tags.slice(0, 2)` pills...
```

Success Criteria 4 (lines 41-45, current):
```markdown
### Success Criteria 4: Entry animations, no exit animations
- `motion` from `'motion/react'` with `initial/animate` on `motion.div` — VERIFIED
- No `exit` prop present — VERIFIED (grep confirmed no exit= in ExpertCard.tsx)
- Stagger delay: `Math.min(index * 0.05, 0.4)` — VERIFIED
- Status: PASS
```
These claims are FALSE for the current code. ExpertCard.tsx has NO `motion` import. The animation is CSS-only. The corrected entry should describe the actual CSS hover animation (in index.css) and note that mount animation is not present.

### Dead `index` prop in ExpertCard (secondary cleanup)
```typescript
// BEFORE — frontend/src/components/marketplace/ExpertCard.tsx
interface ExpertCardProps {
  expert: Expert
  index: number        // ← dead prop from removed stagger animation
  onViewProfile: (url: string) => void
}

// ExpertGrid.tsx passes: <ExpertCard expert={expert} index={index} onViewProfile={...} />

// AFTER — remove index from interface and ExpertGrid call
interface ExpertCardProps {
  expert: Expert
  onViewProfile: (url: string) => void
}
```

### MARKET-05 requirement corrected text (for reference)

Current (REQUIREMENTS.md line 29):
```
- [ ] **MARKET-05**: Cards animate on mount via Framer Motion; `AnimatePresence` used only on sidebar and modal transitions *(gap closure Phase 21: accepting CSS hover animation — requirement will be updated)*
```

The replacement should describe: CSS hover animation (lift + purple glow) on expert cards; `AnimatePresence` from `motion/react` used for Sage FAB show/hide, Sage panel slide-in, and ProfileGateModal enter/exit. The checkbox should become `[x]` once the requirement accurately describes what was shipped. The traceability table and coverage count also need updating.

## State of the Art

| Old State | Current State | When Changed | Impact |
|-----------|--------------|--------------|--------|
| ExpertCard used `motion/react` stagger animation | ExpertCard uses CSS hover transition only (no mount animation) | During Phase 17 development | Phase 17 VERIFICATION.md is stale; MARKET-05 requirement text is wrong |
| `tags.slice(0,3)` documented | `tags.slice(0, 2)` in actual code | During Phase 17 development | Minor factual error in VERIFICATION.md |
| `_state?.triggerSearch()` planned for onRehydrateStorage | `useExplore` useEffect handles initial fetch; `triggerSearch` was never implemented | Phase 16 removed the need | Dead comment in store/index.ts |
| LEAD-03 planned | LEAD-03 explicitly deferred in Phase 19 CONTEXT | Phase 19 scope decision | Checkbox in REQUIREMENTS.md already reflects deferred state |
| Phases 16 and 19 have no VERIFICATION.md | To be created in Phase 21 | Audit gap closure | Audit will pass once files exist |

## Open Questions

1. **onRehydrateStorage full removal vs comment-only removal**
   - What we know: The callback body is empty (just the dead comment). The CONTEXT.md says "delete the comment without further investigation."
   - What's unclear: Whether to also remove the `onRehydrateStorage` key entirely or keep it as an intentionally empty hook.
   - Recommendation: Remove the comment line. Keep the `onRehydrateStorage` structure in place (it is a valid Zustand persist hook point and keeping the empty callback is harmless). This is the minimal-change approach.

2. **ExpertCard `index` prop — include in dead code scan or separate task?**
   - What we know: The prop is declared in the interface and passed from ExpertGrid but never used in ExpertCard. It's definitely dead code from the removed motion animation.
   - What's unclear: The CONTEXT.md says to scan phases 14–20 and fix dead code inline. This falls under that mandate.
   - Recommendation: Remove `index: number` from `ExpertCardProps` interface and remove `index={index}` from ExpertGrid's `itemContent` render call. Include in the code-changes commit.

3. **MARKET-05 checkbox — stays `[ ]` or becomes `[x]`?**
   - What we know: The audit has it as `[ ]` and "pending gap closure Phase 21." The REQUIREMENTS.md inline note says the requirement "will be updated."
   - What's unclear: Should Phase 21 close it to `[x]` (by rewriting to match what was shipped)?
   - Recommendation: Yes — rewriting MARKET-05 to accurately describe the CSS hover animation + AnimatePresence usage means the requirement IS now satisfied. Change to `[x]`, update the traceability table to Complete, and update the coverage count.

## Sources

### Primary (HIGH confidence)
- Direct read: `frontend/src/components/marketplace/ExpertCard.tsx` — confirmed `tags.slice(0, 2)`, NO motion import, dead `index` prop
- Direct read: `frontend/src/store/index.ts` — confirmed dead comment at lines 44–46
- Direct read: `frontend/src/index.css` — confirmed CSS hover animation (`.expert-card:hover`)
- Direct read: `.planning/phases/17-expert-grid-cards/17-VERIFICATION.md` — confirmed stale animation claims (lines 41–45) and `tags.slice(0,3)` error (line 33)
- Direct read: `.planning/phases/16-marketplace-page-sidebar/16-01-SUMMARY.md`, `16-02-SUMMARY.md`, `16-03-SUMMARY.md` — source material for Phase 16 VERIFICATION.md
- Direct read: `.planning/phases/19-extended-features/19-01 through 19-06-SUMMARY.md` — source material for Phase 19 VERIFICATION.md
- Direct read: `.planning/REQUIREMENTS.md` — confirmed LEAD-03 already has three deferral references; confirmed MARKET-05 current text
- Direct read: `.planning/v2.0-MILESTONE-AUDIT.md` — confirmed all five audit gaps and their exact nature
- Direct read: `.planning/MILESTONES.md` — confirmed no v2.1 milestone entry exists (use 'v2.1 backlog' placeholder)
- Direct read: `.planning/phases/18-floating-ai-co-pilot/18-VERIFICATION.md` — format reference for writing new VERIFICATION.md files

### Secondary (MEDIUM confidence)
- None required — all findings sourced directly from codebase files

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- What needs to change: HIGH — all five gaps identified precisely by audit, confirmed by code reads
- VERIFICATION.md content accuracy: HIGH — SUMMARY.md files are comprehensive; key facts spot-checked against live code
- Dead code scope: HIGH — only two dead artifacts found in full scan (onRehydrateStorage comment, ExpertCard index prop)
- LEAD-03 status: HIGH — already documented as deferred; minor confirmation task
- MARKET-05 fix: HIGH — code read confirms CSS hover animation; requirement text rewrite is straightforward

**Research date:** 2026-02-22
**Valid until:** This research is specific to the current codebase snapshot — valid until any code changes are made to files referenced above. No external library changes relevant.
