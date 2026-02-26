# Requirements: Tinrate AI Concierge

**Defined:** 2026-02-26
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v3.1 Requirements

Requirements for launch prep. Each maps to roadmap phases.

### Privacy & Security

- [x] **PRIV-01**: Expert email data purged from SQLite database (all Expert.email set to empty string)
- [x] **PRIV-02**: Email column stripped from data/experts.csv
- [x] **PRIV-03**: CSV import endpoint ignores Email field on future uploads (no longer written to DB)

### Error Hardening

- [x] **ERR-01**: Photo proxy returns 404 instead of 502 when upstream is unavailable (frontend monogram fallback already handles it)
- [x] **ERR-02**: React redirect loop fixed — RedirectWithParams no longer causes maximum call stack exceeded
- [x] **ERR-03**: FTS5 MATCH queries guarded against empty/invalid strings in explore, pilot, and suggest paths
- [x] **ERR-04**: Deprecated gemini-2.0-flash-lite replaced with current Gemini model for Dutch detection

### Search Alignment

- [x] **SRCH-01**: Search Lab uses run_explore() pipeline so results match search bar and Sage
- [x] **SRCH-02**: Search Lab A/B comparison preserves ability to toggle HyDE/feedback as overrides on top of the aligned pipeline

### Mobile UX

- [ ] **MOB-01**: Mobile filters use inline dropdown-style controls instead of Vaul bottom-sheet
- [ ] **MOB-02**: Search bar takes full viewport width on mobile

### Discovery

- [x] **DISC-01**: Desktop tag cloud shows 18-20 visible tags (up from 12)

### Analytics

- [x] **ANLT-01**: Google Analytics (gtag.js) with tracking ID G-0T526W3E1Z added to the app
- [x] **ANLT-02**: SPA page view tracking fires on route changes (not just initial load)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notifications

- **NOTF-01**: User receives in-app notifications for new expert matches
- **NOTF-02**: Email digest for saved expert updates

### Advanced Analytics

- **ADVN-01**: Sentry source maps with hidden sourcemap mode for production debugging
- **ADVN-02**: Conversion funnel tracking (search → card click → profile view → contact)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full GDPR compliance toolkit | Email purge addresses the immediate data issue; full compliance deferred |
| Mobile native app | Web-first — out of scope for all milestones |
| Real-time chat/messaging | Cards link to Tinrate profiles |
| Alembic migration framework | SQLite UPDATE is sufficient for email purge; no DDL changes needed |
| Custom analytics dashboard | GA4 dashboard is sufficient for launch |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRIV-01 | Phase 41 | Complete |
| PRIV-02 | Phase 41 | Complete |
| PRIV-03 | Phase 41 | Complete |
| ERR-01 | Phase 42 | Complete |
| ERR-02 | Phase 43 | Complete |
| ERR-03 | Phase 42 | Complete |
| ERR-04 | Phase 42 | Complete |
| SRCH-01 | Phase 42 | Complete |
| SRCH-02 | Phase 42 | Complete |
| MOB-01 | Phase 44 | Pending |
| MOB-02 | Phase 44 | Pending |
| DISC-01 | Phase 43 | Complete |
| ANLT-01 | Phase 43 | Complete |
| ANLT-02 | Phase 43 | Complete |

**Coverage:**
- v3.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after Phase 43 completion (ERR-02, DISC-01, ANLT-01, ANLT-02 marked complete; ERR-01, ERR-03, ERR-04, SRCH-01, SRCH-02 retroactively marked complete from Phase 42)*
