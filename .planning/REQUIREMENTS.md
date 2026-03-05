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

### Admin Expert Tagging (Phase 69.2 — Inserted)

- [x] **TAG-01**: Admin can manage a predefined tag catalog (view, add, delete tags) seeded from existing AI skill tags
- [x] **TAG-02**: Admin can assign manual domain expertise tags to experts via dedicated tag manager page with bulk support
- [x] **TAG-03**: Manual tags survive AI re-tagging, appear in FAISS semantic search, and are filterable/browsable on the public site
- [x] ~~**TAG-04**: Tag manager page has two navigation modes: Expert-to-Tags and Tag-to-Experts~~ *(Superseded: dual-mode removed during UAT — single Expert→Tags flow per user decision 2026-03-05)*

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
| GATE-01 | Phase 67 → 70 | Pending (verification gap) |
| GATE-02 | Phase 67 → 70 | Pending (verification gap) |
| GATE-03 | Phase 67 → 70 | Pending (verification gap) |
| FIX-01 | Phase 67 → 70 | Pending (verification gap) |
| SAVE-01 | Phase 68 | Complete |
| SAVE-02 | Phase 69 → 70 | Pending (verification gap) |
| SAVE-03 | Phase 69 → 70 | Pending (verification gap) |
| TAG-01 | Phase 69.2 | Complete |
| TAG-02 | Phase 69.2 | Complete |
| TAG-03 | Phase 69.2 | Complete |
| TAG-04 | Phase 69.2 | Superseded |

**Coverage:**
- v5.3 requirements: 11 total (1 superseded)
- Mapped to phases: 11
- Pending (gap closure): 6
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-05 after Phase 69.2 execution*
