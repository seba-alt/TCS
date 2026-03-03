# Requirements: Tinrate AI Concierge

**Defined:** 2026-03-03
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.0 Requirements

Requirements for Platform Polish & Admin Overhaul. Each maps to roadmap phases.

### Bug Fixes

- [x] **BUG-01**: Search results sorted by match tier — Top Match first, then Good Match, then rest — when a search query is active
- [x] **BUG-02**: Currency displayed as symbol (€, $, £) instead of text code (EUR, USD, GBP) across all surfaces
- [x] **BUG-03**: Mobile expert cards show company name
- [x] **BUG-04**: Mobile expert cards show match badge (Top/Good Match) when applicable
- [x] **BUG-05**: Mobile expert card name wraps to two lines when truncated
- [x] **BUG-06**: Clear-all filter button visible and accessible on mobile
- [x] **BUG-07**: Admin experts page has text search filtering by name
- [x] **BUG-08**: Open Graph meta tags with preview image so shared links show a rich card (title, description, image)

### Performance

- [x] **PERF-01**: Query embeddings cached with TTL to avoid duplicate Google API calls (~500ms saved per cache hit)
- [x] **PERF-02**: Tag filtering optimized — no LIKE on JSON substrings (proper indexing or separate tags table)
- [x] **PERF-03**: Feedback data cached per request cycle instead of fetched on every explore call
- [x] **PERF-04**: Settings cached in-memory with TTL instead of full SELECT on every call

### Admin Makeover

- [x] **ADM-01**: Admin backend refactored from 2,225-line monolith into logical route modules
- [x] **ADM-02**: Admin Tools and Data pages use URL-based routing instead of hash fragments
- [x] **ADM-03**: Admin pagination upgraded with page numbers and direct page jump
- [x] **ADM-04**: Admin pages use consistent card, table, and form component patterns
- [x] **ADM-05**: Admin Overview dashboard redesigned with actionable metrics and clear navigation
- [x] **ADM-06**: Admin Experts page table layout modernized
- [x] **ADM-07**: Admin responsive layout works on tablet-width screens

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Performance

- **PERF-05**: Browse endpoint N+1 query pattern optimized (single GROUP BY + JOIN)
- **PERF-06**: Expert photo preloading for top viewport items
- **PERF-07**: ExpertCard store subscription optimization to reduce grid re-renders

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Admin real-time collaboration | Single admin user, no need |
| Admin dark/light theme toggle | Dark theme is established, no need to add toggle |
| Admin mobile-first redesign | Tablet support sufficient; admin is desktop-primary |
| Full backend rewrite | Refactor into modules, not rewrite |
| Caching layer (Redis/Memcached) | In-memory TTL cache sufficient for current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 55 | Complete |
| BUG-02 | Phase 58 | Complete |
| BUG-03 | Phase 55 | Complete |
| BUG-04 | Phase 55 | Complete |
| BUG-05 | Phase 55 | Complete |
| BUG-06 | Phase 55 | Complete |
| BUG-07 | Phase 57 | Complete |
| BUG-08 | Phase 55 | Complete |
| PERF-01 | Phase 58 | Complete |
| PERF-02 | Phase 58 | Complete |
| PERF-03 | Phase 58 | Complete |
| PERF-04 | Phase 58 | Complete |
| ADM-01 | Phase 58 | Complete |
| ADM-02 | Phase 57 | Complete |
| ADM-03 | Phase 57 | Complete |
| ADM-04 | Phase 57 | Complete |
| ADM-05 | Phase 57 | Complete |
| ADM-06 | Phase 58 | Complete |
| ADM-07 | Phase 57 | Complete |
| ADMUI-01 | Phase 58.1 | Complete |
| ADMUI-02 | Phase 58.1 | Complete |
| ADMUI-03 | Phase 59 | Pending |
| ADMUI-04 | Phase 58.1 | Complete |

**Coverage:**
- v5.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after gap closure phase 58 creation*
