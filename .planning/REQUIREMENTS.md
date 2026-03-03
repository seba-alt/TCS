# Requirements: Tinrate AI Concierge

**Defined:** 2026-03-03
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.1 Requirements

Requirements for v5.1 Lead Insights & Overview. Each maps to roadmap phases.

### Lead Journey

- [x] **LEAD-01**: Admin can expand a lead row to see a chronological timeline of all their searches and expert clicks interleaved by timestamp
- [x] **LEAD-02**: Each timeline event shows context — searches show query text and result count; clicks show expert name and which search led to the click
- [x] **LEAD-03**: Timeline shows time gaps between events (e.g., "2 hours later") to reveal engagement patterns

### Overview Enhancements

- [ ] **OVER-01**: Overview page shows top experts by card click volume in the selected period
- [ ] **OVER-02**: Overview page shows top search queries by frequency in the selected period
- [ ] **OVER-03**: Overview page shows zero-result queries as unmet demand signals in the selected period

### Bug Fixes

- [x] **FIX-01**: Clear-all button only appears when user has active tags, search query, or non-default filters (not on page load)
- [x] **FIX-02**: Remove unused `totalTagCount` variable from MobileInlineFilters.tsx to fix Vercel build

## Future Requirements

### Lead Intelligence

- **LEAD-04**: Lead scoring based on engagement depth (number of searches, clicks, time spent)
- **LEAD-05**: Dedicated lead detail page with full journey and outreach notes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Session-to-email mapping | Would require rearchitecting anonymous tracking; current email-linked data is sufficient |
| Real-time lead notifications | Complexity outweighs value for current admin usage patterns |
| Lead CRM integration | Admin panel is the CRM for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 60 | Complete |
| FIX-02 | Phase 60 | Complete |
| LEAD-01 | Phase 61 | Complete |
| LEAD-02 | Phase 61 | Complete |
| LEAD-03 | Phase 61 | Complete |
| OVER-01 | Phase 62 | Pending |
| OVER-02 | Phase 62 | Pending |
| OVER-03 | Phase 62 | Pending |

**Coverage:**
- v5.1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 — traceability populated after roadmap creation*
