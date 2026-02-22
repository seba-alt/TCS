# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-02-22
**Milestone:** v2.3 Sage Evolution & Marketplace Intelligence
**Core Value:** A user describes any problem and instantly gets expertly matched professionals they can browse, filter, and contact — no searching, no guesswork.

## v1 Requirements

Requirements for v2.3 release. Each maps to roadmap phases.

### Sage Search

- [x] **SAGE-01**: Sage can find experts via a `search_experts` Gemini function that calls `/api/explore` in-process (direct Python import, no HTTP self-call)
- [x] **SAGE-02**: Sage search updates the main expert grid via filterSlice dispatch — single-ownership rule: `resultsSlice` written only by `useExplore`
- [x] **SAGE-03**: Sage narrates results in natural language after every function call ("I found 8 fintech experts who…" — no silent grid updates)
- [x] **SAGE-04**: Sage acknowledges zero-result searches and suggests alternatives or asks a clarifying question

### Sage Personality

- [ ] **SAGE-05**: Sage system prompt rewritten for warmer, wittier tone — hard cap of max 1 clarifying question per conversation; after any user reply to a question, Sage must call a function

### Sage FAB

- [ ] **FAB-01**: Sage FAB displays animated boxShadow pulse/glow on user activity via an outer `motion.div` wrapper (inner `motion.button` retains scale gesture props — no animation conflict)

### Tracking

- [ ] **TRACK-01**: Expert card click events tracked to DB (expert_id, context: grid or sage_panel) — fire-and-forget, never awaited in click path
- [ ] **TRACK-02**: Sage query interaction events tracked to DB (query_text, function_called, result_count) — emitted after each pilot response
- [ ] **TRACK-03**: Filter change events tracked to DB (filter name + value) — debounced 1s after settled state, not per slider tick

### Admin Intelligence

- [ ] **INTEL-01**: Admin Marketplace page shows unmet demand table (zero-result Sage queries sorted by frequency + underserved filter combos)
- [ ] **INTEL-02**: Admin Marketplace page shows expert exposure distribution (appears + click counts per expert, grid vs Sage context breakdown)
- [ ] **INTEL-03**: Admin Marketplace page shows daily Sage usage trend (Recharts BarChart)
- [ ] **INTEL-04**: Admin Marketplace page shows cold-start empty state with tracking start timestamp when `user_events` table is empty

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sage UX

- **SAGE-06**: Compact SageExpertCard mini-cards displayed inside the Sage 380px panel after a search_experts call
- **SAGE-07**: Proactive empty-state nudge — Sage FAB pulses and auto-injects a message when expert grid hits zero results and panel is closed (requires hasFetchedOnce + debounce guards)
- **SAGE-08**: Quick-reply chips for Sage clarifying questions (plain text questions acceptable for v2.3 fallback)

### Admin

- **INTEL-05**: Real-time Gaps dashboard (WebSocket/SSE polling) — retrospective analysis sufficient for v2.3
- **INTEL-06**: UMAP visualization for embedding space — heavy Railway build dependency, deferred

## Out of Scope

| Feature | Reason |
|---------|--------|
| Third-party analytics SDK (PostHog, Mixpanel, Segment) | SQLite user_events table sufficient at current scale (<10K daily events) |
| navigator.sendBeacon for tracking | Cannot send Content-Type: application/json; use fetch + keepalive: true |
| Alembic migrations | create_all handles new tables; ALTER TABLE in lifespan for existing table columns |
| Compact cards inside Sage panel (v2.3) | Text narrative + grid update is cleaner UX; compact cards deferred to v2 |
| Proactive empty-state nudge (v2.3) | Requires careful guard conditions; deferred to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAGE-01 | Phase 28 | Complete |
| SAGE-02 | Phase 28 | Complete |
| SAGE-03 | Phase 28 | Complete |
| SAGE-04 | Phase 28 | Complete |
| SAGE-05 | Phase 29 | Pending |
| FAB-01 | Phase 29 | Pending |
| TRACK-01 | Phase 30 | Pending |
| TRACK-02 | Phase 30 | Pending |
| TRACK-03 | Phase 30 | Pending |
| INTEL-01 | Phase 31 | Pending |
| INTEL-02 | Phase 31 | Pending |
| INTEL-03 | Phase 31 | Pending |
| INTEL-04 | Phase 31 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 — traceability finalized after roadmap creation (Phases 28-31)*
