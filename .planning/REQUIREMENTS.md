# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-02-21
**Milestone:** v1.2 Intelligence Activation & Steering Panel
**Core Value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.

## v1.2 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Runtime Configuration

- [ ] **CONF-01**: Backend reads `QUERY_EXPANSION_ENABLED` and `FEEDBACK_LEARNING_ENABLED` flags from a SQLite `settings` table at runtime; Railway env vars serve as the fallback default when no DB override exists
- [ ] **CONF-02**: Backend reads similarity threshold, HyDE trigger sensitivity (minimum strong results before HyDE is skipped), and feedback boost cap from the `settings` table at runtime
- [ ] **CONF-03**: `GET /api/admin/settings` endpoint returns all current setting values (DB value or env var fallback) labeled by source
- [ ] **CONF-04**: `POST /api/admin/settings` endpoint writes setting values to the SQLite `settings` table (admin-auth required)

### Steering Panel

- [ ] **PANEL-01**: Admin Intelligence tab displays HyDE and feedback flags as live toggle switches reflecting actual runtime state (DB override first, env var fallback)
- [ ] **PANEL-02**: Admin can flip a toggle to enable/disable HyDE or feedback re-ranking; change persists to DB and takes effect on the next chat request without any redeploy
- [ ] **PANEL-03**: Admin Intelligence tab displays editable threshold inputs: similarity threshold (0.0–1.0), HyDE trigger sensitivity (1–10), and feedback boost cap (0–50%)
- [ ] **PANEL-04**: Admin can save threshold changes; UI confirms success or failure inline with no page reload

### Search Lab A/B

- [ ] **LAB-01**: Search Lab offers a "Compare modes" option that runs the same query in up to 4 configurations simultaneously: baseline (no intelligence), HyDE only, feedback only, full intelligence (both)
- [ ] **LAB-02**: A/B results render as side-by-side columns per mode showing expert rankings in each configuration
- [ ] **LAB-03**: A/B diff view highlights experts that changed rank, appeared in one mode but not another, or dropped out entirely between configurations
- [ ] **LAB-04**: Admin can force-override HyDE and/or feedback flags for a single Search Lab run without changing global settings

## v2 Requirements

Deferred to future milestone.

### Marketplace Rearchitect (Extreme Semantic Explorer)

- **MKT-01**: Main interface is a virtualized expert grid (react-virtuoso) with faceted sidebar (category, rate range, tags)
- **MKT-02**: Hybrid search endpoint pre-filters by SQLAlchemy (rate, tags) then searches FAISS with IDSelectorBatch + HyDE embedding
- **MKT-03**: Zustand global store (searchParams, results, isPilotOpen slices) with persist middleware
- **MKT-04**: Expert cards display name, headline, rate, 3-8 domain tag badges, bio snippet, findability indicator
- **MKT-05**: Floating AI co-pilot as collapsible side-panel — Gemini function calling with `apply_filters(criteria)` that updates Zustand searchParams
- **MKT-06**: Co-pilot is context-aware — prompt includes summary of currently visible experts in grid
- **MKT-07**: Filter-to-grid latency under 200ms for metadata-only changes
- **MKT-08**: Mobile-first: sidebar becomes bottom-sheet, grid becomes single-column

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Marketplace grid (v2) | High complexity rearchitect; premature before intelligence layer is validated in production |
| Zustand / react-virtuoso (v2) | Deferred to marketplace milestone |
| Floating co-pilot / function calling (v2) | Deferred to marketplace milestone |
| Real-time flag propagation via WebSocket | Polling or next-request refresh is sufficient; WebSocket adds complexity without meaningful UX gain |
| Per-expert flag overrides | Admin controls are global; expert-level tuning is out of scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONF-01 | — | Pending |
| CONF-02 | — | Pending |
| CONF-03 | — | Pending |
| CONF-04 | — | Pending |
| PANEL-01 | — | Pending |
| PANEL-02 | — | Pending |
| PANEL-03 | — | Pending |
| PANEL-04 | — | Pending |
| LAB-01 | — | Pending |
| LAB-02 | — | Pending |
| LAB-03 | — | Pending |
| LAB-04 | — | Pending |

**Coverage:**
- v1.2 requirements: 12 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 — initial definition*
