---
phase: 06-thumbs-up-down-feedback-rate-results-downvote-opens-suggestion-sheet-feedback-stored-in-db
verified: 2026-02-20T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "FeedbackBar appears below expert cards — visual placement and label"
    expected: "Label 'Were these results helpful?' and two SVG thumb buttons render below expert cards after a recommendation response"
    why_human: "React render output and Tailwind CSS layout cannot be verified without a browser"
  - test: "Thumbs-up click fills the icon in brand-purple, no modal opens"
    expected: "Up thumb fills solid purple on click; down thumb remains outline; no modal appears"
    why_human: "State transitions and SVG fill changes require visual inspection in a running app"
  - test: "Thumbs-down click fills red and opens DownvoteModal"
    expected: "Down thumb fills solid red immediately; centered modal dialog with title 'Help us improve' and 4 checkboxes appears"
    why_human: "Modal render and positioning require browser verification"
  - test: "Clicking already-selected thumb is a no-op"
    expected: "Re-clicking the same thumb after selection does nothing — no additional POST, no state change"
    why_human: "Idempotent guard behaviour requires runtime testing"
  - test: "FeedbackBar appears only on the most recent result set"
    expected: "After a second query, FeedbackBar disappears from the first result set and appears only below the second"
    why_human: "isLastExpertMessage logic depends on message list index at runtime"
  - test: "DB rows recorded correctly"
    expected: "sqlite3 query shows feedback rows with correct conversation_id, vote, expert_ids, and optional reasons/comment fields populated"
    why_human: "Requires a running backend and live DB inspection"
  - test: "Backdrop click and Escape key close DownvoteModal without error"
    expected: "Clicking outside the modal card or pressing Escape closes the dialog; the down thumb remains filled"
    why_human: "DOM event handling for backdrop click and keyboard listener require browser verification"
  - test: "Vote state resets on page reload"
    expected: "After reload and submitting the same query, thumb buttons are unfilled (no localStorage persistence)"
    why_human: "Session state and absence of localStorage persistence requires runtime testing"
---

# Phase 6: Thumbs Up/Down Feedback Verification Report

**Phase Goal:** Users can rate expert results with thumbs up/down below the most recent result set — downvote immediately records the vote and opens a lightweight modal for optional detail; all feedback is stored in the DB linked to the conversation.
**Verified:** 2026-02-20
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All 14 observable truths across the three plans are verified at the code level. Human verification is needed for runtime behaviour (visual layout, state transitions, DB row inspection).

#### Plan 01 — Backend Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/feedback accepts a valid request and returns {status: ok} with 200 | VERIFIED | `app/routers/feedback.py` line 35-52: `@router.post("/api/feedback", status_code=200)` → `return {"status": "ok"}` after `db.commit()` |
| 2 | A Feedback row is written to the SQLite DB on each feedback POST | VERIFIED | `feedback.py` lines 41-50: constructs `Feedback(...)`, calls `db.add(record)` and `db.commit()` — no conditional path skips the write |
| 3 | The SSE result event includes conversation_id so the frontend can link feedback to a conversation | VERIFIED | `app/routers/chat.py` line 125: `"conversation_id": conversation.id` in the result SSE dict, after `db.commit()` at line 118 |
| 4 | The feedback router is registered in main.py and inherits CORS middleware automatically | VERIFIED | `app/main.py` line 29 imports `feedback`; line 104: `app.include_router(feedback.router)` — CORS middleware registered at lines 92-98 before routers |

#### Plan 02 — Frontend Data Layer Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | FeedbackBar renders thumb-up and thumb-down SVG buttons with a label above them | VERIFIED | `FeedbackBar.tsx` lines 19-66: `<p>Were these results helpful?</p>` followed by two `<button>` elements each containing an inline `<svg>` — label is above the buttons in DOM order |
| 6 | Clicking a thumb calls submitVote which fires a POST to /api/feedback (fire-and-forget) | VERIFIED | `FeedbackBar.tsx` lines 23, 46: `onClick={() => submitVote('up'/'down')}` → `useFeedback.ts` lines 39-55: `void postFeedback(...)` → `fetch(${API_URL}/api/feedback, { method: 'POST' })` at line 27 |
| 7 | The clicked thumb stays highlighted (filled); clicking the same thumb again does nothing | VERIFIED | `useFeedback.ts` line 41: `if (vote === v) return` guard; `FeedbackBar.tsx` line 35: `fill={vote === 'up' ? 'currentColor' : 'none'}` SVG fill toggle |
| 8 | Clicking thumbs-down opens DownvoteModal on top of the page | VERIFIED | `useFeedback.ts` lines 50-52: `if (v === 'down') { setModalOpen(true) }`; `FeedbackBar.tsx` lines 68-73: `{modalOpen && <DownvoteModal ... />}` |
| 9 | DownvoteModal shows 4 checkboxes and an optional free-text field; closing without submitting is fine | VERIFIED | `DownvoteModal.tsx` lines 3-7: REASONS array has 4 entries; lines 84-94: rendered as checkboxes; lines 98-107: textarea visible only when `selected.has('Other')`; backdrop click `onClick={onClose}` at line 57 |
| 10 | The Message type carries conversationId and useChat stores it from the SSE result event | VERIFIED | `types.ts` line 18: `conversationId?: number` on Message; `useChat.ts` line 120: `const conversationId = event.conversation_id as number | undefined` then line 127: `conversationId` spread into message |

#### Plan 03 — Wiring Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | FeedbackBar appears below the expert cards on the most recent result set only | VERIFIED | `ChatMessage.tsx` line 67: `{isLastExpertMessage && message.conversationId !== undefined && (<FeedbackBar .../>)}` — both guards required |
| 12 | FeedbackBar does not appear on clarification messages (no experts) | VERIFIED | `ChatMessage.tsx` line 55: outer guard `{!isUser && message.experts && message.experts.length > 0 && ...}` — FeedbackBar is inside this block, so it is never rendered on clarification messages (no experts array) |
| 13 | FeedbackBar renders whether or not the email gate is showing | VERIFIED | `ChatMessage.tsx` lines 64-73: EmailGate has its own condition `{!isUnlocked && isLastExpertMessage}` independent of FeedbackBar's condition `{isLastExpertMessage && message.conversationId !== undefined}` — FeedbackBar does not check isUnlocked |
| 14 | Vote state resets on page reload (no localStorage persistence) | VERIFIED | `useFeedback.ts` line 21: `const [vote, setVote] = useState<FeedbackVote>(null)` — plain useState, no localStorage or sessionStorage — state is in-memory only |

**Score:** 14/14 truths verified at code level

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/routers/feedback.py` | POST /api/feedback endpoint with Pydantic validation | VERIFIED | 53 lines; `FeedbackRequest` Pydantic model with Literal["up","down"], router registered, DB insert, `{"status":"ok"}` return |
| `app/models.py` | Feedback ORM model auto-created by Base.metadata.create_all | VERIFIED | `class Feedback(Base)` at line 52 with 8 `Mapped` columns (id, conversation_id, vote, email, expert_ids, reasons, comment, created_at) |
| `app/routers/chat.py` | SSE result event with conversation_id field | VERIFIED | Line 125: `"conversation_id": conversation.id` in result SSE payload |
| `app/main.py` | feedback router registered | VERIFIED | Line 29 imports feedback; line 104: `app.include_router(feedback.router)` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types.ts` | conversationId field on Message, FeedbackVote type, SSEResultEvent with conversation_id | VERIFIED | Line 18: `conversationId?: number`; line 40: `conversation_id?: number` on SSEResultEvent; line 42: `export type FeedbackVote = 'up' \| 'down' \| null` |
| `frontend/src/hooks/useChat.ts` | conversationId parsed from SSE result event and stored on message | VERIFIED | Lines 120-128: `event.conversation_id` extracted, passed as `conversationId` into `updateLastAssistantMessage` |
| `frontend/src/hooks/useFeedback.ts` | vote state management + API POST + modal open/close | VERIFIED | 77 lines; useState for vote and modalOpen; `postFeedback` fires fetch to `/api/feedback`; `submitVote` guards with idempotent check |
| `frontend/src/components/FeedbackBar.tsx` | Thumb buttons + label, delegates state to useFeedback | VERIFIED | 76 lines (min 40 satisfied); imports useFeedback and DownvoteModal; renders label + two SVG buttons with aria-pressed |
| `frontend/src/components/DownvoteModal.tsx` | Centered modal overlay with checkboxes and free text | VERIFIED | 128 lines (min 60 satisfied); `fixed inset-0 z-50`; 4 checkboxes from REASONS array; textarea gated on `selected.has('Other')`; Escape key via useEffect |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/App.tsx` | email prop threaded to ChatMessage | VERIFIED | Line 80: `email={email}` in ChatMessage JSX; `email` from `useEmailGate()` at line 23 |
| `frontend/src/components/ChatMessage.tsx` | FeedbackBar rendered below expert cards on isLastExpertMessage | VERIFIED | Line 4 imports FeedbackBar; lines 67-73: conditional render gated on `isLastExpertMessage && message.conversationId !== undefined` |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `app/routers/feedback.py` | `app/models.py` | Feedback ORM import | WIRED | Line 20: `from app.models import Feedback` |
| `app/main.py` | `app/routers/feedback.py` | include_router | WIRED | Line 104: `app.include_router(feedback.router)` |
| `app/routers/chat.py` | `conversation.id` | SSE result event payload | WIRED | Line 119 commits conversation to DB; line 125: `"conversation_id": conversation.id` in SSE result dict |

### Plan 02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `frontend/src/components/FeedbackBar.tsx` | `frontend/src/hooks/useFeedback.ts` | useFeedback hook call | WIRED | Line 1 imports `useFeedback`; line 11 calls it, destructures all returned values |
| `frontend/src/hooks/useFeedback.ts` | `/api/feedback` | fetch POST in submitVote | WIRED | Line 27: `fetch(\`${API_URL}/api/feedback\`, { method: 'POST', ... })` |
| `frontend/src/hooks/useChat.ts` | `message.conversationId` | SSE result event parsing | WIRED | Line 120: `const conversationId = event.conversation_id as number \| undefined`; line 127: spread into message |

### Plan 03 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `frontend/src/App.tsx` | `frontend/src/components/ChatMessage.tsx` | email prop | WIRED | Line 80: `email={email}` passed to ChatMessage; line 23 derives `email` from `useEmailGate()` |
| `frontend/src/components/ChatMessage.tsx` | `frontend/src/components/FeedbackBar.tsx` | conditional render on isLastExpertMessage and message.conversationId | WIRED | Line 67: `{isLastExpertMessage && message.conversationId !== undefined && (<FeedbackBar conversationId={message.conversationId} expertIds={...} email={email} />)}` — both guards confirmed |

Note on Plan 03 grep pattern: the PLAN pattern `"isLastExpertMessage.*FeedbackBar|FeedbackBar.*isLastExpertMessage"` did not match because the JSX spans multiple lines. Code inspection confirms the wiring is correctly implemented across lines 67-73.

---

## Requirements Coverage

All three plans declare `requirements: []`. Phase 6 introduces the feedback feature which is not covered by any requirement ID in REQUIREMENTS.md — this feature was added beyond the v1 requirements scope.

Notably, REQUIREMENTS.md explicitly lists "In-widget feedback / ratings" in the **Out of Scope** table with the note "No training loop or storage pipeline in v1." Phase 6 was added as an additional enhancement after the initial requirements were written. The plans acknowledge this by leaving the requirements array empty.

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| (none) | 06-01, 06-02, 06-03 | All plans declare `requirements: []` | N/A — feature is beyond v1 requirements scope |

**Orphaned requirements check:** No requirement IDs in REQUIREMENTS.md reference Phase 6. The traceability table ends at Phase 4. No orphaned requirements detected.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/App.tsx` | 9, 25 | `PLACEHOLDER_EMAIL` | Info | Pre-Phase-5 fallback email for anonymous users — intentional design from Phase 5 email gate; not a stub |
| `frontend/src/hooks/useChat.ts` | 63 | "placeholder assistant message" | Info | Comment describing the thinking state skeleton — not a code stub |
| `frontend/src/components/DownvoteModal.tsx` | 102 | `placeholder="Tell us more..."` | Info | HTML textarea placeholder attribute — intentional UX copy |

No blockers or warnings detected. All three "hits" are legitimate code.

---

## Human Verification Required

The automated checks pass. The following 8 items require human verification in a running browser:

### 1. FeedbackBar Visual Placement

**Test:** Submit a query that returns expert recommendations. Scroll below the expert cards.
**Expected:** A small label "Were these results helpful?" appears, followed by two thumb SVG icon buttons (up and down), unobtrusive in size.
**Why human:** React render output and Tailwind CSS layout cannot be confirmed without a browser.

### 2. Thumbs-Up Vote Interaction

**Test:** Click the thumbs-up button.
**Expected:** The up thumb icon fills solid purple (brand-purple / #5128F2). The down thumb remains outline. No modal opens. Clicking the up thumb again does nothing.
**Why human:** SVG fill attribute toggling and visual state require in-browser inspection.

### 3. Thumbs-Down Opens Modal

**Test:** Click the thumbs-down button.
**Expected:** The down thumb fills solid red immediately. A centered modal dialog appears with title "Help us improve", subtitle, and 4 labeled checkboxes: "Wrong experts shown", "Experts not relevant to my problem", "Experts seem unavailable or too expensive", "Other".
**Why human:** Modal positioning (z-50 overlay, centered) and visual appearance require browser verification.

### 4. DownvoteModal — Other Checkbox Reveals Free Text

**Test:** Check "Other" in the DownvoteModal.
**Expected:** A textarea field appears below the checkboxes with placeholder "Tell us more...".
**Why human:** Conditional DOM rendering requires runtime testing.

### 5. Modal Dismiss Behaviours

**Test:** Open DownvoteModal by clicking thumbs-down. (a) Click the backdrop area outside the modal card. (b) On a fresh modal, press Escape key.
**Expected:** In both cases the modal closes without error. The down thumb remains filled after close.
**Why human:** Backdrop click stopPropagation and keyboard event listener behaviour require browser testing.

### 6. Submit Downvote Detail to DB

**Test:** Click thumbs-down, select "Wrong experts shown", click "Send feedback".
**Expected:** Modal closes. Backend DB contains a row: `vote='down'`, `reasons='["Wrong experts shown"]'`, `conversation_id` is a valid integer. Verify: `sqlite3 /Users/sebastianhamers/Documents/TCS/var/db.sqlite3 "SELECT vote, reasons, conversation_id FROM feedback ORDER BY id DESC LIMIT 3;"`
**Why human:** Requires a running backend and live DB inspection.

### 7. FeedbackBar Only on Most Recent Result

**Test:** Submit a second query after the first. Both queries return expert recommendations.
**Expected:** FeedbackBar appears only below the second (most recent) result set. The first result set's FeedbackBar is gone.
**Why human:** isLastExpertMessage index logic depends on message list state at runtime.

### 8. Vote State Resets on Reload

**Test:** Vote thumbs-up on a result. Refresh the page. Submit the same query again.
**Expected:** Thumbs buttons are unfilled — no memory of the prior vote (no localStorage persistence).
**Why human:** Absence of persistence requires runtime confirmation.

---

## Gaps Summary

No code-level gaps detected. All 14 truths are verified, all 11 artifacts exist and are substantive, all 8 key links are wired. The automated verification is complete.

The human_needed status reflects that this phase includes a visual UI feature and a DB-write flow that require runtime confirmation to be fully certified. The PLAN itself required a `checkpoint:human-verify` gate (Plan 03, Task 2), which the SUMMARY reports as approved by a human who confirmed all 6 tests passed and 6 DB feedback rows were visible. That human approval is documented in 06-03-SUMMARY.md but cannot be independently re-confirmed by automated code analysis.

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_
