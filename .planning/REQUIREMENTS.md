# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-02-27
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v4.0 Requirements

Requirements for public launch. Each maps to roadmap phases.

### Security

- [x] **SEC-01**: Admin can log in with username and hashed password (bcrypt) replacing single-key auth
- [x] **SEC-02**: Auth endpoint rate-limited to prevent brute force (3 attempts/min)
- [x] **SEC-03**: SQLite uses WAL mode with busy_timeout to handle concurrent traffic

### Explorer

- [x] **EXP-01**: Search bar input has white background for contrast against aurora background
- [x] **EXP-02**: Search bar placeholder shows keyword prompts ("Name, company, keyword...") instead of conversational sentences
- [x] **EXP-03**: User can toggle between card grid view and compact list view
- [x] **EXP-04**: Sage panel renders only once on desktop (no double desktop + mobile overlay)
- [x] **EXP-05**: Tap-to-expand card behavior is mobile-only, desktop clicks open profile directly
- [x] **EXP-06**: Explorer shows friendly error message when API fails (not blank grid)

### Admin

- [x] **ADM-01**: Dashboard shows one-snap overview with key stats (Total Leads, Expert Pool, Sage volume)
- [x] **ADM-02**: Admin can export leads as CSV including their search queries and card clicks
- [x] **ADM-03**: Embedding heatmap (t-SNE) loads correctly on dashboard
- [x] **ADM-04**: Unused admin tools removed, sidebar simplified for current configuration
- [x] **ADM-05**: Admin can bulk import experts via improved CSV upload flow

### Discovery

- [x] **DISC-01**: Industry-level tags (e.g. Finance, Healthcare, Tech) added alongside domain tags
- [x] **DISC-02**: Industry tags visible in tag cloud as a separate section
- [x] **DISC-03**: User can filter experts by industry tags

### Performance

- [x] **PERF-01**: Admin routes lazy-loaded (React.lazy) for smaller public bundle
- [x] **PERF-02**: Vite build splits large dependencies (recharts, react-table) into separate chunks

## Future Requirements

Deferred to v4.1+. Tracked but not in current roadmap.

### Security

- **SEC-04**: Session auto-expiry after 24h inactivity
- **SEC-05**: Admin panel on separate subdomain for XSS isolation

### Lead Intelligence

- **LEAD-01**: Card click attribution linked to email leads (requires session_id in email gate)
- **LEAD-02**: In-app match report download

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication / accounts | Users interact anonymously; admin uses credentials |
| Booking/payment flow | Cards link to Tinrate profiles where booking happens |
| Mobile native app | Web-first |
| Full multi-language support | Dutch auto-detection sufficient for launch |
| Custom analytics dashboard | GA4 dashboard is sufficient |
| Full GDPR compliance toolkit | Email purge addresses immediate data issue |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 45 | Complete |
| SEC-02 | Phase 45 | Complete |
| SEC-03 | Phase 45 | Complete |
| ADM-03 | Phase 45 | Complete |
| PERF-01 | Phase 46 | Complete |
| PERF-02 | Phase 46 | Complete |
| EXP-01 | Phase 47 | Complete |
| EXP-02 | Phase 47 | Complete |
| EXP-03 | Phase 47 | Complete |
| EXP-04 | Phase 47 | Complete |
| EXP-05 | Phase 47 | Complete |
| EXP-06 | Phase 47 | Complete |
| ADM-01 | Phase 48 → 50 | Pending |
| ADM-02 | Phase 48 → 50 | Pending |
| ADM-05 | Phase 48 → 50 | Pending |
| DISC-01 | Phase 48 → 50 | Pending |
| DISC-02 | Phase 48 → 50 | Pending |
| DISC-03 | Phase 48 → 50 | Pending |
| ADM-04 | Phase 49 | Complete |

**Coverage:**
- v4.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — traceability updated after roadmap creation*
