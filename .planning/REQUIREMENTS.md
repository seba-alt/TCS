# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-03-02
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v4.1 Requirements

Requirements for v4.1 UX Polish & Mobile Overhaul. Each maps to roadmap phases.

### Admin (ADMN)

- [x] **ADMN-01**: Admin overview stats (matches, searches, leads, lead rate, top searches, gaps) display correct non-zero data
- [x] **ADMN-02**: Admin overview stat cards navigate to their detail pages on click
- [x] **ADMN-03**: Admin can delete experts from the admin panel

### Explorer (EXPL)

- [x] **EXPL-01**: Initial expert display randomized every page load, prioritizing high findability scores
- [x] **EXPL-02**: Sort-by dropdown removed — experts always sorted by best match
- [x] **EXPL-03**: Search bar autofocused on page load
- [x] **EXPL-04**: No-results state shows Intercom referral CTA to explain need or request expert
- [x] **EXPL-05**: Autocomplete suggestion dropdown works correctly
- [x] **EXPL-06**: Rate slider max dynamically adjusts to max rate in current filtered results

### Card Redesign (CARD)

- [x] **CARD-01**: Mobile cards show bigger profile photo with name below, centered
- [x] **CARD-02**: Desktop cards show bigger profile photo with info inline to the right
- [x] **CARD-03**: Mobile cards respond to single tap (no tap-expand behavior)

### Mobile (MOBL)

- [x] **MOBL-01**: Clear button removed on mobile
- [x] **MOBL-02**: Search-within-tags and industry picker removed on mobile
- [x] **MOBL-03**: Clicking a tag resets the active search query
- [x] **MOBL-04**: Tag scroll glitch fixed on mobile

### Bookmarks (BOOK)

- [x] **BOOK-01**: Saved/bookmarked profiles visually distinguished with color
- [x] **BOOK-02**: "Show saved" view shows all saved profiles regardless of active filters/tags

### Analytics (ANLT)

- [x] **ANLT-01**: All searches tracked including anonymous (no email required)
- [x] **ANLT-02**: Microsoft Clarity analytics integrated (ID: vph5o95n6c)

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
| ADMN-01 | Phase 51 | Complete |
| ADMN-02 | Phase 51 | Complete |
| ADMN-03 | Phase 51 | Complete |
| EXPL-01 | Phase 52 | Complete |
| EXPL-02 | Phase 52 | Complete |
| EXPL-03 | Phase 52 | Complete |
| EXPL-04 | Phase 52 | Complete |
| EXPL-05 | Phase 52 | Complete |
| EXPL-06 | Phase 52 | Complete |
| CARD-01 | Phase 53 | Complete |
| CARD-02 | Phase 53 | Complete |
| CARD-03 | Phase 53 | Complete |
| MOBL-01 | Phase 53 | Complete |
| MOBL-02 | Phase 53 | Complete |
| MOBL-03 | Phase 53 | Complete |
| MOBL-04 | Phase 53 | Complete |
| BOOK-01 | Phase 54 | Complete |
| BOOK-02 | Phase 54 | Complete |
| ANLT-01 | Phase 54 | Complete |
| ANLT-02 | Phase 54 | Complete |

**Coverage:**
- v4.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
