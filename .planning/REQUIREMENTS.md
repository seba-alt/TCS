# Requirements: TCS Expert Marketplace

**Defined:** 2026-03-04
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v5.3 Requirements

Requirements for milestone v5.3 UX Polish & Admin Saved Insights.

### Email Gate

- [x] **GATE-01**: Email gate uses dark-background logo and cleaner minimal layout (less text)
- [x] **GATE-02**: Cursor auto-focuses email input when gate is active; search bar is not accessible
- [x] **GATE-03**: After gate dismisses, cursor auto-focuses the search bar

### Saved Tracking

- [x] **SAVE-01**: Save/unsave actions tracked as backend events via trackEvent() with expert_id and action (save/unsave)
- [x] **SAVE-02**: Admin overview shows "Top Saved Experts" ranked card (same pattern as Top Clicks/Top Searches)
- [x] **SAVE-03**: Admin lead timeline shows save/unsave events with distinct icon alongside searches and clicks

### Bug Fix

- [x] **FIX-01**: List view renders a save/bookmark button for each expert (matching grid view behavior)

## Future Requirements

None deferred.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend-persisted saved experts (per-user accounts) | No user auth — saves remain localStorage, events are fire-and-forget analytics |
| Aggregate "most saved" public display | Admin-only analytics; no public-facing saved rankings |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 | Phase 67 | Complete |
| GATE-02 | Phase 67 | Complete |
| GATE-03 | Phase 67 | Complete |
| FIX-01 | Phase 67 | Complete |
| SAVE-01 | Phase 68 | Complete |
| SAVE-02 | Phase 69 | Complete |
| SAVE-03 | Phase 69 | Complete |

**Coverage:**
- v5.3 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after Phase 69 completion*
