---
phase: 05-email-gate-ux-show-expert-results-immediately-but-require-email-before-clicking-through-to-a-profile
verified: 2026-02-20T00:00:00Z
status: human_needed
score: 10/11 must-haves verified
re_verification: false
human_verification:
  - test: "Open http://localhost:5173, clear localStorage tcs_gate_email, send a chat query, confirm expert cards appear greyed-out (grayscale, muted) with inline EmailGate form below them"
    expected: "Cards are visibly desaturated and clicking them does nothing; EmailGate form with 'Unlock expert profiles' heading, email input, 'Unlock profiles' button, and 'We'll never spam you.' text appears below the cards"
    why_human: "Visual greyscale/opacity rendering and pointer-events-none enforcement cannot be confirmed programmatically; requires real browser paint"
  - test: "Type 'notanemail' in the email field and click 'Unlock profiles'"
    expected: "Inline error message 'Please enter a valid email address.' appears below the input without page reload"
    why_human: "Client-side validation message rendering and error state UI require browser interaction"
  - test: "Type a valid email and click 'Unlock profiles' — watch for spinner then instant unlock"
    expected: "Button briefly shows spinner ('Unlocking…'), cards immediately go full colour with no animation, EmailGate form disappears, cards are now clickable links opening in a new tab"
    why_human: "Instant unlock timing (no animation) and state transition are visual/interactive — cannot assert in a headless grep check"
  - test: "Hard refresh the page after unlock (Cmd+Shift+R) and send a new chat query"
    expected: "Expert cards appear fully unlocked with no gate form — returning user sees zero locked state, localStorage tcs_gate_email key is present in DevTools"
    why_human: "localStorage persistence across hard refresh and zero flash of locked state for returning users requires real browser session"
  - test: "Verify EMAIL-GATE-01 definition — check if this requirement ID should be added to REQUIREMENTS.md"
    expected: "REQUIREMENTS.md is updated to include EMAIL-GATE-01 under a new section (e.g., 'Lead Capture' or 'Email Gate') with a description, Phase 5 traceability row added to the traceability table, and 'Coverage' counts updated"
    why_human: "The requirement ID EMAIL-GATE-01 is referenced in all three phase 5 plans and all three summaries but does not exist anywhere in REQUIREMENTS.md. A human must decide the canonical requirement text and update the document."
---

# Phase 5: Email Gate UX Verification Report

**Phase Goal:** Expert cards appear immediately after a chat response, greyed-out and non-clickable, with an inline email capture form below them — submitting a valid email instantly unlocks all cards and stores the lead; returning users (same browser) see fully unlocked cards with no gate.
**Verified:** 2026-02-20
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/email-capture accepts a valid email and returns {status: ok} with 200 | VERIFIED | `email_capture.py:29` — `@router.post("/api/email-capture", status_code=200)` returns `{"status": "ok"}`. Route confirmed live: `/api/email-capture` present in FastAPI route list via Python import check. |
| 2  | Duplicate email submissions are silently ignored (idempotent) | VERIFIED | `email_capture.py:38` — `.on_conflict_do_nothing(index_elements=["email"])`. SQLite dialect insert used; no error path returns 409 or 500 for duplicates — function always returns `{"status": "ok"}`. |
| 3  | Invalid email format returns 422 from Pydantic EmailStr validation | VERIFIED | `email_capture.py:26` — `class EmailCaptureRequest(BaseModel): email: EmailStr`. Pydantic will automatically raise `RequestValidationError` (422) for non-email input. No custom override. |
| 4  | The email_leads table is created in the SQLite DB on server startup | VERIFIED | `main.py:53` — `Base.metadata.create_all(bind=engine)` in lifespan. `models.py:43` — `EmailLead.__tablename__ = "email_leads"`. Python import check confirms columns: `['id', 'email', 'created_at']`. |
| 5  | Expert cards appear greyed-out and non-clickable to new users | VERIFIED (code) / NEEDS HUMAN (visual) | `ExpertCard.tsx:75-84` — locked branch renders `<div className="...grayscale opacity-60 pointer-events-none select-none" aria-hidden="true">`. `ChatMessage.tsx:59` — `locked={!isUnlocked}` wired. Code is correct; visual confirmation requires browser. |
| 6  | Inline EmailGate form appears below the most recent expert message only | VERIFIED | `ChatMessage.tsx:62-64` — `{!isUnlocked && isLastExpertMessage && <EmailGate onSubmit={onSubmitEmail} />}`. `App.tsx:62-66` — `lastExpertMsgIndex` computed via `messages.reduce()` to find last expert message; `isLastExpertMessage = i === lastExpertMsgIndex`. Gate cannot appear on older messages. |
| 7  | Submitting a valid email instantly unlocks all cards | VERIFIED (code) / NEEDS HUMAN (visual) | `useEmailGate.ts:33-34` — `localStorage.setItem(STORAGE_KEY, submittedEmail); setEmail(submittedEmail)` called BEFORE backend await. `isUnlocked = email !== null` — state transitions synchronously. Visual unlock confirmation requires browser. |
| 8  | The EmailGate disappears after submission with no re-appearance | VERIFIED | `ChatMessage.tsx:62` — `{!isUnlocked && isLastExpertMessage && <EmailGate ... />}`. Once `isUnlocked=true`, the gate is never rendered again in any message. No re-mount path. |
| 9  | Returning users (localStorage has email) see fully unlocked cards on page load with no flash | VERIFIED (code) / NEEDS HUMAN (visual) | `useEmailGate.ts:24-26` — lazy `useState(() => localStorage.getItem(STORAGE_KEY))`. Lazy initializer runs synchronously before first render — no useEffect delay. Flash prevention is a render-timing guarantee; actual zero-flash behaviour requires real browser observation. |
| 10 | Locked cards render as `<div>` so keyboard users cannot tab-activate a locked link | VERIFIED | `ExpertCard.tsx:75-84` — locked branch returns `<div ... pointer-events-none select-none aria-hidden="true">`. Unlocked cards with profileUrl render as `<a>` (`ExpertCard.tsx:86-97`). Locked path never renders `<a>`. |
| 11 | useChat still receives PLACEHOLDER_EMAIL as fallback before gate submission | VERIFIED | `App.tsx:9` — `const PLACEHOLDER_EMAIL = 'user@tinrate.com'`. `App.tsx:25` — `email: email ?? PLACEHOLDER_EMAIL`. Pre-gate email is null; nullish coalescing guarantees the fallback is sent. |

**Score:** 11/11 truths verified in code; 4 require human confirmation of visual/interactive behaviour.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/routers/email_capture.py` | POST /api/email-capture endpoint with idempotent insert | VERIFIED | 43 lines; exports `router`; uses `sqlalchemy.dialects.sqlite.insert` + `on_conflict_do_nothing`; returns `{"status": "ok"}` |
| `app/models.py` | EmailLead ORM model | VERIFIED | `class EmailLead(Base)` at line 34; `__tablename__ = "email_leads"`; email column has `unique=True, nullable=False, index=True`; created_at with utcnow default |
| `app/main.py` | email_capture router registered | VERIFIED | Line 29: `from app.routers import chat, email_capture, health`; Line 103: `app.include_router(email_capture.router)` |
| `frontend/src/hooks/useEmailGate.ts` | localStorage-backed gate state and submitEmail | VERIFIED | 50 lines; exports `useEmailGate` and `UseEmailGateReturn`; lazy useState initializer; localStorage write before fetch; fire-and-forget catch block |
| `frontend/src/components/EmailGate.tsx` | Inline email capture form (min 60 lines) | VERIFIED | 99 lines (exceeds 60-line minimum); spinner state; client-side regex validation; privacy note; accessible ARIA markup |
| `frontend/src/components/ExpertCard.tsx` | locked prop renders greyed-out non-interactive div | VERIFIED | Lines 3-6: `locked?: boolean` in Props; Lines 75-84: locked branch with `grayscale opacity-60 pointer-events-none select-none aria-hidden="true"` |
| `frontend/src/components/ChatMessage.tsx` | Gate insertion below most recent expert message | VERIFIED | Line 3: `import EmailGate from './EmailGate'`; Line 62: conditional render with `!isUnlocked && isLastExpertMessage`; `locked={!isUnlocked}` passed to ExpertCard |
| `frontend/src/App.tsx` | useEmailGate hook wired; props passed to ChatMessage | VERIFIED | Line 7: `import { useEmailGate }`; Line 23: `const { isUnlocked, email, submitEmail } = useEmailGate()`; Lines 77-79: `isUnlocked`, `onSubmitEmail={submitEmail}`, `isLastExpertMessage` all passed to ChatMessage |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/routers/email_capture.py` | `app/models.EmailLead` | SQLAlchemy dialect insert with `on_conflict_do_nothing` | WIRED | `email_capture.py:16` imports `insert` from `sqlalchemy.dialects.sqlite`; `email_capture.py:35-38` builds stmt with `insert(EmailLead).values(...).on_conflict_do_nothing(index_elements=["email"])` |
| `app/main.py` | `app/routers/email_capture.router` | `app.include_router(email_capture.router)` | WIRED | `main.py:29`: import present; `main.py:103`: `app.include_router(email_capture.router)` — confirmed live via Python route listing |
| `frontend/src/App.tsx` | `frontend/src/hooks/useEmailGate.ts` | `useEmailGate()` hook call | WIRED | `App.tsx:7`: `import { useEmailGate } from './hooks/useEmailGate'`; `App.tsx:23`: destructured and used to pass props to ChatMessage |
| `frontend/src/components/ChatMessage.tsx` | `frontend/src/components/EmailGate.tsx` | Conditional render when `!isUnlocked && isLastExpertMessage` | WIRED | `ChatMessage.tsx:3`: `import EmailGate from './EmailGate'`; `ChatMessage.tsx:62-64`: gate rendered conditionally — correct single-gate logic |
| `frontend/src/components/ExpertCard.tsx` | `locked` prop | `locked={!isUnlocked}` passed from ChatMessage | WIRED | `ChatMessage.tsx:59`: `locked={!isUnlocked}`; `ExpertCard.tsx:5`: `locked?: boolean` in Props; `ExpertCard.tsx:75`: `if (locked)` branch present |
| `frontend/src/hooks/useEmailGate.ts` | `/api/email-capture` | Fire-and-forget fetch POST after localStorage write | WIRED | `useEmailGate.ts:38`: `await fetch(\`${API_URL}/api/email-capture\`, { method: 'POST', ... })` — called inside try/catch after localStorage write |

All 6 key links: WIRED.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EMAIL-GATE-01 | 05-01-PLAN, 05-02-PLAN, 05-03-PLAN | Email gate UX — show results immediately, require email to unlock, store lead | IMPLEMENTED but NOT IN REQUIREMENTS.md | All three plans claim this ID. Implementation is complete and human-verified (05-03-SUMMARY). However EMAIL-GATE-01 does not exist anywhere in `.planning/REQUIREMENTS.md` — no definition, no traceability row, no coverage count update. |

**REQUIREMENTS.md gap:** EMAIL-GATE-01 is referenced in 6 phase 5 planning documents but has no entry in `.planning/REQUIREMENTS.md`. The traceability table ends at Phase 4 / DEPL-01. This is a documentation gap — the implementation is real and verified, but the requirements document is out of date.

---

## Anti-Patterns Found

No blocker or warning anti-patterns detected across any of the 6 modified files.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `frontend/src/components/EmailGate.tsx:60` | `placeholder="you@example.com"` | Info | Legitimate HTML input placeholder attribute — not a stub indicator |
| `frontend/src/App.tsx:9` | `PLACEHOLDER_EMAIL` | Info | Intentional design per plan must_haves — pre-gate fallback email for useChat |

No empty returns, no TODO/FIXME/HACK comments, no stub implementations, no console.log-only handlers found.

---

## Human Verification Required

The following items require a real browser session to confirm. All automated code checks passed.

### 1. Visual locked state (greyed-out cards)

**Test:** Open http://localhost:5173 in a browser. Clear localStorage key `tcs_gate_email` in DevTools. Hard refresh. Send a chat query.
**Expected:** Expert cards appear immediately but are visibly desaturated (greyscale) and muted (opacity). Clicking a card does nothing.
**Why human:** CSS classes `grayscale opacity-60 pointer-events-none` produce the correct visual output in code, but rendering and pointer event suppression require actual browser paint to confirm.

### 2. Email gate form appearance and content

**Test:** Observe the inline EmailGate form below the greyed-out cards.
**Expected:** Form shows "Unlock expert profiles" heading, descriptive subtext, email input with placeholder "you@example.com", "Unlock profiles" button, and "We'll never spam you." privacy note.
**Why human:** JSX structure is correct in code, but actual rendered layout and readability require visual inspection.

### 3. Client-side validation error display

**Test:** Enter "notanemail" in the email field and click "Unlock profiles".
**Expected:** Inline error "Please enter a valid email address." appears below the input without any page reload or navigation.
**Why human:** Error state rendering and absence of page reload cannot be verified programmatically from static analysis.

### 4. Instant unlock on valid email submission

**Test:** Enter a valid email (e.g., test@example.com) and click "Unlock profiles".
**Expected:** Button briefly shows spinner with "Unlocking…" text, then cards instantly become fully coloured with no animation/transition, EmailGate form unmounts, and cards are clickable links opening Tinrate profile pages in a new tab.
**Why human:** Timing of the unlock transition (instant vs animated), spinner appearance, and link navigation behaviour require browser interaction to confirm.

### 5. Returning user — zero flash on page load

**Test:** After unlocking, hard refresh the page (Cmd+Shift+R) and send a new chat query.
**Expected:** Cards appear fully unlocked with no visible greyed-out state at any point — including during initial render. localStorage `tcs_gate_email` key visible in DevTools.
**Why human:** The lazy useState initializer prevents a flash of locked state in theory, but the "zero flash" guarantee is a perceptual claim that requires real browser observation. DevTools localStorage inspection confirms persistence.

---

## Requirements Document Gap

EMAIL-GATE-01 is declared as the requirement ID in all three phase 5 plans (`requirements: [EMAIL-GATE-01]`) and marked completed in all three summaries (`requirements-completed: [EMAIL-GATE-01]`). However:

- `.planning/REQUIREMENTS.md` contains no definition for EMAIL-GATE-01
- The traceability table in REQUIREMENTS.md ends at Phase 4 / DEPL-01 with no Phase 5 row
- The "Coverage" section counts 7 v1 requirements — Phase 5 is not counted

**Recommended action:** Add EMAIL-GATE-01 to REQUIREMENTS.md under a new "Lead Capture" or "Email Gate" section, add a Phase 5 traceability row, and update the coverage counts. This is a documentation task — the implementation is complete and human-verified.

---

## Commits Verified

All commits referenced in summaries exist in git history:

| Commit | Summary Reference | Description |
|--------|------------------|-------------|
| `bebe24b` | 05-01-SUMMARY | feat(05-01): add EmailLead ORM model to app/models.py |
| `dbddc81` | 05-01-SUMMARY | feat(05-01): create POST /api/email-capture endpoint and wire into main.py |
| `54e3b18` | 05-02-SUMMARY | feat(05-02): create useEmailGate hook and EmailGate component |
| `1c3768b` | 05-02-SUMMARY | feat(05-02): wire email gate into ExpertCard, ChatMessage, and App.tsx |

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_
