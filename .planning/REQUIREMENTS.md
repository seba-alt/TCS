# Requirements: Tinrate Expert Marketplace

**Defined:** 2026-03-04
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.2 Requirements

Requirements for milestone v5.2 Email-First Gate & Admin See-All. Each maps to roadmap phases.

### Admin Overview

- [ ] **ADMOV-01**: Admin can expand Top Experts card to see all experts ranked by click volume (not just top 5)
- [ ] **ADMOV-02**: Admin can expand Top Searches card to see all search queries ranked by frequency (not just top 5)
- [ ] **ADMOV-03**: Admin can collapse expanded cards back to top 5 view

### Email Gate

- [ ] **GATE-01**: User sees mandatory email gate modal on first page load before browsing the Explorer
- [ ] **GATE-02**: User cannot dismiss or skip the email gate — email submission is required to access the platform
- [ ] **GATE-03**: Returning subscriber bypasses gate instantly with no flash (synchronous localStorage check)
- [ ] **GATE-04**: Email gate submission sends distinct `source: "page_entry"` to Loops for lead segmentation

### Email Tracking

- [ ] **TRACK-01**: Backend stores email on `user_events` table (nullable indexed column, idempotent startup migration)
- [ ] **TRACK-02**: Frontend `trackEvent()` includes user's email in every event after gate submission
- [ ] **TRACK-03**: Admin lead journey timeline includes Explorer search queries attributed to the lead's email

### Analytics

- [ ] **ANLYT-01**: Vercel Speed Insights active on the frontend

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
| ADMOV-01 | — | Pending |
| ADMOV-02 | — | Pending |
| ADMOV-03 | — | Pending |
| GATE-01 | — | Pending |
| GATE-02 | — | Pending |
| GATE-03 | — | Pending |
| GATE-04 | — | Pending |
| TRACK-01 | — | Pending |
| TRACK-02 | — | Pending |
| TRACK-03 | — | Pending |
| ANLYT-01 | — | Pending |

**Coverage:**
- v5.2 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
