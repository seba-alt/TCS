# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-03-02
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v4.1 Requirements

Requirements for v4.1 UX Polish & Mobile Overhaul. Each maps to roadmap phases.

### Admin (ADMN)

- [ ] **ADMN-01**: Admin overview stats (matches, searches, leads, lead rate, top searches, gaps) display correct non-zero data
- [ ] **ADMN-02**: Admin overview stat cards navigate to their detail pages on click
- [ ] **ADMN-03**: Admin can delete experts from the admin panel

### Explorer (EXPL)

- [x] **EXPL-01**: Initial expert display randomized every page load, prioritizing high findability scores
- [x] **EXPL-02**: Sort-by dropdown removed — experts always sorted by best match
- [x] **EXPL-03**: Search bar autofocused on page load
- [x] **EXPL-04**: No-results state shows Intercom referral CTA to explain need or request expert
- [ ] **EXPL-05**: Autocomplete suggestion dropdown works correctly
- [ ] **EXPL-06**: Rate slider max dynamically adjusts to max rate in current filtered results

### Card Redesign (CARD)

- [ ] **CARD-01**: Mobile cards show bigger profile photo with name below, centered
- [ ] **CARD-02**: Desktop cards show bigger profile photo with info inline to the right
- [ ] **CARD-03**: Mobile cards respond to single tap (no tap-expand behavior)

### Mobile (MOBL)

- [ ] **MOBL-01**: Clear button removed on mobile
- [ ] **MOBL-02**: Search-within-tags and industry picker removed on mobile
- [ ] **MOBL-03**: Clicking a tag resets the active search query
- [ ] **MOBL-04**: Tag scroll glitch fixed on mobile

### Bookmarks (BOOK)

- [ ] **BOOK-01**: Saved/bookmarked profiles visually distinguished with color
- [ ] **BOOK-02**: "Show saved" view shows all saved profiles regardless of active filters/tags

### Analytics (ANLT)

- [ ] **ANLT-01**: All searches tracked including anonymous (no email required)
- [ ] **ANLT-02**: Microsoft Clarity analytics integrated (ID: vph5o95n6c)

## Future Requirements

(None deferred — all items scoped to v4.1)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New admin pages/dashboards | v4.1 fixes existing overview, no new analytics views |
| Expert profile page redesign | Cards only — full profile pages deferred |
| Desktop tag/industry picker changes | Only mobile picker simplified in v4.1 |
| Real-time expert availability | Not in data model |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMN-01 | Phase 51 | Pending |
| ADMN-02 | Phase 51 | Pending |
| ADMN-03 | Phase 51 | Pending |
| EXPL-01 | Phase 52 | Complete |
| EXPL-02 | Phase 52 | Complete |
| EXPL-03 | Phase 52 | Complete |
| EXPL-04 | Phase 52 | Complete |
| EXPL-05 | Phase 52 | Pending |
| EXPL-06 | Phase 52 | Pending |
| CARD-01 | Phase 53 | Pending |
| CARD-02 | Phase 53 | Pending |
| CARD-03 | Phase 53 | Pending |
| MOBL-01 | Phase 53 | Pending |
| MOBL-02 | Phase 53 | Pending |
| MOBL-03 | Phase 53 | Pending |
| MOBL-04 | Phase 53 | Pending |
| BOOK-01 | Phase 54 | Pending |
| BOOK-02 | Phase 54 | Pending |
| ANLT-01 | Phase 54 | Pending |
| ANLT-02 | Phase 54 | Pending |

**Coverage:**
- v4.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
