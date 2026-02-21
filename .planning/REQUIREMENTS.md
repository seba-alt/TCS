# Requirements: Tinrate AI Concierge Chatbot

**Defined:** 2026-02-21
**Milestone:** v1.1 Expert Intelligence & Search Quality
**Core Value:** A user describes any problem and instantly gets three expertly matched professionals they can contact — no searching, no filtering, no guesswork.

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Expert Tagging

- [ ] **TAGS-01**: Admin can run an offline batch script that generates 3-8 domain tags for every one of the 1,558 experts using Gemini 2.5 Flash structured output (e.g., "crypto", "veterinary", "tax law", "machine learning")
- [x] **TAGS-02**: Tags are stored per expert in the SQLite Expert table as a JSON text column, validated against a structured schema on every LLM response
- [ ] **TAGS-03**: The FAISS ingest script reads from the Expert DB table (not experts.csv) and includes tag text in each expert's embedding input
- [ ] **TAGS-04**: FAISS index is rebuilt with all 1,558 experts (up from 530 currently indexed), validated by count assertion before promotion to production
- [ ] **TAGS-05**: When an admin adds a new expert via the admin dashboard, the system automatically generates domain tags and computes a findability score for that expert immediately (no manual batch run required)

### Findability Scoring

- [x] **FIND-01**: System computes a 0–100 findability score per expert based on a deterministic formula: bio presence/length (40 pts), tags present (25 pts), profile URL present (15 pts), job title present (10 pts), hourly rate present (10 pts)
- [x] **FIND-02**: Findability score is stored as a Float column on the Expert table in SQLite, added via idempotent schema migration
- [ ] **FIND-03**: Score computation runs automatically as part of the batch tagging script after tags are written

### Admin Expert Tab

- [ ] **ADMIN-01**: Admin Expert tab displays First Name and Last Name separately (replacing the current Username-based display)
- [ ] **ADMIN-02**: Admin Expert tab displays a bio preview (truncated to ~120 characters)
- [ ] **ADMIN-03**: Admin Expert tab displays the expert's profile URL as a clickable link
- [ ] **ADMIN-04**: Admin Expert tab displays each expert's domain tags as visual pills
- [ ] **ADMIN-05**: Admin Expert tab displays a color-coded findability score badge per expert: red (0–39), yellow (40–69), green (70–100)
- [ ] **ADMIN-06**: Admin Expert tab defaults to worst-first sort by findability score so lowest-quality profiles surface at the top

### Search Intelligence

- [ ] **SEARCH-01**: System generates a hypothetical expert bio matching each user query (HyDE) and blends it with the raw query embedding before FAISS search
- [ ] **SEARCH-02**: HyDE expansion is controlled by a `QUERY_EXPANSION_ENABLED` environment variable flag (can be disabled without a code change)
- [ ] **SEARCH-03**: HyDE expansion is skipped when the original query already returns strong results above the similarity threshold — only activates on weak matches
- [ ] **SEARCH-04**: System applies a soft feedback-weighted boost to retrieval results based on cumulative thumbs up/down votes per expert
- [ ] **SEARCH-05**: Feedback re-ranking requires a minimum of 10 interactions per expert before applying any boost, capped at 20% of similarity score
- [ ] **SEARCH-06**: Feedback re-ranking is controlled by a `FEEDBACK_LEARNING_ENABLED` environment variable flag
- [ ] **SEARCH-07**: Admin can view a domain map endpoint (`GET /api/admin/domain-map`) showing which expert tag domains appear most frequently in downvoted results

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Test Lab

- **TESTLAB-01**: Admin can run test queries against the live search engine from within the admin UI and see retrieval scores per result
- **TESTLAB-02**: Admin can compare retrieval results before/after a FAISS re-ingest from the test lab UI
- **TESTLAB-03**: Test lab shows gap rate trend over time

### Tag Management

- **TAGMGMT-01**: Admin can manually edit or add tags for an individual expert from the Expert tab
- **TAGMGMT-02**: Manual tag edits trigger a background FAISS re-ingest for that expert only

### Advanced Retrieval

- **ADV-01**: Multi-query RAG Fusion — generate multiple query reformulations and merge ranked results

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Embedding fine-tuning on feedback data | Google does not support fine-tuning text-embedding-004 or gemini-embedding-001; 50–200 votes is insufficient training data regardless |
| Real-time findability score recalculation | Score is a diagnostic tool for admins, not a live signal; batch recompute on demand is sufficient |
| Manual tag editing with FAISS sync in v1.1 | High complexity (mark-as-reviewed workflow + scheduled re-ingest); defer until manual correction need is proven by admin usage |
| Test lab UI in v1.1 | High UI complexity; feedback corpus will be too small at v1.1 launch to show meaningful signal; defer to v1.2 |
| Feedback score boosting niche experts (impression balancing) | Out of scope for v1.1; minimum interaction threshold (10) partially mitigates popularity bias |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TAGS-01 | Phase 8 | Pending |
| TAGS-02 | Phase 8 | Complete |
| TAGS-03 | Phase 8 | Pending |
| TAGS-04 | Phase 8 | Pending |
| TAGS-05 | Phase 8 | Pending |
| FIND-01 | Phase 8 | Complete |
| FIND-02 | Phase 8 | Complete |
| FIND-03 | Phase 8 | Pending |
| ADMIN-01 | Phase 9 | Pending |
| ADMIN-02 | Phase 9 | Pending |
| ADMIN-03 | Phase 9 | Pending |
| ADMIN-04 | Phase 9 | Pending |
| ADMIN-05 | Phase 9 | Pending |
| ADMIN-06 | Phase 9 | Pending |
| SEARCH-07 | Phase 9 | Pending |
| SEARCH-01 | Phase 10 | Pending |
| SEARCH-02 | Phase 10 | Pending |
| SEARCH-03 | Phase 10 | Pending |
| SEARCH-04 | Phase 10 | Pending |
| SEARCH-05 | Phase 10 | Pending |
| SEARCH-06 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 20
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 — traceability filled by roadmapper (Phases 8–10)*
