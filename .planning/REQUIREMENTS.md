# Requirements: Tinrate Expert Marketplace

**Defined:** 2026-03-04
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.2 Requirements

Requirements for milestone v5.2 Email-First Gate & Admin See-All. Each maps to roadmap phases.

### Admin Overview

- [x] **ADMOV-01**: Admin can expand Top Experts card to see all experts ranked by click volume (not just top 5)
- [x] **ADMOV-02**: Admin can expand Top Searches card to see all search queries ranked by frequency (not just top 5)
- [x] **ADMOV-03**: Admin can collapse expanded cards back to top 5 view

### Email Gate

- [x] **GATE-01**: User sees mandatory email gate modal on first page load before browsing the Explorer
- [x] **GATE-02**: User cannot dismiss or skip the email gate — email submission is required to access the platform
- [x] **GATE-03**: Returning subscriber bypasses gate instantly with no flash (synchronous localStorage check)
- [x] **GATE-04**: Email gate submission sends distinct `source: "page_entry"` to Loops for lead segmentation

### Email Tracking

- [x] **TRACK-01**: Backend stores email on `user_events` table (nullable indexed column, idempotent startup migration)
- [x] **TRACK-02**: Frontend `trackEvent()` includes user's email in every event after gate submission
- [x] **TRACK-03**: Admin lead journey timeline includes Explorer search queries attributed to the lead's email

### Analytics

- [x] **ANLYT-01**: Vercel Speed Insights active on the frontend

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Lead Intelligence

- **LEAD-01**: Rate-limit gate re-triggers for users who clear localStorage
- **LEAD-02**: Entry gate A/B test (mandatory vs dismissible) via feature flag

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| "Skip for now" dismiss option on gate | User explicitly chose mandatory gate — no skip path |
| Retroactive email attribution for pre-v5.2 events | No reliable cross-device identity link exists for anonymous session_ids |
| Dedicated admin pages for "See All" (`/admin/top-experts`) | In-card expansion is simpler and preserves period toggle context |
| Email in `user_events.payload` JSON blob | Unindexable — use dedicated indexed column instead |
| Replace session_id with email entirely | session_id still needed for anonymous pre-gate tracking window |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRACK-01 | Phase 63 | Done |
| TRACK-02 | Phase 63 | Done |
| GATE-01 | Phase 64 | Done |
| GATE-02 | Phase 64 | Done |
| GATE-03 | Phase 64 | Done |
| GATE-04 | Phase 64 | Done |
| TRACK-03 | Phase 64 | Done |
| ADMOV-01 | Phase 65 | Complete |
| ADMOV-02 | Phase 65 | Complete |
| ADMOV-03 | Phase 65 | Complete |
| ANLYT-01 | Phase 65 | Complete |

**Coverage:**
- v5.2 requirements: 11 total
- Mapped to phases: 11
- Pending (gap closure): 0
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 — traceability complete after roadmap creation*
