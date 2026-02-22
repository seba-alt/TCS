---
plan: 29-01
phase: 29-sage-personality-fab-reactions
status: complete
completed: 2026-02-22
---

# Summary: Sage Personality + FAB Glow Animation

## What Was Built

Rewrote Sage's system prompt for a "smart funny friend" voice with a hard one-clarifying-question cap and concrete-options requirement. Added a reactive `motion.div` glow wrapper to the Sage FAB — purple glow on Sage reply, blue glow on filter changes, auto-fade after 1.5s.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Rewrite system_instruction in pilot_service.py for Sage personality | ✓ |
| 2 | Add motion.div glow wrapper to SageFAB with Sage and filter activity triggers | ✓ |

## Key Decisions

- System prompt rewritten with hard rules: no filler affirmations, one clarifying question max, concrete 2-3 options format
- motion.div wrapper animates `boxShadow` ONLY — inner `motion.button` retains `whileHover`/`whileTap` scale unchanged (no conflict)
- Filter glow trigger: prevFilterKey initialized to `null` on mount, skips first render to avoid page-load flare
- Sage glow trigger: `prevStreamingRef` initialized to current `isStreaming` to avoid spurious glow on first mount
- Two distinct glow colors: purple `rgba(139,92,246,0.55)` for Sage activity, blue `rgba(99,179,237,0.45)` for filter changes

## Artifacts

### key-files.created
- `app/services/pilot_service.py` — system_instruction rewritten (lines 262-287)
- `frontend/src/components/pilot/SageFAB.tsx` — full rewrite with motion.div wrapper, GlowType state, dual trigger useEffects

## Verification Results

- `python3 -c "from app.services.pilot_service import run_pilot"` → OK
- `grep "at most ONE" pilot_service.py` → found (line 269)
- `grep "Absolutely" pilot_service.py` → only in ban-list (correct)
- `npx tsc --noEmit` → no errors
- `npm run build` → exits 0
- `whileHover`/`whileTap` on inner `motion.button` confirmed
- No `scale` on `motion.div` wrapper confirmed
- `boxShadow` animate prop confirmed on `motion.div`

## Self-Check: PASSED
