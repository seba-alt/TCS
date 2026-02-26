# Requirements: Tinrate AI Concierge

**Defined:** 2026-02-26
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v3.1 Requirements

Requirements for launch prep. Each maps to roadmap phases.

### Privacy & Security

- [ ] **PRIV-01**: Expert email data purged from SQLite database (all Expert.email set to empty string)
- [ ] **PRIV-02**: Email column stripped from data/experts.csv
- [ ] **PRIV-03**: CSV import endpoint ignores Email field on future uploads (no longer written to DB)

### Error Hardening

- [ ] **ERR-01**: Photo proxy returns 404 instead of 502 when upstream is unavailable (frontend monogram fallback already handles it)
- [ ] **ERR-02**: React redirect loop fixed — RedirectWithParams no longer causes maximum call stack exceeded
- [ ] **ERR-03**: FTS5 MATCH queries guarded against empty/invalid strings in explore, pilot, and suggest paths
- [ ] **ERR-04**: Deprecated gemini-2.0-flash-lite replaced with current Gemini model for Dutch detection

### Search Alignment

- [ ] **SRCH-01**: Search Lab uses run_explore() pipeline so results match search bar and Sage
- [ ] **SRCH-02**: Search Lab A/B comparison preserves ability to toggle HyDE/feedback as overrides on top of the aligned pipeline

### Mobile UX

- [ ] **MOB-01**: Mobile filters use inline dropdown-style controls instead of Vaul bottom-sheet
- [ ] **MOB-02**: Search bar takes full viewport width on mobile

### Discovery

- [ ] **DISC-01**: Desktop tag cloud shows 18-20 visible tags (up from 12)

### Analytics

- [ ] **ANLT-01**: Google Analytics (gtag.js) with tracking ID G-0T526W3E1Z added to the app
- [ ] **ANLT-02**: SPA page view tracking fires on route changes (not just initial load)

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
| PRIV-01 | — | Pending |
| PRIV-02 | — | Pending |
| PRIV-03 | — | Pending |
| ERR-01 | — | Pending |
| ERR-02 | — | Pending |
| ERR-03 | — | Pending |
| ERR-04 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| MOB-01 | — | Pending |
| MOB-02 | — | Pending |
| DISC-01 | — | Pending |
| ANLT-01 | — | Pending |
| ANLT-02 | — | Pending |

**Coverage:**
- v3.1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
